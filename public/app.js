const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tgUser = tg?.initDataUnsafe?.user;
const telegramId = tgUser ? String(tgUser.id) : '999999999';
const username = tgUser ? tgUser.username : '';

let selectedSlot = null;
const images = [null, null, null, null];
let currentCards = [];
let currentIndex = 0;

// Sayfa Yüklendiğinde Kullanıcı Durumunu Kontrol Et
window.addEventListener('DOMContentLoaded', async () => {
  await checkUserProfile();
});

// 1. Profil Kontrolü
async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${telegramId}`);
    const data = await res.json();

    if (data.exists) {
      // Profil zaten varsa formu doldur ve keşfet ekranına geç
      fillForm(data.profile);
      showExploreView();
      loadExploreCards();
    } else {
      // Profil yoksa kayıt formunda kal
      showRegisterView();
    }
  } catch (err) {
    console.error('Profil kontrol hatası:', err);
    showRegisterView();
  }
}

// 2. Ekran Değiştirme Fonksiyonları
function showRegisterView() {
  document.getElementById('registerView').classList.remove('hidden');
  document.getElementById('exploreView').classList.add('hidden');
}

function showExploreView() {
  document.getElementById('registerView').classList.add('hidden');
  document.getElementById('exploreView').classList.remove('hidden');
}

function openProfileEdit() {
  showRegisterView();
}

function fillForm(profile) {
  document.getElementById('nickname').value = profile.nickname || '';
  document.getElementById('age').value = profile.age || '';
  document.getElementById('height').value = profile.height || '';
  document.getElementById('weight').value = profile.weight || '';
  document.getElementById('role').value = profile.role || '';
  document.getElementById('expression').value = profile.expression || '';
  document.getElementById('bio').value = profile.bio || '';

  if (profile.photos && profile.photos.length > 0) {
    profile.photos.forEach((photo, idx) => {
      if (idx < 4 && photo) {
        images[idx] = photo;
        const slotElem = document.getElementById(`slot-${idx}`);
        const imgElem = slotElem.querySelector('.slot-preview');
        const iconElem = slotElem.querySelector('.slot-icon');
        imgElem.src = photo;
        imgElem.style.display = 'block';
        iconElem.style.display = 'none';
      }
    });
  }
}

// 3. Fotoğraf Seçim İşlemleri
function pickImage(slotIndex) {
  selectedSlot = slotIndex;
  document.getElementById('fileSelector').click();
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result;
    images[selectedSlot] = base64Data;

    const slotElem = document.getElementById(`slot-${selectedSlot}`);
    const imgElem = slotElem.querySelector('.slot-preview');
    const iconElem = slotElem.querySelector('.slot-icon');

    imgElem.src = base64Data;
    imgElem.style.display = 'block';
    iconElem.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// 4. Form Gönderimi (Profil Kaydetme)
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!images[0]) {
    alert('Lütfen en az bir ana fotoğraf yükleyin.');
    return;
  }

  const payload = {
    telegramId,
    username,
    nickname: document.getElementById('nickname').value,
    age: document.getElementById('age').value,
    height: document.getElementById('height').value,
    weight: document.getElementById('weight').value,
    role: document.getElementById('role').value,
    expression: document.getElementById('expression').value,
    bio: document.getElementById('bio').value,
    photos: images.filter(img => img !== null)
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerText = 'Kaydediliyor...';

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet & Başla';

    if (data.success) {
      showExploreView();
      loadExploreCards();
    } else {
      alert(data.message || 'Bir hata oluştu.');
    }
  } catch (err) {
    console.error(err);
    alert('Sunucuya bağlanılamadı.');
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet & Başla';
  }
}

// 5. Keşfet Kartlarını Getirme
async function loadExploreCards() {
  const stack = document.getElementById('cardStack');
  stack.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">Profiller yükleniyor...</div>';

  try {
    const res = await fetch(`/api/cards?userId=${telegramId}`);
    const data = await res.json();

    if (data.success && data.cards.length > 0) {
      currentCards = data.cards;
      currentIndex = 0;
      renderCurrentCard();
    } else {
      stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">✨ Civarında görüntülenecek yeni profil kalmadı. Daha sonra tekrar kontrol et!</div>';
    }
  } catch (err) {
    console.error('Kart yükleme hatası:', err);
    stack.innerHTML = '<div style="padding: 40px; text-align: center; color: red;">Profiller yüklenemedi.</div>';
  }
}

// 6. Kart Ekrana Basma
function renderCurrentCard() {
  const stack = document.getElementById('cardStack');

  if (currentIndex >= currentCards.length) {
    stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">🎉 Tüm profilleri inceledin! Yeni kullanıcılar katıldığında burada görünecek.</div>';
    return;
  }

  const user = currentCards[currentIndex];
  const photoUrl = (user.photos && user.photos[0]) ? user.photos[0] : '';
  const heightText = user.height ? ` • ${user.height} cm` : '';
  const weightText = user.weight ? ` • ${user.weight} kg` : '';

  stack.innerHTML = `
    <div class="card-image-box">
      ${photoUrl ? `<img src="${photoUrl}" alt="${user.nickname}">` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;">Fotoğraf Yok</div>'}
    </div>
    <div class="card-info">
      <div>
        <div class="card-title">${user.nickname}, ${user.age}</div>
        <div class="card-meta">${user.role || ''} • ${user.expression || ''}${heightText}${weightText}</div>
        <div class="card-bio">${user.bio || 'Henüz bir biyografi eklenmemiş.'}</div>
      </div>
    </div>
  `;
}

// 7. Beğen / Pas Aksiyonu
async function handleCardAction(action) {
  if (currentIndex >= currentCards.length) return;

  const targetUser = currentCards[currentIndex];
  currentIndex++;
  renderCurrentCard();

  try {
    const res = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromUserId: telegramId,
        toUserId: targetUser.telegramId,
        action: action
      })
    });

    const data = await res.json();
    if (data.isMatch) {
      if (tg?.showPopup) {
        tg.showPopup({
          title: '🎉 Eşleştiniz!',
          message: `${targetUser.nickname} ile karşılıklı eşleştiniz! Bot üzerinden sohbet bağlantısı gönderildi.`,
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert(`Tebrikler! ${targetUser.nickname} ile eşleştiniz!`);
      }
    }
  } catch (err) {
    console.error('Aksiyon gönderilemedi:', err);
  }
}
