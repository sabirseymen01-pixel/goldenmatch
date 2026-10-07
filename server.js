require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const { LOCATIONS_DATA, calculateExactDistance } = require('./cities');
const { verifyImageSafety } = require('./nsfwCheck');

const app = express();

// Güvenlik & Spam Koruması
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: { success: false, message: 'Çok fazla istek yapıldı. Lütfen bekleyin.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// UptimeRobot / Canlılık Kontrolü
app.get('/health', (req, res) => res.status(200).send('OLYMPUS_ALIVE'));

// Bellek İçi Veri Depoları
const users = new Map();       // tgId -> profil nesnesi
const likes = new Map();       // tgId -> Set(beğenilenler)
const matches = new Map();     // matchId -> { user1, user2, paravan1, paravan2, messages }
const dailyPicks = new Map();  // tgId -> { targetId, date }

// Mini App ve Bot Yapılandırması
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'olympus_admin_777';
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `🏛️ Hoş Geldin ${ctx.from.first_name}!\n\nGoldenMatch Panteonu'na adım attın. Kaderindeki eşleşmeyi bulmak ve Olimpos meclisine katılmak için butona dokun:`,
      Markup.inlineKeyboard([
        Markup.button.webApp('⚡ GoldenMatch\'e Gir', WEBAPP_URL)
      ])
    );
  });

  bot.command(['match', 'ara', 'tanis'], (ctx) => {
    ctx.reply(
      '🏛️ Altın Çağın Eşleşmeleri seni bekliyor:',
      Markup.inlineKeyboard([Markup.button.webApp('✨ Keşfet', WEBAPP_URL)])
    );
  });

  bot.launch()
    .then(() => console.log('⚡ Telegram Botu aktif.'))
    .catch((err) => console.error('Bot başlatma hatası:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 1. API: Konumlar (Şehir ve Semtler)
app.get('/api/locations', (req, res) => {
  res.json({ success: true, locations: LOCATIONS_DATA });
});

// 2. API: Profil Kontrolü
app.get('/api/profile/:id', (req, res) => {
  const profile = users.get(String(req.params.id));
  if (profile) return res.json({ exists: true, profile });
  return res.json({ exists: false });
});

// 3. API: Profil Kaydetme & NSFW Denetimi
app.post('/api/profile', async (req, res) => {
  try {
    const {
      telegramId, username, nickname, age, height, weight,
      role, interestedRole, city, district, archetype, bio, photos
    } = req.body;

    if (!telegramId || !city || !role) {
      return res.status(400).json({ success: false, message: 'ID, şehir ve rol zorunludur.' });
    }

    // NSFW / Çıplaklık AI Denetimi
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
      archetype: archetype || 'Apollon', // Mistik Tema: Apollon, Afrodit, Ares, Hermes vb.
      bio,
      photos: photos || [],
      isBanned: false,
      photoApproved: true,
      registeredAt: new Date().toISOString()
    };

    users.set(String(telegramId), newProfile);
    console.log(`[Yeni Kayıt] ${nickname} (@${newProfile.username || 'gizli'}) - ${city}`);

    return res.json({ success: true, message: 'Kutsal profil mühürlendi!', profile: newProfile });
  } catch (err) {
    console.error('Kayıt Hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// 4. API: Keşfet Kartları & İl/İlçe Koordinat Mesafesi
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

// 5. API: Günün Eşleşmesi (Daily Pick)
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

// 6. API: Beğeni / Eşleşme
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
        matches.set(matchId, { user1: fromId, user2: toId, paravan1: false, paravan2: false });
      }

      if (bot) {
        const u1 = users.get(fromId);
        const u2 = users.get(toId);
        try {
          await bot.telegram.sendMessage(fromId, `🏛️ *Altın Kader Eşleşti!*\n*${u2?.nickname}* ile karşılıklı beğendiniz! Olimpos Meclisi'ne girip anonim sohbete başlayabilirsin.`, { parse_mode: 'Markdown' });
          await bot.telegram.sendMessage(toId, `🏛️ *Altın Kader Eşleşti!*\n*${u1?.nickname}* ile karşılıklı beğendiniz! Olimpos Meclisi'ne girip anonim sohbete başlayabilirsin.`, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error('Bot bildirim hatası:', e.message);
        }
      }
    }
  }

  res.json({ success: true, isMatch, matchId });
});

// 7. YÖNETİCİ (ADMIN) API'LERİ
// Middleware: Admin Yetki Kontrolü
function checkAdminAuth(req, res, next) {
  const secret = req.headers['x-admin-key'] || req.query.key;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: 'Yönetici yetkisi reddedildi.' });
  }
  next();
}

// Admin: Genel Durum ve Kullanıcı Listesi
app.get('/api/admin/dashboard', checkAdminAuth, (req, res) => {
  const userList = Array.from(users.values());
  const activeCount = userList.filter(u => !u.isBanned).length;
  const bannedCount = userList.filter(u => u.isBanned).length;

  res.json({
    success: true,
    stats: {
      totalUsers: userList.length,
      activeUsers: activeCount,
      bannedUsers: bannedCount,
      totalMatches: matches.size
    },
    users: userList.map(u => ({
      telegramId: u.telegramId,
      username: u.username || 'Gizli',
      nickname: u.nickname,
      age: u.age,
      city: u.city,
      district: u.district,
      role: u.role,
      archetype: u.archetype,
      photoCount: u.photos?.length || 0,
      photos: u.photos,
      isBanned: u.isBanned,
      registeredAt: u.registeredAt
    }))
  });
});

// Admin: Kullanıcı Yasakla / Yasağı Kaldır
app.post('/api/admin/toggle-ban', checkAdminAuth, (req, res) => {
  const { targetTelegramId } = req.body;
  const user = users.get(String(targetTelegramId));
  if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

  user.isBanned = !user.isBanned;
  users.set(String(targetTelegramId), user);

  res.json({ success: true, isBanned: user.isBanned, message: `Kullanıcı durumu: ${user.isBanned ? 'Yasaklandı' : 'Aktif'}` });
});

// Sunucuyu Dinle
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ GoldenMatch Olympus ${PORT} portunda aktif.`));
