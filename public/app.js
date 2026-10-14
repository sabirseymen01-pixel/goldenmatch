// ==========================================================================
// GOLDENMATCH - İSTEMCİ UYGULAMA MOTORU (APP.JS)
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

let filterCity = 'Hepsi';
let filterRole = 'Hepsi';
let allLocations = {};

// Sayfa Açılışı
window.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await checkUserProfile();
});

// Şehir & İlçe Verilerini Çekme
async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success) {
      allLocations = data.locations;
      populateCityChips();
      populateFilterCityChips();
    }
  } catch (err) {
    console.error('Konum yükleme hatası:', err);
  }
}

function populateCityChips(filterText = '') {
  const container = document.getElementById('cityChipGrid');
  if (!container) return;
  container.innerHTML = '';

  const cities = Object.keys(allLocations).filter(c => 
    c.toLocaleLowerCase('tr-TR').includes(filterText.toLocaleLowerCase('tr-TR'))
  );

  cities.slice(0, 30).forEach(city => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-chip';
    btn.innerText = city;
    btn.onclick = () => selectCity(city, btn);
    container.appendChild(btn);
  });
}

function filterCityChips() {
  const q = document.getElementById('citySearchInput')?.value || '';
  populateCityChips(q);
}

function selectCity(city, btnElem) {
  document.getElementById('city').value = city;
  document.querySelectorAll('#cityChipGrid .choice-chip').forEach(b => b.classList.remove('selected'));
  if (btnElem) btnElem.classList.add('selected');

  const distContainer = document.getElementById('districtChipGrid');
  if (!distContainer) return;
  distContainer.innerHTML = '';
  document.getElementById('district').value = '';

  const districts = allLocations[city] || [];
  districts.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice-chip';
    b.innerText = d;
    b.onclick = () => {
      document.getElementById('district').value = d;
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
}

// Profil Kontrolü & Yeni Stilize Avatar Senkronizasyonu
async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${window.currentUserId}?username=${window.currentUsername}`);
    const data = await res.json();

    if (data.isAdmin || data.isFounder) {
      document.getElementById('ytNavBtn')?.classList.remove('hidden');
    }

    if (data.exists && data.profile) {
      currentProfile = data.profile;

      // Kayıtlı Stilize Avatar Verisini Eşitle
      if (currentProfile.avatarConfig) {
        localStorage.setItem('gm_avatar_config', JSON.stringify(currentProfile.avatarConfig));
        if (typeof myAvatarConfig !== 'undefined') {
          myAvatarConfig = Object.assign(myAvatarConfig, currentProfile.avatarConfig);
        }
        updateMiniAvatarBadge(currentProfile.avatarConfig);
      }

      fillProfileForm(currentProfile);
      document.getElementById('appNav').classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
      loadDailyPick();
    } else {
      switchTab('register');
    }
  } catch (err) {
    console.error('Profil kontrol hatası:', err);
    switchTab('register');
  }
}

function updateMiniAvatarBadge(cfg) {
  const badge = document.getElementById('mini-avatar-badge');
  if (!badge || !cfg) return;
  badge.innerText = cfg.gender === 'female' ? '💃' : '🕺';
  badge.style.borderColor = cfg.hairColor || '#e5a93c';
}

function fillProfileForm(p) {
  document.getElementById('nickname').value = p.nickname || '';
  document.getElementById('age').value = p.age || '';
  document.getElementById('height').value = p.height || '';
  document.getElementById('weight').value = p.weight || '';
  document.getElementById('bio').value = p.bio || '';

  if (p.city) selectCity(p.city, null);
  if (p.district) document.getElementById('district').value = p.district;
  if (p.role) selectChip('role', p.role, findButtonByText('role', p.role));
  if (p.interestedRole) selectChip('interestedRole', p.interestedRole, findButtonByText('interestedRole', p.interestedRole));
  if (p.archetype) selectChip('archetype', p.archetype, findButtonByCard('archetype', p.archetype));
  if (p.expression) selectChip('expression', p.expression, findButtonByText('expression', p.expression));

  if (p.photos && p.photos.length) {
    p.photos.forEach((url, i) => {
      if (url && i < 4) {
        userPhotos[i] = url;
        const slot = document.getElementById(`slot-${i}`);
        if (slot) {
          const img = slot.querySelector('.slot-preview');
          img.src = url;
          slot.classList.add('has-image');
        }
      }
    });
  }

  document.getElementById('deleteAccountBtn')?.classList.remove('hidden');
}

function findButtonByText(targetName, text) {
  const container = document.querySelector(`[data-target="${targetName}"]`);
  if (!container) return null;
  return Array.from(container.querySelectorAll('button')).find(b => b.innerText.trim() === text);
}

function findButtonByCard(targetName, text) {
  const container = document.querySelector(`[data-target="${targetName}"]`);
  if (!container) return null;
  return Array.from(container.querySelectorAll('button')).find(b => b.innerText.includes(text.split(' ')[0]));
}

// Fotoğraf Seçimi
let activeSlotIndex = 0;
function pickImage(slotIdx) {
  activeSlotIndex = slotIdx;
  document.getElementById('fileSelector').click();
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

// Profil Kaydetme
async function handleFormSubmit(event) {
  event.preventDefault();
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.innerText = '⚡ Mühürleniyor...';

  let currentAvatarConfig = null;
  try {
    const raw = localStorage.getItem('gm_avatar_config');
    if (raw) currentAvatarConfig = JSON.parse(raw);
  } catch (e) {}

  const payload = {
    telegramId: window.currentUserId,
    username: window.currentUsername,
    nickname: document.getElementById('nickname').value.trim(),
    age: Number(document.getElementById('age').value),
    height: Number(document.getElementById('height').value) || null,
    weight: Number(document.getElementById('weight').value) || null,
    role: document.getElementById('role').value,
    interestedRole: document.getElementById('interestedRole').value || 'Hepsi',
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
    archetype: document.getElementById('archetype').value,
    expression: document.getElementById('expression').value,
    bio: document.getElementById('bio').value.trim(),
    photos: userPhotos.filter(p => p !== ''),
    avatarConfig: currentAvatarConfig || (typeof myAvatarConfig !== 'undefined' ? myAvatarConfig : {})
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
      updateMiniAvatarBadge(currentProfile.avatarConfig);
      document.getElementById('appNav').classList.remove('hidden');
      document.getElementById('welcomeModal').classList.remove('hidden');
    } else {
      alert(`Uyarı: ${data.message || 'Kayıt tamamlanamadı.'}`);
    }
  } catch (err) {
    alert('Sunucu iletişim hatası oluştu.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'Profili Mühürle & Başla';
  }
}

function closeWelcomeAndExplore() {
  document.getElementById('welcomeModal').classList.add('hidden');
  switchTab('explore');
  loadExploreCards();
  loadDailyPick();
}

// Sekme Yöneticisi
function switchTab(tabId) {
  if (chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
  }

  document.querySelectorAll('.view-screen').forEach(s => s.classList.add('hidden'));

  if (tabId === 'register') {
    document.getElementById('registerView').classList.remove('hidden');
  } else if (tabId === 'explore') {
    document.getElementById('exploreView').classList.remove('hidden');
    loadExploreCards();
  } else if (tabId === 'inbox') {
    document.getElementById('inboxView').classList.remove('hidden');
    loadInboxChats();
  } else if (tabId === 'chatRoom') {
    document.getElementById('chatRoomView').classList.remove('hidden');
  } else if (tabId === 'metaverse') {
    document.getElementById('metaverseView').classList.remove('hidden');
    if (typeof initMetaverse === 'function') initMetaverse();
  } else if (tabId === 'adminPanel') {
    document.getElementById('adminPanelView').classList.remove('hidden');
    loadAdminDashboard();
  }
}

function openProfileEdit() {
  switchTab('register');
}

// Keşfet / Kartlar
async function loadExploreCards() {
  const stage = document.getElementById('activeCard');
  stage.innerHTML = '<div class="card-loader">Altın kader ağları taranıyor...</div>';

  try {
    const res = await fetch(`/api/cards?userId=${window.currentUserId}&city=${encodeURIComponent(filterCity)}&role=${encodeURIComponent(filterRole)}`);
    const data = await res.json();
    if (data.success) {
      cardsList = data.cards;
      currentCardIndex = 0;
      renderCurrentCard();
    }
  } catch (err) {
    stage.innerHTML = '<div class="card-loader">Kullanıcılar getirilemedi.</div>';
  }
}

function renderCurrentCard() {
  const cardElem = document.getElementById('activeCard');
  if (!cardsList.length || currentCardIndex >= cardsList.length) {
    cardElem.innerHTML = `
      <div class="card-loader">
        <h3 style="color:#e5a93c;">Şimdilik Kimse Kalmadı ✨</h3>
        <p style="font-size:12px; color:#888;">Parametrik 3D Lounge'a geçebilir veya filtreleri değiştirebilirsin.</p>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="ghost-btn" onclick="openFilterModal()">Filtreler</button>
          <button class="primary-btn sm-btn" onclick="switchTab('metaverse')">🏛️ 3D Mekana Gir</button>
        </div>
      </div>`;
    return;
  }

  const user = cardsList[currentCardIndex];
  const photo = user.photos?.[0] || 'https://via.placeholder.com/400x600/181726/e5a93c?text=Foto%C4%9Fraf+Yok';
  const distText = user.distanceKm !== null ? `📍 ${user.distanceKm} km uzakta` : `📍 ${user.city}`;

  cardElem.innerHTML = `
    <img src="${photo}" class="card-img" alt="${user.nickname}">
    <div class="card-overlay">
      <div class="card-title">${user.nickname}, ${user.age}</div>
      <div class="card-meta">${user.role} • ${distText}</div>
      <div class="card-badge-row">
        <span class="card-chip">⚡ ${user.archetype?.split(' ')[0] || 'Apollon'}</span>
        <span class="card-chip">✨ ${user.expression || 'Doğal'}</span>
      </div>
      <div class="card-bio">${user.bio || 'Henüz bir biyografi yazılmamış.'}</div>
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
      body: JSON.stringify({
        fromUserId: window.currentUserId,
        toUserId: targetUser.telegramId,
        action: action
      })
    });
    const data = await res.json();
    if (data.isMatch) {
      alert(`🎉 EŞLEŞTİNİZ!\n\n${targetUser.nickname} ile kaderiniz birleşti! DM kutusundan yazışabilirsiniz.`);
    }
  } catch (err) {}

  currentCardIndex++;
  renderCurrentCard();
}

async function loadDailyPick() {
  try {
    const res = await fetch(`/api/daily-pick?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success && data.dailyPick) {
      const banner = document.getElementById('dailyPickBanner');
      const content = document.getElementById('dailyPickContent');
      const p = data.dailyPick;
      banner.classList.remove('hidden');
      content.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${p.nickname}, ${p.age}</strong> (${p.role})
            <div style="font-size:11px; color:#aaa;">📍 ${p.city} • ${p.archetype?.split(' ')[0] || ''}</div>
          </div>
          <button class="primary-btn sm-btn" onclick="likeDailyPick('${p.telegramId}')">⚡ Beğen</button>
        </div>
      `;
    }
  } catch (e) {}
}

async function likeDailyPick(targetId) {
  await fetch('/api/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromUserId: window.currentUserId, toUserId: targetId, action: 'like' })
  });
  document.getElementById('dailyPickBanner')?.classList.add('hidden');
  alert('Günün seçimi beğenildi!');
}

// DM Sohbetleri (3D Metaverse Kalp Eşleşmeleri Dahil)
async function loadInboxChats() {
  const list = document.getElementById('chatList');
  list.innerHTML = '<div class="card-loader">Sohbetler yükleniyor...</div>';

  try {
    const res = await fetch(`/api/chats?userId=${window.currentUserId}`);
    const data = await res.json();
    if (data.success && data.chats) {
      if (!data.chats.length) {
        list.innerHTML = `
          <div class="card-loader">
            Henüz eşleşme yok.<br>
            <span style="font-size:12px; color:#e5a93c; margin-top:8px; display:block; cursor:pointer;" onclick="switchTab('metaverse')">
              🏛️ 3D Parametrik Lounge'a gidip insanlara kalp atabilirsin!
            </span>
          </div>`;
        return;
      }
      list.innerHTML = '';
      data.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => openChatRoom(chat.matchId, chat.partner);
        
        const badgeTag = chat.source === 'metaverse_heart' ? '<span style="font-size:10px; color:#df5d78; font-weight:bold;">❤️ 3D Lounge</span> ' : '';

        item.innerHTML = `
          <div class="chat-avatar-wrap">
            <img src="${chat.partner.avatar || 'https://via.placeholder.com/60'}" class="chat-avatar" alt="Profil">
          </div>
          <div class="chat-info">
            <div class="chat-name">${chat.partner.nickname}</div>
            <div class="chat-snippet">${badgeTag}${chat.lastMessage}</div>
          </div>
          <div class="chat-time">${chat.lastMessageTime || ''}</div>
        `;
        list.appendChild(item);
      });
    }
  } catch (e) {
    list.innerHTML = '<div class="card-loader">Sohbetler alınamadı.</div>';
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
        paravanStatus.innerText = `🔓 Açık Kimlik (${data.partner.username || 'TG ID Var'})`;
        paravanBtn.style.display = 'none';
      } else if (data.myParavanRequested) {
        paravanStatus.innerText = '⏳ Karşı Tarafın Onayı Bekleniyor';
        paravanBtn.innerText = 'İstek Gönderildi';
      } else {
        paravanStatus.innerText = '🎭 Anonim Sohbet';
        paravanBtn.innerText = '🎭 Paravanı Aç';
        paravanBtn.style.display = 'block';
      }
    }
  } catch (e) {}
}

function renderMessages(messages) {
  const stream = document.getElementById('messageStream');
  stream.innerHTML = '';
  messages.forEach(msg => {
    const isMe = msg.senderId === window.currentUserId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
    bubble.innerHTML = `
      <span>${msg.text}</span>
      <span class="bubble-time">${msg.time}</span>
    `;
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
  try {
    await fetch(`/api/chats/${activeMatchId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: window.currentUserId, text })
    });
    fetchMessages();
  } catch (err) {}
}

function sendIcebreaker(text) {
  document.getElementById('chatInput').value = text;
}

async function requestParavanReveal() {
  if (!activeMatchId) return;
  try {
    const res = await fetch(`/api/chats/${activeMatchId}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUserId })
    });
    const data = await res.json();
    if (data.bothRevealed) {
      alert(`🎉 İki taraf da onayladı! Kullanıcı adı: ${data.partnerUsername}`);
    } else {
      alert('Paravan isteğiniz iletildi. Karşı taraf da açarsa kimlikler görünecek.');
    }
    fetchMessages();
  } catch (e) {}
}

async function cancelCurrentMatch() {
  if (!activeMatchId || !confirm('Bu eşleşmeyi bitirmek istiyor musunuz?')) return;
  await fetch(`/api/chats/${activeMatchId}/unmatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: window.currentUserId })
  });
  switchTab('inbox');
}

// Şikayet İşlemleri
function openChatReportModal() {
  document.getElementById('reportReason').value = '';
  document.getElementById('reportedMessagesPreview').innerText = 'Mevcut sohbet kayıtları kanıt olarak YT Masasına iletilecektir.';
  document.getElementById('reportModal').classList.remove('hidden');
}

function openReportModalCurrentCard() {
  if (currentCardIndex >= cardsList.length) return;
  activePartnerId = cardsList[currentCardIndex].telegramId;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportedMessagesPreview').innerText = 'Profil ve kullanıcı bilgileri incelenmek üzere YT Masasına iletilecek.';
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
}

async function submitReport() {
  const reason = document.getElementById('reportReason').value.trim();
  if (!reason) return alert('Lütfen bir şikayet nedeni yazın.');

  await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterId: window.currentUserId,
      targetId: activePartnerId,
      reason,
      selectedMessages: ['Otomatik sohbet veya profil raporu']
    })
  });
  closeReportModal();
  alert('Şikayetiniz topluluk yönetimine iletildi.');
}

// Filtreler
function populateFilterCityChips() {
  const container = document.getElementById('filterCityChips');
  if (!container) return;
  Object.keys(allLocations).slice(0, 15).forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-chip';
    btn.innerText = c;
    btn.onclick = () => selectFilterCity(c, btn);
    container.appendChild(btn);
  });
}

function selectFilterCity(city, btnElem) {
  filterCity = city;
  document.querySelectorAll('#filterCityChips .choice-chip').forEach(b => b.classList.remove('selected'));
  if (btnElem) btnElem.classList.add('selected');
}

function selectFilterRole(role, btnElem) {
  filterRole = role;
  document.querySelectorAll('#filterRoleChips .choice-chip').forEach(b => b.classList.remove('selected'));
  if (btnElem) btnElem.classList.add('selected');
}

function openFilterModal() {
  document.getElementById('filterModal').classList.remove('hidden');
}

function closeFilterModal() {
  document.getElementById('filterModal').classList.add('hidden');
}

function applyFilters() {
  closeFilterModal();
  loadExploreCards();
}

// Hesap Silme
async function deleteMyAccount() {
  if (!confirm('Hesabınızı silmek istediğinize emin misiniz?')) return;
  await fetch(`/api/profile/${window.currentUserId}`, { method: 'DELETE' });
  alert('Hesabınız kalıcı olarak silindi.');
  location.reload();
}

// YT Paneli (Dashboard)
async function loadAdminDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${window.currentUserId}&username=${window.currentUsername}`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('ytStatTotal').innerText = data.stats.total;
      document.getElementById('ytStatActive').innerText = data.stats.active;
      document.getElementById('ytStatReports').innerText = data.stats.reportsCount;

      const rList = document.getElementById('adminReportsList');
      if (rList) {
        rList.innerHTML = '';
        if (!data.reports || !data.reports.length) {
          rList.innerHTML = '<div style="font-size:12px;color:#777;">Henüz şikayet bulunmuyor.</div>';
        } else {
          data.reports.forEach(r => {
            const item = document.createElement('div');
            item.style = 'border-bottom: 1px solid #333; padding: 6px 0; font-size: 11px;';
            item.innerHTML = `<strong>Hedef:</strong> ${r.targetNickname} (@${r.targetUsername})<br><strong>Sebep:</strong> ${r.reason}<br><small style="color:#aaa;">${r.date}</small>`;
            rList.appendChild(item);
          });
        }
      }

      const mList = document.getElementById('metaverseReportsList');
      if (mList && data.worldReports) {
        mList.innerHTML = '';
        if (!data.worldReports.length) {
          mList.innerHTML = '<div style="font-size:12px;color:#777;">Henüz mekan şikayeti bulunmuyor.</div>';
        } else {
          data.worldReports.forEach(wr => {
            const row = document.createElement('div');
            row.style = 'border-bottom: 1px solid rgba(229,169,60,0.2); padding: 6px 0; font-size: 11px;';
            row.innerHTML = `
              <strong>Raporlayan:</strong> ${wr.reporterId}<br>
              <strong>Sebep:</strong> <span style="color:#ff9f43;">${wr.reason}</span><br>
              <small style="color:#aaa;">📍 X:${Math.round(wr.location.x)} Z:${Math.round(wr.location.z)} | ${new Date(wr.createdAt).toLocaleTimeString('tr-TR')}</small>
            `;
            mList.appendChild(row);
          });
        }
      }

      const uList = document.getElementById('adminUserCards');
      if (uList) {
        uList.innerHTML = '';
        data.users.forEach(u => {
          const card = document.createElement('div');
          card.className = 'admin-user-row';
          card.innerHTML = `
            <div>
              <strong>${u.nickname}</strong> (${u.role}) - ${u.city}<br>
              <small style="color:#888;">TG ID: ${u.telegramId}</small>
            </div>
            <button class="sm-btn ${u.isBanned ? 'gold' : 'danger'}" onclick="toggleBanUser('${u.telegramId}')">
              ${u.isBanned ? 'Yasağı Kaldır' : 'Yasakla'}
            </button>
          `;
          uList.appendChild(card);
        });
      }
    }
  } catch (e) {
    console.error('YT paneli yükleme hatası:', e);
  }
}

async function toggleBanUser(targetId) {
  await fetch('/api/admin/toggle-ban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': window.currentUserId, 'x-user-name': window.currentUsername },
    body: JSON.stringify({ targetTelegramId: targetId })
  });
  loadAdminDashboard();
}

function directYtLogin() {
  switchTab('adminPanel');
}
