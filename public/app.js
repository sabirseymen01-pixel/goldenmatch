// ==========================================================================
// GOLDENMATCH - SAF İSTEMCİ UYGULAMA MOTORU (APP.JS)
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

const DEFAULT_LOCATIONS = {
  "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Beyoğlu", "Bakırköy", "Üsküdar", "Maltepe", "Ataşehir", "Sarıyer", "Fatih"],
  "Ankara": ["Çankaya", "Kızılay", "Tunalı", "Bahçelievler", "Yenimahalle"],
  "İzmir": ["Alsancak", "Konak", "Karşıyaka", "Bornova", "Buca"],
  "Antalya": ["Muratpaşa", "Konyaaltı", "Lara", "Kepez"],
  "Bursa": ["Nilüfer", "Osmangazi", "Yıldırım"]
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
}

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

async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${window.currentUserId}?username=${window.currentUsername}`);
    const data = await res.json();

    if (data.isAdmin || data.isFounder) {
      document.getElementById('ytNavBtn')?.classList.remove('hidden');
    }

    if (data.exists && data.profile) {
      currentProfile = data.profile;
      fillProfileForm(currentProfile);
      document.getElementById('appNav')?.classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
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
    const res = await fetch(`/api/cards?userId=${window.currentUserId}&city=Hepsi&role=Hepsi`);
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
      <p style="color:#d4af37; font-size:13px; margin:0;">${user.role} • 📍 ${user.city}</p>
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

async function loadAdminDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${window.currentUserId}&username=${window.currentUsername}`);
    const data = await res.json();
    if (data.success) {
      const uList = document.getElementById('adminUserCards');
      if (uList && data.users) {
        uList.innerHTML = '';
        data.users.forEach(u => {
          const card = document.createElement('div');
          card.className = 'admin-user-row';
          card.innerHTML = `<div><strong>${u.nickname}</strong> (${u.role})</div>`;
          uList.appendChild(card);
        });
      }
    }
  } catch (e) {}
}
