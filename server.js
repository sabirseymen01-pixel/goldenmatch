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
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
}

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 400,
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
  .then(() => console.log('✅ MongoDB Atlas Bağlantısı Başarılı!'))
  .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  nickname: String,
  age: Number,
  height: Number,
  weight: Number,
  role: String,
  interestedRole: { type: String, default: 'Hepsi' },
  city: String,
  district: String,
  archetype: String,
  expression: String,
  bio: String,
  photos: [String],
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  registeredAt: { type: Date, default: Date.now }
});

const LikeSchema = new mongoose.Schema({
  fromUserId: String,
  toUserId: String,
  createdAt: { type: Date, default: Date.now }
});

const MatchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true },
  user1: String,
  user2: String,
  paravan1: { type: Boolean, default: false },
  paravan2: { type: Boolean, default: false },
  messages: [{
    id: String,
    senderId: String,
    text: String,
    time: String,
    read: { type: Boolean, default: false }
  }],
  source: { type: String, default: 'explore' },
  updatedAt: { type: Date, default: Date.now }
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

const AdminSchema = new mongoose.Schema({
  target: { type: String, unique: true },
  type: String
});

const UserModel = mongoose.model('User', UserSchema);
const LikeModel = mongoose.model('Like', LikeSchema);
const MatchModel = mongoose.model('Match', MatchSchema);
const ReportModel = mongoose.model('Report', ReportSchema);
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
  bot.launch({ dropPendingUpdates: true }).catch(err => console.warn('Bot uyarısı:', err.message));
}

// ================= API ROTALARI =================
app.get('/api/locations', (req, res) => {
  // Şehir isimleri ve içindeki ilçe key'lerini client'a gönderiyoruz
  const formattedLocations = {};
  for (const [city, districtsObj] of Object.entries(LOCATIONS_DATA)) {
    formattedLocations[city] = Object.keys(districtsObj);
  }
  res.json({ success: true, locations: formattedLocations });
});

app.get('/api/profile/:id', async (req, res) => {
  const tid = String(req.params.id);
  const uname = req.query.username || '';
  const profile = await UserModel.findOne({ telegramId: tid });
  const isAdmin = await isUserAdmin(tid, uname);
  const founder = isFounder(tid, uname);
  if (profile) return res.json({ exists: true, profile, isAdmin, isFounder: founder });
  return res.json({ exists: false, isAdmin, isFounder: founder });
});

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
      isVerified: false,
      isBanned: false
    };

    const saved = await UserModel.findOneAndUpdate({ telegramId: String(telegramId) }, profileData, { upsert: true, new: true });
    return res.json({ success: true, message: 'Kaydedildi.', profile: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

app.delete('/api/profile/:id', async (req, res) => {
  const tid = String(req.params.id);
  await UserModel.deleteOne({ telegramId: tid });
  await LikeModel.deleteMany({ $or: [{ fromUserId: tid }, { toUserId: tid }] });
  await MatchModel.deleteMany({ $or: [{ user1: tid }, { user2: tid }] });
  res.json({ success: true, message: 'Hesap silindi.' });
});

app.get('/api/cards', async (req, res) => {
  const currentUserId = String(req.query.userId);
  const filterCity = req.query.city;
  const filterDistrict = req.query.district;
  const filterRole = req.query.role;

  const currentUser = await UserModel.findOne({ telegramId: currentUserId });
  const myLikes = await LikeModel.find({ fromUserId: currentUserId });
  const likedUserIds = new Set(myLikes.map(l => l.toUserId));

  let query = { telegramId: { $ne: currentUserId, $nin: Array.from(likedUserIds) }, isBanned: false };
  if (filterCity && filterCity !== 'Hepsi') query.city = filterCity;
  if (filterDistrict && filterDistrict !== 'Hepsi') query.district = filterDistrict;
  if (filterRole && filterRole !== 'Hepsi') query.role = filterRole;

  const users = await UserModel.find(query);
  const cards = users.map(user => {
    let distanceKm = null;
    if (currentUser?.city && user.city) {
      distanceKm = calculateExactDistance(
        { city: currentUser.city, district: currentUser.district },
        { city: user.city, district: user.district }
      );
    }
    return { ...user.toObject(), distanceKm };
  });

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

app.get('/api/chats', async (req, res) => {
  const userId = String(req.query.userId);
  const matches = await MatchModel.find({ $or: [{ user1: userId }, { user2: userId }] }).sort({ updatedAt: -1 });
  const userChats = [];

  for (const match of matches) {
    const partnerId = match.user1 === userId ? match.user2 : match.user1;
    const partner = await UserModel.findOne({ telegramId: partnerId });
    const bothRevealed = match.paravan1 && match.paravan2;
    const lastMsg = match.messages[match.messages.length - 1];

    userChats.push({
      matchId: match.matchId,
      partner: {
        telegramId: partnerId,
        nickname: partner?.nickname || 'Kullanıcı',
        avatar: partner?.photos?.[0] || '',
        username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
      },
      bothRevealed,
      lastMessage: lastMsg ? lastMsg.text : 'Yeni eşleşme! Selam ver ✨',
      lastMessageTime: lastMsg ? lastMsg.time : '',
      unread: lastMsg ? (lastMsg.senderId !== userId && !lastMsg.read) : true
    });
  }
  res.json({ success: true, chats: userChats, totalUnread: userChats.filter(c => c.unread).length });
});

app.get('/api/chats/:matchId', async (req, res) => {
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  const userId = String(req.query.userId);
  if (!match) return res.status(404).json({ success: false });

  match.messages.forEach(m => { if (m.senderId !== userId) m.read = true; });
  await match.save();

  const partnerId = match.user1 === userId ? match.user2 : match.user1;
  const partner = await UserModel.findOne({ telegramId: partnerId });
  const bothRevealed = match.paravan1 && match.paravan2;

  res.json({
    success: true,
    matchId: match.matchId,
    partner: {
      telegramId: partnerId,
      nickname: partner?.nickname || 'Kullanıcı',
      avatar: partner?.photos?.[0] || '',
      username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
    },
    bothRevealed,
    messages: match.messages
  });
});

app.post('/api/chats/:matchId/message', async (req, res) => {
  const { senderId, text } = req.body;
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  if (!match || !text?.trim()) return res.status(400).json({ success: false });

  const msg = {
    id: Date.now().toString(),
    senderId: String(senderId),
    text: text.trim().slice(0, 500),
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    read: false
  };

  match.messages.push(msg);
  match.updatedAt = new Date();
  await match.save();
  res.json({ success: true, message: msg });
});

app.post('/api/chats/:matchId/reveal', async (req, res) => {
  const { userId } = req.body;
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  if (!match) return res.status(404).json({ success: false });

  if (match.user1 === String(userId)) match.paravan1 = true;
  if (match.user2 === String(userId)) match.paravan2 = true;
  await match.save();

  const bothRevealed = match.paravan1 && match.paravan2;
  res.json({ success: true, bothRevealed });
});

app.post('/api/chats/:matchId/unmatch', async (req, res) => {
  const { userId } = req.body;
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  if (!match) return res.status(404).json({ success: false });
  await MatchModel.deleteOne({ matchId: req.params.matchId });
  res.json({ success: true });
});

// Şikayet / Raporlama Rotası
app.post('/api/report', async (req, res) => {
  const { targetId, reporterId, reason } = req.body;
  if (!targetId || !reporterId || !reason) return res.status(400).json({ success: false });

  const targetUser = await UserModel.findOne({ telegramId: targetId });
  const reporterUser = await UserModel.findOne({ telegramId: reporterId });

  await ReportModel.create({
    id: Date.now().toString(),
    targetId,
    targetNickname: targetUser ? targetUser.nickname : 'Bilinmeyen',
    reporterId,
    reporterNickname: reporterUser ? reporterUser.nickname : 'Bilinmeyen',
    reason,
    date: new Date().toLocaleString('tr-TR')
  });

  res.json({ success: true, message: 'Şikayet iletildi.' });
});

// ================= YÖNETİCİ PANELİ (YT) API =================
async function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const isAdmin = await isUserAdmin(requesterId, requesterUsername);
  if (isAdmin) return next();
  return res.status(403).json({ success: false, message: 'Yetki reddedildi.' });
}

app.get('/api/admin/dashboard-data', checkAdminAuth, async (req, res) => {
  const userList = await UserModel.find();
  const reportsList = await ReportModel.find().sort({ _id: -1 });
  const allAdmins = await AdminModel.find();
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  res.json({
    success: true,
    isFounder: isFounder(requesterId, requesterUsername),
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned).length,
      banned: userList.filter(u => u.isBanned).length,
      reportsCount: reportsList.length
    },
    users: userList,
    reports: reportsList,
    admins: allAdmins.map(a => a.target)
  });
});

app.post('/api/admin/toggle-ban', checkAdminAuth, async (req, res) => {
  const user = await UserModel.findOne({ telegramId: String(req.body.targetTelegramId) });
  if (!user) return res.status(404).json({ success: false });
  user.isBanned = !user.isBanned;
  await user.save();
  res.json({ success: true, isBanned: user.isBanned });
});

// Kurucunun YT Ekleme / Çıkarma Rotası
app.post('/api/admin/toggle-admin', async (req, res) => {
  const { userId, username, targetId } = req.body;
  if (!isFounder(userId, username)) {
    return res.status(403).json({ success: false, message: 'Bu işlem sadece Kurucuya özeldir.' });
  }

  const tid = String(targetId).trim();
  const existing = await AdminModel.findOne({ target: tid });
  if (existing) {
    await AdminModel.deleteOne({ target: tid });
    return res.json({ success: true, isAdmin: false, message: 'YT yetkisi alındı.' });
  } else {
    await AdminModel.create({ target: tid, type: 'id' });
    return res.json({ success: true, isAdmin: true, message: 'YT yetkisi verildi.' });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`GoldenMatch Sunucusu ${PORT} portunda aktif.`);
});
