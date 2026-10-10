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

let activeFilters = {
  city: 'Hepsi',
  role: 'Hepsi'
};

// Touch Drag Değişkenleri
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let isDragging = false;

window.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await checkUserProfile();
});

// 1. Konum Verileri
async function loadLocations() {
  try {
    const res = await fetch('/api/locations');
    const data = await res.json();
    if (data.success) {
      locationsData = data.locations;
      populateCityDropdowns();
    }
  } catch (err) {}
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

  districtSelect.innerHTML = '<option value="" disabled selected>İlçe Seç</option>';

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

// 2. Profil Durumu (Otomatik Oturum)
async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${telegramId}?username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (data.isAdmin) {
      document.getElementById('ytNavBtn').classList.remove('hidden');
    }

    if (data.exists) {
      fillForm(data.profile);
      document.getElementById('deleteAccountBtn').classList.remove('hidden');
      document.getElementById('appNav').classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
      loadDailyPick();
      checkInboxBadge();
    } else {
      document.getElementById('deleteAccountBtn').classList.add('hidden');
      showRegisterView();
    }
  } catch (err) {
    showRegisterView();
  }
}

// 3. Tab Değiştirme
function showRegisterView() {
  document.getElementById('registerView').classList.remove('hidden');
  document.getElementById('exploreView').classList.add('hidden');
  document.getElementById('inboxView').classList.add('hidden');
  document.getElementById('chatRoomView').classList.add('hidden');
  document.getElementById('adminPanelView').classList.add('hidden');
}

function switchTab(tabName) {
  triggerHaptic('light');
  if (chatPollingInterval) clearInterval(chatPollingInterval);

  document.getElementById('registerView').classList.add('hidden');
  document.getElementById('exploreView').classList.add('hidden');
  document.getElementById('inboxView').classList.add('hidden');
  document.getElementById('chatRoomView').classList.add('hidden');
  document.getElementById('adminPanelView').classList.add('hidden');

  if (tabName === 'explore') {
    document.getElementById('exploreView').classList.remove('hidden');
    loadExploreCards();
  } else if (tabName === 'inbox') {
    document.getElementById('inboxView').classList.remove('hidden');
    loadInboxChats();
  } else if (tabName === 'adminPanel') {
    document.getElementById('adminPanelView').classList.remove('hidden');
    loadAdminDashboard();
  }
  checkInboxBadge();
}

function openProfileEdit() {
  triggerHaptic('medium');
  showRegisterView();
}

function fillForm(profile) {
  document.getElementById('nickname').value = profile.nickname || '';
  document.getElementById('age').value = profile.age || '';
  document.getElementById('height').value = profile.height || '';
  document.getElementById('weight').value = profile.weight || '';
  document.getElementById('role').value = profile.role || '';
  document.getElementById('interestedRole').value = profile.interestedRole || 'Hepsi';
  document.getElementById('archetype').value = profile.archetype || '';
  document.getElementById('expression').value = profile.expression || '';
  document.getElementById('bio').value = profile.bio || '';

  if (profile.city) {
    document.getElementById('city').value = profile.city;
    onCityChanged();
    if (profile.district) document.getElementById('district').value = profile.district;
  }

  if (profile.photos && profile.photos.length > 0) {
    profile.photos.forEach((photo, idx) => {
      if (idx < 4 && photo) {
        images[idx] = photo;
        const slotElem = document.getElementById(`slot-${idx}`);
        const imgElem = slotElem.querySelector('.slot-preview');
        imgElem.src = photo;
        imgElem.style.display = 'block';
        const placeholder = slotElem.querySelector('.slot-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        const plus = slotElem.querySelector('.plus-icon');
        if (plus) plus.style.display = 'none';
      }
    });
  }
}

// 4. Fotoğraf Seçim İşlemleri
function pickImage(slotIndex) {
  triggerHaptic('light');
  selectedSlot = slotIndex;
  document.getElementById('fileSelector').click();
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    images[selectedSlot] = e.target.result;
    const slotElem = document.getElementById(`slot-${selectedSlot}`);
    const imgElem = slotElem.querySelector('.slot-preview');
    imgElem.src = e.target.result;
    imgElem.style.display = 'block';

    const placeholder = slotElem.querySelector('.slot-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    const plus = slotElem.querySelector('.plus-icon');
    if (plus) plus.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// 5. Profil Kaydetme
async function handleFormSubmit(e) {
  e.preventDefault();
  triggerHaptic('medium');

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
  btn.innerText = 'Fotoğraflar Taranıyor...';

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
      triggerHaptic('success');
      document.getElementById('deleteAccountBtn').classList.remove('hidden');
      document.getElementById('appNav').classList.remove('hidden');
      switchTab('explore');
    } else {
      triggerHaptic('error');
      alert(data.message || 'Hata oluştu.');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet & Başla';
  }
}

// 6. Hesap Silme
async function deleteMyAccount() {
  triggerHaptic('warning');
  if (!confirm('Hesabınızı, fotoğraflarınızı ve tüm sohbetlerinizi kalıcı olarak silmek istiyor musunuz?')) return;
  if (!confirm('Bu işlem GERİ ALINAMAZ. Profiliniz tamamen silinecek!')) return;

  try {
    const res = await fetch(`/api/profile/${telegramId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      triggerHaptic('success');
      alert('Hesabınız başarıyla silindi.');
      localStorage.removeItem('gm_cached_profile');
      document.getElementById('regForm').reset();
      images.fill(null);
      document.querySelectorAll('.slot-preview').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.slot-placeholder').forEach(p => p.style.display = 'flex');
      document.getElementById('appNav').classList.add('hidden');
      document.getElementById('deleteAccountBtn').classList.add('hidden');
      showRegisterView();
    }
  } catch (err) {
    alert('İşlem tamamlanamadı.');
  }
}

// 7. Günün Eşleşmesi
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
  } catch (e) {}
}

// 8. Keşfet Kartları & Rozetler
async function loadExploreCards() {
  const stage = document.getElementById('activeCard');
  stage.innerHTML = '<div class="card-loader">Altın kader ağları taranıyor...</div>';

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
      stage.innerHTML = '<div class="card-loader">✨ Civarında görüntülenecek yeni profil kalmadı.<br><br>Filtreleri genişletmeyi deneyebilirsin!</div>';
    }
  } catch (err) {
    stage.innerHTML = '<div class="card-loader" style="color:#ff4757;">Profiller yüklenemedi.</div>';
  }
}

function renderCurrentCard() {
  const card = document.getElementById('activeCard');
  card.className = 'tinder-card';
  card.style.transform = '';
  card.style.opacity = '1';

  if (currentIndex >= currentCards.length) {
    card.innerHTML = '<div class="card-loader">🎉 Tüm profilleri inceledin!<br><br>Yeni kullanıcılar katıldığında burada belirecek.</div>';
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
    distanceBadge = `<div class="pill-badge">${distText}</div>`;
  }

  const archetypeBadge = user.archetype ? `<div class="archetype-badge">🏛️ ${user.archetype.split(' ')[0]}</div>` : '';

  card.innerHTML = `
    ${photoUrl ? `<img src="${photoUrl}" class="card-bg-img" alt="${user.nickname}">` : '<div style="width:100%;height:100%;background:#1a1a23;"></div>'}
    <div class="card-gradient-overlay"></div>
    <div class="swipe-stamp stamp-like" id="stampLike">BEĞEN</div>
    <div class="swipe-stamp stamp-pass" id="stampPass">PAS</div>
    ${distanceBadge}
    ${archetypeBadge}
    <div class="card-meta-box">
      <div class="meta-name-age">${user.nickname}, ${user.age}</div>
      <div class="meta-tags">
        <span class="tag-pill gold">${user.role || 'Belirtilmemiş'}</span>
        <span class="tag-pill">${locationText}</span>
        <span class="tag-pill">${user.expression || ''}${heightText}${weightText}</span>
      </div>
      <div class="meta-bio">${user.bio || 'Henüz bir biyografi eklenmemiş.'}</div>
    </div>
  `;

  initTouchDrag(card);
}

// 9. DOKUNMATİK KAYDIRMA FİZİK MOTORU
function initTouchDrag(cardElement) {
  cardElement.addEventListener('touchstart', onDragStart, { passive: true });
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  cardElement.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragStart(e) {
  if (currentIndex >= currentCards.length) return;
  isDragging = true;
  const touch = e.touches ? e.touches[0] : e;
  startX = touch.clientX;
  startY = touch.clientY;
  currentX = startX;
  currentY = startY;

  const card = document.getElementById('activeCard');
  card.classList.remove('animate-spring');
}

function onDragMove(e) {
  if (!isDragging) return;
  const touch = e.touches ? e.touches[0] : e;
  currentX = touch.clientX;
  currentY = touch.clientY;

  const deltaX = currentX - startX;
  const deltaY = currentY - startY;

  if (e.cancelable && Math.abs(deltaX) > 10) e.preventDefault();

  const rotate = deltaX * 0.08;
  const card = document.getElementById('activeCard');
  card.style.transform = `translate3d(${deltaX}px, ${deltaY * 0.3}px, 0) rotate(${rotate}deg)`;

  const stampLike = document.getElementById('stampLike');
  const stampPass = document.getElementById('stampPass');

  if (deltaX > 25) {
    if (stampLike) stampLike.style.opacity = Math.min((deltaX - 25) / 80, 1);
    if (stampPass) stampPass.style.opacity = 0;
  } else if (deltaX < -25) {
    if (stampPass) stampPass.style.opacity = Math.min((Math.abs(deltaX) - 25) / 80, 1);
    if (stampLike) stampLike.style.opacity = 0;
  } else {
    if (stampLike) stampLike.style.opacity = 0;
    if (stampPass) stampPass.style.opacity = 0;
  }
}

function onDragEnd() {
  if (!isDragging) return;
  isDragging = false;

  const deltaX = currentX - startX;
  const threshold = 110;
  const card = document.getElementById('activeCard');

  if (deltaX > threshold) {
    triggerCardSwipe('like');
  } else if (deltaX < -threshold) {
    triggerCardSwipe('pass');
  } else {
    card.classList.add('animate-spring');
    card.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    const stampLike = document.getElementById('stampLike');
    const stampPass = document.getElementById('stampPass');
    if (stampLike) stampLike.style.opacity = 0;
    if (stampPass) stampPass.style.opacity = 0;
    triggerHaptic('light');
  }
}

function triggerCardSwipe(action) {
  if (currentIndex >= currentCards.length) return;
  const card = document.getElementById('activeCard');

  if (action === 'like') {
    triggerHaptic('medium');
    card.classList.add('fly-right');
  } else {
    triggerHaptic('light');
    card.classList.add('fly-left');
  }

  setTimeout(() => {
    handleCardAction(action);
  }, 220);
}

// 10. Beğeni / Pas Gönderme
async function handleCardAction(action) {
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
      triggerHaptic('success');
      checkInboxBadge();
      if (tg?.showPopup) {
        tg.showPopup({
          title: '🎉 Tebrikler, Eşleştiniz!',
          message: `${targetUser.nickname} ile karşılıklı beğendiniz! DM kutusundan anonim sohbete başlayabilirsiniz.`,
          buttons: [{ type: 'ok' }]
        });
      } else {
        alert(`Tebrikler! ${targetUser.nickname} ile eşleştiniz! DM kutusuna bakınız.`);
      }
    }
  } catch (err) {}
}

// 11. DM Kutusu ve Rozet
async function checkInboxBadge() {
  try {
    const res = await fetch(`/api/chats?userId=${telegramId}`);
    const data = await res.json();
    const badge = document.getElementById('unreadBadge');
    if (data.success && data.totalUnread > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  } catch (e) {}
}

async function loadInboxChats() {
  const list = document.getElementById('chatList');
  list.innerHTML = '<div style="text-align: center; color: #888; padding: 30px;">Sohbetler getiriliyor...</div>';

  try {
    const res = await fetch(`/api/chats?userId=${telegramId}`);
    const data = await res.json();

    if (data.success && data.chats.length > 0) {
      list.innerHTML = '';
      data.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'inbox-card';
        item.onclick = () => openChatRoom(chat.matchId);

        const avatar = chat.partner.avatar || 'https://via.placeholder.com/50';
        const unreadClass = chat.unread ? 'unread' : '';

        item.innerHTML = `
          <img src="${avatar}" class="inbox-avatar" alt="${chat.partner.nickname}">
          <div class="inbox-info">
            <div class="inbox-top">
              <span>${chat.partner.nickname}</span>
              <span class="inbox-time">${chat.lastMessageTime ? chat.lastMessageTime.slice(11, 16) || '' : ''}</span>
            </div>
            <div class="inbox-snippet ${unreadClass}">${chat.lastMessage}</div>
          </div>
        `;
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<div style="text-align: center; color: #888; padding: 60px 20px;">Henüz aktif bir eşleşmen yok.<br><br>Profilleri keşfetmeye devam et! ✨</div>';
    }
  } catch (err) {
    list.innerHTML = '<div style="text-align: center; color: #ff4757; padding: 30px;">Sohbetler yüklenemedi.</div>';
  }
}

// 12. Anonim Chat Odası & Paravan
async function openChatRoom(matchId) {
  triggerHaptic('light');
  activeMatchId = matchId;
  document.getElementById('inboxView').classList.add('hidden');
  document.getElementById('chatRoomView').classList.remove('hidden');

  await refreshChatRoom();
  chatPollingInterval = setInterval(refreshChatRoom, 3000);
}

async function refreshChatRoom() {
  if (!activeMatchId) return;

  try {
    const res = await fetch(`/api/chats/${activeMatchId}?userId=${telegramId}`);
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('chatPartnerName').innerText = data.partner.nickname;
    const paravanAlert = document.getElementById('paravanAlert');
    const paravanBtn = document.getElementById('paravanBtn');

    if (data.bothRevealed) {
      document.getElementById('chatParavanStatus').innerText = `🔓 ${data.partner.username}`;
      paravanAlert.innerHTML = `🎉 <strong>Paravan Açıldı!</strong> Telegram Adresi: <strong>${data.partner.username}</strong>`;
      paravanAlert.classList.remove('hidden');
      paravanBtn.style.display = 'none';
    } else if (data.myParavanRequested) {
      document.getElementById('chatParavanStatus').innerText = '⏳ İstek Gönderildi';
      paravanAlert.innerHTML = '🎭 Paravan açma isteğin iletildi. Karşı taraf onayladığında Telegram adresi belirecek.';
      paravanAlert.classList.remove('hidden');
      paravanBtn.innerText = '⏳ Onay Bekleniyor';
      paravanBtn.disabled = true;
    } else {
      document.getElementById('chatParavanStatus').innerText = '🎭 Anonim Sohbet';
      paravanAlert.classList.add('hidden');
      paravanBtn.innerText = '🎭 Paravanı Aç';
      paravanBtn.disabled = false;
      paravanBtn.style.display = 'block';
    }

    const stream = document.getElementById('messageStream');
    stream.innerHTML = '';

    data.messages.forEach(msg => {
      const bubble = document.createElement('div');
      const isMe = msg.senderId === telegramId;
      bubble.className = `chat-bubble ${isMe ? 'me' : 'partner'}`;
      bubble.innerHTML = `${msg.text} <span class="bubble-time">${msg.time}</span>`;
      stream.appendChild(bubble);
    });

    stream.scrollTop = stream.scrollHeight;
  } catch (err) {}
}

async function sendChatMessage(e) {
  e.preventDefault();
  triggerHaptic('light');
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !activeMatchId) return;

  input.value = '';
  try {
    const res = await fetch(`/api/chats/${activeMatchId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: telegramId, text })
    });
    const data = await res.json();
    if (data.success) refreshChatRoom();
  } catch (err) {}
}

async function requestParavanReveal() {
  triggerHaptic('medium');
  if (!activeMatchId) return;
  if (!confirm('Telegram kullanıcı adınızı karşı tarafla paylaşmak istiyor musunuz?')) return;

  try {
    const res = await fetch(`/api/chats/${activeMatchId}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: telegramId })
    });
    const data = await res.json();
    if (data.success) {
      triggerHaptic('success');
      refreshChatRoom();
    }
  } catch (err) {}
}

// 13. Eşleşmeyi İptal Et (Unmatch)
async function cancelCurrentMatch() {
  triggerHaptic('warning');
  if (!activeMatchId) return;
  if (!confirm('Bu eşleşmeyi bitirmek ve sohbeti kalıcı olarak silmek istiyor musunuz?')) return;

  try {
    const res = await fetch(`/api/chats/${activeMatchId}/unmatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: telegramId })
    });
    const data = await res.json();
    if (data.success) {
      triggerHaptic('success');
      switchTab('inbox');
    }
  } catch (err) {}
}

// 14. Şikayet Et (Report)
function openReportModalCurrentCard() {
  triggerHaptic('light');
  if (currentIndex >= currentCards.length) return;
  const user = currentCards[currentIndex];
  reportingTargetId = user.telegramId;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
}

async function submitReport() {
  const reason = document.getElementById('reportReason').value.trim();
  if (!reason) return alert('Lütfen bir açıklama girin.');

  triggerHaptic('medium');
  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterId: telegramId, targetId: reportingTargetId, reason })
    });
    const data = await res.json();
    if (data.success) {
      triggerHaptic('success');
      alert('Şikayet iletildi.');
      closeReportModal();
      triggerCardSwipe('pass');
    }
  } catch (err) {}
}

// 15. YT Girişi & Yönetim Masası
async function directYtLogin() {
  triggerHaptic('medium');
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, username })
    });
    const data = await res.json();

    if (data.success) {
      triggerHaptic('success');
      document.getElementById('appNav').classList.remove('hidden');
      document.getElementById('ytNavBtn').classList.remove('hidden');
      switchTab('adminPanel');
    } else {
      const keyPrompt = prompt('Telegram hesabınız listede bulunamadı. Lütfen YT Şifresini girin:');
      if (!keyPrompt) return;

      const keyRes = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, username, key: keyPrompt })
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
  } catch (err) {}
}

async function loadAdminDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${telegramId}&username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!data.success) {
      switchTab('explore');
      return;
    }

    document.getElementById('ytStatTotal').innerText = data.stats.total;
    document.getElementById('ytStatActive').innerText = data.stats.active;
    document.getElementById('ytStatReports').innerText = data.stats.reportsCount;

    allAdminUsers = data.users;
    renderAdminUserCards(allAdminUsers);
    renderAdminReports(data.reports);

    const adminListEl = document.getElementById('activeAdminsList');
    const uNames = data.admins.usernames.map(u => `@${u}`).join(', ');
    const ids = data.admins.ids.join(', ');
    adminListEl.innerHTML = `<strong>Yetkililer:</strong> ${uNames || 'Yok'} ${ids ? `| ID'ler: ${ids}` : ''}`;
  } catch (err) {}
}

function renderAdminReports(reports) {
  const container = document.getElementById('adminReportsList');
  container.innerHTML = '';

  if (!reports || reports.length === 0) {
    container.innerHTML = '<div style="font-size: 12px; color: #777; padding: 10px;">Gelen şikayet bulunmuyor.</div>';
    return;
  }

  reports.forEach(r => {
    const card = document.createElement('div');
    card.className = 'report-row-card';
    card.innerHTML = `
      <div class="report-row-header">
        <span>Hedef: ${r.targetNickname} (@${r.targetUsername})</span>
        <span style="font-size: 10px; opacity: 0.6;">${r.date}</span>
      </div>
      <div class="report-reason-text">"${r.reason}"</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
        <span style="font-size: 10px; color: #888;">Şikayet Eden: ${r.reporterNickname}</span>
        <button class="sm-btn danger" onclick="toggleBanUser('${r.targetId}')">Kullanıcıyı Yasakla</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAdminUserCards(usersToRender) {
  const container = document.getElementById('adminUserCards');
  container.innerHTML = '';

  if (usersToRender.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #777; padding: 30px;">Kayıtlı üye bulunamadı.</div>';
    return;
  }

  usersToRender.forEach(u => {
    const photo = u.photos && u.photos[0] ? u.photos[0] : '';
    const tgDisplay = u.username ? `@${u.username}` : `ID: ${u.telegramId}`;
    const row = document.createElement('div');
    row.className = 'admin-row';

    row.innerHTML = `
      <div class="admin-row-user">
        ${photo ? `<img src="${photo}" class="admin-row-avatar">` : '<div style="width:42px;height:42px;border-radius:50%;background:#222;"></div>'}
        <div>
          <div style="font-weight:700;font-size:14px;color:#fff;">${u.nickname}, ${u.age}</div>
          <div style="font-size:11px;color:#8e8e9a;">${u.city} / ${u.district || '-'} • <strong>${u.role}</strong></div>
          <div style="font-size:12px;color:#e5a93c;font-weight:600;">${tgDisplay}</div>
        </div>
      </div>
      <div>
        <button class="sm-btn ${u.isBanned ? 'gold' : 'danger'}" onclick="toggleBanUser('${u.telegramId}')">
          ${u.isBanned ? 'Yasağı Aç' : 'Yasakla'}
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function filterAdminUserList() {
  const q = document.getElementById('userSearchInput').value.toLowerCase().trim();
  const filtered = allAdminUsers.filter(u => {
    const nick = (u.nickname || '').toLowerCase();
    const uname = (u.username || '').toLowerCase();
    const city = (u.city || '').toLowerCase();
    const id = String(u.telegramId || '');
    return nick.includes(q) || uname.includes(q) || city.includes(q) || id.includes(q);
  });
  renderAdminUserCards(filtered);
}

async function toggleBanUser(targetTgId) {
  triggerHaptic('warning');
  if (!confirm('Bu kullanıcının durumunu değiştirmek istiyor musunuz?')) return;

  try {
    const res = await fetch('/api/admin/toggle-ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': telegramId, 'x-user-name': username },
      body: JSON.stringify({ targetTelegramId: targetTgId })
    });
    const data = await res.json();
    if (data.success) {
      triggerHaptic('success');
      loadAdminDashboard();
    }
  } catch (err) {}
}

async function addAdminTarget() {
  const target = document.getElementById('newAdminTarget').value.trim();
  if (!target) return alert('Lütfen @kullaniciadi veya ID girin.');

  try {
    const res = await fetch('/api/admin/add-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': telegramId, 'x-user-name': username },
      body: JSON.stringify({ target })
    });
    const data = await res.json();
    triggerHaptic('success');
    document.getElementById('newAdminTarget').value = '';
    loadAdminDashboard();
  } catch (err) {}
}

async function removeAdminTarget() {
  const target = document.getElementById('newAdminTarget').value.trim();
  if (!target) return alert('Lütfen kaldırılacak @kullaniciadi veya ID girin.');

  try {
    const res = await fetch('/api/admin/remove-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': telegramId, 'x-user-name': username },
      body: JSON.stringify({ target })
    });
    const data = await res.json();
    triggerHaptic('success');
    document.getElementById('newAdminTarget').value = '';
    loadAdminDashboard();
  } catch (err) {}
}

// 16. Filtre Modalı
function openFilterModal() { triggerHaptic('light'); document.getElementById('filterModal').classList.remove('hidden'); }
function closeFilterModal() { document.getElementById('filterModal').classList.add('hidden'); }
function applyFilters() {
  triggerHaptic('medium');
  activeFilters.city = document.getElementById('filterCity').value;
  activeFilters.role = document.getElementById('filterRole').value;
  closeFilterModal();
  loadExploreCards();
}
