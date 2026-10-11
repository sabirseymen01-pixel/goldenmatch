// nsfwCheck.js - Görsel Güvenlik ve Moderasyon Modülü (Sıfır Bağımlılık / Native Node.js)
async function verifyImageSafety(base64Image) {
  // Eğer Sightengine ortam değişkenleri tanımlı değilse engelleme yapmadan devam eder
  if (!process.env.SIGHTENGINE_USER || !process.env.SIGHTENGINE_SECRET) {
    return { safe: true, reason: 'Denetim servisi pasif (Bypass)' };
  }

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Node.js yerleşik FormData ve Blob kullanımı (axios ve form-data paketine gerek kalmaz)
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('media', blob, 'upload.jpg');
    formData.append('models', 'nudity-2.0');
    formData.append('api_user', process.env.SIGHTENGINE_USER);
    formData.append('api_secret', process.env.SIGHTENGINE_SECRET);

    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
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
