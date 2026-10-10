require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const { LOCATIONS_DATA, calculateExactDistance } = require('./cities');
const { verifyImageSafety } = require('./nsfwCheck');

const app = express();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 250,
  message: { success: false, message: 'İstek limiti aşıldı.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('GOLDENMATCH_OK'));

// Veri Depoları
const users = new Map();         // tgId -> profil nesnesi
const likes = new Map();         // tgId -> Set(beğenilenler)
const matches = new Map();       // matchId -> { id, user1, user2, paravan1, paravan2, messages: [], updatedAt }
const dailyPicks = new Map();    // tgId -> { targetId, date }
const reports = [];              // Şikayet havuzu

const initialAdminIds = (process.env.ADMIN_IDS || '999999999').split(',').map(s => s.trim().toLowerCase());
const initialAdminUsernames = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase().replace('@', ''));

const adminIdSet = new Set(initialAdminIds.filter(Boolean));
const adminUsernameSet = new Set(initialAdminUsernames.filter(Boolean));

function isUserAdmin(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');
  return (tid && adminIdSet.has(tid)) || (uname && adminUsernameSet.has(uname));
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'golden_admin_2026';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch'e hoş geldin. Topluluktaki diğer üyelerle tanışmak, anonim sohbet etmek ve profilleri keşfetmek için butona tıkla:`,
      Markup.inlineKeyboard([Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)])
    );
  });
  bot.launch().catch(err => console.error('Bot hatası:', err));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 1. Konumlar
app.get('/api/locations', (req, res) => res.json({ success: true, locations: LOCATIONS_DATA }));

// 2. Profil Sorgula
app.get('/api/profile/:id', (req, res) => {
  const tid = String(req.params.id);
  const uname = req.query.username || '';
  const profile = users.get(tid);
  const isAdmin = isUserAdmin(tid, uname);
  if (profile) return res.json({ exists: true, profile, isAdmin });
  return res.json({ exists: false, isAdmin });
});

// 3. Profil Kaydet / Güncelle
app.post('/api/profile', async (req, res) => {
  try {
    const { telegramId, username, nickname, age, height, weight, role, interestedRole, city, district, expression, bio, photos } = req.body;
    if (!telegramId || !city || !role) return res.status(400).json({ success: false, message: 'Eksik bilgi.' });

    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const check = await verifyImageSafety(photo);
        if (!check.safe) return res.status(400).json({ success: false, message: check.reason });
      }
    }

    const newProfile = {
      telegramId: String(telegramId),
      username: username ? username.replace('@', '') : '',
      nickname,
      age: Number(age),
      height: Number(height) || null,
      weight: Number(weight) || null,
      role,
      interestedRole: interestedRole || 'Hepsi',
      city,
      district: district || '',
      expression,
      bio,
      photos: photos || [],
      isBanned: false,
      registeredAt: new Date().toISOString()
    };

    users.set(String(telegramId), newProfile);
    return res.json({ success: true, message: 'Kaydedildi.', profile: newProfile });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// 4. HESAP SİLME SİSTEMİ (Tüm bağlı verileriyle sıfırlama)
app.delete('/api/profile/:id', (req, res) => {
  const tid = String(req.params.id);
  
  if (!users.has(tid)) {
    return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  }

  // Kullanıcı profilini sil
  users.delete(tid);
  likes.delete(tid);
  dailyPicks.delete(tid);

  // Bu kullanıcıya ait tüm eşleşmeleri ve sohbetleri temizle
  for (const [mId, m] of matches.entries()) {
    if (m.user1 === tid || m.user2 === tid) {
      matches.delete(mId);
    }
  }

  // Diğer kullanıcıların beğeni listesinden bu kullanıcıyı temizle
  for (const likeSet of likes.values()) {
    likeSet.delete(tid);
  }

  console.log(`[HESAP SİLİNDİ] ID: ${tid}`);
  res.json({ success: true, message: 'Hesabınız ve tüm verileriniz kalıcı olarak silindi.' });
});

// 5. Keşfet Kartları
app.get('/api/cards', (req, res) => {
  const currentUserId = String(req.query.userId);
  const filterCity = req.query.city;
  const filterRole = req.query.role;
  const currentUser = users.get(currentUserId);
  const userLikes = likes.get(currentUserId) || new Set();

  const cards = [];
  for (const [id, user] of users.entries()) {
    if (id === currentUserId || userLikes.has(id) || user.isBanned) continue;
    if (filterCity && filterCity !== 'Hepsi' && user.city !== filterCity) continue;
    if (filterRole && filterRole !== 'Hepsi' && user.role !== filterRole) continue;

    let distanceKm = null;
    if (currentUser?.city && user.city) {
      distanceKm = calculateExactDistance(
        { city: currentUser.city, district: currentUser.district },
        { city: user.city, district: user.district }
      );
    }
    cards.push({ ...user, distanceKm });
  }
  res.json({ success: true, cards });
});

// 6. Günün Eşleşmesi
app.get('/api/daily-pick', (req, res) => {
  const userId = String(req.query.userId);
  const currentUser = users.get(userId);
  if (!currentUser) return res.status(404).json({ success: false });

  const todayStr = new Date().toISOString().slice(0, 10);
  const cached = dailyPicks.get(userId);
  if (cached && cached.date === todayStr && users.has(cached.targetId)) {
    const target = users.get(cached.targetId);
    return res.json({ success: true, dailyPick: { ...target, distanceKm: calculateExactDistance(currentUser, target) } });
  }

  const candidates = [];
  for (const [id, user] of users.entries()) {
    if (id === userId || user.isBanned) continue;
    if (currentUser.interestedRole !== 'Hepsi' && user.role !== currentUser.interestedRole) continue;
    candidates.push(user);
  }
  if (!candidates.length) return res.json({ success: true, dailyPick: null });

  candidates.sort((a, b) => (calculateExactDistance(currentUser, a) ?? 9999) - (calculateExactDistance(currentUser, b) ?? 9999));
  const picked = candidates[0];
  dailyPicks.set(userId, { targetId: picked.telegramId, date: todayStr });
  res.json({ success: true, dailyPick: { ...picked, distanceKm: calculateExactDistance(currentUser, picked) } });
});

// 7. Beğeni / Eşleşme
app.post('/api/like', async (req, res) => {
  const { fromUserId, toUserId, action } = req.body;
  const fromId = String(fromUserId);
  const toId = String(toUserId);

  if (!likes.has(fromId)) likes.set(fromId, new Set());
  likes.get(fromId).add(toId);

  let isMatch = false;
  let matchId = null;

  if (action === 'like') {
    const targetLikes = likes.get(toId);
    if (targetLikes && targetLikes.has(fromId)) {
      isMatch = true;
      matchId = [fromId, toId].sort().join('_');
      if (!matches.has(matchId)) {
        matches.set(matchId, {
          id: matchId,
          user1: fromId,
          user2: toId,
          paravan1: false,
          paravan2: false,
          messages: [],
          updatedAt: new Date().toISOString()
        });
      }

      if (bot) {
        const u1 = users.get(fromId);
        const u2 = users.get(toId);
        try {
          await bot.telegram.sendMessage(fromId, `🎉 *Tebrikler, Eşleştiniz!*\n\n*${u2?.nickname || 'Biri'}* ile karşılıklı beğendiniz! DM kutusundan sohbete başlayabilirsin.`);
          await bot.telegram.sendMessage(toId, `🎉 *Tebrikler, Eşleştiniz!*\n\n*${u1?.nickname || 'Biri'}* ile karşılıklı beğendiniz! DM kutusundan sohbete başlayabilirsin.`);
        } catch (e) {}
      }
    }
  }
  res.json({ success: true, isMatch, matchId });
});

// 8. DM Kutusu
app.get('/api/chats', (req, res) => {
  const userId = String(req.query.userId);
  const userChats = [];

  for (const match of matches.values()) {
    if (match.user1 === userId || match.user2 === userId) {
      const partnerId = match.user1 === userId ? match.user2 : match.user1;
      const partner = users.get(partnerId);
      const isMyParavanOpen = match.user1 === userId ? match.paravan1 : match.paravan2;
      const bothRevealed = match.paravan1 && match.paravan2;
      const lastMsg = match.messages[match.messages.length - 1];

      userChats.push({
        matchId: match.id,
        partner: {
          telegramId: partnerId,
          nickname: partner?.nickname || 'Kullanıcı',
          avatar: partner?.photos?.[0] || '',
          city: partner?.city || '',
          role: partner?.role || '',
          username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
        },
        bothRevealed,
        myParavanRequested: isMyParavanOpen,
        lastMessage: lastMsg ? lastMsg.text : 'Yeni eşleşme! Selam ver ✨',
        lastMessageTime: lastMsg ? lastMsg.time : match.updatedAt,
        unread: lastMsg ? (lastMsg.senderId !== userId && !lastMsg.read) : true
      });
    }
  }

  userChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  res.json({ success: true, chats: userChats, totalUnread: userChats.filter(c => c.unread).length });
});

// 9. Tekil Sohbet
app.get('/api/chats/:matchId', (req, res) => {
  const match = matches.get(req.params.matchId);
  const userId = String(req.query.userId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });

  match.messages.forEach(m => { if (m.senderId !== userId) m.read = true; });
  const partnerId = match.user1 === userId ? match.user2 : match.user1;
  const partner = users.get(partnerId);
  const bothRevealed = match.paravan1 && match.paravan2;

  res.json({
    success: true,
    matchId: match.id,
    partner: {
      telegramId: partnerId,
      nickname: partner?.nickname || 'Kullanıcı',
      avatar: partner?.photos?.[0] || '',
      username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID: ${partnerId}`) : null
    },
    bothRevealed,
    myParavanRequested: match.user1 === userId ? match.paravan1 : match.paravan2,
    messages: match.messages
  });
});

// 10. Mesaj Gönder
app.post('/api/chats/:matchId/message', (req, res) => {
  const { senderId, text } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match || !text?.trim()) return res.status(400).json({ success: false });

  const msg = {
    id: Date.now().toString(),
    senderId: String(senderId),
    text: text.trim().slice(0, 500),
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    read: false
  };

  match.messages.push(msg);
  match.updatedAt = new Date().toISOString();
  res.json({ success: true, message: msg });
});

// 11. Paravanı Aç
app.post('/api/chats/:matchId/reveal', (req, res) => {
  const { userId } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false });

  if (match.user1 === String(userId)) match.paravan1 = true;
  if (match.user2 === String(userId)) match.paravan2 = true;

  const bothRevealed = match.paravan1 && match.paravan2;
  const partnerId = match.user1 === String(userId) ? match.user2 : match.user1;
  const partner = users.get(partnerId);

  res.json({
    success: true,
    bothRevealed,
    partnerUsername: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
  });
});

// 12. Eşleşmeyi İptal Et
app.post('/api/chats/:matchId/unmatch', (req, res) => {
  const { userId } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false });

  const partnerId = match.user1 === String(userId) ? match.user2 : match.user1;
  matches.delete(req.params.matchId);
  likes.get(String(userId))?.delete(partnerId);
  likes.get(partnerId)?.delete(String(userId));

  res.json({ success: true, message: 'Eşleşme iptal edildi.' });
});

// 13. Şikayet Et
app.post('/api/report', (req, res) => {
  const { reporterId, targetId, reason } = req.body;
  if (!targetId || !reason?.trim()) return res.status(400).json({ success: false });

  const targetUser = users.get(String(targetId));
  const reporterUser = users.get(String(reporterId));

  const reportItem = {
    id: Date.now().toString(),
    targetId: String(targetId),
    targetNickname: targetUser?.nickname || 'Bilinmiyor',
    targetUsername: targetUser?.username || 'Gizli',
    reporterId: String(reporterId),
    reporterNickname: reporterUser?.nickname || 'Anonim',
    reason: reason.trim(),
    date: new Date().toLocaleString('tr-TR')
  };

  reports.unshift(reportItem);
  res.json({ success: true });
});

// 14. YT Paneli API'leri
function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const secretKey = req.headers['x-admin-key'] || req.query.key;

  if (isUserAdmin(requesterId, requesterUsername) || secretKey === ADMIN_SECRET) return next();
  return res.status(403).json({ success: false });
}

app.post('/api/admin/verify', (req, res) => {
  const { telegramId, username, key } = req.body;
  if (isUserAdmin(telegramId, username) || key === ADMIN_SECRET) return res.json({ success: true });
  return res.status(403).json({ success: false });
});

app.get('/api/admin/dashboard-data', checkAdminAuth, (req, res) => {
  const userList = Array.from(users.values());
  res.json({
    success: true,
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned).length,
      banned: userList.filter(u => u.isBanned).length,
      reportsCount: reports.length
    },
    users: userList,
    reports: reports,
    admins: { ids: Array.from(adminIdSet), usernames: Array.from(adminUsernameSet) }
  });
});

app.post('/api/admin/toggle-ban', checkAdminAuth, (req, res) => {
  const user = users.get(String(req.body.targetTelegramId));
  if (!user) return res.status(404).json({ success: false });
  user.isBanned = !user.isBanned;
  res.json({ success: true, isBanned: user.isBanned });
});

app.post('/api/admin/add-admin', checkAdminAuth, (req, res) => {
  const clean = req.body.target?.trim().toLowerCase();
  if (clean.startsWith('@') || isNaN(clean)) adminUsernameSet.add(clean.replace('@', ''));
  else adminIdSet.add(clean);
  res.json({ success: true, admins: { ids: Array.from(adminIdSet), usernames: Array.from(adminUsernameSet) } });
});

app.post('/api/admin/remove-admin', checkAdminAuth, (req, res) => {
  const clean = req.body.target?.trim().toLowerCase();
  if (clean.startsWith('@') || isNaN(clean)) adminUsernameSet.delete(clean.replace('@', ''));
  else adminIdSet.delete(clean);
  res.json({ success: true, admins: { ids: Array.from(adminIdSet), usernames: Array.from(adminUsernameSet) } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GoldenMatch Sunucusu ${PORT} portunda aktif.`));
