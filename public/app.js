// ==========================================================================
// GOLDENMATCH - GELİŞMİŞ İSTEMCİ UYGULAMA MOTORU (APP.JS)
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
let chatPollingInterval = null;
let windowIsAdmin = false;
let windowIsFounder = false;

let filterCity = 'Hepsi';
let filterDistrict = 'Hepsi';
let filterRole = 'Hepsi';

const DEFAULT_LOCATIONS = {
  "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Beyoğlu", "Bakırköy", "Üsküdar", "Maltepe", "Ataşehir", "Sarıyer", "Fatih", "Bahçelievler", "Avcılar", "Kartal", "Pendik", "Beylikdüzü"],
  "Ankara": ["Çankaya", "Kızılay", "Tunalı", "Bahçelievler", "Yenimahalle", "Batıkent", "Keçiören", "Mamak"],
  "İzmir": ["Alsancak", "Konak", "Karşıyaka", "Bornova", "Buca", "Bostanlı", "Göztepe"],
  "Antalya": ["Muratpaşa", "Konyaaltı", "Lara", "Kepez", "Alanya"],
  "Bursa": ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya"]
};

let allLocations = Object.assign({}, DEFAULT_LOCATIONS);

window.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await checkUserProfile();
});

async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success && data.locations && Object.keys(data.locations).length > 0) {
      allLocations = Object.assign({}, DEFAULT_LOCATIONS, data.locations);
    }
  } catch (err) {}
  populateCityChips();
  populateFilterCityChips();
}

// ----------------- KAYIT / PROFİL ŞEHİR & İLÇE -----------------
function populateCityChips(filterText = '') {
  const container = document.getElementById('cityChipGrid');
  if (!container) return;
  container.innerHTML = '';
  const currentSelectedCity = document.getElementById('city')?.value || '';
  const cities = Object.keys(allLocations).filter(c => c.toLocaleLowerCase('tr-TR').includes(filterText.toLocaleLowerCase('tr-TR')));

  cities.forEach(city => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-chip' + (city === currentSelectedCity ? ' selected' : '');
    btn.innerText = city;
    btn.onclick = () => selectCity(city, btn);
    container.appendChild(btn);
  });
}

function filterCityChips() {
  const q = document.getElementById('citySearchInput')?.value || '';
  populateCityChips(q);
}

function selectCity(city, btnElem, preselectedDistrict = null) {
  const cityInput = document.getElementById('city');
  if (cityInput) cityInput.value = city;

  document.querySelectorAll('#cityChipGrid .choice-chip').forEach(b => {
    if (b.innerText.trim() === city) b.classList.add('selected');
    else b.classList.remove('selected');
  });
  if (btnElem) btnElem.classList.add('selected');

  const distContainer = document.getElementById('districtChipGrid');
  if (!distContainer) return;
  distContainer.innerHTML = '';

  const distInput = document.getElementById('district');
  if (distInput && !preselectedDistrict) distInput.value = '';

  const districts = allLocations[city] || ['Merkez'];
  districts.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-chip';
    b.innerText = d;
    if (preselectedDistrict && d === preselectedDistrict) {
      b.classList.add('selected');
      if (distInput) distInput.value = d;
    }
    b.onclick = () => {
      if (distInput) distInput.value = d;
      distContainer.querySelectorAll('.choice-chip').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    };
    distContainer.appendChild(b);
  });
}

// ----------------- GELİŞMİŞ FİLTRELEME -----------------
function populateFilterCityChips() {
  const container = document.getElementById('filterCityChips');
  if (!container) return;
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'choice-chip' + (filterCity === 'Hepsi' ? ' selected' : '');
  allBtn.innerText = 'Tüm Şehirler';
  allBtn.onclick = () => setFilterCity('Hepsi', allBtn);
  container.appendChild(allBtn);

  Object.keys(allLocations).forEach(city => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-chip' + (city === filterCity ? ' selected' : '');
    btn.innerText = city;
    btn.onclick = () => setFilterCity(city, btn);
    container.appendChild(btn);
  });
}

function setFilterCity(city, elem) {
  filterCity = city;
  filterDistrict = 'Hepsi';
  document.querySelectorAll('#filterCityChips .choice-chip').forEach(b => b.classList.remove('selected'));
  elem.classList.add('selected');
  populateFilterDistrictChips();
}

function populateFilterDistrictChips() {
  const container = document.getElementById('filterDistrictChips');
  if (!container) return;
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'choice-chip selected';
  allBtn.innerText = 'Tüm İlçeler';
  allBtn.onclick = () => setFilterDistrict('Hepsi', allBtn);
  container.appendChild(allBtn);

  if (filterCity !== 'Hepsi' && allLocations[filterCity]) {
    allLocations[filterCity].forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-chip' + (d === filterDistrict ? ' selected' : '');
      btn.innerText = d;
      btn.onclick = () => setFilterDistrict(d, btn);
      container.appendChild(btn);
    });
  }
}

function setFilterDistrict(district, elem) {
  filterDistrict = district;
  document.querySelectorAll('#filterDistrictChips .choice-chip').forEach(b => b.classList.remove('selected'));
  elem.classList.add('selected');
}

function setFilterRole(role, elem) {
  filterRole = role;
  document.querySelectorAll('#filterRoleChips .choice-chip').forEach(b => b.classList.remove('selected'));
  elem.classList.add('selected');
}

function openFilterModal() {
  populateFilterCityChips();
  populateFilterDistrictChips();
  document.getElementById('filterModal')?.classList.remove('hidden');
}

function closeFilterModal() {
  document.getElementById('filterModal')?.classList.add('hidden');
}

function applyFilters() {
  closeFilterModal();
  loadExploreCards();
}

// ----------------- GENEL YETKİ VE PROFİL KONTROLÜ -----------------
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

    if (data.exists && data.profile) {
      currentProfile = data.profile;
      fillProfileForm(currentProfile);
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

function fillProfileForm(p) {
  document.getElementById('nickname').value = p.nickname || '';
  document.getElementById('age').value = p.age || '';
  document.getElementById('height').value = p.height || '';
  document.getElementById('weight').value = p.weight || '';
  document.getElementById('bio').value = p.bio || '';

  if (p.city) selectCity(p.city, null, p.district || null);
  if (p.role) selectChip('role', p.role, findButtonByText('role', p.role));

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
}

function findButtonByText(targetName, text) {
  const container = document.querySelector(`[data-target="${targetName}"]`);
  return container ? Array.from(container.querySelectorAll('button')).find(b => b.innerText.trim() === text) : null;
}

function selectChip(fieldId, value, elem) {
  const input = document.getElementById(fieldId);
  if (input) input.value = value;
  const parent = elem ? elem.closest('.chip-grid') : null;
  if (parent) {
    parent.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    elem.classList.add('selected');
  }
  if (fieldId === 'city') selectCity(value, elem);
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
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
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

function switchTab(tabId) {
  if (chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
  }

  if (tabId === 'adminPanel' && !windowIsAdmin) {
    alert('⚠️ Bu porta sadece Kurucu ve YT üyeleri girebilir!');
    switchTab('explore');
    return;
  }

  document.querySelectorAll('.view-screen').forEach(s => s.classList.add('hidden'));

  const navBar = document.getElementById('appNav');
  if (tabId !== 'register' || currentProfile) {
    navBar?.classList.remove('hidden');
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

async function loadExploreCards() {
  const stage = document.getElementById('activeCard');
  if (!stage) return;
  stage.innerHTML = '<div class="card-loader">Altın kader ağları taranıyor...</div>';
  try {
    const res = await fetch(`/api/cards?userId=${window.currentUserId}&city=${encodeURIComponent(filterCity)}&district=${encodeURIComponent(filterDistrict)}&role=${encodeURIComponent(filterRole)}`);
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
    cardElem.innerHTML = `<div class="card-loader"><h3 style="color:#e5a93c;">Şimdilik Kimse Kalmadı ✨</h3></div>`;
    return;
  }
  const user = cardsList[currentCardIndex];
  const photo = user.photos?.[0] || '';
  cardElem.innerHTML = `
    <img src="${photo}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;" alt="">
    <div style="position:absolute; bottom:0; left:0; right:0; padding:20px; background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);">
      <h3 style="color:#fff; font-size:22px; margin:0 0 4px 0;">${user.nickname}, ${user.age}</h3>
      <p style="color:#d4af37; font-size:13px; margin:0;">${user.role} • 📍 ${user.city} / ${user.district || 'Merkez'}</p>
    </div>
  `;
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

// ----------------- MESAJLAR & UNREAD BADGE -----------------
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
      data.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => openChatRoom(chat.matchId, chat.partner);
        item.innerHTML = `
          <div class="chat-avatar-wrap"><img src="${chat.partner.avatar || ''}" class="chat-avatar" alt=""></div>
          <div class="chat-info"><div class="chat-name">${chat.partner.nickname}</div><div class="chat-snippet">${chat.lastMessage}</div></div>
          <div class="chat-time">${chat.lastMessageTime || ''}</div>
        `;
        list.appendChild(item);
      });
      document.getElementById('unreadBadge')?.classList.add('hidden');
    }
  } catch (e) {
    list.innerHTML = '<div class="card-loader">Sohbetler yüklenemedi.</div>';
  }
}

async function openChatRoom(matchId, partner) {
  activeMatchId = matchId;
  activePartnerId = partner.telegramId;
  switchTab('chatRoom');
  document.getElementById('chatPartnerName').innerText = partner.nickname;
  await fetchMessages();
  chatPollingInterval = setInterval(fetchMessages, 3000);
}

async function fetchMessages() {
  if (!activeMatchId) return;
  try {
    const res = await fetch(`/api/chats/${activeMatchId}?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success) {
      renderMessages(data.messages);
      const paravanStatus = document.getElementById('chatParavanStatus');
      const paravanBtn = document.getElementById('paravanBtn');
      if (data.bothRevealed) {
        paravanStatus.innerText = `🔓 Açık Kimlik (@${data.partner.username || 'Kullanıcı'})`;
        paravanBtn.style.display = 'none';
      } else {
        paravanStatus.innerText = '🎭 Anonim Paravan Sohbeti';
      }
    }
  } catch (e) {}
}

function renderMessages(messages) {
  const stream = document.getElementById('messageStream');
  if (!stream) return;
  stream.innerHTML = '';
  messages.forEach(msg => {
    const isMe = msg.senderId === window.currentUserId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
    bubble.innerHTML = `<span>${msg.text}</span><span class="bubble-time">${msg.time}</span>`;
    stream.appendChild(bubble);
  });
  stream.scrollTop = stream.scrollHeight;
}

async function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !activeMatchId) return;
  input.value = '';
  await fetch(`/api/chats/${activeMatchId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId: window.currentUserId, text })
  });
  fetchMessages();
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

// Şikayet Etme Fonksiyonu
async function reportCurrentPartner() {
  const reason = prompt('Şikayet sebebinizi belirtin (Örn: Uygunsuz davranış):');
  if (!reason || !activePartnerId) return;
  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: activePartnerId, reporterId: window.currentUserId, reason })
    });
    const data = await res.json();
    if (data.success) {
      alert('⚠️ Şikayetiniz YT ekibine iletildi.');
    }
  } catch (e) {
    alert('Şikayet iletilemedi.');
  }
}

// ----------------- YÖNETİCİ (YT) PANELİ & RAPORLAR -----------------
async function loadAdminDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${window.currentUserId}&username=${window.currentUsername}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('ytStatTotal').innerText = data.stats.total;
      document.getElementById('ytStatActive').innerText = data.stats.active;

      const uList = document.getElementById('adminUserCards');
      if (uList && data.users) {
        uList.innerHTML = '<h3 style="color:#d4af37; font-size:14px; margin-bottom:8px;">👥 Üye Listesi & YT Yönetimi</h3>';
        data.users.forEach(u => {
          const isAdmin = data.admins?.includes(u.telegramId) || data.admins?.includes(u.username);
          const card = document.createElement('div');
          card.style.cssText = 'background:#1c1b29; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:6px;';
          card.innerHTML = `
            <div><strong>${u.nickname}</strong> (${u.role}) - <span style="color:#d4af37;">${u.city}</span> ${isAdmin ? '<span style="color:#2ed573;">[YT]</span>' : ''}</div>
            <div style="display:flex; gap:6px;">
              ${windowIsFounder ? `<button onclick="toggleAdmin('${u.telegramId}')" style="background:${isAdmin ? '#e58e26' : '#3c6382'}; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700;">${isAdmin ? 'YT Al' : 'YT Yap'}</button>` : ''}
              <button onclick="toggleBanUser('${u.telegramId}')" style="background:${u.isBanned ? '#2ed573' : '#ff4757'}; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:700;">${u.isBanned ? 'Aç' : 'Banla'}</button>
            </div>
          `;
          uList.appendChild(card);
        });

        // Şikayet ve Raporlar Bölümü
        if (data.reports && data.reports.length > 0) {
          const repHeading = document.createElement('h3');
          repHeading.style.cssText = 'color:#ff4757; font-size:14px; margin:16px 0 8px 0;';
          repHeading.innerText = `🚨 Bildirilen Şikayetler (${data.reports.length})`;
          uList.appendChild(repHeading);

          data.reports.forEach(r => {
            const repCard = document.createElement('div');
            repCard.style.cssText = 'background:#241923; border:1px solid rgba(255,71,87,0.3); padding:10px; border-radius:12px; font-size:12px; margin-bottom:6px; color:#fff;';
            repCard.innerHTML = `
              <div><strong>Şikayet Edilen:</strong> <span style="color:#ff4757;">${r.targetNickname}</span></div>
              <div><strong>Şikayet Eden:</strong> ${r.reporterNickname}</div>
              <div><strong>Sebep:</strong> ${r.reason}</div>
              <div style="font-size:10px; color:#aaa; margin-top:4px;">Tarih: ${r.date}</div>
            `;
            uList.appendChild(repCard);
          });
        }
      }
    }
  } catch (e) {}
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

async function toggleBanUser(targetTelegramId) {
  await fetch('/api/admin/toggle-ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTelegramId, userId: window.currentUserId, username: window.currentUsername })
  });
  loadAdminDashboard();
}
