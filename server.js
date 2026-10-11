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
  max: 300,
  message: { success: false, message: 'İstek limiti aşıldı.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('GOLDENMATCH_OK'));

// Veri Havuzları
const users = new Map();         // tgId -> profil
const likes = new Map();         // tgId -> Set(beğenilenler)
const matches = new Map();       // matchId -> { id, user1, user2, paravan1, paravan2, messages: [], updatedAt }
const dailyPicks = new Map();    // tgId -> { targetId, date }
const reports = [];              // Profil ve Mesaj şikayet havuzu

// KURUCU (GİZLİ SÜPER ADMİN) & YT YÖNETİMİ
const FOUNDER_ID = String(process.env.FOUNDER_ID || '8245373459').trim().toLowerCase();
const FOUNDER_USERNAME = String(process.env.FOUNDER_USERNAME || 'breskavica').trim().toLowerCase().replace('@', '');

const initialAdminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim().toLowerCase());
const initialAdminUsernames = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase().replace('@', ''));

const adminIdSet = new Set(initialAdminIds.filter(Boolean));
const adminUsernameSet = new Set(initialAdminUsernames.filter(Boolean));

// Kurucuyu kalıcı yetkiye dahil et
if (FOUNDER_ID) adminIdSet.add(FOUNDER_ID);
if (FOUNDER_USERNAME) adminUsernameSet.add(FOUNDER_USERNAME);

// Güçlendirilmiş Büyük/Küçük Harf Duyarsız Yetki Sorgusu
function isUserAdmin(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');
  
  if (tid && (tid === FOUNDER_ID || adminIdSet.has(tid))) return true;
  if (uname && (uname === FOUNDER_USERNAME || adminUsernameSet.has(uname))) return true;
  return false;
}

function isFounder(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');
  return tid === FOUNDER_ID || uname === FOUNDER_USERNAME;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'golden_admin_2026';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// TELEGRAM BOT KOMUTLARI
if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch'e hoş geldin. Topluluktaki diğer üyelerle tanışmak, anonim sohbet etmek ve profilleri keşfetmek için dokun:`,
      Markup.inlineKeyboard([Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)])
    );
  });

  // Kurucuya Özel: /ytekle @kullaniciadi veya ID
  bot.command('ytekle', (ctx) => {
    const senderId = String(ctx.from.id).toLowerCase();
    const senderUname = String(ctx.from.username || '').toLowerCase();

    if (!isFounder(senderId, senderUname)) {
      return ctx.reply('⛔ Bu komutu sadece sistem kurucusu kullanabilir.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.reply('Kullanım: /ytekle @kullaniciadi veya /ytekle 123456789');

    const target = args[0].trim().toLowerCase().replace('@', '');
    if (isNaN(target)) {
      adminUsernameSet.add(target);
      console.log(`[BOT - YT Eklendi] Kullanıcı Adı: @${target}`);
      ctx.reply(`✅ @${target} başarıyla YT yetkilisi yapıldı. Artık şifresiz giriş yapabilir.`);
    } else {
      adminIdSet.add(target);
      console.log(`[BOT - YT Eklendi] Telegram ID: ${target}`);
      ctx.reply(`✅ ID: ${target} başarıyla YT yetkilisi yapıldı. Artık şifresiz giriş yapabilir.`);
    }
  });

  // Kurucuya Özel: /ytcikar @kullaniciadi veya ID
  bot.command('ytcikar', (ctx) => {
    const senderId = String(ctx.from.id).toLowerCase();
    const senderUname = String(ctx.from.username || '').toLowerCase();

    if (!isFounder(senderId, senderUname)) {
      return ctx.reply('⛔ Bu komutu sadece sistem kurucusu kullanabilir.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.reply('Kullanım: /ytcikar @kullaniciadi veya /ytcikar 123456789');

    const target = args[0].trim().toLowerCase().replace('@', '');
    if (isNaN(target)) {
      adminUsernameSet.delete(target);
      ctx.reply(`❌ @${target} YT yetkisi kaldırıldı.`);
    } else {
      adminIdSet.delete(target);
      ctx.reply(`❌ ID: ${target} YT yetkisi kaldırıldı.`);
    }
  });

  // Kurucuya Özel: /ytsorgu (KURUCU GİZLENMİŞ LİSTE)
  bot.command('ytsorgu', (ctx) => {
    const senderId = String(ctx.from.id).toLowerCase();
    const senderUname = String(ctx.from.username || '').toLowerCase();

    if (!isFounder(senderId, senderUname)) return ctx.reply('⛔ Yetkisiz işlem.');

    const visibleUsernames = Array.from(adminUsernameSet)
      .filter(u => u !== FOUNDER_USERNAME)
      .map(u => `@${u}`)
      .join(', ');

    const visibleIds = Array.from(adminIdSet)
      .filter(id => id !== FOUNDER_ID)
      .join(', ');

    ctx.reply(
      `👑 *Tanımlı Alt Yetkililer (YT):*\n\n` +
      `Kullanıcı Adları: ${visibleUsernames || 'Atanmış yetkili yok'}\n` +
      `ID'ler: ${visibleIds || 'Atanmış ID yok'}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Kurucuya Özel: /duyuru [mesaj]
  bot.command('duyuru', async (ctx) => {
    const senderId = String(ctx.from.id).toLowerCase();
    const senderUname = String(ctx.from.username || '').toLowerCase();

    if (!isFounder(senderId, senderUname)) return ctx.reply('⛔ Yetkisiz işlem.');

    const msg = ctx.message.text.replace('/duyuru', '').trim();
    if (!msg) return ctx.reply('Lütfen duyuru metnini girin: /duyuru [metin]');

    let count = 0;
    for (const u of users.values()) {
      try {
        await bot.telegram.sendMessage(u.telegramId, `📢 *GOLDENMATCH RESMİ DUYURU*\n\n${msg}`, { parse_mode: 'Markdown' });
        count++;
      } catch (e) {}
    }
    ctx.reply(`✅ Duyuru ${count} üyeye başarıyla gönderildi.`);
  });

  bot.launch().catch(err => console.error('Bot başlatma hatası:', err));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 1. API: Konumlar
app.get('/api/locations', (req, res) => res.json({ success: true, locations: LOCATIONS_DATA }));

// 2. API: Profil Sorgula
app.get('/api/profile/:id', (req, res) => {
  const tid = String(req.params.id);
  const uname = req.query.username || '';
  const profile = users.get(tid);
  const isAdmin = isUserAdmin(tid, uname);
  const founder = isFounder(tid, uname);
  if (profile) return res.json({ exists: true, profile, isAdmin, isFounder: founder });
  return res.json({ exists: false, isAdmin, isFounder: founder });
});

// 3. API: Profil Kaydet
app.post('/api/profile', async (req, res) => {
  try {
    const { telegramId, username, nickname, age, height, weight, role, interestedRole, city, district, archetype, expression, bio, photos } = req.body;
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
      archetype: archetype || 'Apollon',
      expression,
      bio,
      photos: photos || [],
      isVerified: false,
      isBanned: false,
      registeredAt: new Date().toISOString()
    };

    users.set(String(telegramId), newProfile);
    return res.json({ success: true, message: 'Kaydedildi.', profile: newProfile });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// 4. API: Hesap Silme
app.delete('/api/profile/:id', (req, res) => {
  const tid = String(req.params.id);
  if (!users.has(tid)) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

  users.delete(tid);
  likes.delete(tid);
  dailyPicks.delete(tid);

  for (const [mId, m] of matches.entries()) {
    if (m.user1 === tid || m.user2 === tid) matches.delete(mId);
  }
  for (const likeSet of likes.values()) likeSet.delete(tid);

  res.json({ success: true, message: 'Hesap silindi.' });
});

// 5. API: Keşfet Kartları
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

// 6. API: Günün Eşleşmesi
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

// 7. API: Beğeni / Eşleşme
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

// 8. API: DM Kutusu
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

// 9. API: Tekil Sohbet
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

// 10. API: Mesaj Gönder
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

// 11. API: Paravanı Aç
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

// 12. API: Eşleşmeyi İptal Et
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

// 13. API: Şikayet Et
app.post('/api/report', (req, res) => {
  const { reporterId, targetId, reason, selectedMessages } = req.body;
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
    evidenceMessages: selectedMessages || [],
    date: new Date().toLocaleString('tr-TR')
  };

  reports.unshift(reportItem);
  res.json({ success: true, message: 'Şikayet iletildi.' });
});

// 14. YT Yetki Middleware'i
function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const secretKey = req.headers['x-admin-key'] || req.query.key;

  if (isUserAdmin(requesterId, requesterUsername) || secretKey === ADMIN_SECRET) return next();
  return res.status(403).json({ success: false, message: 'Yetki reddedildi.' });
}

// YT Yetki Kontrolü (Web App Girişi İçin İyileştirildi)
app.post('/api/admin/verify', (req, res) => {
  const { telegramId, username, key } = req.body;
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');

  const isAdmin = isUserAdmin(tid, uname) || key === ADMIN_SECRET;
  const founder = isFounder(tid, uname);

  if (isAdmin) {
    return res.json({ success: true, isFounder: founder });
  }
  return res.status(403).json({ success: false, message: 'YT yetkisi bulunmuyor.' });
});

// YT Dashboard Verisi (KURUCU GİZLENMİŞ ŞEKİLDE)
app.get('/api/admin/dashboard-data', checkAdminAuth, (req, res) => {
  const userList = Array.from(users.values());
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  const visibleAdmins = {
    ids: Array.from(adminIdSet).filter(id => id !== FOUNDER_ID),
    usernames: Array.from(adminUsernameSet).filter(u => u !== FOUNDER_USERNAME)
  };

  res.json({
    success: true,
    isFounder: isFounder(requesterId, requesterUsername),
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned).length,
      banned: userList.filter(u => u.isBanned).length,
      reportsCount: reports.length
    },
    users: userList,
    reports: reports,
    admins: visibleAdmins
  });
});

// YT: Kullanıcı Banla / Aç
app.post('/api/admin/toggle-ban', checkAdminAuth, (req, res) => {
  const user = users.get(String(req.body.targetTelegramId));
  if (!user) return res.status(404).json({ success: false });
  user.isBanned = !user.isBanned;
  res.json({ success: true, isBanned: user.isBanned });
});

// YT: Ekleme/Çıkarma (Sadece Kurucu Yapabilir)
app.post('/api/admin/add-admin', checkAdminAuth, (req, res) => {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  if (!isFounder(requesterId, requesterUsername)) {
    return res.status(403).json({ success: false, message: 'Yalnızca kurucu yeni YT ekleyebilir.' });
  }

  const clean = String(req.body.target || '').trim().toLowerCase().replace('@', '');
  if (!clean) return res.status(400).json({ success: false, message: 'Geçersiz hedef.' });

  if (isNaN(clean)) adminUsernameSet.add(clean);
  else adminIdSet.add(clean);

  res.json({
    success: true,
    message: `${clean} başarıyla YT yapıldı.`,
    admins: {
      ids: Array.from(adminIdSet).filter(id => id !== FOUNDER_ID),
      usernames: Array.from(adminUsernameSet).filter(u => u !== FOUNDER_USERNAME)
    }
  });
});

app.post('/api/admin/remove-admin', checkAdminAuth, (req, res) => {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  if (!isFounder(requesterId, requesterUsername)) {
    return res.status(403).json({ success: false, message: 'Yalnızca kurucu YT yetkisini alabilir.' });
  }

  const clean = String(req.body.target || '').trim().toLowerCase().replace('@', '');
  if (isNaN(clean)) adminUsernameSet.delete(clean);
  else adminIdSet.delete(clean);

  res.json({
    success: true,
    message: `${clean} yetkisi kaldırıldı.`,
    admins: {
      ids: Array.from(adminIdSet).filter(id => id !== FOUNDER_ID),
      usernames: Array.from(adminUsernameSet).filter(u => u !== FOUNDER_USERNAME)
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GoldenMatch Sunucusu ${PORT} portunda aktif.`));
