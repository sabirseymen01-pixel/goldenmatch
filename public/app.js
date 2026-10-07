const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tgUser = tg?.initDataUnsafe?.user;
const telegramId = tgUser ? String(tgUser.id) : '999999999';
const username = tgUser ? (tgUser.username || '') : '';

let selectedSlot = null;
const images = [null, null, null, null];
let currentCards = [];
let currentIndex = 0;
let locationsData = {};
let activeMatchId = null;
let chatPollingInterval = null;
let allAdminUsers = [];

let activeFilters = {
  city: 'Hepsi',
  role: 'Hepsi'
};

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
  } catch (err) {
    console.error('Konum yükleme hatası:', err);
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

// 2. Profil Durumu Kontrolü
async function checkUserProfile() {
  try {
    const res = await fetch(`/api/profile/${telegramId}?username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (data.isAdmin) {
      document.getElementById('ytNavBtn').classList.remove('hidden');
    }

    if (data.exists) {
      fillForm(data.profile);
      document.getElementById('appNav').classList.remove('hidden');
      switchTab('explore');
      loadExploreCards();
      loadDailyPick();
      checkInboxBadge();
    } else {
      showRegisterView();
    }
  } catch (err) {
    console.error('Profil kontrol hatası:', err);
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
        slotElem.querySelector('.slot-preview').src = photo;
        slotElem.querySelector('.slot-preview').style.display = 'block';
        slotElem.querySelector('.slot-icon').style.display = 'none';
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
    images[selectedSlot] = e.target.result;
    const slotElem = document.getElementById(`slot-${selectedSlot}`);
    slotElem.querySelector('.slot-preview').src = e.target.result;
    slotElem.querySelector('.slot-preview').style.display = 'block';
    slotElem.querySelector('.slot-icon').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// 5. Profil Form Kaydetme
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
    expression: document.getElementById('expression').value,
    bio: document.getElementById('bio').value,
    photos: images.filter(img => img !== null)
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerText = 'Fotoğraflar taranıyor ve kaydediliyor...';

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet & Keşfet';

    if (data.success) {
      document.getElementById('appNav').classList.remove('hidden');
      switchTab('explore');
    } else {
      alert(data.message || 'Kayıt sırasında hata oluştu.');
    }
  } catch (err) {
    alert('Sunucuya bağlanılamadı.');
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet & Keşfet';
  }
}

// 6. Günün Eşleşmesi
async function loadDailyPick() {
  try {
    const res = await fetch(`/api/daily-pick?userId=${telegramId}`);
    const data = await res.json();
    const banner = document.getElementById('dailyPickBanner');
    const content = document.getElementById('dailyPickContent');

    if (data.success && data.dailyPick) {
      const p = data.dailyPick;
      const dist = p.distanceKm !== null ? `(${p.distanceKm === 0 ? 'Aynı Semt' : p.distanceKm + ' km'})` : '';
      content.innerHTML = `<strong>${p.nickname}, ${p.age}</strong> • ${p.city}${p.district ? '/' + p.district : ''} ${dist} • <em>${p.role}</em>`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {
    console.error(e);
  }
}

// 7. Keşfet Kartları
async function loadExploreCards() {
  const stack = document.getElementById('cardStack');
  stack.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">Uygun profiller taranıyor...</div>';

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
      stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">✨ Civarında yeni profil kalmadı. Filtreleri genişletmeyi deneyebilirsin!</div>';
    }
  } catch (err) {
    stack.innerHTML = '<div style="padding: 40px; text-align: center; color: #ff4757;">Profiller yüklenemedi.</div>';
  }
}

function renderCurrentCard() {
  const stack = document.getElementById('cardStack');
  if (currentIndex >= currentCards.length) {
    stack.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #aaa;">🎉 Tüm profilleri inceledin! Yeni kullanıcılar geldiğinde burada göreceksin.</div>';
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

  stack.innerHTML = `
    <div class="card-image-box">
      ${photoUrl ? `<img src="${photoUrl}" alt="${user.nickname}">` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;">Fotoğraf Yok</div>'}
      ${distanceBadge}
    </div>
    <div class="card-info">
      <div>
        <div class="card-title">${user.nickname}, ${user.age}</div>
        <div class="card-meta">${locationText} • ${user.role || ''} • ${user.expression || ''}${heightText}${weightText}</div>
        <div class="card-bio">${user.bio || 'Henüz bir biyografi eklenmemiş.'}</div>
      </div>
    </div>
  `;
}

// 8. Beğeni & Pas
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
  } catch (err) {
    console.error(err);
  }
}

// 9. DM Kutusu ve Rozet
async function checkInboxBadge() {
  try {
    const res = await fetch(`/api/chats?userId=${telegramId}`);
    const data = await res.json();
    const badge = document.getElementById('unreadBadge');
    if (data.success && data.totalUnread > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {
    console.error(e);
  }
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
        item.className = 'chat-item';
        item.onclick = () => openChatRoom(chat.matchId);

        const avatar = chat.partner.avatar || 'https://via.placeholder.com/50';
        const unreadClass = chat.unread ? 'unread' : '';

        item.innerHTML = `
          <img src="${avatar}" class="chat-avatar">
          <div class="chat-info">
            <div class="chat-name">
              <span>${chat.partner.nickname}</span>
              <span class="chat-time">${chat.lastMessageTime ? chat.lastMessageTime.slice(11, 16) || '' : ''}</span>
            </div>
            <div class="chat-snippet ${unreadClass}">${chat.lastMessage}</div>
          </div>
        `;
        list.appendChild(item);
      });
    } else {
      list.innerHTML = '<div style="text-align: center; color: #aaa; padding: 50px 20px;">Henüz aktif bir eşleşmen yok. Keşfetmeye devam et! ✨</div>';
    }
  } catch (err) {
    list.innerHTML = '<div style="text-align: center; color: #ff4757; padding: 30px;">Sohbetler yüklenemedi.</div>';
  }
}

// 10. Anonim Chat & Paravan
async function openChatRoom(matchId) {
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
      paravanAlert.innerHTML = `🎉 <strong>Paravan Açıldı!</strong> Telegram hesabı: <strong>${data.partner.username}</strong>`;
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
      bubble.className = `message-bubble ${isMe ? 'me' : 'partner'}`;
      bubble.innerHTML = `${msg.text} <span class="msg-time">${msg.time}</span>`;
      stream.appendChild(bubble);
    });

    stream.scrollTop = stream.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

async function sendChatMessage(e) {
  e.preventDefault();
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
  } catch (err) {
    console.error(err);
  }
}

async function requestParavanReveal() {
  if (!activeMatchId) return;
  if (!confirm('Telegram kullanıcı adını karşı tarafla paylaşmak istiyor musun?')) return;

  try {
    const res = await fetch(`/api/chats/${activeMatchId}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: telegramId })
    });
    const data = await res.json();
    if (data.success) refreshChatRoom();
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------------------------
// 11. KAYITSIZ DOĞRUDAN YT GİRİŞİ & YÖNETİM MASASI
// ----------------------------------------------------

async function directYtLogin() {
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, username })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('appNav').classList.remove('hidden');
      document.getElementById('ytNavBtn').classList.remove('hidden');
      switchTab('adminPanel');
    } else {
      // Eğer Telegram ID / Username otomatik listede değilse şifre sor
      const keyPrompt = prompt('Telegram hesabınız (@' + (username || 'gizli') + ') otomatik YT listesinde bulunamadı. Lütfen YT Şifrenizi girin:');
      if (!keyPrompt) return;

      const keyRes = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, username, key: keyPrompt })
      });
      const keyData = await keyRes.json();

      if (keyData.success) {
        document.getElementById('appNav').classList.remove('hidden');
        document.getElementById('ytNavBtn').classList.remove('hidden');
        switchTab('adminPanel');
      } else {
        alert('Hatalı şifre veya yetkisiz erişim!');
      }
    }
  } catch (err) {
    alert('YT doğrulama sunucusuna erişilemedi.');
  }
}

async function loadAdminDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard-data?userId=${telegramId}&username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (!data.success) {
      alert(data.message || 'Yetki reddedildi!');
      switchTab('explore');
      return;
    }

    document.getElementById('ytStatTotal').innerText = data.stats.total;
    document.getElementById('ytStatActive').innerText = data.stats.active;
    document.getElementById('ytStatBanned').innerText = data.stats.banned;

    allAdminUsers = data.users;
    renderAdminUserCards(allAdminUsers);

    // Aktif Yetkililer Listesini Göster
    const adminListEl = document.getElementById('activeAdminsList');
    const uNames = data.admins.usernames.map(u => `@${u}`).join(', ');
    const ids = data.admins.ids.join(', ');
    adminListEl.innerHTML = `<strong>Yetkili Listesi:</strong> ${uNames || 'Kullanıcı adı yok'} ${ids ? `| ID'ler: ${ids}` : ''}`;

  } catch (err) {
    console.error('Yönetim verisi çekilemedi:', err);
  }
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
    const card = document.createElement('div');
    card.className = 'admin-u-card';

    card.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
        ${photo ? `<img src="${photo}" class="admin-u-photo">` : '<div style="width:44px;height:44px;border-radius:50%;background:#333;margin-right:10px;"></div>'}
        <div class="admin-u-details">
          <div class="admin-u-name">${u.nickname}, ${u.age}</div>
          <div class="admin-u-meta">${u.city} / ${u.district || '-'} • <strong>${u.role}</strong></div>
          <div class="admin-u-tg">${tgDisplay}</div>
        </div>
      </div>
      <div>
        <button class="${u.isBanned ? 'admin-unban-btn' : 'admin-ban-btn'}" onclick="toggleBanUser('${u.telegramId}')">
          ${u.isBanned ? 'Yasağı Aç' : 'Yasakla'}
        </button>
      </div>
    `;
    container.appendChild(card);
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
  if (!confirm('Bu kullanıcının durumunu değiştirmek istiyor musunuz?')) return;

  try {
    const res = await fetch('/api/admin/toggle-ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': telegramId,
        'x-user-name': username
      },
      body: JSON.stringify({ targetTelegramId: targetTgId })
    });
    const data = await res.json();
    if (data.success) loadAdminDashboard();
  } catch (err) {
    alert('İşlem tamamlanamadı.');
  }
}

async function addAdminTarget() {
  const target = document.getElementById('newAdminTarget').value.trim();
  if (!target) return alert('Lütfen @kullaniciadi veya Telegram ID girin.');

  try {
    const res = await fetch('/api/admin/add-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': telegramId,
        'x-user-name': username
      },
      body: JSON.stringify({ target })
    });
    const data = await res.json();
    alert(data.message);
    document.getElementById('newAdminTarget').value = '';
    loadAdminDashboard();
  } catch (err) {
    alert('Yönetici eklenemedi.');
  }
}

async function removeAdminTarget() {
  const target = document.getElementById('newAdminTarget').value.trim();
  if (!target) return alert('Lütfen kaldırılacak @kullaniciadi veya ID girin.');

  try {
    const res = await fetch('/api/admin/remove-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': telegramId,
        'x-user-name': username
      },
      body: JSON.stringify({ target })
    });
    const data = await res.json();
    alert(data.message);
    document.getElementById('newAdminTarget').value = '';
    loadAdminDashboard();
  } catch (err) {
    alert('Yönetici yetkisi kaldırılamadı.');
  }
}

// 12. Filtre Modalı
function openFilterModal() { document.getElementById('filterModal').classList.remove('hidden'); }
function closeFilterModal() { document.getElementById('filterModal').classList.add('hidden'); }
function applyFilters() {
  activeFilters.city = document.getElementById('filterCity').value;
  activeFilters.role = document.getElementById('filterRole').value;
  closeFilterModal();
  loadExploreCards();
}
