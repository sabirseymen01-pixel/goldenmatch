// ==========================================================================
// GOLDENMATCH - 3D METAVERSE, SOKET & ETKİLEŞİM MOTORU
// ==========================================================================

let scene, camera, renderer, player, joystick;
let moveVector = { x: 0, y: 0 };
let chatBubble = null;
let socket = null;
let otherPlayers = {}; // { socketId: { group: THREE.Group, data: {...} } }
let currentTargetUser = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isGhostMode = false;
let isAdminEditor = false;

function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  if (renderer && scene) {
    onWindowResize();
    return;
  }

  // --- SAHNE & KAMERA ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0914);
  scene.fog = new THREE.FogExp2(0x0a0914, 0.035);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

  // --- RENDERER ---
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // --- IŞIKLAR ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const goldSpot = new THREE.SpotLight(0xd4af37, 2.2, 50, Math.PI / 4, 0.4);
  goldSpot.position.set(0, 16, 6);
  goldSpot.castShadow = true;
  scene.add(goldSpot);

  const neonPurple = new THREE.PointLight(0x8a2be2, 3.5, 30);
  neonPurple.position.set(-12, 6, -10);
  scene.add(neonPurple);

  const neonCyan = new THREE.PointLight(0x00d2d3, 2.5, 25);
  neonCyan.position.set(12, 5, -8);
  scene.add(neonCyan);

  // --- ZEMİN ---
  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x121118, roughness: 0.25, metalness: 0.6 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  createBarCounter();
  loadSavedWorldItems();
  createPlayerAvatar();
  setupJoystick();

  // Tıklama ile Avatar İnceleme (Raycaster)
  renderer.domElement.addEventListener('pointerdown', onSceneClick);

  // Socket.io Canlı Bağlantısı
  setupSocket();

  window.addEventListener('resize', onWindowResize);
  animate();
}

// Socket Bağlantısı
function setupSocket() {
  if (socket) return;
  socket = typeof io !== 'undefined' ? io() : null;
  if (!socket) return;

  const userNickname = document.getElementById('nickname')?.value || 'Misafir';
  const userCity = document.getElementById('city')?.value || '';
  const userDistrict = document.getElementById('district')?.value || '';
  const userRole = document.getElementById('role')?.value || '';
  const userAvatar = (typeof images !== 'undefined' && images[0]) ? images[0] : '';

  // Odaya Katıl
  socket.emit('join_metaverse', {
    telegramId: window.currentUserId,
    nickname: userNickname,
    city: userCity,
    district: userDistrict,
    role: userRole,
    avatar: userAvatar,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    isGhost: isGhostMode
  });

  // Odadaki aktif oyuncuları getir
  socket.on('current_players', (players) => {
    players.forEach(p => addOtherPlayer(p));
  });

  // Yeni oyuncu katıldı
  socket.on('player_joined', (pData) => {
    addOtherPlayer(pData);
  });

  // Oyuncu hareket etti
  socket.on('player_moved', (data) => {
    if (otherPlayers[data.socketId]) {
      const group = otherPlayers[data.socketId].group;
      group.position.set(data.x, data.y, data.z);
      group.rotation.y = data.rotY;
    }
  });

  // Diğer oyuncunun sohbet baloncuğu
  socket.on('player_said', (data) => {
    if (otherPlayers[data.socketId]) {
      showBubbleOnMesh(otherPlayers[data.socketId].group, data.text);
    }
  });

  // Karşılıklı Eşleşme Bildirimi
  socket.on('match_notification', ({ user1, user2 }) => {
    if (window.currentUserId === user1 || window.currentUserId === user2) {
      alert("🎉 TEBRİKLER! Karşılıklı kalpleştiniz! DM kutusundan sohbet açıldı!");
      if (typeof checkInboxBadge === 'function') checkInboxBadge();
    }
  });

  // Oyuncu ayrıldı
  socket.on('player_left', (socketId) => {
    if (otherPlayers[socketId]) {
      scene.remove(otherPlayers[socketId].group);
      delete otherPlayers[socketId];
    }
  });
}

// Diğer Oyuncunun Modelini Sahneye Ekleme
function addOtherPlayer(pData) {
  if (otherPlayers[pData.socketId] || pData.telegramId === window.currentUserId) return;

  const group = new THREE.Group();
  
  // Gövde
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.35, 1.9, 20);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4e, roughness: 0.35 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.45;
  body.castShadow = true;
  group.add(body);

  // Baş
  const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b5, roughness: 0.55 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.75;
  head.castShadow = true;
  group.add(head);

  // Baş Üstü İsim Etiketi
  const nameSprite = createNameSprite(pData.nickname);
  nameSprite.position.set(0, 3.6, 0);
  group.add(nameSprite);

  group.position.set(pData.x, pData.y, pData.z);
  group.userData = pData;
  scene.add(group);

  otherPlayers[pData.socketId] = { group, data: pData };
}

// İsim Etiketi Sprite
function createNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.roundRect(10, 10, 236, 44, 12);
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 38);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

// Raycaster: Tıklanan Avatarı Algılama
function onSceneClick(event) {
  const container = document.getElementById('canvas-container');
  if (!container || !camera) return;

  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const playerMeshes = Object.values(otherPlayers).map(p => p.group);
  const intersects = raycaster.intersectObjects(playerMeshes, true);

  if (intersects.length > 0) {
    let clickedGroup = intersects[0].object;
    while (clickedGroup.parent && !clickedGroup.userData.telegramId) {
      clickedGroup = clickedGroup.parent;
    }

    if (clickedGroup.userData && clickedGroup.userData.telegramId) {
      openMetaverseProfileModal(clickedGroup.userData);
    }
  }
}

// Profil Modalını Açma
function openMetaverseProfileModal(data) {
  currentTargetUser = data;
  document.getElementById('metaProfileName').innerText = data.nickname;
  document.getElementById('metaProfileMeta').innerText = `${data.role || 'Belirtilmemiş'} • ${data.city || 'Şehir Yok'}`;
  document.getElementById('metaProfileDistance').innerText = `📍 ${data.district || 'Merkez'}`;
  document.getElementById('metaProfileImg').src = data.avatar || 'https://via.placeholder.com/80';
  document.getElementById('metaverseProfileModal').classList.remove('hidden');
}

function closeMetaverseProfileModal() {
  document.getElementById('metaverseProfileModal').classList.add('hidden');
  currentTargetUser = null;
}

// Seçilen Oyuncuya Kalp Gönderme
function sendHeartToCurrentTarget() {
  if (!currentTargetUser || !socket) return;
  socket.emit('send_world_heart', {
    fromUserId: window.currentUserId,
    toUserId: currentTargetUser.telegramId
  });
  alert(`❤️ ${currentTargetUser.nickname} kullanıcısına kalp gönderildi! Karşılık verirse DM açılacak.`);
  closeMetaverseProfileModal();
}

// Bar Tezgahı
function createBarCounter() {
  const barMat = new THREE.MeshStandardMaterial({ color: 0x24180d, roughness: 0.3, metalness: 0.2 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.15 });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 3.5), barMat);
  counter.position.set(0, 1.2, -14);
  counter.castShadow = true;
  counter.receiveShadow = true;
  scene.add(counter);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.2, 3.7), goldTrim);
  trim.position.set(0, 2.4, -14);
  scene.add(trim);
}

// Kendi Karakteri
function createPlayerAvatar() {
  player = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.35, 1.9, 20);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f1f2e, roughness: 0.35 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.45;
  body.castShadow = true;
  player.add(body);

  const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b5, roughness: 0.55 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.75;
  head.castShadow = true;
  player.add(head);

  const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.4;
  player.add(ring);

  player.position.set(0, 0, 0);
  scene.add(player);
}

// Joystick
function setupJoystick() {
  const zone = document.getElementById('joystick-zone');
  if (!zone) return;
  zone.innerHTML = '';

  joystick = nipplejs.create({
    zone: zone,
    mode: 'static',
    position: { left: '60px', top: '60px' },
    color: '#d4af37',
    size: 90
  });

  joystick.on('move', (evt, data) => {
    moveVector.x = data.vector.x;
    moveVector.y = data.vector.y;
  });

  joystick.on('end', () => {
    moveVector.x = 0;
    moveVector.y = 0;
  });
}

// Sohbet Baloncuğu
function sendWorldChat() {
  const input = document.getElementById('world-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !player) return;

  showBubbleOnMesh(player, text);

  if (socket) {
    socket.emit('world_chat_message', { text });
  }

  input.value = '';
}

function showBubbleOnMesh(targetMesh, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 12, 27, 0.9)';
  ctx.roundRect(10, 10, 280, 120, 20);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text.substring(0, 22), 150, 75);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture });
  const bubble = new THREE.Sprite(spriteMat);
  bubble.position.set(0, 4.3, 0);
  bubble.scale.set(3.2, 1.6, 1);

  targetMesh.add(bubble);
  setTimeout(() => targetMesh.remove(bubble), 4500);
}

// Şikayet Bildirimi
function sendMetaverseReportPrompt() {
  const reason = prompt("🚨 Mekandaki şikayetinizi yazın (YT Masasına iletilecektir):");
  if (!reason || !reason.trim()) return;

  const currentUserId = window.currentUserId || 'Anonim';
  const pos = player ? { x: player.position.x, y: player.position.y, z: player.position.z } : { x: 0, y: 0, z: 0 };

  fetch('/api/metaverse/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterId: currentUserId,
      type: 'chat_abuse',
      reason: reason.trim(),
      location: pos
    })
  })
  .then(res => res.json())
  .then(data => alert(data.success ? "✅ Şikayetiniz YT Masasına iletildi." : "Hata: " + data.message))
  .catch(() => alert("Sunucuya bağlanılamadı."));
}

// YT Hayalet Modu
function enterMetaverseAsGhost() {
  isGhostMode = true;
  isAdminEditor = true;
  switchTab('metaverse');
  alert("👻 Hayalet Modu Devrede! Diğer oyuncular sizi görmüyor.");

  if (player) {
    player.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.35;
      }
    });
  }
  showAdminEditorToolbar();
}

function showAdminEditorToolbar() {
  let bar = document.getElementById('admin-editor-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'admin-editor-bar';
    bar.style = `position: absolute; top: 15px; left: 50%; transform: translateX(-50%); background: rgba(15, 12, 27, 0.92); border: 1px solid #d4af37; border-radius: 20px; padding: 6px 14px; display: flex; gap: 8px; z-index: 100; backdrop-filter: blur(8px);`;
    bar.innerHTML = `
      <span style="color:#d4af37; font-size:12px; font-weight:bold; align-self:center;">🛠 Editör:</span>
      <button onclick="spawnItem('table')" style="background:#262635; color:#fff; border:1px solid #555; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">+ Masa</button>
      <button onclick="spawnItem('bar_stool')" style="background:#262635; color:#fff; border:1px solid #555; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">+ Tabure</button>
      <button onclick="spawnItem('neon_light')" style="background:#262635; color:#fff; border:1px solid #555; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">+ Işık</button>
      <button onclick="toggleGhostVisibility()" id="ghostToggleBtn" style="background:#6a11cb; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">👁 Hayalet: Açık</button>
    `;
    document.getElementById('metaverseView').appendChild(bar);
  }
}

function toggleGhostVisibility() {
  isGhostMode = !isGhostMode;
  const btn = document.getElementById('ghostToggleBtn');
  if (btn) btn.innerText = `👁 Hayalet: ${isGhostMode ? 'Açık' : 'Kapalı'}`;

  if (player) {
    player.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = isGhostMode;
        child.material.opacity = isGhostMode ? 0.35 : 1.0;
      }
    });
  }
}

function spawnItem(itemType) {
  if (!isAdminEditor || !player) return;
  const posX = player.position.x;
  const posZ = player.position.z - 2.5;
  const posY = 0.6;

  renderItemMesh(itemType, { x: posX, y: posY, z: posZ });

  fetch('/api/admin/metaverse/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemType,
      position: { x: posX, y: posY, z: posZ },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      updatedBy: 'YT_Masası'
    })
  });
}

function renderItemMesh(itemType, pos) {
  let geo, mat;
  if (itemType === 'table') {
    geo = new THREE.CylinderGeometry(1.2, 1.2, 1.2, 16);
    mat = new THREE.MeshStandardMaterial({ color: 0x3d2716, roughness: 0.3 });
  } else if (itemType === 'bar_stool') {
    geo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16);
    mat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
  } else if (itemType === 'neon_light') {
    geo = new THREE.SphereGeometry(0.3, 16, 16);
    mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  } else {
    geo = new THREE.BoxGeometry(1, 1, 1);
    mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function loadSavedWorldItems() {
  fetch('/api/metaverse/items')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.items) {
        data.items.forEach(item => renderItemMesh(item.itemType, item.position));
      }
    });
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animasyon & Hareket Senkronizasyonu
let lastSend = 0;
function animate() {
  requestAnimationFrame(animate);

  if (player && (moveVector.x !== 0 || moveVector.y !== 0)) {
    const speed = 0.13;
    player.position.x += moveVector.x * speed;
    player.position.z -= moveVector.y * speed;

    const angle = Math.atan2(moveVector.x, moveVector.y);
    player.rotation.y = angle;

    const now = Date.now();
    if (socket && now - lastSend > 50) {
      lastSend = now;
      socket.emit('player_move', {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotY: player.rotation.y
      });
    }
  }

  if (player) {
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + 4.2;
    camera.position.z = player.position.z + 7.5;
    camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
