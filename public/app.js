const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function triggerHaptic(type = 'light') {
  try {
    if (tg?.HapticFeedback) {
      if (type === 'success' || type === 'error' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    }
  } catch (e) {}
}

const tgUser = tg?.initDataUnsafe?.user;
const telegramId = tgUser ? String(tgUser.id) : (localStorage.getItem('gm_tid') || '999999999');
const username = tgUser ? (tgUser.username || '') : (localStorage.getItem('gm_uname') || '');

localStorage.setItem('gm_tid', telegramId);
localStorage.setItem('gm_uname', username);

let selectedSlot = null;
const images = [null, null, null, null];
let currentCards = [];
let currentIndex = 0;
let locationsData = {};
let activeMatchId = null;
let chatPollingInterval = null;
let allAdminUsers = [];
let reportingTargetId = null;
let selectedReportMessages = []; // Şikayet kanıtı olarak seçilen mesajlar

let activeFilters = {
  city: 'Hepsi',
  role: 'Hepsi'
};

// Dokunmatik Sürükleme (Swipe Physics) Değişkenleri
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let isDragging = false;

window.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await checkUserProfile();
});

// ==========================================================================
// 1. KONUM VERİLERİ & DOĞRUDAN ÇİPLER
// ==========================================================================

async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success) {
      locationsData = data.locations;
      renderCityChips();
      renderFilterCityChips();
    }
  } catch (err) {}
}

function renderCityChips(filterText = '') {
  const container = document.getElementById('cityChipGrid');
  if (!container) return;
  container.innerHTML = '';

  const cities = Object.keys(locationsData).sort((a, b) => a.localeCompare(b, 'tr'));
  const filtered = cities.filter(c => c.toLowerCase().includes(filterText.toLowerCase().trim()));

  if (filtered.length === 0) {
    container.innerHTML = '<span style="font-size: 12px; color: #777;">Şehir bulunamadı.</span>';
    return;
  }

  const currentCityVal = document.getElementById('city').value;
  filtered.forEach(city => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `choice-chip ${currentCityVal === city ? 'selected' : ''}`;
    btn.textContent = city;
    btn.onclick = () => onCitySelected(city, btn);
    container.appendChild(btn);
  });
}

function filterCityChips() {
  renderCityChips(document.getElementById('citySearchInput').value);
}

function onCitySelected(city, btnElement) {
  triggerHaptic('light');
  document.getElementById('city').value = city;
  const container = document.getElementById('cityChipGrid');
  container.querySelectorAll('.choice-chip').forEach(c => c.classList.remove('selected'));
  btnElement.classList.add('selected');
  renderDistrictChips(city);
}

function renderDistrictChips(city) {
  const container = document.getElementById('districtChipGrid');
  if (!container) return;
  container.innerHTML = '';
  document.getElementById('district').value = '';

  if (locationsData[city] && locationsData[city].districts) {
    const districts = Object.keys(locationsData[city].districts).sort((a, b) => a.localeCompare(b, 'tr'));
    if (districts.length === 0) {
      document.getElementById('district').value = 'Merkez';
      container.innerHTML = '<span style="font-size: 12px; color: #777;">Merkez</span>';
      return;
    }
    districts.forEach(dist => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-chip';
      btn.textContent = dist;
      btn.onclick = () => onDistrictSelected(dist, btn);
      container.appendChild(btn);
    });
  } else {
    document.getElementById('district').value = 'Merkez';
    container.innerHTML = '<span style="font-size: 12px; color: #777;">Merkez</span>';
  }
}

function onDistrictSelected(district, btnElement) {
  triggerHaptic('light');
  document.getElementById('district').value = district;
  const container = document.getElementById('districtChipGrid');
  container.querySelectorAll('.choice-chip').forEach(c => c.classList.remove('selected'));
  btnElement.classList.add('selected');
}

function renderFilterCityChips() {
  const container = document.getElementById('filterCityChips
