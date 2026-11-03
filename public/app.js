// ==========================================================================
// GOLDENMATCH - GELİŞMİŞ SIFIR GECİKME & YÖNETİM MOTORU (APP.JS)
// ==========================================================================

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

window.currentUserId = tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : '8245373459';
window.currentUsername = tg?.initDataUnsafe?.user?.username || 'breskavica';

let currentProfile = null;
let cardsList = [];
let currentCardIndex = 0;
let userPhotos = ['', '', '', ''];
let activeMatchId = null;
let activePartnerId = null;
let socket = null;
let windowIsAdmin = false;
let windowIsFounder = false;
let isGhostModeActive = false;
let selectedMessageForReport = null;

let filterCity = 'Hepsi';
let filterDistrict = 'Hepsi';
let filterRole = 'Hepsi';
let filterMinAge = 18;
let filterMaxAge = 99;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

const DEFAULT_LOCATIONS = {
  "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Beyoğlu", "Bakırköy", "Üsküdar", "Maltepe", "Ataşehir", "Sarıyer", "Fatih", "Bahçelievler", "Avcılar", "Kartal", "Pendik", "Beylikdüzü"],
  "Ankara": ["Çankaya", "Kızılay", "Tunalı", "Bahçelievler", "Yenimahalle", "Batıkent", "Keçiören", "Mamak"],
  "İzmir": ["Alsancak", "Konak", "Karşıyaka", "Bornova", "Buca", "Bostanlı", "Göztepe"],
  "Antalya": ["Muratpaşa", "Konyaaltı", "Lara", "Kepez", "Alanya"],
  "Bursa": ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya"]
};

let allLocations = Object.assign({}, DEFAULT_LOCATIONS);

const ROLE_OPTIONS = [
  'Top', 'Bottom', 'Verse', 'Verse Top', 'Verse Bottom', 
  'Side', 'Trans', 'Biseksüel', 'Panseksüel', 'Non-Binary', 'Queer / Akışkan'
];

const INTERESTED_ROLE_OPTIONS = ['Hepsi', 'Top', 'Bottom', 'Verse', 'Verse Top', 'Verse Bottom', 'Side', 'Trans', 'Biseksüel'];
const ARCHETYPE_OPTIONS = ['☀️ Apollon', '🕊️ Afrodit', '⚔️ Ares', '🪽 Hermes'];

let currentActiveField = null;
let currentModalOptions = [];

window.addEventListener('DOMContentLoaded', async () => {
  initSocketConnection();
  await loadLocations();
  await checkUserProfile();
});

// --- SIFIR GECİKME İÇİN OPTİMİZE EDİLMİŞ SOCKET.IO BAĞLANTISI ---
function initSocketConnection() {
  try {
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500
    });

    socket.on('connect', () => {
      if (activeMatchId) socket.emit('join_chat', activeMatchId);
    });

    socket.on('receive_message', (msg) => {
      if (activeMatchId && msg) appendIncomingMessage(msg);
    });
  } catch (e) {}
}

async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success && data.locations && Object.keys(data.locations).length > 0) {
      allLocations = Object.assign({}, DEFAULT_LOCATIONS, data.locations);
    }
  } catch (err) {}
}

// ----------------- DİNAMİK SEÇİM MODALI (SHEET) MOTORU -----------------
function openSelectionModal(fieldType) {
  currentActiveField = fieldType;
  const modal = document.getElementById('dynamicSelectionModal');
  const title = document.getElementById('modalTitle');
  const searchInput = document.getElementById('modalSearchInput');
  const searchWrapper = document.getElementById('modalSearchWrapper');
  
  if (!modal) return;
  modal.classList.remove('hidden');
  if (searchInput) searchInput.value = '';

  if (fieldType === 'city') {
    title.innerText = 'Şehir Seçin';
    searchWrapper.style.display = 'block';
    currentModalOptions = Object.keys(allLocations);
  } else if (fieldType === 'district') {
    const city = document.getElementById('city')?.value;
    if (!city) {
      alert('Lütfen önce bir şehir seçin!');
      closeSelectionModal();
      return;
    }
    title.innerText = `${city} - İlçe / Semt Seçin`;
    searchWrapper.style.display = 'none';
    currentModalOptions = allLocations[city] || ['Merkez'];
  } else if (fieldType === 'role') {
    title.innerText = 'Rolünüzü Seçin';
    searchWrapper.style.display = 'none';
    currentModalOptions = ROLE_OPTIONS;
  } else if (fieldType === 'interestedRole') {
    title.innerText = 'Aradığınız Rolü Seçin';
    searchWrapper.style.display = 'none';
    currentModalOptions = INTERESTED_ROLE_OPTIONS;
  } else if (fieldType === 'archetype') {
    title.innerText = 'Olimpos Arketipi Seçin';
    searchWrapper.style.display = 'none';
    currentModalOptions = ARCHETYPE_OPTIONS;
  } else if (fieldType === 'filterCity') {
    title.innerText = 'Şehir Filtrele';
    searchWrapper.style.display = 'block';
    currentModalOptions = ['Hepsi', ...Object.keys(allLocations)];
  } else if (fieldType === 'filterDistrict') {
    title.innerText = 'İlçe Filtrele';
    searchWrapper.style.display = 'none';
    currentModalOptions = ['Hepsi', ...(allLocations[filterCity] || [])];
  } else if (fieldType === 'filterRole') {
    title.innerText = 'Rol Filtrele';
    searchWrapper.style.display = 'none';
    currentModalOptions = ['Hepsi', ...ROLE_OPTIONS];
  }

  renderModalChips(currentModalOptions);
}

function renderModalChips(options) {
  const container = document.getElementById('modalChipContainer');
  if (!container) return;
  container.innerHTML = '';

  let currentValue = '';
  if (currentActiveField.startsWith('filter')) {
    const map = { 'filterCity': filterCity, 'filterDistrict': filterDistrict, 'filterRole': filterRole };
    currentValue = map[currentActiveField] || '';
  } else {
    currentValue = document.getElementById(currentActiveField)?.value || '';
  }

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-chip' + (opt === currentValue ? ' selected' : '');
    btn.innerText = opt;
    btn.style.cssText = 'padding: 12px 18px; font-size: 13px; border-radius: 20px;';
    btn.onclick = () => selectModalOption(opt);
    container.appendChild(btn);
  });
}

function filterModalItems() {
  const q = document.getElementById('modalSearchInput')?.value.toLocaleLowerCase('tr-TR') || '';
  const filtered = currentModalOptions.filter(o => o.toLocaleLowerCase('tr-TR').includes(q));
  renderModalChips(filtered);
}

function selectModalOption(value) {
  if (currentActiveField.startsWith('filter')) {
    const filterMap = {
      'filterCity': { input: 'filterCityInput', btn: 'filterSelectedCityBtn', setter: (v) => { filterCity = v; filterDistrict = 'Hepsi'; document.getElementById('filterSelectedDistrictBtn').innerText = 'Tüm İlçeler'; } },
      'filterDistrict': { input: 'filterDistrictInput', btn: 'filterSelectedDistrictBtn', setter: (v) => { filterDistrict = v; } },
      'filterRole': { input: 'filterRoleInput', btn: 'filterSelectedRoleBtn', setter: (v) => { filterRole = v; } }
    };
    const conf = filterMap[currentActiveField];
    if (conf) {
      document.getElementById(conf.input).value = value;
      document.getElementById(conf.btn).innerText = value;
      conf.setter(value);
    }
    closeSelectionModal();
    return;
  }

  const input = document.getElementById(currentActiveField);
  if (input) input.value = value;

  const btnMap = {
    'city': 'selectedCityBtn',
    'district': 'selectedDistrictBtn',
    'role': 'selectedRoleBtn',
    'interestedRole': 'selectedInterestedRoleBtn',
    'archetype': 'selectedArchetypeBtn'
  };

  const triggerBtn = document.getElementById(btnMap[currentActiveField]);
  if (triggerBtn) triggerBtn.innerText = value;

  if (currentActiveField === 'city') {
    document.getElementById('district').value = '';
    const distBtn = document.getElementById('selectedDistrictBtn');
    if (distBtn) distBtn.innerText = 'Semt Seçin...';
  }

  closeSelectionModal();
}

function closeSelectionModal() {
  document.getElementById('dynamicSelectionModal')?.classList.add('hidden');
}

// ----------------- FİLTRE MOTORU -----------------
async function openFilterModal() {
  if (windowIsAdmin || isGhostModeActive) {
    document.getElementById('filterModal')?.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/filter/check-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUserId })
    });
    const data = await res.json();
    const badge = document.getElementById('filterRemainingBadge');
    if (badge) badge.innerText = data.remaining;

    if (!data.allowed) {
      if (confirm('Ücretsiz filtre hakkınız bitti! 25 Yıldız ⭐ karşılığında ek 3 filtre hakkı almak ister misiniz?')) {
        buyPremiumOrStars('filter_pack');
        return;
      }
      return;
    }
  } catch (e) {}

  document.getElementById('filterModal')?.classList.remove('hidden');
}

function closeFilterModal() {
  document.getElementById('filterModal')?.classList.add('hidden');
}

function applyFilters() {
  filterMinAge = Number(document.getElementById('filterMinAge')?.value) || 18;
  filterMaxAge = Number(document.getElementById('filterMaxAge')?.value) || 99;
  closeFilterModal();
  loadExploreCards();
}

async function buyPremiumOrStars(productType = 'premium_weekly') {
  try {
    const res = await fetch('/api/billing/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUserId, productType })
    });
    const data = await res.json();
    if (data.success && data.invoiceLink) {
      window.location.href = data.invoiceLink;
    } else {
      alert(data.message || 'Ödeme faturası oluşturulamadı.');
    }
  } catch (e) {
    alert('Sunucu ödeme hatası.');
  }
}

async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${window.currentUserId}?username=${window.currentUsername}`);
    const data = await res.json();

    windowIsAdmin = !!(data.isAdmin || data.isFounder);
    windowIsFounder = !!data.isFounder;

    if (windowIsAdmin) {
      document.getElementById('ytNavBtn')?.classList.remove('hidden');
    } else {
      document.getElementById('ytNavBtn')?.classList.add('hidden');
    }

    // Saat bazlı ihlal (Ban / Timeout) kontrolü
    if (data.profile?.bannedUntil && new Date(data.profile.bannedUntil) > new Date()) {
      showBanCurtain(data.profile.bannedUntil);
    }

    if (data.exists && data.profile) {
      currentProfile = data.profile;
      fillProfileForm(currentProfile);
      document.getElementById('glassDock')?.classList.remove('hidden');
      document.getElementById('appNav')?.classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
      checkUnreadMessages();
    } else {
      switchTab('register');
    }
  } catch (err) {
    switchTab('register');
  }
}

// ----------------- GHOST MODE (HAYALET MOD) -----------------
function toggleGhostMode() {
  isGhostModeActive = !isGhostModeActive;
  const btn = document.getElementById('ghostModeTriggerBtn');
  if (isGhostModeActive) {
    if (btn) {
      btn.style.background = 'linear-gradient(135deg, #2ed573, #1e90ff)';
      btn.innerText = 'Hayalet Mod Aktif (Sınırsız Premium)';
    }
    alert('👻 Hayalet Mod etkinleştirildi! Artık tüm premium özellikleri ücretsiz test edebilirsiniz.');
  } else {
    if (btn) {
      btn.style.background = 'linear-gradient(135deg, #8a2be2, #ff69b4)';
      btn.innerText = 'Hayalet Modu Aktifleştir';
    }
    alert('Hayalet Mod kapatıldı.');
  }
}

// ----------------- SAAT BAZLI İHLAL PERDESİ -----------------
function showBanCurtain(bannedUntilStr) {
  const curtain = document.getElementById('banCurtainOverlay');
  const timerElem = document.getElementById('banCountdownTimer');
  if (!curtain || !timerElem) return;

  curtain.classList.remove('hidden');
  const targetTime = new Date(bannedUntilStr).getTime();

  const interval = setInterval(() => {
    const now = new Date().getTime();
    const diff = targetTime - now;

    if (diff <= 0) {
      clearInterval(interval);
      curtain.classList.add('hidden');
      location.reload();
      return;
    }

    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    timerElem.innerText = `Kalan İhlal Süresi: ${hours}s ${minutes}d ${seconds}s`;
  }, 1000);
}

function fillProfileForm(p) {
  document.getElementById('nickname').value = p.nickname || '';
  document.getElementById('age').value = p.age || '';
  document.getElementById('height').value = p.height || '';
  document.getElementById('weight').value = p.weight || '';
  document.getElementById('bio').value = p.bio || '';

  if (p.city) {
    document.getElementById('city').value = p.city;
    const btn = document.getElementById('selectedCityBtn');
    if (btn) btn.innerText = p.city;
  }
  if (p.district) {
    document.getElementById('district').value = p.district;
    const btn = document.getElementById('selectedDistrictBtn');
    if (btn) btn.innerText = p.district;
  }
  if (p.role) {
    document.getElementById('role').value = p.role;
    const btn = document.getElementById('selectedRoleBtn');
    if (btn) btn.innerText = p.role;
  }
  if (p.interestedRole) {
    document.getElementById('interestedRole').value = p.interestedRole;
    const btn = document.getElementById('selectedInterestedRoleBtn');
    if (btn) btn.innerText = p.interestedRole;
  }
  if (p.archetype) {
    document.getElementById('archetype').value = p.archetype;
    const btn = document.getElementById('selectedArchetypeBtn');
    if (btn) btn.innerText = p.archetype;
  }

  if (p.photos && p.photos.length) {
    p.photos.forEach((url, i) => {
      if (url && i < 4) {
        userPhotos[i] = url;
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
          slot.querySelector('.slot-preview').src = url;
          slot.classList.add('has-image');
        }
      }
    });
  }

  document.getElementById('deactivateAccountBtn')?.classList.remove('hidden');
  document.getElementById('deleteAccountBtn')?.classList.remove('hidden');
}

let activeSlotIndex = 0;
function pickImage(slotIdx) {
  activeSlotIndex = slotIdx;
  document.getElementById('fileSelector')?.click();
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    userPhotos[activeSlotIndex] = base64;
    const slot = document.getElementById(`slot-${activeSlotIndex}`);
    if (slot) {
      slot.querySelector('.slot-preview').src = base64;
      slot.classList.add('has-image');
    }
  };
  reader.readAsDataURL(file);
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.innerText = '⚡ Mühürleniyor...';

  const payload = {
    telegramId: window.currentUserId,
    username: window.currentUsername,
    nickname: document.getElementById('nickname').value.trim(),
    age: Number(document.getElementById('age').value),
    height: Number(document.getElementById('height').value) || null,
    weight: Number(document.getElementById('weight').value) || null,
    role: document.getElementById('role').value,
    interestedRole: document.getElementById('interestedRole').value,
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
    archetype: document.getElementById('archetype').value,
    bio: document.getElementById('bio').value.trim(),
    photos: userPhotos.filter(p => p !== '')
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      currentProfile = data.profile;
      document.getElementById('glassDock')?.classList.remove('hidden');
      document.getElementById('appNav')?.classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
    } else {
      alert(data.message || 'Kayıt başarısız.');
    }
  } catch (err) {
    alert('Sunucu hatası.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'Profili Mühürle & Başla';
  }
}

async function deactivateMyAccount() {
  if (!confirm('Hesabınızı dondurmak istediğinize emin misiniz?')) return;
  try {
    await fetch('/api/profile/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: window.currentUserId })
    });
    alert('Hesabınız donduruldu.');
    location.reload();
  } catch (e) {}
}

async function deleteMyAccount() {
  if (!confirm('Hesabınızı silmek istediğinize emin misiniz?')) return;
  try {
    await fetch(`/api/profile/${window.currentUserId}`, { method: 'DELETE' });
    alert('Hesabınız silindi.');
    location.reload();
  } catch (e) {}
}

function switchTab(tabId) {
  if (tabId === 'adminPanel' && !windowIsAdmin) {
    alert('⚠️ Üyeler YT paneline giremez!');
    switchTab('explore');
    return;
  }

  document.querySelectorAll('.view-screen').forEach(s => s.classList.add('hidden'));

  const glassDock = document.getElementById('glassDock');
  const appNav = document.getElementById('appNav');

  if (tabId !== 'register' || currentProfile) {
    glassDock?.classList.remove('hidden');
    appNav?.classList.remove('hidden');
  }

  if (tabId === 'register') {
    document.getElementById('registerView')?.classList.remove('hidden');
  } else if (tabId === 'explore') {
    document.getElementById('exploreView')?.classList.remove('hidden');
    loadExploreCards();
  } else if (tabId === 'inbox') {
    document.getElementById('inboxView')?.classList.remove('hidden');
    document.getElementById('unreadBadge')?.classList.add('hidden');
    loadInboxChats();
  } else if (tabId === 'chatRoom') {
    document.getElementById('chatRoomView')?.classList.remove('hidden');
  } else if (tabId === 'adminPanel') {
    document.getElementById('adminPanelView')?.classList.remove('hidden');
    loadAdminDashboard();
  }
}

function openProfileEdit() {
  switchTab('register');
}

// ----------------- KEŞFET -----------------
async function loadExploreCards() {
  const stage = document.getElementById('activeCard');
  if (!stage) return;
  stage.innerHTML = '<div class="card-loader">Yakındaki kader ağları taranıyor...</div>';
  try {
    const res = await fetch(`/api/cards?userId=${window.currentUserId}&city=${encodeURIComponent(filterCity)}&district=${encodeURIComponent(filterDistrict)}&role=${encodeURIComponent(filterRole)}&minAge=${filterMinAge}&maxAge=${filterMaxAge}`);
    const data = await res.json();
    if (data.success) {
      cardsList = data.cards;
      currentCardIndex = 0;
      renderCurrentCard();
    }
  } catch (err) {
    stage.innerHTML = '<div class="card-loader">Kullanıcılar yüklenemedi.</div>';
  }
}

function renderCurrentCard() {
  const cardElem = document.getElementById('activeCard');
  if (!cardElem) return;
  if (!cardsList.length || currentCardIndex >= cardsList.length) {
    cardElem.innerHTML = `<div class="card-loader"><h3 style="color:#f3e5ab;">Şimdilik Kimse Kalmadı ✨</h3></div>`;
    return;
  }
  const user = cardsList[currentCardIndex];
  const photo = user.photos?.[0] || '';
  const distanceText = user.distanceKm !== 9999 ? ` • 📍 ${user.distanceKm} km uzakta` : '';
  const premiumBadge = (user.isPremium || isGhostModeActive) ? ' <span class="premium-glow-badge">🌟</span>' : '';
  
  cardElem.innerHTML = `
    <img src="${photo}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; pointer-events:none;" alt="">
    <div style="position:absolute; bottom:0; left:0; right:0; padding:20px; background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);">
      <h3 style="color:#fff; font-size:22px; margin:0 0 4px 0;">${user.nickname}, ${user.age}${premiumBadge}</h3>
      <p style="color:#f3e5ab; font-size:13px; margin:0;">${user.role} • 📍 ${user.city} / ${user.district || 'Merkez'}${distanceText}</p>
    </div>
  `;
  initCardSwipePhysics(cardElem);
}

function initCardSwipePhysics(card) {
  let startX = 0, currentX = 0, isDragging = false;

  const onStart = (clientX) => {
    isDragging = true;
    startX = clientX;
    card.style.transition = 'none';
  };

  const onMove = (clientX) => {
    if (!isDragging) return;
    currentX = clientX - startX;
    const rotate = currentX * 0.06;
    const opacityFactor = Math.max(0.4, 1 - Math.abs(currentX) / 350);
    card.style.transform = `translate(${currentX}px, 0px) rotate(${rotate}deg)`;
    card.style.opacity = opacityFactor;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
    if (currentX > 100) {
      card.style.transform = `translate(500px, 50px) rotate(30deg)`;
      card.style.opacity = '0';
      setTimeout(() => triggerCardSwipe('like'), 250);
    } else if (currentX < -100) {
      card.style.transform = `translate(-500px, 50px) rotate(-30deg)`;
      card.style.opacity = '0';
      setTimeout(() => triggerCardSwipe('pass'), 250);
    } else {
      card.style.transform = 'translate(0px, 0px) rotate(0deg)';
      card.style.opacity = '1';
    }
  };

  card.onmousedown = (e) => onStart(e.clientX);
  window.onmousemove = (e) => onMove(e.clientX);
  window.onmouseup = () => onEnd();

  card.ontouchstart = (e) => onStart(e.touches[0].clientX);
  card.ontouchmove = (e) => onMove(e.touches[0].clientX);
  card.ontouchend = () => onEnd();
}

async function triggerCardSwipe(action) {
  if (currentCardIndex >= cardsList.length) return;
  const targetUser = cardsList[currentCardIndex];
  try {
    const res = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId: window.currentUserId, toUserId: targetUser.telegramId, action })
    });
    const data = await res.json();
    if (data.isMatch) {
      alert(`🎉 EŞLEŞTİNİZ! ${targetUser.nickname} ile mesajlaşabilirsiniz.`);
    }
  } catch (err) {}
  currentCardIndex++;
  renderCurrentCard();
}

// ----------------- MESAJLAR & SIFIR GECİKME -----------------
async function checkUnreadMessages() {
  try {
    const res = await fetch(`/api/chats?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success && data.totalUnread > 0) {
      document.getElementById('unreadBadge')?.classList.remove('hidden');
    } else {
      document.getElementById('unreadBadge')?.classList.add('hidden');
    }
  } catch (e) {}
}

async function loadInboxChats() {
  const list = document.getElementById('chatList');
  if (!list) return;
  list.innerHTML = '<div class="card-loader">Sohbetler yükleniyor...</div>';
  try {
    const res = await fetch(`/api/chats?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success && data.chats) {
      if (!data.chats.length) {
        list.innerHTML = '<div class="card-loader">Henüz eşleşme yok.</div>';
        return;
      }
      list.innerHTML = '';
      const fragment = document.createDocumentFragment();
      data.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => openChatRoom(chat.matchId, chat.partner);
        const premiumBadge = chat.partner.isPremium ? ' <span class="premium-glow-badge">🌟</span>' : '';
        item.innerHTML = `
          <div class="chat-avatar-wrap"><img src="${chat.partner.avatar || ''}" class="chat-avatar" alt=""></div>
          <div class="chat-info"><div class="chat-name">${chat.partner.nickname}${premiumBadge}</div><div class="chat-snippet">${chat.lastMessage}</div></div>
          <div class="chat-time">${chat.lastMessageTime || ''}</div>
        `;
        fragment.appendChild(item);
      });
      list.appendChild(fragment);
      document.getElementById('unreadBadge')?.classList.add('hidden');
    } else {
      list.innerHTML = '<div class="card-loader">Henüz eşleşme yok.</div>';
    }
  } catch (e) {
    list.innerHTML = '<div class="card-loader">Sohbetler yüklenemedi.</div>';
  }
}

// --- OPTİMİZE EDİLMİŞ ANINDA AÇILAN CHAT ODASI (0 Gecikme & DocumentFragment) ---
async function openChatRoom(matchId, partner) {
  activeMatchId = matchId;
  activePartnerId = partner.telegramId;
  selectedMessageForReport = null;
  
  switchTab('chatRoom');
  document.getElementById('chatPartnerName').innerText = partner.nickname;
  
  const stream = document.getElementById('messageStream');
  if (stream) stream.innerHTML = '<div style="text-align:center; color:#f3e5ab; font-size:11px; padding:12px;">⚡ Sohbet yükleniyor...</div>';

  if (socket) socket.emit('join_chat', matchId);

  try {
    const res = await fetch(`/api/chats/${matchId}?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success) {
      renderMessagesOptimized(data.messages);
      const paravanStatus = document.getElementById('chatParavanStatus');
      const paravanBtn = document.getElementById('paravanBtn');
      if (data.bothRevealed) {
        if (paravanStatus) paravanStatus.innerText = `🔓 Açık Kimlik (@${data.partner.username || 'Kullanıcı'})`;
        if (paravanBtn) paravanBtn.style.display = 'none';
      } else {
        if (paravanStatus) paravanStatus.innerText = '🎭 Anonim Paravan Sohbeti';
      }
    }
  } catch (e) {
    if (stream) stream.innerHTML = '<div style="text-align:center; color:#ff4757; font-size:11px;">Bağlantı kurulamadı.</div>';
  }
}

function appendIncomingMessage(msg) {
  const stream = document.getElementById('messageStream');
  if (!stream) return;
  const isMe = msg.senderId === window.currentUserId;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMe ? 'me' : 'them'} selectable`;
  
  let contentHtml = `<span>${msg.text || ''}</span>`;
  if (msg.type === 'image' && msg.mediaUrl) {
    contentHtml = `<img src="${msg.mediaUrl}" alt="Fotoğraf" loading="lazy">`;
  } else if (msg.type === 'audio' && msg.mediaUrl) {
    contentHtml = `<audio controls src="${msg.mediaUrl}" style="max-width:200px; height:32px;"></audio>`;
  }

  const readCheck = isMe && msg.read ? ' <span style="font-size:10px; color:#f3e5ab;">✓✓</span>' : '';
  bubble.innerHTML = `${contentHtml}<span class="bubble-time">${msg.time}${readCheck}</span>`;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}

function renderMessagesOptimized(messages) {
  const stream = document.getElementById('messageStream');
  if (!stream) return;
  stream.innerHTML = '';
  
  if (!messages || !messages.length) {
    stream.innerHTML = '<div style="text-align:center; color:#bfaed6; font-size:11px; padding:20px;">İlk mesajı fısıldayarak buzları eritin... ✨</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  messages.forEach(msg => {
    const isMe = msg.senderId === window.currentUserId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'} selectable`;
    if (selectedMessageForReport === (msg.text || msg.mediaUrl)) {
      bubble.classList.add('selected-for-report');
    }
    bubble.onclick = () => {
      selectedMessageForReport = msg.text || msg.mediaUrl;
      renderMessagesOptimized(messages);
    };

    let contentHtml = `<span>${msg.text || ''}</span>`;
    if (msg.type === 'image' && msg.mediaUrl) {
      contentHtml = `<img src="${msg.mediaUrl}" alt="Fotoğraf" loading="lazy">`;
    } else if (msg.type === 'audio' && msg.mediaUrl) {
      contentHtml = `<audio controls src="${msg.mediaUrl}" style="max-width:200px; height:32px;"></audio>`;
    }

    const readCheck = isMe && msg.read ? ' <span style="font-size:10px; color:#f3e5ab;">✓✓</span>' : '';
    bubble.innerHTML = `${contentHtml}<span class="bubble-time">${msg.time}${readCheck}</span>`;
    fragment.appendChild(bubble);
  });

  stream.appendChild(fragment);
  stream.scrollTop = stream.scrollHeight;
}

async function sendChatMessage(e, customType = 'text', customMediaUrl = '') {
  if (e) e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input ? input.value.trim() : '';
  if (!activeMatchId) return;

  if (customType === 'text' && !text) return;
  if (input) input.value = '';

  const tempMsg = {
    id: 'temp_' + Date.now(),
    senderId: String(window.currentUserId),
    text: text,
    type: customType,
    mediaUrl: customMediaUrl,
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    read: false
  };
  appendIncomingMessage(tempMsg);

  const res = await fetch(`/api/chats/${activeMatchId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderId: window.currentUserId,
      text: customType === 'text' ? text : '',
      type: customType,
      mediaUrl: customMediaUrl
    })
  });
  const data = await res.json();
  if (data.success && socket) {
    socket.emit('send_message', { matchId: activeMatchId, message: data.message });
  }
}

async function onChatMediaSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    await sendChatMessage(null, 'image', base64);
  };
  reader.readAsDataURL(file);
}

async function toggleAudioRecording() {
  const btn = document.getElementById('recordAudioBtn');
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          await sendChatMessage(null, 'audio', reader.result);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      btn?.classList.add('recording');
    } catch (err) {
      alert('Mikrofon erişimi reddedildi.');
    }
  } else {
    mediaRecorder?.stop();
    isRecording = false;
    btn?.classList.remove('recording');
  }
}

async function requestParavanReveal() {
  if (!activeMatchId) return;
  const res = await fetch(`/api/chats/${activeMatchId}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window.currentUserId })
  });
  const data = await res.json();
  if (data.bothRevealed) alert('🎉 Kimlikler açıldı!');
  else alert('🎭 Paravan açma isteği gönderildi.');
  fetchMessages();
}

async function cancelCurrentMatch() {
  if (!activeMatchId || !confirm('Eşleşmeyi bitirmek istiyor musunuz?')) return;
  await fetch(`/api/chats/${activeMatchId}/unmatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window.currentUserId })
  });
  switchTab('inbox');
}

async function reportCurrentPartner() {
  let reason = prompt('Şikayet sebebinizi belirtin:');
  if (!reason || !activePartnerId) return;
  if (selectedMessageForReport) reason += ` [İlgili Mesaj/İçerik: "${selectedMessageForReport}"]`;
  try {
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: activePartnerId, reporterId: window.currentUserId, reason })
    });
    alert('⚠️ Şikayetiniz loglara iletildi.');
    selectedMessageForReport = null;
  } catch (e) {}
}

// ----------------- YT YÖNETİM MASASI & ÜST DOCK PORT GEÇİŞLERİ -----------------
function switchYtPort(portName) {
  document.querySelectorAll('.yt-port-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.yt-top-dock .yt-dock-tab').forEach(btn => btn.classList.remove('active'));

  const targetSec = document.getElementById(`ytPort${portName.charAt(0).toUpperCase() + portName.slice(1)}`);
  if (targetSec) targetSec.classList.add('active');

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

// --- OPTİMİZE EDİLMİŞ 0 GECİKME YÜKLEME (YT PANEL) ---
async function loadAdminDashboard() {
  const uList = document.getElementById('adminUserCards');
  if (uList) uList.innerHTML = '<div class="card-loader">Yönetim verileri taranıyor...</div>';

  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${window.currentUserId}&username=${window.currentUsername}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('ytStatTotal').innerText = data.stats.total || 0;
      document.getElementById('ytStatActive').innerText = data.stats.active || 0;

      if (data.isFounder) {
        document.getElementById('founderPricingSection')?.classList.remove('hidden');
      }

      // 1. ÜYELER PORTU (Fragment Optimizasyonu)
      if (uList && data.users) {
        uList.innerHTML = '';
        if (!data.users.length) {
          uList.innerHTML = '<div style="font-size:11px; color:#888;">Kayıtlı üye bulunmuyor.</div>';
        } else {
          const fragment = document.createDocumentFragment();
          data.users.forEach(u => {
            const tgTag = u.username ? `@${u.username}` : `ID:${u.telegramId}`;
            const card = document.createElement('div');
            card.className = 'admin-card-box';
            card.innerHTML = `
              <div style="margin-bottom:6px;">
                <strong>${u.nickname}</strong> (${u.role}) - <span style="color:#f3e5ab;">${u.city}</span><br>
                <span style="font-size:11px; color:#aaa;">Telegram: <strong style="color:#fff;">${tgTag}</strong> (ID: ${u.telegramId})</span>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button onclick="setMemberTimeout('${u.telegramId}')" style="background:#ff4757; color:#fff; border:none; padding:5px 8px; border-radius:8px; font-weight:700; font-size:11px; cursor:pointer;">⏱️ İhlal / Süre Ver (Saat)</button>
                <button onclick="setPremiumWeeks('${u.telegramId}')" style="background:#f3e5ab; color:#000; border:none; padding:5px 8px; border-radius:8px; font-weight:700; font-size:11px; cursor:pointer;">Prem. Ver</button>
              </div>
            `;
            fragment.appendChild(card);
          });
          uList.appendChild(fragment);
        }
      }

      // 2. ADMİNLER PORTU
      const adminListContainer = document.getElementById('adminListContainer');
      if (adminListContainer && data.adminsList) {
        adminListContainer.innerHTML = '';
        const adminFragment = document.createDocumentFragment();
        data.adminsList.forEach(a => {
          const tgTag = a.username ? `@${a.username}` : `ID:${a.telegramId}`;
          const card = document.createElement('div');
          card.className = 'admin-card-box';
          card.innerHTML = `
            <div style="margin-bottom:6px;">
              <strong>${a.nickname || 'Admin'}</strong> - <span style="color:#2ed573;">[Yönetici]</span><br>
              <span style="font-size:11px; color:#aaa;">Telegram Hesap: <strong style="color:#fff;">${tgTag}</strong> (TG ID: ${a.telegramId})</span>
            </div>
            ${windowIsFounder && String(a.telegramId) !== window.currentUserId ? `<button onclick="toggleAdmin('${a.telegramId}')" style="background:#ff4757; color:#fff; border:none; padding:5px 8px; border-radius:8px; font-weight:700; font-size:11px; cursor:pointer;">YT Yetkisini Al</button>` : ''}
          `;
          adminFragment.appendChild(card);
        });
        adminListContainer.appendChild(adminFragment);
      }

      // 3. PREMİUM & YILDIZ PORTU
      const premList = document.getElementById('premiumSubscribersList');
      if (premList && data.users) {
        const premiumUsers = data.users.filter(u => u.isPremium);
        if (!premiumUsers.length) {
          premList.innerHTML = 'Aktif premium aboneliği olan kullanıcı bulunmuyor.';
        } else {
          premList.innerHTML = '';
          const premFragment = document.createDocumentFragment();
          premiumUsers.forEach(u => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:6px 0; border-bottom:1px solid rgba(255,215,0,0.1); font-size:12px;';
            div.innerHTML = `⭐ <strong>${u.nickname}</strong> (ID: ${u.telegramId}) - Bitiş: <span style="color:#2ed573;">${u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString('tr-TR') : 'Sınırsız'}</span>`;
            premFragment.appendChild(div);
          });
          premList.appendChild(premFragment);
        }
      }

      // 4. ŞİKAYETLER PORTU
      const repContainer = document.getElementById('adminReportsContainer');
      if (repContainer && data.reports) {
        repContainer.innerHTML = '';
        if (data.reports.length === 0) {
          repContainer.innerHTML = '<div style="font-size:11px; color:#888;">Bildirilen şikayet bulunmuyor.</div>';
        } else {
          const repFragment = document.createDocumentFragment();
          data.reports.forEach(r => {
            const card = document.createElement('div');
            card.style.cssText = 'background:rgba(255,71,87,0.1); border:1.5px solid rgba(255,71,87,0.3); padding:10px; border-radius:14px; font-size:11px; margin-bottom:6px; color:#fff;';
            card.innerHTML = `<strong>Şikayet Edilen:</strong> <span style="color:#ff4757;">${r.targetNickname}</span> | <strong>Eden:</strong> ${r.reporterNickname}<br><strong>Sebep:</strong> ${r.reason} (${r.date})`;
            repFragment.appendChild(card);
          });
          repContainer.appendChild(repFragment);
        }
      }

      // 5. SİSTEM LOGLARI PORTU (Aşırı yükü önlemek için son 50 log)
      const logsList = document.getElementById('adminLogsList');
      if (logsList && data.logs) {
        logsList.innerHTML = '';
        const recentLogs = data.logs.slice(-50).reverse();
        const logFragment = document.createDocumentFragment();
        recentLogs.forEach(l => {
          const div = document.createElement('div');
          div.style.cssText = 'background:rgba(0,0,0,0.3); padding:8px; border-radius:10px; margin-bottom:6px; font-size:11px;';
          const timeStr = new Date(l.timestamp).toLocaleString('tr-TR');
          let matchDetail = '';
          if (l.targetAccountName || l.targetUserTgId) {
            matchDetail = `<br><span style="color:#ff69b4;">Target Üye:</span> ${l.targetAccountName || 'Bilinmeyen'} (ID: ${l.targetUserTgId || 'yok'})`;
          }
          div.innerHTML = `<span style="color:#f3e5ab;">[${timeStr}]</span> <strong>Admin:</strong> ${l.adminName} <br><strong>İşlem:</strong> <span style="color:#fff;">${l.action}</span> -> ${l.targetInfo}${matchDetail}`;
          logFragment.appendChild(div);
        });
        logsList.appendChild(logFragment);
      }
    }
  } catch (e) {
    if (uList) uList.innerHTML = '<div style="color:#ff4757; font-size:11px;">Yönetim verileri yüklenemedi.</div>';
  }
}

// Saat bazlı ihlal / uzaklaştırma verme
async function setMemberTimeout(targetTelegramId) {
  let hours = prompt('Kaç saat ihlal (uzaklaştırma) verilsin?', '24');
  if (!hours) return;
  await fetch('/api/admin/timeout-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTelegramId, hours: Number(hours), adminId: window.currentUserId, adminName: window.currentUsername })
  });
  alert(`Üyeye ${hours} saat ihlal cezası verildi.`);
  loadAdminDashboard();
}

async function setPremiumWeeks(targetTelegramId) {
  let weeks = prompt('Kaç hafta Premium tanımlansın?', '1');
  if (!weeks) return;
  await fetch('/api/admin/set-premium-duration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTelegramId, weeks: Number(weeks), adminId: window.currentUserId, adminName: window.currentUsername })
  });
  alert(`${weeks} hafta premium tanımlandı.`);
  loadAdminDashboard();
}

async function clearSystemLogs() {
  if (!confirm('Tüm sistem loglarını silmek istediğinize emin misiniz?')) return;
  await fetch('/api/admin/clear-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: window.currentUserId, adminName: window.currentUsername })
  });
  alert('Loglar temizlendi.');
  loadAdminDashboard();
}

async function updatePricing(key) {
  let priceInputId = key === 'premium_weekly' ? 'priceWeeklyInput' : 'priceFiltersInput';
  let val = document.getElementById(priceInputId)?.value;
  if (!val) return;

  const res = await fetch('/api/admin/update-pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window.currentUserId, username: window.currentUsername, key, priceStars: Number(val) })
  });
  const data = await res.json();
  alert(data.message);
  loadAdminDashboard();
}

async function toggleAdmin(targetId) {
  if (!windowIsFounder) {
    alert('Bu işlem sadece Kurucuya özeldir.');
    return;
  }
  const res = await fetch('/api/admin/toggle-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window.currentUserId, username: window.currentUsername, targetId })
  });
  const data = await res.json();
  alert(data.message);
  loadAdminDashboard();
}
