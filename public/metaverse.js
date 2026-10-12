// ==========================================================================
// GOLDENMATCH - 3D METAVERSE & HAYALET MODU MOTORU
// ==========================================================================

let scene, camera, renderer, player, joystick;
let moveVector = { x: 0, y: 0 };
let chatBubble = null;

// Yönetici & Hayalet Modu Durumları
let isGhostMode = false;
let isAdminEditor = false;

// 1. Sahneyi Başlatma Fonksiyonu
function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // Sahne zaten kuruluysa sadece boyutları tazele
  if (renderer && scene) {
    onWindowResize();
    return;
  }

  // --- SAHNE & KAMERA ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0914);
  scene.fog = new THREE.FogExp2(0x0a0914, 0.035);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

  // --- RENDERER (Yüksek Kalite & Antialiasing) ---
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = ''; // Temizle
  container.appendChild(renderer.domElement);

  // --- IŞIKLANDIRMA (Lounge & Altın Parıltı) ---
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
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x121118,
    roughness: 0.25,
    metalness: 0.6
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- BAŞLANGIÇ BAR TEZGAHI ---
  createBarCounter();

  // --- SUNUCUDAN KAYITLI DEKORLARI YÜKLE ---
  loadSavedWorldItems();

  // --- OYUNCU AVATARI ---
  createPlayerAvatar();

  // --- MOBİL SANAL JOYSTICK ---
  setupJoystick();

  // Boyut değişimi ve animasyon döngüsü
  window.addEventListener('resize', onWindowResize);
  animate();
}

// 2. Bar Tezgahı
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

// 3. Karakter Gövdesi (GTA / Şık Siluet)
function createPlayerAvatar() {
  player = new THREE.Group();

  // Gövde
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.35, 1.9, 20);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f1f2e, roughness: 0.35 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.45;
  body.castShadow = true;
  player.add(body);

  // Baş
  const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b5, roughness: 0.55 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.75;
  head.castShadow = true;
  player.add(head);

  // Altın Aksesuar (Kolyeli Halka)
  const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.4;
  player.add(ring);

  player.position.set(0, 0, 0);
  scene.add(player);
}

// 4. Mobil Joystick (Nipple.js)
function setupJoystick() {
  const zone = document.getElementById('joystick-zone');
  if (!zone) return;
  zone.innerHTML = ''; // Varsa eskiyi temizle

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

// 5. 3D Chat Baloncuğu
function sendWorldChat() {
  const input = document.getElementById('world-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !player) return;

  if (chatBubble) player.remove(chatBubble);

  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');

  // Arka plan kutusu
  ctx.fillStyle = 'rgba(15, 12, 27, 0.9)';
  ctx.roundRect(10, 10, 280, 120, 20);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Metin
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text.substring(0, 22), 150, 75);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture });
  chatBubble = new THREE.Sprite(spriteMat);
  chatBubble.position.set(0, 4.1, 0);
  chatBubble.scale.set(3.2, 1.6, 1);

  player.add(chatBubble);
  input.value = '';

  setTimeout(() => {
    if (chatBubble) {
      player.remove(chatBubble);
      chatBubble = null;
    }
  }, 4500);
}

// 6. Şikayet Bildirimi (Oyuncu Tarafı)
function sendMetaverseReportPrompt() {
  const reason = prompt("🚨 Mekandaki şikayetinizi yazın (YT Masasına iletilecektir):");
  if (!reason || !reason.trim()) return;

  const currentUserId = window.currentUserId || localStorage.getItem('gm_userId') || 'Anonim';
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
  .then(data => {
    if (data.success) {
      alert("✅ Şikayetiniz 3D konumunuzla birlikte YT Masasına iletildi.");
    } else {
      alert("Hata: " + data.message);
    }
  })
  .catch(() => alert("Sunucuya bağlanılamadı."));
}

// ==========================================================================
// YT / ADMİN: HAYALET MODU & MEKAN EDİTÖRÜ
// ==========================================================================

// YT Paneli Üzerinden Hayalet Olarak Giriş
function enterMetaverseAsGhost() {
  isGhostMode = true;
  isAdminEditor = true;

  // Metaverse sekmesine geç
  switchTab('metaverse');

  alert("👻 Hayalet Modu Devrede!\nMekanda tamamen görünmezsiniz. Canlı düzenleme yapabilirsiniz.");

  // Karakteri yarı saydam yap
  if (player) {
    player.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.35;
      }
    });
  }

  // Editör Çubuğunu Ekrana Getir
  showAdminEditorToolbar();
}

// Editör Çubuğu
function showAdminEditorToolbar() {
  let bar = document.getElementById('admin-editor-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'admin-editor-bar';
    bar.style = `
      position: absolute;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 12, 27, 0.92);
      border: 1px solid #d4af37;
      border-radius: 20px;
      padding: 6px 14px;
      display: flex;
      gap: 8px;
      z-index: 100;
      backdrop-filter: blur(8px);
    `;
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

// Hayalet Görünürlüğünü Aç/Kapa
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

// Eşya Ekleme & Sunucuya Kaydetme
function spawnItem(itemType) {
  if (!isAdminEditor || !player) return;

  const posX = player.position.x;
  const posZ = player.position.z - 2.5; // Oyuncunun biraz önü
  const posY = 0.6;

  renderItemMesh(itemType, { x: posX, y: posY, z: posZ });

  // MongoDB'ye kaydet
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
  }).then(r => r.json()).then(data => {
    console.log("Mekan eşyası kaydedildi:", data);
  });
}

// Eşyayı 3D Sahneye Çizme
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

// Kayıtlı Eşyaları Veritabanından Yükle
function loadSavedWorldItems() {
  fetch('/api/metaverse/items')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.items) {
        data.items.forEach(item => {
          renderItemMesh(item.itemType, item.position);
        });
      }
    })
    .catch(err => console.error("Kayıtlı eşyalar alınamadı:", err));
}

// Boyutlandırma
function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// 7. Oyun Döngüsü & Kamera Takibi (GTA Açısı)
function animate() {
  requestAnimationFrame(animate);

  if (player && (moveVector.x !== 0 || moveVector.y !== 0)) {
    const speed = 0.13;
    player.position.x += moveVector.x * speed;
    player.position.z -= moveVector.y * speed;

    const angle = Math.atan2(moveVector.x, moveVector.y);
    player.rotation.y = angle;
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
