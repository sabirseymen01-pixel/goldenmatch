// nsfwCheck.js - Görsel Güvenlik ve Moderasyon Modülü
const axios = require('axios');
const FormData = require('form-data');

async function verifyImageSafety(base64Image) {
  // Eğer Sightengine ortam değişkenleri tanımlı değilse engelleme yapmadan devam eder
  if (!process.env.SIGHTENGINE_USER || !process.env.SIGHTENGINE_SECRET) {
    return { safe: true, reason: 'Denetim servisi pasif (Bypass)' };
  }

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const form = new FormData();
    form.append('media', buffer, { filename: 'upload.jpg' });
    form.append('models', 'nudity-2.0');
    form.append('api_user', process.env.SIGHTENGINE_USER);
    form.append('api_secret', process.env.SIGHTENGINE_SECRET);

    const response = await axios.post('https://api.sightengine.com/1.0/check.json', form, {
      headers: form.getHeaders()
    });

    const data = response.data;
    if (data.status === 'success') {
      const nudity = data.nudity;
      if (nudity.sexual_activity > 0.6 || nudity.sexual_display > 0.6 || nudity.erotica > 0.8) {
        return { safe: false, reason: 'Görsel topluluk kurallarına aykırı çıplaklık içeriyor.' };
      }
    }
    return { safe: true };
  } catch (error) {
    console.error('NSFW Kontrol Hatası:', error.message);
    return { safe: true }; // API hatasında akışı bozmamak için güvenli kabul et
  }
}

module.exports = { verifyImageSafety };
