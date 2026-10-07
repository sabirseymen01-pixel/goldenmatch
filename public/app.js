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
let locationsData = {};

// Aktif Filtre Durumu
let activeFilters = {
  city: 'Hepsi',
  role: 'Hepsi'
};

// Sayfa Yüklendiğinde
window.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await checkUserProfile();
});

// 1. Şehir ve İlçe Verilerini Backend'den Çekme
async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success) {
      locationsData = data.locations;
      populateCityDropdowns();
    }
  } catch (err) {
    console.error('Konum verileri yüklenemedi:', err);
  }
}

function populateCityDropdowns() {
  const citySelect = document.getElementById('city');
  const filterCitySelect = document.getElementById('filterCity');
  const cities = Object.keys(locationsData).sort((a, b) => a.localeCompare(b, 'tr'));

  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    citySelect.appendChild(opt);

    const filterOpt = document.createElement('option');
    filterOpt.value = city;
    filterOpt.textContent = city;
    filterCitySelect.appendChild(filterOpt);
  });
}

function onCityChanged() {
  const citySelect = document.getElementById('city');
  const districtSelect = document.getElementById('district');
  const selectedCity = citySelect.value;

  districtSelect.innerHTML = '<option value="" disabled selected>İlçe / Semt Seçiniz</option>';

  if (locationsData[selectedCity] && locationsData[selectedCity].districts) {
    const districts = Object.keys(locationsData[selectedCity].districts).sort((a, b) => a.localeCompare(b, 'tr'));
    districts.forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });
  }
}

// 2. Profil Durumunu Kontrol Et
async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${telegramId}`);
    const data = await res.json();

    if (data.exists) {
      fillForm(data.profile);
      showExploreView();
      loadExploreCards();
      loadDailyPick();
    } else {
      showRegisterView();
    }
  } catch (err) {
    console.error('Profil kontrol hatası:', err);
    showRegisterView();
  }
}

// 3. Ekran Değiştirme
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
  document.getElementById('interestedRole').value = profile.interestedRole || 'Hepsi';
  document.getElementById('expression').value = profile.expression || '';
  document.getElementById('archetype').value = profile.archetype || '';
  document.getElementById('bio').value = profile.bio || '';

  if (profile.city) {
    document.getElementById('city').value = profile.city;
    onCityChanged();
    if (profile.district) {
      document.getElementById('district').value = profile.district;
    }
  }

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

// 4. Fotoğraf Seçim İşlemleri
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

// 5. Form Kaydetme & Güvenlik/NSFW İşlemi
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!images[0]) {
    alert('Lütfen en az bir ana profil fotoğrafı yükleyin.');
    return;
  }

  const payload = {
    telegramId,
    username,
    nickname: document.getElementById('nickname').value,
    age: document.getElementById('age').value,
    height: document.getElementById('height').value,
    weight: document.getElementById('weight').value,
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
    role: document.getElementById('role').value,
    interestedRole: document.getElementById('interestedRole').value,
    archetype: document.getElementById('archetype').value,
    expression: document.getElementById('expression').value,
    bio: document.getElementById('bio').value,
    photos: images.filter(img => img !== null)
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerText = 'Kutsal Mühür İşleniyor...';

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerText = 'Kutsal Profili Kaydet & Başla';

    if (data.success) {
      showExploreView();
      loadExploreCards();
      loadDailyPick();
    } else {
      alert(data.message || 'Kayıt sırasında bir hata oluştu.');
    }
  } catch (err) {
    console.error('Kayıt isteği hatası:', err);
    alert('Sunucuyla bağlantı kurulamadı.');
    btn.disabled = false;
    btn.innerText = 'Kutsal Profili Kaydet & Başla';
  }
}

// 6. Günün Eşleşmesini Getirme
async function loadDailyPick() {
  try {
    const res = await fetch(`/api/daily-pick?userId=${telegramId}`);
    const data = await res.json();
    const banner = document.getElementById('dailyPickBanner');
    const content = document.getElementById('dailyPickContent');

    if (data.success && data.dailyPick) {
      const p = data.dailyPick;
      const dist = p.distanceKm !== null ? `(${p.distanceKm === 0 ? 'Aynı Semt' : p.distanceKm + ' km'})` : '';
      const archName = p.archetype ? p.archetype.split(' ')[0] : 'Olimpos';
      content.innerHTML = `<strong>${p.nickname}, ${p.age}</strong> • ${p.city}${p.district ? '/' + p.district : ''} ${dist} • <span style="color:#e5a93c;">🏛️ ${archName}</span> • <em>${p.role}</em>`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {
    console.error('Günün seçimi alınamadı:', e);
  }
}

// 7. Keşfet Kartlarını Getirme & Filtreleme
async function loadExploreCards() {
  const stack = document.getElementById('cardStack');
  stack.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">Kader ağları taranıyor...</div>';

  let url = `/api/cards?userId=${telegramId}`;
  if (activeFilters.city !== 'Hepsi') url += `&city=${encodeURIComponent(activeFilters.city)}`;
  if (activeFilters.role !== 'Hepsi') url += `&role=${encodeURIComponent(activeFilters.role)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.cards.length > 0) {
      currentCards = data.cards;
      currentIndex = 0;
      renderCurrentCard();
    } else {
      stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">🏛️ Belirlediğin kriterlere uygun meclis üyesi kalmadı. Filtreleri genişletmeyi dene!</div>';
    }
  } catch (err) {
    console.error('Kart getirme hatası:', err);
    stack.innerHTML = '<div style="padding: 40px; text-align: center; color: #ff4757;">Profiller yüklenemedi.</div>';
  }
}

// 8. Kartı Ekrana Çizme & KM ve Arketip Rozetleri
function renderCurrentCard() {
  const stack = document.getElementById('cardStack');

  if (currentIndex >= currentCards.length) {
    stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">✨ Olimpos\'taki tüm ruhları inceledin! Yeni tanrılar katıldığında burada belirecek.</div>';
    return;
  }

  const user = currentCards[currentIndex];
  const photoUrl = (user.photos && user.photos[0]) ? user.photos[0] : '';
  const heightText = user.height ? ` • ${user.height} cm` : '';
  const weightText = user.weight ? ` • ${user.weight} kg` : '';
  const locationText = `${user.city}${user.district ? ', ' + user.district : ''}`;

  let distanceBadge = '';
  if (user.distanceKm !== null && user.distanceKm !== undefined) {
    const distText = user.distanceKm === 0 ? '📍 Aynı Semt' : `📍 ${user.distanceKm} km`;
    distanceBadge = `<div class="distance-badge">${distText}</div>`;
  }

  const archetypeTag = user.archetype ? `<div class="archetype-badge">🏛️ ${user.archetype.split(' ')[0]}</div>` : '';

  stack.innerHTML = `
    <div class="card-image-box">
      ${photoUrl ? `<img src="${photoUrl}" alt="${user.nickname}">` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;">Fotoğraf Yok</div>'}
      ${distanceBadge}
      ${archetypeTag}
    </div>
    <div class="card-info">
      <div>
        <div class="card-title">${user.nickname}, ${user.age}</div>
        <div class="card-meta">${locationText} • ${user.role || ''} • ${user.expression || ''}${heightText}${weightText}</div>
        <div class="card-bio">${user.bio || 'Bu tanrısal varlık henüz bir destan yazmamış.'}</div>
      </div>
    </div>
  `;
}

// 9. Beğen / Pas Aksiyonu
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
          title: '🎉 Kutsal Eşleşme!',
          message: `${targetUser.nickname} ile karşılıklı eşleştiniz! Mini App üzerinden anonim sohbet başlatabilirsiniz.`,
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert(`Tebrikler! ${targetUser.nickname} ile kutsal eşleşme gerçekleşti!`);
      }
    }
  } catch (err) {
    console.error('Aksiyon hatası:', err);
  }
}

// 10. Filtreleme Modal Yönetimi
function openFilterModal() {
  document.getElementById('filterModal').classList.remove('hidden');
}

function closeFilterModal() {
  document.getElementById('filterModal').classList.add('hidden');
}

function applyFilters() {
  activeFilters.city = document.getElementById('filterCity').value;
  activeFilters.role = document.getElementById('filterRole').value;
  closeFilterModal();
  loadExploreCards();
}
