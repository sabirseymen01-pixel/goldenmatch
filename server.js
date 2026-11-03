require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const { LOCATIONS_DATA, calculateExactDistance } = require('./cities');
const { verifyImageSafety } = require('./nsfwCheck');

let Server;
try {
  Server = require('socket.io').Server;
} catch (e) {
  console.warn('⚠️ socket.io modülü yüklenemedi.');
}

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.get('/health', (req, res) => res.status(200).send('GOLDENMATCH_OK'));

let io = null;
if (Server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e8 
  });
}

// --- SIFIR GECİKME GERÇEK ZAMANLI MESAJ SOKETLERİ ---
if (io) {
  io.on('connection', (socket) => {
    socket.on('join_chat', (matchId) => {
      if (matchId) socket.join(matchId);
    });

    socket.on('send_message', (data) => {
      if (data && data.matchId && data.message) {
        io.to(data.matchId).emit('receive_message', data.message);
      }
    });

    socket.on('disconnect', () => {});
  });
}

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'İstek limiti aşıldı.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '35mb' }));

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://breskavica:05527330103Ss@cluster0.z1oe54g.mongodb.net/goldenmatch?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas & Yüksek Performans İndeksleri Aktif!'))
  .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));

// --- ŞEMALAR VE İNDEKSLEME ---
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true, index: true },
  username: { type: String, index: true },
  nickname: String,
  age: Number,
  height: Number,
  weight: Number,
  role: String,
  interestedRole: { type: String, default: 'Hepsi' },
  city: { type: String, index: true },
  district: String,
  archetype: String,
  expression: String,
  bio: String,
  photos: [String],
  isVerified: { type: Boolean, default: false },
  restrictionLevel: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  bannedUntil: { type: Date, default: null }, // 🌟 Saat bazlı ihlal (Timeout) bitiş süresi
  isDeactivated: { type: Boolean, default: false },
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },
  filterUsage: {
    date: String,
    count: { type: Number, default: 0 }
  },
  registeredAt: { type: Date, default: Date.now }
});

const LikeSchema = new mongoose.Schema({
  fromUserId: { type: String, index: true },
  toUserId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now }
});

const MatchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true, index: true },
  user1: { type: String, index: true },
  user2: { type: String, index: true },
  paravan1: { type: Boolean, default: false },
  paravan2: { type: Boolean, default: false },
  messages: [{
    id: String,
    senderId: String,
    text: String,
    type: { type: String, default: 'text' },
    mediaUrl: String,
    time: String,
    read: { type: Boolean, default: false }
  }],
  updatedAt: { type: Date, default: Date.now, index: true }
});

const SystemLogSchema = new mongoose.Schema({
  id: String,
  adminId: String,
  adminName: String,
  action: String,
  targetInfo: String,
  targetMatchId: String,
  targetUserTgId: String,
  targetUsername: String,
  targetAccountName: String,
  timestamp: { type: Date, default: Date.now }
});

const ReportSchema = new mongoose.Schema({
  id: String,
  targetId: String,
  targetNickname: String,
  reporterId: String,
  reporterNickname: String,
  reason: String,
  date: String
});

const PricingConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true }, 
  priceStars: Number
});

const AdminSchema = new mongoose.Schema({
  target: { type: String, unique: true, index: true },
  type: String
});

const UserModel = mongoose.model('User', UserSchema);
const LikeModel = mongoose.model('Like', LikeSchema);
const MatchModel = mongoose.model('Match', MatchSchema);
const SystemLogModel = mongoose.model('SystemLog', SystemLogSchema);
const ReportModel = mongoose.model('Report', ReportSchema);
const PricingConfigModel = mongoose.model('PricingConfig', PricingConfigSchema);
const AdminModel = mongoose.model('Admin', AdminSchema);

const FOUNDER_ID = String(process.env.FOUNDER_ID || '8245373459').trim().toLowerCase();
const FOUNDER_USERNAME = String(process.env.FOUNDER_USERNAME || 'breskavica').trim().toLowerCase().replace('@', '');

async function isUserAdmin(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');
  if (tid === FOUNDER_ID || uname === FOUNDER_USERNAME) return true;
  try {
    const admin = await AdminModel.findOne({ $or: [{ target: tid }, { target: uname }] });
    return !!admin;
  } catch (e) {
    return false;
  }
}

function isFounder(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');
  return tid === FOUNDER_ID || uname === FOUNDER_USERNAME;
}

async function logSystemAction(adminId, adminName, action, targetInfo, matchData = {}) {
  try {
    await SystemLogModel.create({
      id: Date.now().toString(),
      adminId: String(adminId || 'Sistem'),
      adminName: String(adminName || 'YT'),
      action,
      targetInfo,
      targetMatchId: matchData.matchId || '',
      targetUserTgId: matchData.telegramId || '',
      targetUsername: matchData.username || '',
      targetAccountName: matchData.nickname || ''
    });
  } catch (e) {}
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://goldenmatch.onrender.com';
const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch meclisine hoş geldin. Keşfe başlamak için dokun:`,
      Markup.inlineKeyboard([Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)])
    );
  });

  bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
  bot.on('successful_payment', async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    const userId = ctx.from.id.toString();
    
    if (payload === 'golden_match_premium_weekly') {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      await UserModel.findOneAndUpdate({ telegramId: userId }, { isPremium: true, premiumExpiresAt: expires });
      await ctx.reply('🌟 Tebrikler! 1 haftalık Premium Üyeliğiniz aktifleştirildi.');
    } else if (payload === 'golden_match_filters') {
      const user = await UserModel.findOne({ telegramId: userId });
      if (user) {
        user.filterUsage.count = Math.max(0, (user.filterUsage.count || 0) - 3);
        await user.save();
      }
      await ctx.reply('✨ 25 Yıldız karşılığı ek 3 filtre hakkınız yüklendi!');
    }
  });

  bot.launch({ dropPendingUpdates: true }).catch(err => {
    if (err.code !== 409) console.warn('Bot uyarısı:', err.message);
  });
}

// ================= API ROTALARI =================
app.get('/api/locations', (req, res) => {
  const formattedLocations = {};
  for (const [city, districtsObj] of Object.entries(LOCATIONS_DATA)) {
    formattedLocations[city] = Object.keys(districtsObj);
  }
  res.json({ success: true, locations: formattedLocations });
});

app.get('/api/profile/:id', async (req, res) => {
  const tid = String(req.params.id);
  const uname = req.query.username || '';
  let profile = await UserModel.findOne({ telegramId: tid }).lean();
  
  const isAdmin = await isUserAdmin(tid, uname);
  const founder = isFounder(tid, uname);
  
  if (profile) {
    if (profile.isPremium && profile.premiumExpiresAt && new Date() > new Date(profile.premiumExpiresAt)) {
      await UserModel.updateOne({ telegramId: tid }, { isPremium: false, premiumExpiresAt: null });
      profile.isPremium = false;
    }
    // İhlal süresi bittiyse otomatik temizle
    if (profile.bannedUntil && new Date() > new Date(profile.bannedUntil)) {
      await UserModel.updateOne({ telegramId: tid }, { bannedUntil: null, restrictionLevel: 0, isBanned: false });
      profile.bannedUntil = null;
    }
    return res.json({ exists: true, profile, isAdmin, isFounder: founder });
  }
  return res.json({ exists: false, isAdmin, isFounder: founder });
});

app.post('/api/profile', async (req, res) => {
  try {
    const { telegramId, username, nickname, age, height, weight, role, interestedRole, city, district, archetype, expression, bio, photos } = req.body;
    if (!telegramId || !city || !role) return res.status(400).json({ success: false, message: 'Eksik bilgi.' });

    const existingUser = await UserModel.findOne({ telegramId: String(telegramId) });
    if (existingUser && (existingUser.isBanned || (existingUser.bannedUntil && new Date() < new Date(existingUser.bannedUntil)))) {
      return res.status(403).json({ success: false, message: 'Hesabınız kısıtlanmış/uzaklaştırılmıştır.' });
    }

    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const check = await verifyImageSafety(photo);
        if (!check.safe) return res.status(400).json({ success: false, message: check.reason });
      }
    }

    const profileData = {
      telegramId: String(telegramId),
      username: username ? username.replace('@', '') : '',
      nickname,
      age: Number(age),
      height: Number(height) || null,
      weight: Number(weight) || null,
      role,
      interestedRole: interestedRole || 'Hepsi',
      city,
      district: district || 'Merkez',
      archetype: archetype || 'Apollon',
      expression: expression || 'Maskülen',
      bio,
      photos: photos || [],
      isVerified: false
    };

    const saved = await UserModel.findOneAndUpdate({ telegramId: String(telegramId) }, profileData, { upsert: true, new: true });
    return res.json({ success: true, message: 'Kaydedildi.', profile: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

app.post('/api/billing/create-invoice', async (req, res) => {
  const { userId, productType } = req.body;
  if (!bot) return res.status(400).json({ success: false, message: 'Bot aktif değil.' });

  try {
    let config = await PricingConfigModel.findOne({ key: productType });
    let starsAmount = productType === 'premium_weekly' ? (config?.priceStars || 100) : (config?.priceStars || 25);
    let title = productType === 'premium_weekly' ? '🌟 GoldenMatch Haftalık Premium' : '✨ Ek 3 Filtre Hakkı';
    let payload = productType === 'premium_weekly' ? 'golden_match_premium_weekly' : 'golden_match_filters';

    const invoiceLink = await bot.telegram.createInvoiceLink({
      title,
      description: 'GoldenMatch ilahi ayrıcalıklar paketi.',
      payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: title, amount: starsAmount }]
    });

    res.json({ success: true, invoiceLink });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Fatura oluşturulamadı.' });
  }
});

app.get('/api/cards', async (req, res) => {
  const currentUserId = String(req.query.userId);
  const filterCity = req.query.city;
  const filterDistrict = req.query.district;
  const filterRole = req.query.role;
  const minAge = Number(req.query.minAge) || 18;
  const maxAge = Number(req.query.maxAge) || 99;

  const currentUser = await UserModel.findOne({ telegramId: currentUserId }).lean();
  const myLikes = await LikeModel.find({ fromUserId: currentUserId }).lean();
  const likedUserIds = new Set(myLikes.map(l => l.toUserId));

  let query = { 
    telegramId: { $ne: currentUserId, $nin: Array.from(likedUserIds) }, 
    isBanned: false,
    $or: [{ bannedUntil: null }, { bannedUntil: { $lt: new Date() } }],
    restrictionLevel: { $lt: 3 },
    isDeactivated: false,
    age: { $gte: minAge, $lte: maxAge }
  };
  if (filterCity && filterCity !== 'Hepsi') query.city = filterCity;
  if (filterDistrict && filterDistrict !== 'Hepsi') query.district = filterDistrict;
  if (filterRole && filterRole !== 'Hepsi') query.role = filterRole;

  const users = await UserModel.find(query).limit(100).lean();
  
  let cards = users.map(user => {
    let distanceKm = 9999;
    if (currentUser?.city && user.city) {
      distanceKm = calculateExactDistance(
        { city: currentUser.city, district: currentUser.district },
        { city: user.city, district: user.district }
      ) || 9999;
    }
    return { ...user, distanceKm };
  });

  cards.sort((a, b) => a.distanceKm - b.distanceKm);
  res.json({ success: true, cards });
});

app.post('/api/like', async (req, res) => {
  const { fromUserId, toUserId, action } = req.body;
  if (!fromUserId || !toUserId) return res.status(400).json({ success: false });

  if (action === 'like') {
    await LikeModel.create({ fromUserId: String(fromUserId), toUserId: String(toUserId) });
    const reverseLike = await LikeModel.findOne({ fromUserId: String(toUserId), toUserId: String(fromUserId) });

    if (reverseLike) {
      const matchId = [String(fromUserId), String(toUserId)].sort().join('_');
      await MatchModel.findOneAndUpdate(
        { matchId },
        { matchId, user1: String(fromUserId), user2: String(toUserId), updatedAt: new Date() },
        { upsert: true }
      );
      return res.json({ success: true, isMatch: true });
    }
  }
  res.json({ success: true, isMatch: false });
});

// --- OPTİMİZE EDİLMİŞ CHATS ROUTE ---
app.get('/api/chats', async (req, res) => {
  try {
    const userId = String(req.query.userId);
    const matches = await MatchModel.find({ $or: [{ user1: userId }, { user2: userId }] }).sort({ updatedAt: -1 }).lean();
    if (!matches.length) return res.json({ success: true, chats: [], totalUnread: 0 });

    const partnerIds = matches.map(m => m.user1 === userId ? m.user2 : m.user1);
    const partners = await UserModel.find({ telegramId: { $in: partnerIds } }).lean();
    const partnerMap = new Map();
    partners.forEach(p => partnerMap.set(String(p.telegramId), p));

    const userChats = [];
    for (const match of matches) {
      const partnerId = match.user1 === userId ? match.user2 : match.user1;
      const partner = partnerMap.get(String(partnerId));
      const bothRevealed = match.paravan1 && match.paravan2;
      const lastMsg = match.messages[match.messages.length - 1];

      let snippetText = 'Yeni eşleşme! Selam ver ✨';
      if (lastMsg) {
        if (lastMsg.type === 'image') snippetText = '📷 Fotoğraf';
        else if (lastMsg.type === 'audio') snippetText = '🎤 Sesli Mesaj';
        else snippetText = lastMsg.text;
      }

      userChats.push({
        matchId: match.matchId,
        partner: {
          telegramId: partnerId,
          nickname: partner?.nickname || 'Kullanıcı',
          avatar: partner?.photos?.[0] || '',
          username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null,
          isPremium: partner?.isPremium || false
        },
        bothRevealed,
        lastMessage: snippetText,
        lastMessageTime: lastMsg ? lastMsg.time : '',
        unread: lastMsg ? (lastMsg.senderId !== userId && !lastMsg.read) : true
      });
    }
    res.json({ success: true, chats: userChats, totalUnread: userChats.filter(c => c.unread).length });
  } catch (e) {
    res.json({ success: true, chats: [], totalUnread: 0 });
  }
});

// 🌟 HIZLANDIRILMIŞ VE LİMİTLENMİŞ MESAJ ENDPOINT'İ (Geç Yüklenme Çözümü)
app.get('/api/chats/:matchId', async (req, res) => {
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  const userId = String(req.query.userId);
  if (!match) return res.status(404).json({ success: false });

  let updated = false;
  match.messages.forEach(m => { 
    if (m.senderId !== userId && !m.read) { 
      m.read = true; 
      updated = true; 
    } 
  });
  if (updated) await match.save();

  const partnerId = match.user1 === userId ? match.user2 : match.user1;
  const partner = await UserModel.findOne({ telegramId: partnerId }).lean();
  const bothRevealed = match.paravan1 && match.paravan2;

  // Sadece son 50 mesajı alarak yükü ve yüklenme süresini minimize ediyoruz
  const limitedMessages = match.messages.slice(-50);

  res.json({
    success: true,
    matchId: match.matchId,
    partner: {
      telegramId: partnerId,
      nickname: partner?.nickname || 'Kullanıcı',
      avatar: partner?.photos?.[0] || '',
      username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null,
      isPremium: partner?.isPremium || false
    },
    bothRevealed,
    messages: limitedMessages
  });
});

app.post('/api/chats/:matchId/message', async (req, res) => {
  const { senderId, text, type, mediaUrl } = req.body;
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  if (!match) return res.status(400).json({ success: false });

  const msgType = type || 'text';
  if (msgType === 'text' && !text?.trim()) return res.status(400).json({ success: false });

  const msg = {
    id: Date.now().toString(),
    senderId: String(senderId),
    text: text ? text.trim().slice(0, 500) : '',
    type: msgType,
    mediaUrl: mediaUrl || '',
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    read: false
  };

  match.messages.push(msg);
  match.updatedAt = new Date();
  await match.save();

  if (io) {
    io.to(match.matchId).emit('receive_message', msg);
  }

  res.json({ success: true, message: msg });
});

app.post('/api/report', async (req, res) => {
  const { targetId, reporterId, reason } = req.body;
  if (!targetId || !reporterId || !reason) return res.status(400).json({ success: false });

  const targetUser = await UserModel.findOne({ telegramId: targetId }).lean();
  const reporterUser = await UserModel.findOne({ telegramId: reporterId }).lean();

  await ReportModel.create({
    id: Date.now().toString(),
    targetId,
    targetNickname: targetUser ? targetUser.nickname : 'Bilinmeyen',
    reporterId,
    reporterNickname: reporterUser ? reporterUser.nickname : 'Bilinmeyen',
    reason,
    date: new Date().toLocaleString('tr-TR')
  });

  res.json({ success: true, message: 'Şikayet iletildi ve YT paneline kaydedildi.' });
});

// ================= YÖNETİCİ PANELİ & LOG API =================
async function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const isAdmin = await isUserAdmin(requesterId, requesterUsername);
  if (isAdmin) return next();
  return res.status(403).json({ success: false, message: 'Yetki reddedildi.' });
}

app.get('/api/admin/dashboard-data', checkAdminAuth, async (req, res) => {
  const userList = await UserModel.find().lean();
  const reportsList = await ReportModel.find().sort({ _id: -1 }).lean();
  const systemLogs = await SystemLogModel.find().sort({ timestamp: -1 }).limit(100).lean();
  const pricingConfigs = await PricingConfigModel.find().lean();
  const allAdmins = await AdminModel.find().lean();
  const adminIdsSet = new Set(allAdmins.map(a => String(a.target)));
  adminIdsSet.add(FOUNDER_ID);
  adminIdsSet.add(FOUNDER_USERNAME);

  const adminsList = [];
  const regularUsersList = [];

  userList.forEach(u => {
    if (adminIdsSet.has(String(u.telegramId)) || adminIdsSet.has(String(u.username))) {
      adminsList.push(u);
    } else {
      regularUsersList.push(u);
    }
  });

  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  res.json({
    success: true,
    isFounder: isFounder(requesterId, requesterUsername),
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned && u.restrictionLevel === 0).length,
      reportsCount: reportsList.length
    },
    users: regularUsersList,
    adminsList: adminsList,
    reports: reportsList,
    logs: systemLogs,
    pricing: pricingConfigs,
    admins: Array.from(adminIdsSet)
  });
});

// 🌟 Saat Bazlı İhlal (Timeout) Endpoint'i
app.post('/api/admin/timeout-user', checkAdminAuth, async (req, res) => {
  const { targetTelegramId, hours, adminId, adminName } = req.body;
  const user = await UserModel.findOne({ telegramId: String(targetTelegramId) });
  if (!user) return res.status(404).json({ success: false });

  const banUntil = new Date();
  banUntil.setHours(banUntil.getHours() + Number(hours || 24));

  user.bannedUntil = banUntil;
  user.restrictionLevel = 2; // Geçici kısıt
  await user.save();

  await logSystemAction(adminId, adminName, `Üyeye ${hours} Saat İhlal Süresi Verildi`, `${user.nickname} (ID: ${targetTelegramId})`, {
    telegramId: user.telegramId,
    username: user.username,
    nickname: user.nickname
  });

  res.json({ success: true, bannedUntil: banUntil });
});

app.post('/api/admin/set-premium-duration', checkAdminAuth, async (req, res) => {
  const { targetTelegramId, weeks, adminId, adminName } = req.body;
  const user = await UserModel.findOne({ telegramId: String(targetTelegramId) });
  if (!user) return res.status(404).json({ success: false });

  const expires = new Date();
  expires.setDate(expires.getDate() + (Number(weeks) * 7));

  user.isPremium = true;
  user.premiumExpiresAt = expires;
  await user.save();

  await logSystemAction(adminId, adminName, `Haftalık Premium Tanımlandı (${weeks} Hafta)`, `${user.nickname}`, {
    telegramId: user.telegramId,
    username: user.username,
    nickname: user.nickname
  });

  res.json({ success: true, message: `${weeks} hafta premium tanımlandı.` });
});

app.post('/api/admin/clear-logs', checkAdminAuth, async (req, res) => {
  const { adminId, adminName } = req.body;
  await SystemLogModel.deleteMany({});
  await logSystemAction(adminId, adminName, 'Sistem Logları Temizlendi', 'Tüm geçmiş loglar silindi.');
  res.json({ success: true, message: 'Loglar temizlendi.' });
});

app.post('/api/admin/update-pricing', async (req, res) => {
  const { userId, username, key, priceStars } = req.body;
  if (!isFounder(userId, username)) {
    return res.status(403).json({ success: false, message: 'Sadece Kurucu belirleyebilir!' });
  }

  await PricingConfigModel.findOneAndUpdate(
    { key },
    { key, priceStars: Number(priceStars) },
    { upsert: true, new: true }
  );

  await logSystemAction(userId, username, `Yıldız Fiyatı Güncellendi (${key})`, `${priceStars} XTR`);
  res.json({ success: true, message: 'Fiyat güncellendi.' });
});

app.post('/api/admin/toggle-admin', async (req, res) => {
  const { userId, username, targetId } = req.body;
  if (!isFounder(userId, username)) {
    return res.status(403).json({ success: false, message: 'Sadece Kurucuya özeldir.' });
  }

  const tid = String(targetId).trim();
  const existing = await AdminModel.findOne({ target: tid });
  if (existing) {
    await AdminModel.deleteOne({ target: tid });
    await logSystemAction(userId, username, 'YT Yetkisi Alındı', tid);
    return res.json({ success: true, isAdmin: false, message: 'YT yetkisi alındı.' });
  } else {
    await AdminModel.create({ target: tid, type: 'id' });
    await logSystemAction(userId, username, 'YT Yetkisi Verildi', tid);
    return res.json({ success: true, isAdmin: true, message: 'YT yetkisi verildi.' });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`GoldenMatch Sunucusu ${PORT} portunda performans optimizasyonuyla aktif.`);
});
