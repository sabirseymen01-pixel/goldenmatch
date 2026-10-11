// 10. YT Girişi & Yönetim Masası
async function directYtLogin() {
  triggerHaptic('medium');
  try {
    const cleanUname = (username || '').toLowerCase().replace('@', '');
    const cleanId = String(telegramId || '').trim();

    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: cleanId, username: cleanUname })
    });
    const data = await res.json();

    if (data.success) {
      triggerHaptic('success');
      document.getElementById('appNav').classList.remove('hidden');
      document.getElementById('ytNavBtn').classList.remove('hidden');
      switchTab('adminPanel');
    } else {
      const keyPrompt = prompt('Telegram hesabınız (@' + (cleanUname || 'isimsiz') + ' | ID:' + cleanId + ') tanımlı YT listesinde bulunamadı.\n\nEğer yetkiliyseniz YT Anahtarını girin:');
      if (!keyPrompt) return;

      const keyRes = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: cleanId, username: cleanUname, key: keyPrompt })
      });
      const keyData = await keyRes.json();

      if (keyData.success) {
        triggerHaptic('success');
        document.getElementById('appNav').classList.remove('hidden');
        document.getElementById('ytNavBtn').classList.remove('hidden');
        switchTab('adminPanel');
      } else {
        triggerHaptic('error');
        alert('Hatalı şifre veya yetkisiz erişim!');
      }
    }
  } catch (err) {
    alert('Doğrulama sunucusuna erişilemedi.');
  }
}
