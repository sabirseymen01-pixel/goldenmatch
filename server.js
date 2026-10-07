require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const app = express();

// Ayarlar ve Ara Yazılımlar
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Arayüz dosyalarını sun (public klasörü)
app.use(express.static(path.join(__dirname, 'public')));

// UptimeRobot / Canlılık Kontrolü (Cold start'ı önlemek için)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Bellek İçi Veri Depoları
const users = new Map();   // Profil verileri (tgId -> profil)
const likes = new Map();   // Beğeniler (tgId -> Set(beğenilenTgIdler))

// Render Değişkenleri
const BOT_TOKEN = process.env.BOT_TOKEN;
let activeWebAppUrl = process.env.WEBAPP_URL || '';

// Sunucuya gelen ilk istek üzerinden kendi adresini otomatik yakalama (Yedek Güvenlik)
app.use((req, res, next) => {
  if (!activeWebAppUrl && req.headers.host) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    activeWebAppUrl = `${protocol}://${req.headers.host}`;
    console.log('Mini App URL otomatik olarak tespit edildi:', activeWebAppUrl);
  }
  next();
});

// Telegram Bot Kurulumu
if (!BOT_TOKEN) {
  console.warn('UYARI: BOT_TOKEN tanımlanmamış. Bot başlatılamadı, sadece web sunucusu çalışıyor.');
}

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

function getValidAppUrl() {
  return activeWebAppUrl || process.env.WEBAPP_URL;
}

if (bot) {
  // Kullanıcı bota özelden /start yazdığında
  bot.start((ctx) => {
    const appUrl = getValidAppUrl();

    if (!appUrl) {
      return ctx.reply('⚠️ Mini App adresi henüz hazır değil. Lütfen birkaç saniye sonra tekrar /start yazın.');
    }

    ctx.reply(
      `Merhaba ${ctx.from.first_name}! ✨\n\nGoldenMatch'e hoş geldin. Topluluktaki diğer üyelerle tanışmak ve profilleri keşfetmek için butona tıkla:`,
      Markup.inlineKeyboard([
        Markup.button.webApp('🔥 GoldenMatch\'i Aç', appUrl)
      ])
    );
  });

  // Grup veya kanallarda /match, /ara, /bul komutları verildiğinde
  bot.command(['match', 'ara', 'bul', 'tanis'], (ctx) => {
    const appUrl = getValidAppUrl();

    if (!appUrl) {
      return ctx.reply('⚠️ Mini App adresi henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.');
    }

    ctx.reply(
      `🔥 Yeni insanlarla tanışmak ve sohbet etmek için GoldenMatch'e katılın!`,
      Markup.inlineKeyboard([
        Markup.button.webApp('✨ Eşleşmeye Başla', appUrl)
      ])
    );
  });

  // Botu başlat
  bot.launch()
    .then(() => console.log('Telegram Botu başarıyla devreye girdi.'))
    .catch((err) => console.error('Bot başlatma hatası:', err));

  // Kapanma sinyallerini yakala
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// API: Profil Bilgisi Kontrolü (Kullanıcı kayıtlı mı?)
app.get('/api/profile/:id', (req, res) => {
  const profile = users.get(String(req.params.id));
  if (profile) {
    return res.json({ exists: true, profile });
  }
  return res.json({ exists: false });
});

// API: Profil Kaydet / Güncelle
app.post('/api/profile', (req, res) => {
  try {
    const { telegramId, username, nickname, age, height, weight, role, expression, bio, photos } = req.body;

    if (!telegramId) {
      return res.status(400).json({ success: false, message: 'Telegram ID zorunludur.' });
    }

    const newProfile = {
      telegramId: String(telegramId),
      username: username || '',
      nickname,
      age: Number(age),
      height: Number(height) || null,
      weight: Number(weight) || null,
      role,
      expression,
      bio,
      photos: photos || [],
      updatedAt: new Date()
    };

    users.set(String(telegramId), newProfile);
    console.log(`Profil kaydedildi: ${nickname} (@${username || 'gizli'}) [${telegramId}]`);

    return res.json({ success: true, message: 'Profil başarıyla kaydedildi!', profile: newProfile });
  } catch (err) {
    console.error('Profil kayıt hatası:', err);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
});

// API: Keşfet Kartlarını Getir
app.get('/api/cards', (req, res) => {
  const currentUserId = String(req.query.userId);
  const userLikes = likes.get(currentUserId) || new Set();

  const cards = [];
  for (const [id, user] of users.entries()) {
    // Kendisi hariç ve daha önce aksiyon almadığı profiller
    if (id !== currentUserId && !userLikes.has(id)) {
      cards.push(user);
    }
  }

  res.json({ success: true, cards });
});

// API: Beğeni / Pas Geçme ve Eşleşme Bildirimi
app.post('/api/like', async (req, res) => {
  const { fromUserId, toUserId, action } = req.body; // action: 'like' veya 'pass'
  const fromId = String(fromUserId);
  const toId = String(toUserId);

  if (!likes.has(fromId)) {
    likes.set(fromId, new Set());
  }
  likes.get(fromId).add(toId);

  let isMatch = false;

  if (action === 'like') {
    const targetLikes = likes.get(toId);
    // Karşı taraf da bizi beğendi mi?
    if (targetLikes && targetLikes.has(fromId)) {
      isMatch = true;

      const user1 = users.get(fromId);
      const user2 = users.get(toId);

      // Telegram Botu üzerinden iki tarafa da bildirim at
      if (bot) {
        const u1Link = user1?.username ? `@${user1.username}` : `[${user1?.nickname || 'Kullanıcı'}](tg://user?id=${fromId})`;
        const u2Link = user2?.username ? `@${user2.username}` : `[${user2?.nickname || 'Kullanıcı'}](tg://user?id=${toId})`;

        try {
          await bot.telegram.sendMessage(
            fromId,
            `🎉 *Tebrikler, Eşleştiniz!*\n\n*${user2?.nickname || 'Biri'}* ile karşılıklı beğendiniz.\nSohbete başlamak için tıkla: ${u2Link}`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error(`Eşleşme bildirimi gönderilemedi (${fromId}):`, e.message);
        }

        try {
          await bot.telegram.sendMessage(
            toId,
            `🎉 *Tebrikler, Eşleştiniz!*\n\n*${user1?.nickname || 'Biri'}* ile karşılıklı beğendiniz.\nSohbete başlamak için tıkla: ${u1Link}`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error(`Eşleşme bildirimi gönderilemedi (${toId}):`, e.message);
        }
      }
    }
  }

  res.json({ success: true, isMatch });
});

// Port Dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GoldenMatch sunucusu ${PORT} portunda aktif.`);
});
