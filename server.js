require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const { LOCATIONS_DATA, calculateExactDistance } = require('./cities');
const { verifyImageSafety } = require('./nsfwCheck');

const app = express();

// Güvenlik & Spam Koruması (Rate Limiter: Dakikada max 120 istek)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' }
});
app.use(limiter);

// Ayarlar ve Ara Yazılımlar
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// UptimeRobot / Canlılık Kontrolü
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 1. API: Şehir ve İlçe/Semt Listesi
app.get('/api/locations', (req, res) => {
  res.json({ success: true, locations: LOCATIONS_DATA });
});

// Bellek İçi Veri Depoları
const users = new Map();       // tgId -> profil
const likes = new Map();       // tgId -> Set(beğenilenTgIdler)
const matches = new Map();     // matchId -> { user1, user2, paravan1: bool, paravan2: bool, messages: [] }
const dailyPicks = new Map();  // tgId -> { targetId, date }

// Mini App ve Bot Ayarları
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'golden_admin_2026';
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch'e hoş geldin. Topluluktaki diğer üyelerle tanışmak ve profilleri keşfetmek için butona tıkla:`,
      Markup.inlineKeyboard([
        Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)
      ])
    );
  });

  bot.command(['match', 'ara', 'bul', 'tanis'], (ctx) => {
    ctx.reply(
      `🔥 Yeni insanlarla tanışmak ve sohbet etmek için GoldenMatch'e katılın!`,
      Markup.inlineKeyboard([
        Markup.button.webApp('✨ Eşleşmeye Başla', WEBAPP_URL)
      ])
    );
  });

  bot.launch()
    .then(() => console.log('Telegram Botu başarıyla devreye girdi.'))
    .catch((err) => console.error('Bot başlatma hatası:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// 2. API: Profil Bilgisi Kontrolü
app.get('/api/profile/:id', (req, res) => {
  const profile = users.get(String(req.params.id));
  if (profile) {
    return res.json({ exists: true, profile });
  }
  return res.json({ exists: false });
});

// 3. API: Profil Kaydet / Güncelle & NSFW Kontrolü
app.post('/api/profile', async (req, res) => {
  try {
    const {
      telegramId,
      username,
      nickname,
      age,
      height,
      weight,
      role,
      interestedRole,
      city,
      district,
      expression,
      bio,
      photos
    } = req.body;

    if (!telegramId || !city || !role) {
      return res.status(400).json({ success: false, message: 'Telegram ID, şehir ve rol zorunludur.' });
    }

    // NSFW / Çıplaklık Görsel Kontrolü
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
      username: username || '',
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
      updatedAt: new Date()
    };

    users.set(String(telegramId), newProfile);
    console.log(`Profil kaydedildi: ${nickname} [${city} / ${district || 'Merkez'}] - ${role}`);

    return res.json({ success: true, message: 'Profil başarıyla kaydedildi!', profile: newProfile });
  } catch (err) {
    console.error('Profil kayıt hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// 4. API: Keşfet Kartları & Semt/Şehir Mesafe Hesabı & Filtreleme
app.get('/api/cards', (req, res) => {
  const currentUserId = String(req.query.userId);
  const filterCity = req.query.city;
  const filterRole = req.query.role;

  const currentUser = users.get(currentUserId);
  const userLikes = likes.get(currentUserId) || new Set();

  const cards = [];
  for (const [id, user] of users.entries()) {
    if (id === currentUserId || userLikes.has(id) || user.isBanned) continue;

    // Şehir filtresi
    if (filterCity && filterCity !== 'Hepsi' && user.city !== filterCity) continue;

    // Rol filtresi
    if (filterRole && filterRole !== 'Hepsi' && user.role !== filterRole) continue;

    // Semt/Şehir koordinatlarına göre tam mesafe hesabı
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
    const distanceKm = calculateExactDistance(
      { city: currentUser.city, district: currentUser.district },
      { city: targetUser.city, district: targetUser.district }
    );
    return res.json({ success: true, dailyPick: { ...targetUser, distanceKm } });
  }

  const candidates = [];
  for (const [id, user] of users.entries()) {
    if (id === userId || user.isBanned) continue;
    if (currentUser.interestedRole !== 'Hepsi' && user.role !== currentUser.interestedRole) continue;
    candidates.push(user);
  }

  if (candidates.length === 0) {
    return res.json({ success: true, dailyPick: null });
  }

  // En yakın mesafedeki kullanıcıyı seç
  candidates.sort((a, b) => {
    const distA = calculateExactDistance(currentUser, a) ?? 9999;
    const distB = calculateExactDistance(currentUser, b) ?? 9999;
    return distA - distB;
  });

  const selected = candidates[0];
  dailyPicks.set(userId, { targetId: selected.telegramId, date: todayStr });

  const distanceKm = calculateExactDistance(currentUser, selected);
  return res.json({ success: true, dailyPick: { ...selected, distanceKm } });
});

// 6. API: Beğeni / Eşleşme ve Paravan Sohbet Başlatma
app.post('/api/like', async (req, res) => {
  const { fromUserId, toUserId, action } = req.body;
  const fromId = String(fromUserId);
  const toId = String(toUserId);

  if (!likes.has(fromId)) {
    likes.set(fromId, new Set());
  }
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
          user1: fromId,
          user2: toId,
          paravan1: false,
          paravan2: false,
          messages: []
        });
      }

      if (bot) {
        const user1 = users.get(fromId);
        const user2 = users.get(toId);

        try {
          await bot.telegram.sendMessage(
            fromId,
            `🎉 *Tebrikler, Eşleştiniz!*\n\n*${user2?.nickname || 'Biri'}* ile karşılıklı eşleştiniz. Uygulamaya girip anonim sohbete başlayabilirsiniz!`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error(`Eşleşme bildirimi hatası (${fromId}):`, e.message);
        }

        try {
          await bot.telegram.sendMessage(
            toId,
            `🎉 *Tebrikler, Eşleştiniz!*\n\n*${user1?.nickname || 'Biri'}* ile karşılıklı eşleştiniz. Uygulamaya girip anonim sohbete başlayabilirsiniz!`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error(`Eşleşme bildirimi hatası (${toId}):`, e.message);
        }
      }
    }
  }

  res.json({ success: true, isMatch, matchId });
});

// 7. API: Anonim Sohbet & Çift Onaylı "Paravanı Aç"
app.get('/api/chat/:matchId', (req, res) => {
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false, message: 'Eşleşme bulunamadı.' });
  res.json({ success: true, match });
});

app.post('/api/chat/:matchId/reveal', (req, res) => {
  const { userId } = req.body;
  const match = matches.get(req.params.matchId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });

  if (match.user1 === String(userId)) match.paravan1 = true;
  if (match.user2 === String(userId)) match.paravan2 = true;

  const bothRevealed = match.paravan1 && match.paravan2;
  const u1 = users.get(match.user1);
  const u2 = users.get(match.user2);

  res.json({
    success: true,
    bothRevealed,
    user1Tg: bothRevealed ? (u1?.username ? `@${u1.username}` : `ID: ${u1?.telegramId}`) : null,
    user2Tg: bothRevealed ? (u2?.username ? `@${u2.username}` : `ID: ${u2?.telegramId}`) : null
  });
});

// 8. API: Yönetici (Admin) Paneli
app.get('/api/admin/users', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: 'Yetkisiz erişim.' });
  }

  const userList = Array.from(users.values()).map((u) => ({
    telegramId: u.telegramId,
    username: u.username,
    nickname: u.nickname,
    city: u.city,
    district: u.district,
    role: u.role,
    isBanned: u.isBanned,
    createdAt: u.updatedAt
  }));

  res.json({ success: true, total: userList.length, users: userList });
});

// Port Dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GoldenMatch sunucusu ${PORT} portunda aktif.`);
});
