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
  max: 200,
  message: { success: false, message: 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('GOLDENMATCH_OK'));

// Veri Havuzları
const users = new Map();         // tgId -> profil nesnesi
const likes = new Map();         // tgId -> Set(beğenilenler)
const matches = new Map();       // matchId -> { id, user1, user2, paravan1, paravan2, messages: [], updatedAt }
const dailyPicks = new Map();    // tgId -> { targetId, date }

// YÖNETİCİ (YT) LİSTELERİ - Dinamik Olarak Yönetilebilir Set Yapısı
// .env içerisinde virgülle ayrılmış ID'ler veya kullanıcı adları belirtilebilir:
// Örnek: ADMIN_IDS="123456789"
// Örnek: ADMIN_USERNAMES="sabirseymen,baskabiryt"
const initialAdminIds = (process.env.ADMIN_IDS || '999999999').split(',').map(s => s.trim().toLowerCase());
const initialAdminUsernames = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase().replace('@', ''));

const adminIdSet = new Set(initialAdminIds.filter(Boolean));
const adminUsernameSet = new Set(initialAdminUsernames.filter(Boolean));

// Yönetici Yetki Doğrulama Fonksiyonu
function isUserAdmin(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');

  if (tid && adminIdSet.has(tid)) return true;
  if (uname && adminUsernameSet.has(uname)) return true;
  return false;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'golden_admin_2026';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch'e hoş geldin. Topluluktaki diğer üyelerle tanışmak, anonim sohbet etmek ve profilleri keşfetmek için butona tıkla:`,
      Markup.inlineKeyboard([
        Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)
      ])
    );
  });

  bot.command(['match', 'ara', 'bul', 'tanis'], (ctx) => {
    ctx.reply(
      `🔥 Yeni insanlarla tanışmak için GoldenMatch Mini App'e katıl!`,
      Markup.inlineKeyboard([Markup.button.webApp('✨ Eşleşmeye Başla', WEBAPP_URL)])
    );
  });

  bot.launch()
    .then(() => console.log('Telegram Botu aktif.'))
    .catch((err) => console.error('Bot başlatma hatası:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 1. API: Konumlar
app.get('/api/locations', (req, res) => {
  res.json({ success: true, locations: LOCATIONS_DATA });
});

// 2. API: Profil Sorgula
app.get('/api/profile/:id', (req, res) => {
  const tid = String(req.params.id);
  const username = req.query.username || '';
  const profile = users.get(tid);
  const isAdmin = isUserAdmin(tid, username);

  if (profile) return res.json({ exists: true, profile, isAdmin });
  return res.json({ exists: false, isAdmin });
});

// 3. API: Profil Kaydet
app.post('/api/profile', async (req, res) => {
  try {
    const {
      telegramId, username, nickname, age, height, weight,
      role, interestedRole, city, district, expression, bio, photos
    } = req.body;

    if (!telegramId || !city || !role) {
      return res.status(400).json({ success: false, message: 'Telegram ID, şehir ve rol zorunludur.' });
    }

    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const check = await verifyImageSafety(photo);
        if (!check.safe) {
          return res.status(400).json({ success: false, message: check.reason });
        }
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
    console.log(`[Yeni Kayıt] ${nickname} (@${newProfile.username || 'gizli'}) [${telegramId}]`);

    return res.json({ success: true, message: 'Profil başarıyla kaydedildi!', profile: newProfile });
  } catch (err) {
    console.error('Kayıt Hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// 4. API: Keşfet Kartları & KM Mesafe
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

// 5. API: Günün Eşleşmesi
app.get('/api/daily-pick', (req, res) => {
  const userId = String(req.query.userId);
  const currentUser = users.get(userId);
  if (!currentUser) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

  const todayStr = new Date().toISOString().slice(0, 10);
  const cachedPick = dailyPicks.get(userId);

  if (cachedPick && cachedPick.date === todayStr && users.has(cachedPick.targetId)) {
    const targetUser = users.get(cachedPick.targetId);
    const distanceKm = calculateExactDistance(currentUser, targetUser);
    return res.json({ success: true, dailyPick: { ...targetUser, distanceKm } });
  }

  const candidates = [];
  for (const [id, user] of users.entries()) {
    if (id === userId || user.isBanned) continue;
    if (currentUser.interestedRole !== 'Hepsi' && user.role !== currentUser.interestedRole) continue;
    candidates.push(user);
  }

  if (candidates.length === 0) return res.json({ success: true, dailyPick: null });

  candidates.sort((a, b) => (calculateExactDistance(currentUser, a) ?? 9999) - (calculateExactDistance(currentUser, b) ?? 9999));
  const selected = candidates[0];
  dailyPicks.set(userId, { targetId: selected.telegramId, date: todayStr });

  const distanceKm = calculateExactDistance(currentUser, selected);
  return res.json({ success: true, dailyPick: { ...selected, distanceKm } });
});

// 6. API: Beğeni & Eşleşme
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
          await bot.telegram.sendMessage(fromId, `🎉 *Tebrikler, Eşleştiniz!*\n\n*${u2?.nickname || 'Biri'}* ile karşılıklı beğendiniz! GoldenMatch DM kutusundan anonim sohbete başlayabilirsin.`);
          await bot.telegram.sendMessage(toId, `🎉 *Tebrikler, Eşleştiniz!*\n\n*${u1?.nickname || 'Biri'}* ile karşılıklı beğendiniz! GoldenMatch DM kutusundan anonim sohbete başlayabilirsin.`);
        } catch (e) {
          console.error('Bot bildirim hatası:', e.message);
        }
      }
    }
  }

  res.json({ success: true, isMatch, matchId });
});

// 7. API: DM Kutusu
app.get('/api/chats', (req, res) => {
  const userId = String(req.query.userId);
  const userChats = [];

  for (const match of matches.values()) {
    if (match.user1 === userId || match.user2 === userId) {
      const partnerId = match.user1 === userId ? match.user2 : match.user1;
      const partner = users.get(partnerId);

      const isMyParavanOpen = match.user1 === userId ? match.paravan1 : match.paravan2;
      const isPartnerParavanOpen = match.user1 === userId ? match.paravan2 : match.paravan1;
      const bothRevealed = match.paravan1 && match.paravan2;

      const lastMsg = match.messages.length > 0 ? match.messages[match.messages.length - 1] : null;

      userChats.push({
        matchId: match.id,
        partner: {
          telegramId: partnerId,
          nickname: partner?.nickname || 'Kullanıcı',
          avatar: partner?.photos?.[0] || '',
          city: partner?.city || '',
          district: partner?.district || '',
          role: partner?.role || '',
          username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
        },
        bothRevealed,
        myParavanRequested: isMyParavanOpen,
        partnerParavanRequested: isPartnerParavanOpen,
        lastMessage: lastMsg ? lastMsg.text : 'Yeni eşleşme! Selam ver ✨',
        lastMessageTime: lastMsg ? lastMsg.time : match.updatedAt,
        unread: lastMsg ? (lastMsg.senderId !== userId && !lastMsg.read) : true
      });
    }
  }

  userChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  const totalUnread = userChats.filter(c => c.unread).length;
  res.json({ success: true, chats: userChats, totalUnread });
});

// 8. API: Tekil Sohbet
app.get('/api/chats/:matchId', (req, res) => {
  const match = matches.get(req.params.matchId);
  const userId = String(req.query.userId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });

  match.messages.forEach(m => {
    if (m.senderId !== userId) m.read = true;
  });

  const partnerId = match.user1 === userId ? match.user2 : match.user1;
  const partner = users.get(partnerId);
  const bothRevealed = match.paravan1 && match.paravan2;
  const myParavanRequested = match.user1 === userId ? match.paravan1 : match.paravan2;

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
    myParavanRequested,
    messages: match.messages
  });
});

// 9. API: Mesaj Gönder
app.post('/api/chats/:matchId/message', (req, res) => {
  const { senderId, text } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Mesaj boş olamaz.' });

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

// 10. API: Paravanı Aç
app.post('/api/chats/:matchId/reveal', (req, res) => {
  const { userId } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });

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

// ----------------------------------------------------
// 11. YÖNETİCİ (YT) PANELİ VE DİNAMİK YETKİ UÇ NOKTALARI
// ----------------------------------------------------

function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const secretKey = req.headers['x-admin-key'] || req.query.key;

  if (isUserAdmin(requesterId, requesterUsername) || secretKey === ADMIN_SECRET) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Erişim engellendi: Yetkili (YT) değilsiniz.' });
}

// YT Yetki Kontrolü (Kayıt olmadan kontrol eder)
app.post('/api/admin/verify', (req, res) => {
  const { telegramId, username, key } = req.body;
  const authorized = isUserAdmin(telegramId, username) || key === ADMIN_SECRET;

  if (authorized) {
    return res.json({ success: true, message: 'Yönetici yetkisi onaylandı.' });
  }
  return res.status(403).json({ success: false, message: 'Bu Telegram hesabına ait YT yetkisi bulunmuyor.' });
});

// YT: Tüm Kullanıcıları, Sohbet Sayısını ve Yönetici Listesini Getir
app.get('/api/admin/dashboard-data', checkAdminAuth, (req, res) => {
  const userList = Array.from(users.values());
  res.json({
    success: true,
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned).length,
      banned: userList.filter(u => u.isBanned).length,
      matches: matches.size
    },
    users: userList,
    admins: {
      ids: Array.from(adminIdSet),
      usernames: Array.from(adminUsernameSet)
    }
  });
});

// YT: Kullanıcı Banla / Yasağı Kaldır
app.post('/api/admin/toggle-ban', checkAdminAuth, (req, res) => {
  const { targetTelegramId } = req.body;
  const user = users.get(String(targetTelegramId));
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

  user.isBanned = !user.isBanned;
  res.json({ success: true, isBanned: user.isBanned });
});

// YT: Yeni Yönetici Ekle (Kullanıcı adı veya ID ile)
app.post('/api/admin/add-admin', checkAdminAuth, (req, res) => {
  const { target } = req.body; // Örnek: "@ahmet" veya "123456789"
  if (!target || !target.trim()) return res.status(400).json({ success: false, message: 'Hedef belirtilmelidir.' });

  const clean = target.trim().toLowerCase();
  if (clean.startsWith('@') || isNaN(clean)) {
    const uName = clean.replace('@', '');
    adminUsernameSet.add(uName);
    console.log(`[YT Eklendi] Kullanıcı Adı: @${uName}`);
  } else {
    adminIdSet.add(clean);
    console.log(`[YT Eklendi] Telegram ID: ${clean}`);
  }

  res.json({
    success: true,
    message: 'Yeni yönetici başarıyla eklendi.',
    admins: { ids: Array.from(adminIdSet), usernames: Array.from(adminUsernameSet) }
  });
});

// YT: Yönetici Çıkar (Yetkiyi Al)
app.post('/api/admin/remove-admin', checkAdminAuth, (req, res) => {
  const { target } = req.body;
  if (!target || !target.trim()) return res.status(400).json({ success: false, message: 'Hedef belirtilmelidir.' });

  const clean = target.trim().toLowerCase();
  if (clean.startsWith('@') || isNaN(clean)) {
    const uName = clean.replace('@', '');
    adminUsernameSet.delete(uName);
    console.log(`[YT Çıkarıldı] Kullanıcı Adı: @${uName}`);
  } else {
    adminIdSet.delete(clean);
    console.log(`[YT Çıkarıldı] Telegram ID: ${clean}`);
  }

  res.json({
    success: true,
    message: 'Yönetici yetkisi kaldırıldı.',
    admins: { ids: Array.from(adminIdSet), usernames: Array.from(adminUsernameSet) }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GoldenMatch Sunucusu ${PORT} portunda aktif.`));
