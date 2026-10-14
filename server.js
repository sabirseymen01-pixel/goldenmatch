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
  console.warn('⚠️ socket.io modülü henüz yüklenemedi.');
}

const app = express();
const server = http.createServer(app);

// Render / Proxy arkasında gerçek IP tespiti (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR Çözümü)
app.set('trust proxy', 1);

let io = null;
if (Server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
}

// Rate Limiter - Proxy başlık kontrolü devre dışı bırakılarak çökme kesin olarak engellendi
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 400,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'İstek limiti aşıldı.' }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('GOLDENMATCH_OK'));

// ==========================================================================
// MONGODB ATLAS VERİTABANI BAĞLANTISI VE ŞEMALAR
// ==========================================================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://breskavica:05527330103Ss@cluster0.z1oe54g.mongodb.net/goldenmatch?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Bağlantısı Başarılı! Veriler kalıcı saklanıyor.'))
  .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  nickname: String,
  age: Number,
  height: Number,
  weight: Number,
  role: String,
  interestedRole: String,
  city: String,
  district: String,
  archetype: String,
  expression: String,
  bio: String,
  photos: [String],
  
  // Zengin Sims/Snapchat Tarzı Avatar Anatomisi & Giysi Katmanları
  avatarConfig: {
    gender: { type: String, default: 'male' },
    skinColor: { type: String, default: '#f0c7a1' },
    eyeColor: { type: String, default: '#2980b9' },
    eyeShape: { type: String, default: 'almond' },
    hairStyle: { type: String, default: 'greek_curls' },
    hairColor: { type: String, default: '#4a2f1b' },
    hat: { type: String, default: 'none' },              // Şapkalar / Taçlar
    glasses: { type: String, default: 'none' },          // Gözlükler
    necklace: { type: String, default: 'none' },         // Kolyeler
    outfitTop: { type: String, default: 'greek_tunic' }, // Üst giyim
    outfitTopColor: { type: String, default: '#ffffff' },
    outfitBottom: { type: String, default: 'classic_pants' }, // Alt giyim
    outfitBottomColor: { type: String, default: '#1a1a24' },
    shoes: { type: String, default: 'gladiator_sandals' },    // Ayakkabılar
    shoesColor: { type: String, default: '#8b4513' }
  },
  
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
  targetUsername: String,
  reporterId: String,
  reporterNickname: String,
  reason: String,
  evidenceMessages: [String],
  date: String
});

const AdminSchema = new mongoose.Schema({
  target: { type: String, unique: true },
  type: String
});

const WorldReportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reportedUserId: { type: String, default: null },
  type: { 
    type: String, 
    enum: ['chat_abuse', 'inappropriate_avatar', 'griefing', 'system_alert'],
    default: 'chat_abuse'
  },
  reason: { type: String, required: true },
  location: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const WorldItemSchema = new mongoose.Schema({
  itemType: { type: String, required: true },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  rotation: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  scale: {
    x: { type: Number, default: 1 },
    y: { type: Number, default: 1 },
    z: { type: Number, default: 1 }
  },
  textureVariant: { type: String, default: 'default' },
  updatedBy: { type: String, default: 'Admin' },
  updatedAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', UserSchema);
const LikeModel = mongoose.model('Like', LikeSchema);
const MatchModel = mongoose.model('Match', MatchSchema);
const ReportModel = mongoose.model('Report', ReportSchema);
const AdminModel = mongoose.model('Admin', AdminSchema);
const WorldReportModel = mongoose.model('WorldReport', WorldReportSchema);
const WorldItemModel = mongoose.model('WorldItem', WorldItemSchema);

// KURUCU SÜPER YETKİLİ
const FOUNDER_ID = String(process.env.FOUNDER_ID || '8245373459').trim().toLowerCase();
const FOUNDER_USERNAME = String(process.env.FOUNDER_USERNAME || 'breskavica').trim().toLowerCase().replace('@', '');

async function isUserAdmin(telegramId, username) {
  const tid = String(telegramId || '').trim().toLowerCase();
  const uname = String(username || '').trim().toLowerCase().replace('@', '');

  if (tid && tid === FOUNDER_ID) return true;
  if (uname && uname === FOUNDER_USERNAME) return true;

  try {
    const admin = await AdminModel.findOne({
      $or: [{ target: tid }, { target: uname }]
    });
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

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'golden_admin_2026';
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://goldenmatch.onrender.com';

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start((ctx) => {
    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch evrenine hoş geldin. Topluluk meclisine katılıp 3D Lounge ve eşleşmelere girmek için dokun:`,
      Markup.inlineKeyboard([Markup.button.webApp("🔥 GoldenMatch'i Aç", WEBAPP_URL)])
    );
  });

  // 409 Conflict çakışmasını önlemek için dropPendingUpdates eklendi
  bot.launch({ dropPendingUpdates: true }).catch(err => console.warn('Bot başlatma uyarısı:', err.message));

  process.once('SIGINT', () => process.exit(0));
  process.once('SIGTERM', () => process.exit(0));
}

// ==========================================================================
// REST API ROTALARI
// ==========================================================================

app.get('/api/locations', (req, res) => res.json({ success: true, locations: LOCATIONS_DATA }));

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
    const { 
      telegramId, username, nickname, age, height, weight, 
      role, interestedRole, city, district, archetype, expression, 
      bio, photos, avatarConfig 
    } = req.body;

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
      district: district || '',
      archetype: archetype || 'Apollon',
      expression,
      bio,
      photos: photos || [],
      avatarConfig: avatarConfig || {},
      isVerified: false,
      isBanned: false
    };

    const saved = await UserModel.findOneAndUpdate(
      { telegramId: String(telegramId) },
      profileData,
      { upsert: true, new: true }
    );

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
  res.json({ success: true, message: 'Hesap kalıcı olarak silindi.' });
});

app.get('/api/cards', async (req, res) => {
  const currentUserId = String(req.query.userId);
  const filterCity = req.query.city;
  const filterRole = req.query.role;

  const currentUser = await UserModel.findOne({ telegramId: currentUserId });
  const myLikes = await LikeModel.find({ fromUserId: currentUserId });
  const likedUserIds = new Set(myLikes.map(l => l.toUserId));

  let query = {
    telegramId: { $ne: currentUserId,$nin: Array.from(likedUserIds) },
    isBanned: false
  };

  if (filterCity && filterCity !== 'Hepsi') query.city = filterCity;
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

// DM Sohbet Listesi
app.get('/api/chats', async (req, res) => {
  const userId = String(req.query.userId);
  const matches = await MatchModel.find({ $or: [{ user1: userId }, { user2: userId }] }).sort({ updatedAt: -1 });
  const userChats = [];

  for (const match of matches) {
    const partnerId = match.user1 === userId ? match.user2 : match.user1;
    const partner = await UserModel.findOne({ telegramId: partnerId });
    const isMyParavanOpen = match.user1 === userId ? match.paravan1 : match.paravan2;
    const bothRevealed = match.paravan1 && match.paravan2;
    const lastMsg = match.messages[match.messages.length - 1];

    userChats.push({
      matchId: match.matchId,
      source: match.source || 'explore',
      partner: {
        telegramId: partnerId,
        nickname: partner?.nickname || 'Kullanıcı',
        avatar: partner?.photos?.[0] || '',
        avatarConfig: partner?.avatarConfig || null,
        city: partner?.city || '',
        role: partner?.role || '',
        username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
      },
      bothRevealed,
      myParavanRequested: isMyParavanOpen,
      lastMessage: lastMsg ? lastMsg.text : (match.source === 'metaverse_heart' ? '❤️ 3D Metaverse Lounge\'ta kalpleştiniz!' : 'Yeni eşleşme! Selam ver ✨'),
      lastMessageTime: lastMsg ? lastMsg.time : match.updatedAt,
      unread: lastMsg ? (lastMsg.senderId !== userId && !lastMsg.read) : true
    });
  }

  res.json({ success: true, chats: userChats, totalUnread: userChats.filter(c => c.unread).length });
});

app.get('/api/chats/:matchId', async (req, res) => {
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  const userId = String(req.query.userId);
  if (!match) return res.status(404).json({ success: false, message: 'Sohbet bulunamadı.' });

  match.messages.forEach(m => { if (m.senderId !== userId) m.read = true; });
  await match.save();

  const partnerId = match.user1 === userId ? match.user2 : match.user1;
  const partner = await UserModel.findOne({ telegramId: partnerId });
  const bothRevealed = match.paravan1 && match.paravan2;

  res.json({
    success: true,
    matchId: match.matchId,
    source: match.source,
    partner: {
      telegramId: partnerId,
      nickname: partner?.nickname || 'Kullanıcı',
      avatar: partner?.photos?.[0] || '',
      avatarConfig: partner?.avatarConfig || null,
      username: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID: ${partnerId}`) : null
    },
    bothRevealed,
    myParavanRequested: match.user1 === userId ? match.paravan1 : match.paravan2,
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
  const partnerId = match.user1 === String(userId) ? match.user2 : match.user1;
  const partner = await UserModel.findOne({ telegramId: partnerId });

  res.json({
    success: true,
    bothRevealed,
    partnerUsername: bothRevealed ? (partner?.username ? `@${partner.username}` : `ID:${partnerId}`) : null
  });
});

app.post('/api/chats/:matchId/unmatch', async (req, res) => {
  const { userId } = req.body;
  const match = await MatchModel.findOne({ matchId: req.params.matchId });
  if (!match) return res.status(404).json({ success: false });

  const partnerId = match.user1 === String(userId) ? match.user2 : match.user1;
  await MatchModel.deleteOne({ matchId: req.params.matchId });
  await LikeModel.deleteMany({
    $or: [
      { fromUserId: String(userId), toUserId: partnerId },
      { fromUserId: partnerId, toUserId: String(userId) }
    ]
  });

  res.json({ success: true, message: 'Eşleşme iptal edildi.' });
});

app.post('/api/report', async (req, res) => {
  const { reporterId, targetId, reason, selectedMessages } = req.body;
  if (!targetId || !reason?.trim()) return res.status(400).json({ success: false });

  const targetUser = await UserModel.findOne({ telegramId: String(targetId) });
  const reporterUser = await UserModel.findOne({ telegramId: String(reporterId) });

  await ReportModel.create({
    id: Date.now().toString(),
    targetId: String(targetId),
    targetNickname: targetUser?.nickname || 'Bilinmiyor',
    targetUsername: targetUser?.username || 'Gizli',
    reporterId: String(reporterId),
    reporterNickname: reporterUser?.nickname || 'Anonim',
    reason: reason.trim(),
    evidenceMessages: selectedMessages || [],
    date: new Date().toLocaleString('tr-TR')
  });

  res.json({ success: true, message: 'Şikayet iletildi.' });
});

// ==========================================================================
// METAVERSE ŞİKAYET VE EŞYA API'LERİ
// ==========================================================================

app.post('/api/metaverse/report', async (req, res) => {
  try {
    const { reporterId, reportedUserId, type, reason, location } = req.body;
    if (!reporterId || !reason) {
      return res.status(400).json({ success: false, message: 'Eksik bilgi.' });
    }
    const report = new WorldReportModel({ reporterId, reportedUserId, type, reason, location });
    await report.save();
    res.json({ success: true, message: 'Şikayet YT Masasına iletildi.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/metaverse-reports', async (req, res) => {
  try {
    const reports = await WorldReportModel.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/metaverse/item', async (req, res) => {
  try {
    const { itemType, position, rotation, scale, textureVariant, updatedBy } = req.body;
    const newItem = new WorldItemModel({
      itemType,
      position,
      rotation,
      scale,
      textureVariant: textureVariant || 'default',
      updatedBy: updatedBy || 'YT_Admin'
    });
    await newItem.save();
    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/metaverse/item/:id', async (req, res) => {
  try {
    await WorldItemModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/metaverse/items', async (req, res) => {
  try {
    const items = await WorldItemModel.find();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// YT DASHBOARD VE AUTH
// ==========================================================================

async function checkAdminAuth(req, res, next) {
  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;
  const secretKey = req.headers['x-admin-key'] || req.query.key;

  const isAdmin = await isUserAdmin(requesterId, requesterUsername);
  if (isAdmin || secretKey === ADMIN_SECRET) return next();
  return res.status(403).json({ success: false, message: 'Yetki reddedildi.' });
}

app.get('/api/admin/dashboard-data', checkAdminAuth, async (req, res) => {
  const userList = await UserModel.find();
  const reportsList = await ReportModel.find().sort({ _id: -1 });
  const allAdmins = await AdminModel.find();
  const worldReports = await WorldReportModel.find().sort({ createdAt: -1 }).limit(25);

  const requesterId = req.headers['x-user-id'] || req.query.userId;
  const requesterUsername = req.headers['x-user-name'] || req.query.username;

  const visibleAdmins = {
    ids: allAdmins.filter(a => a.type === 'id' && a.target !== FOUNDER_ID).map(a => a.target),
    usernames: allAdmins.filter(a => a.type === 'username' && a.target !== FOUNDER_USERNAME).map(a => a.target)
  };

  res.json({
    success: true,
    isFounder: isFounder(requesterId, requesterUsername),
    stats: {
      total: userList.length,
      active: userList.filter(u => !u.isBanned).length,
      banned: userList.filter(u => u.isBanned).length,
      reportsCount: reportsList.length,
      worldReportsCount: worldReports.length
    },
    users: userList,
    reports: reportsList,
    worldReports: worldReports,
    admins: visibleAdmins
  });
});

app.post('/api/admin/toggle-ban', checkAdminAuth, async (req, res) => {
  const user = await UserModel.findOne({ telegramId: String(req.body.targetTelegramId) });
  if (!user) return res.status(404).json({ success: false });
  user.isBanned = !user.isBanned;
  await user.save();
  res.json({ success: true, isBanned: user.isBanned });
});

// ==========================================================================
// SOCKET.IO - 3D METAVERSE GERÇEK ZAMANLI MOTOR
// ==========================================================================
const onlinePlayers = {};

if (io) {
  io.on('connection', (socket) => {
    
    // 1. Odaya Giriş
    socket.on('join_metaverse', (userData) => {
      onlinePlayers[socket.id] = {
        socketId: socket.id,
        telegramId: userData.telegramId,
        nickname: userData.nickname || 'Misafir',
        avatar: userData.avatar || '',
        avatarConfig: userData.avatarConfig || {},
        role: userData.role || '',
        city: userData.city || '',
        district: userData.district || '',
        x: userData.x || 0,
        y: userData.y || 0,
        z: userData.z || 0,
        rotY: 0,
        actionState: 'idle',
        isGhost: !!userData.isGhost
      };

      const visiblePlayers = Object.values(onlinePlayers).filter(p => !p.isGhost && p.socketId !== socket.id);
      socket.emit('current_players', visiblePlayers);

      if (!userData.isGhost) {
        socket.broadcast.emit('player_joined', onlinePlayers[socket.id]);
      }
    });

    // 2. Hareket, Oturma, Çömelme Senkronizasyonu
    socket.on('player_move', (data) => {
      if (onlinePlayers[socket.id]) {
        onlinePlayers[socket.id].x = data.x;
        onlinePlayers[socket.id].y = data.y;
        onlinePlayers[socket.id].z = data.z;
        onlinePlayers[socket.id].rotY = data.rotY;
        onlinePlayers[socket.id].actionState = data.actionState || 'idle';

        if (!onlinePlayers[socket.id].isGhost) {
          socket.broadcast.emit('player_moved', {
            socketId: socket.id,
            x: data.x,
            y: data.y,
            z: data.z,
            rotY: data.rotY,
            actionState: data.actionState || 'idle'
          });
        }
      }
    });

    // 3. Giysi / Avatar Canlı Değişimi
    socket.on('update_avatar_look', (data) => {
      if (onlinePlayers[socket.id]) {
        onlinePlayers[socket.id].avatarConfig = data.avatarConfig;
        socket.broadcast.emit('player_updated_avatar', {
          socketId: socket.id,
          avatarConfig: data.avatarConfig
        });
      }
    });

    // 4. Mekan Konsepti Değiştirme (YT)
    socket.on('change_venue_theme', (data) => {
      io.emit('venue_theme_changed', { themeName: data.themeName });
    });

    // 5. Sohbet Baloncuğu
    socket.on('world_chat_message', (data) => {
      io.emit('player_said', {
        socketId: socket.id,
        text: data.text
      });
    });

    // 6. METAVERSE ↔ DM ENTEGRASYONU (Karşılıklı Kalp)
    socket.on('send_world_heart', async ({ fromUserId, toUserId }) => {
      try {
        const fromId = String(fromUserId);
        const toId = String(toUserId);

        await LikeModel.create({ fromUserId: fromId, toUserId: toId });
        const targetLike = await LikeModel.findOne({ fromUserId: toId, toUserId: fromId });

        if (targetLike) {
          const matchId = [fromId, toId].sort().join('_');
          await MatchModel.findOneAndUpdate(
            { matchId },
            { 
              matchId, 
              user1: fromId, 
              user2: toId, 
              source: 'metaverse_heart',
              updatedAt: new Date() 
            },
            { upsert: true }
          );

          if (bot) {
            const u1 = await UserModel.findOne({ telegramId: fromId });
            const u2 = await UserModel.findOne({ telegramId: toId });
            try {
              await bot.telegram.sendMessage(fromId, `🎉 *3D Metaverse Lounge'ta Eşleştiniz!*\n\n*${u2?.nickname || 'Biri'}* ile karşılıklı kalpleştiniz! DM kutuna mesaj düştü, sohbete başlayabilirsin.`);
              await bot.telegram.sendMessage(toId, `🎉 *3D Metaverse Lounge'ta Eşleştiniz!*\n\n*${u1?.nickname || 'Biri'}* ile karşılıklı kalpleştiniz! DM kutuna mesaj düştü, sohbete başlayabilirsin.`);
            } catch (e) {}
          }

          io.emit('match_notification', {
            user1: fromId,
            user2: toId,
            matchId
          });
        }
      } catch (err) {
        console.error('Metaverse kalp gönderme hatası:', err);
      }
    });

    // 7. Çıkış
    socket.on('disconnect', () => {
      if (onlinePlayers[socket.id]) {
        socket.broadcast.emit('player_left', socket.id);
        delete onlinePlayers[socket.id];
      }
    });
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`GoldenMatch Sunucusu ${PORT} portunda aktif.`));
