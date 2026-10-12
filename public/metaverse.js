// ==========================================================================
// GOLDENMATCH - 3D ANTİK YUNAN LOUNGE, İNSANSI AVATAR & SOKET MOTORU
// ==========================================================================

let scene, camera, renderer, player, joystick;
let moveVector = { x: 0, y: 0 };
let chatBubble = null;
let socket = null;
let otherPlayers = {}; // { socketId: { group: THREE.Group, data: {...} } }
let currentTargetUser = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Eklemli Yürüyüş ve Animasyon Durumları
let walkCycle = 0;
let isMoving = false;

// Yönetici & Hayalet Modu
let isGhostMode = false;
let isAdminEditor = false;
let currentVenueTheme = 'ancient_greek'; // 'ancient_greek', 'cyber_lounge', 'dionysus_rave'

// Varsayılan Kullanıcı Avatar Ayarları
let myAvatarConfig = {
  gender: 'male',
  skinColor: '#f0c7a1',
  eyeColor: '#2980b9',
  hairStyle: 'greek_curls',
  hairColor: '#4a2f1b',
  outfit: 'greek_toga',
  outfitColor: '#ffffff',
  accessory: 'gold_wreath',
  shoes: 'gladiator_sandals'
};

// Yerel hafızadan kayıtlı avatar stilini yükle
try {
  const saved = localStorage.getItem('gm_avatar_config');
  if (saved) myAvatarConfig = Object.assign(myAvatarConfig, JSON.parse(saved));
} catch (e) {}

// ==========================================================================
// 1. SAHNE & ATMOSFER BAŞLATMA (ANTİK YUNAN OLİMPOS GECESİ)
// ==========================================================================
function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  if (renderer && scene) {
    onWindowResize();
    return;
  }

  // Sahne ve Sis Atmosferi
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b16);
  scene.fog = new THREE.FogExp2(0x0a0b16, 0.028);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

  // WebGL Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Işıklandırma (Meşale ve Olimpos Altın Parlaması)
  const ambientLight = new THREE.AmbientLight(0xffeedd, 0.65);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0x7f8fa6, 1.2);
  moonLight.position.set(20, 40, 20);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  scene.add(moonLight);

  const goldCenterSpot = new THREE.SpotLight(0xd4af37, 2.8, 45, Math.PI / 3, 0.5);
  goldCenterSpot.position.set(0, 18, 0);
  goldCenterSpot.castShadow = true;
  scene.add(goldCenterSpot);

  // Antik Mekan Mimarisi
  buildGreekLoungeEnvironment();

  // Oyuncu Avatarını Ekle
  player = createHumanoidAvatar(myAvatarConfig);
  scene.add(player);

  setupJoystick();
  loadSavedWorldItems();
  setupSocket();

  renderer.domElement.addEventListener('pointerdown', onSceneClick);
  window.addEventListener('resize', onWindowResize);
  animate();
}

// ==========================================================================
// 2. ANTİK YUNAN PARTİ MEKANI MİMARİSİ
// ==========================================================================
function buildGreekLoungeEnvironment() {
  // Mermer Mozaik Zemin
  const floorGeo = new THREE.PlaneGeometry(90, 90);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x22232a,
    roughness: 0.35,
    metalness: 0.25
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Mermer Dorik Sütunlar
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.25 });
  const goldRingMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });

  const pillarCoords = [
    [-14, -14], [14, -14], [-14, 14], [14, 14],
    [-8, -18], [8, -18], [-18, 0], [18, 0]
  ];

  pillarCoords.forEach(([px, pz]) => {
    const colGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.6, 16), pillarMat);
    base.position.y = 0.3;
    colGroup.add(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 10, 20), pillarMat);
    shaft.position.y = 5.3;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    colGroup.add(shaft);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 2.1), goldRingMat);
    cap.position.y = 10.5;
    colGroup.add(cap);

    colGroup.position.set(px, 0, pz);
    scene.add(colGroup);
  });

  // Antik Bar Tezgahı
  buildGreekBarCounter();

  // Meşaleler & Ateş Çanakları
  spawnTorchFire(-8, 3.8, -13.5);
  spawnTorchFire(8, 3.8, -13.5);

  // Şarap Küpleri (Amforalar)
  renderItemMesh('ancient_urn', { x: -6, y: 0.8, z: -11 });
  renderItemMesh('ancient_urn', { x: 6, y: 0.8, z: -11 });
}

function buildGreekBarCounter() {
  const barGroup = new THREE.Group();
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xefefef, roughness: 0.2, metalness: 0.1 });
  const cedarMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });

  // Ana Mermer Tezgah
  const front = new THREE.Mesh(new THREE.BoxGeometry(16, 2.6, 2.5), marbleMat);
  front.position.set(0, 1.3, -13);
  front.castShadow = true;
  front.receiveShadow = true;
  barGroup.add(front);

  // Üst Sedir Ağacı Kaplama
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.25, 2.9), cedarMat);
  topTrim.position.set(0, 2.65, -13);
  barGroup.add(topTrim);

  // Altın Amblem
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 16, 32), goldMat);
  crest.position.set(0, 1.4, -11.7);
  barGroup.add(crest);

  scene.add(barGroup);
}

function spawnTorchFire(x, y, z) {
  const torchLight = new THREE.PointLight(0xff7700, 3.2, 18, 1.5);
  torchLight.position.set(x, y, z);
  scene.add(torchLight);

  const fireOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  fireOrb.position.set(x, y, z);
  scene.add(fireOrb);
}

// ==========================================================================
// 3. İNSANSI & EKLEMLİ AVATAR MOTORU (GTA / RIGGED)
// ==========================================================================
function createHumanoidAvatar(cfg) {
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinColor || '#f0c7a1', roughness: 0.6 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: cfg.eyeColor || '#2980b9', roughness: 0.2 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hairColor || '#4a2f1b', roughness: 0.5 });
  const outfitMat = new THREE.MeshStandardMaterial({ color: cfg.outfitColor || '#ffffff', roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });
  const shoesMat = new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.6 });

  // 1. Pelvis ve Gövde
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.8;
  root.add(pelvis);

  const torsoWidth = isFemale ? 0.75 : 0.95;
  const torsoChest = isFemale ? 0.85 : 1.1;
  const torsoGeo = new THREE.CylinderGeometry(torsoChest * 0.45, torsoWidth * 0.4, 1.3, 16);
  const torso = new THREE.Mesh(torsoGeo, outfitMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  pelvis.add(torso);

  // 2. Boyun & Baş
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12), skinMat);
  neck.position.y = 1.45;
  pelvis.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.85;
  pelvis.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.38, 20, 20);
  headGeo.scale(1, 1.18, 1.08);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Gözler
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeL.position.set(-0.13, 0.05, 0.33);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeR.position.set(0.13, 0.05, 0.33);
  headGroup.add(eyeR);

  // Saç Modeli
  buildHairMesh(headGroup, cfg.hairStyle, hairMat);

  // Aksesuar & Taç
  if (cfg.accessory === 'gold_wreath') {
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 24), goldMat);
    wreath.rotation.x = Math.PI / 2.2;
    wreath.position.set(0, 0.22, 0.02);
    headGroup.add(wreath);
  } else if (cfg.accessory === 'sunglasses') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.15), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }));
    glasses.position.set(0, 0.06, 0.36);
    headGroup.add(glasses);
  } else if (cfg.accessory === 'chain_necklace') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 12, 24), goldMat);
    chain.rotation.x = Math.PI / 2.5;
    chain.position.set(0, 1.35, 0.08);
    pelvis.add(chain);
  }

  // 3. Eklemli Kollar
  const armOffset = isFemale ? 0.48 : 0.62;

  // Sol Kol
  const leftArm = new THREE.Group();
  leftArm.position.set(-armOffset, 1.25, 0);
  pelvis.add(leftArm);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.65, 12), skinMat);
  leftBicep.position.y = -0.32;
  leftArm.add(leftBicep);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12), skinMat);
  leftForearm.position.y = -0.85;
  leftArm.add(leftForearm);

  // Sağ Kol
  const rightArm = new THREE.Group();
  rightArm.position.set(armOffset, 1.25, 0);
  pelvis.add(rightArm);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.65, 12), skinMat);
  rightBicep.position.y = -0.32;
  rightArm.add(rightBicep);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12), skinMat);
  rightForearm.position.y = -0.85;
  rightArm.add(rightForearm);

  // 4. Eklemli Bacaklar
  const legOffset = isFemale ? 0.22 : 0.28;

  // Sol Bacak
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-legOffset, 0, 0);
  pelvis.add(leftLeg);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.85, 12), outfitMat);
  leftThigh.position.y = -0.42;
  leftThigh.castShadow = true;
  leftLeg.add(leftThigh);
  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 12), skinMat);
  leftShin.position.y = -1.18;
  leftLeg.add(leftShin);
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.42), shoesMat);
  leftFoot.position.set(0, -1.65, 0.1);
  leftLeg.add(leftFoot);

  // Sağ Bacak
  const rightLeg = new THREE.Group();
  rightLeg.position.set(legOffset, 0, 0);
  pelvis.add(rightLeg);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.85, 12), outfitMat);
  rightThigh.position.y = -0.42;
  rightThigh.castShadow = true;
  rightLeg.add(rightThigh);
  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 12), skinMat);
  rightShin.position.y = -1.18;
  rightLeg.add(rightShin);
  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.42), shoesMat);
  rightFoot.position.set(0, -1.65, 0.1);
  rightLeg.add(rightFoot);

  // Eklem Referanslarını Animasyon İçin Sakla
  root.userData.joints = {
    pelvis,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg
  };

  root.userData.config = cfg;
  return root;
}

function buildHairMesh(headGroup, style, hairMat) {
  if (style === 'greek_curls') {
    const curls = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hairMat);
      const angle = (i / 9) * Math.PI * 1.6 - Math.PI * 0.8;
      curl.position.set(Math.sin(angle) * 0.32, 0.28 + Math.random() * 0.08, Math.cos(angle) * 0.28);
      curls.add(curl);
    }
    const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.39, 16, 16), hairMat);
    topCap.position.set(0, 0.1, -0.05);
    curls.add(topCap);
    headGroup.add(curls);
  } else if (style === 'long_braid') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), hairMat);
    hair.position.set(0, 0.1, -0.06);
    headGroup.add(hair);

    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 1.4, 12), hairMat);
    braid.position.set(0, -0.5, -0.32);
    headGroup.add(braid);
  } else if (style === 'bob') {
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.6, 16), hairMat);
    bob.position.set(0, 0.12, -0.04);
    headGroup.add(bob);
  } else {
    const shortHair = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 16), hairMat);
    shortHair.position.set(0, 0.15, -0.04);
    headGroup.add(shortHair);
  }
}

// ==========================================================================
// 4. AVATAR STÜDYOSU (ÖZELLEŞTİRME & CANLI ÖNİZLEME)
// ==========================================================================
let previewRenderer, previewScene, previewCamera, previewMesh;

function openAvatarCustomizer() {
  document.getElementById('avatarCustomizerModal').classList.remove('hidden');

  const container = document.getElementById('avatar-preview-canvas');
  if (!previewRenderer) {
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x181726);

    previewCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 50);
    previewCamera.position.set(0, 2.0, 4.6);
    previewCamera.lookAt(0, 1.8, 0);

    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(previewRenderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.85);
    previewScene.add(light);
    const pSpot = new THREE.PointLight(0xd4af37, 2.2, 20);
    pSpot.position.set(3, 4, 3);
    previewScene.add(pSpot);

    animatePreview();
  }

  updatePreviewMesh();
}

function closeAvatarCustomizer() {
  document.getElementById('avatarCustomizerModal').classList.add('hidden');
}

function setAvatarParam(key, val, btnElem) {
  myAvatarConfig[key] = val;
  if (btnElem && btnElem.parentElement) {
    btnElem.parentElement.querySelectorAll('.choice-chip').forEach(b => b.classList.remove('selected'));
    btnElem.classList.add('selected');
  }
  updatePreviewMesh();
}

function updatePreviewMesh() {
  if (previewMesh) previewScene.remove(previewMesh);
  previewMesh = createHumanoidAvatar(myAvatarConfig);
  previewScene.add(previewMesh);
}

function animatePreview() {
  requestAnimationFrame(animatePreview);
  if (previewMesh) {
    previewMesh.rotation.y += 0.012;
  }
  if (previewRenderer && previewScene && previewCamera) {
    previewRenderer.render(previewScene, previewCamera);
  }
}

function saveAvatarSettings() {
  localStorage.setItem('gm_avatar_config', JSON.stringify(myAvatarConfig));
  closeAvatarCustomizer();

  if (player) {
    const curPos = { x: player.position.x, y: player.position.y, z: player.position.z };
    scene.remove(player);
    player = createHumanoidAvatar(myAvatarConfig);
    player.position.set(curPos.x, curPos.y, curPos.z);
    scene.add(player);
  }

  if (socket) {
    socket.emit('update_avatar_look', {
      telegramId: window.currentUserId,
      avatarConfig: myAvatarConfig
    });
  }

  alert("⚡ Olimpos tarzın mühürlendi! Karakterin güncellendi.");
}

// ==========================================================================
// 5. YT MASASI: MEKAN KONSEPTİ DEĞİŞTİRİCİ & EŞYA EDİTÖRÜ
// ==========================================================================
function enterMetaverseAsGhost() {
  isGhostMode = true;
  isAdminEditor = true;
  switchTab('metaverse');
  alert("👻 Hayalet Modu Devrede! Mekandasınız, oyuncular sizi görmüyor.\nKonsepti ve dekorasyonu yönetebilirsiniz.");

  if (player) {
    player.traverse(child => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.35;
      }
    });
  }
  showAdminKonseptToolbar();
}

function showAdminKonseptToolbar() {
  let bar = document.getElementById('admin-konsept-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'admin-konsept-bar';
    bar.style = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(14, 13, 23, 0.94); border: 1px solid #d4af37; border-radius: 16px;
      padding: 8px 12px; display: flex; gap: 6px; z-index: 100; flex-wrap: wrap; justify-content: center;
      box-shadow: 0 4px 18px rgba(0,0,0,0.6); max-width: 95vw;
    `;
    bar.innerHTML = `
      <span style="color:#d4af37; font-size:11px; font-weight:bold; align-self:center;">🏛 KONSEPT:</span>
      <button onclick="setVenueTheme('ancient_greek')" style="background:#2c2b3d; color:#fff; border:1px solid #d4af37; padding:4px 8px; border-radius:6px; font-size:10px; cursor:pointer;">🏛 Olimpos</button>
      <button onclick="setVenueTheme('cyber_lounge')" style="background:#2c2b3d; color:#00f0ff; border:1px solid #00f0ff; padding:4px 8px; border-radius:6px; font-size:10px; cursor:pointer;">🌃 Cyber</button>
      <button onclick="setVenueTheme('dionysus_rave')" style="background:#2c2b3d; color:#ff0055; border:1px solid #ff0055; padding:4px 8px; border-radius:6px; font-size:10px; cursor:pointer;">🍷 Şölen</button>
      <span style="color:#aaa; font-size:10px; align-self:center;">| EŞYA:</span>
      <button onclick="spawnItem('greek_column')" style="background:#1f1e2c; color:#fff; border:none; padding:4px 7px; border-radius:4px; font-size:10px; cursor:pointer;">+ Sütun</button>
      <button onclick="spawnItem('marble_table')" style="background:#1f1e2c; color:#fff; border:none; padding:4px 7px; border-radius:4px; font-size:10px; cursor:pointer;">+ Mermer Masa</button>
      <button onclick="spawnItem('ancient_throne')" style="background:#1f1e2c; color:#d4af37; border:none; padding:4px 7px; border-radius:4px; font-size:10px; cursor:pointer;">+ Taht</button>
      <button onclick="spawnItem('ancient_urn')" style="background:#1f1e2c; color:#fff; border:none; padding:4px 7px; border-radius:4px; font-size:10px; cursor:pointer;">+ Amfora</button>
      <button onclick="spawnItem('bar_stool')" style="background:#1f1e2c; color:#fff; border:none; padding:4px 7px; border-radius:4px; font-size:10px; cursor:pointer;">+ Tabure</button>
    `;
    document.getElementById('metaverseView').appendChild(bar);
  }
}

function setVenueTheme(themeName) {
  currentVenueTheme = themeName;
  if (themeName === 'cyber_lounge') {
    scene.background = new THREE.Color(0x05050f);
    scene.fog.color = new THREE.Color(0x05050f);
    alert("🌃 Konsept: Cyber Neon Lounge aktif edildi!");
  } else if (themeName === 'dionysus_rave') {
    scene.background = new THREE.Color(0x18050e);
    scene.fog.color = new THREE.Color(0x18050e);
    alert("🍷 Konsept: Dionysos Kızıl Şarap Şöleni aktif edildi!");
  } else {
    scene.background = new THREE.Color(0x0a0b16);
    scene.fog.color = new THREE.Color(0x0a0b16);
    alert("🏛 Konsept: Antik Olimpos Altın Partisi aktif edildi!");
  }

  if (socket) {
    socket.emit('change_venue_theme', { themeName });
  }
}

function spawnItem(itemType) {
  if (!isAdminEditor || !player) return;
  const posX = player.position.x;
  const posZ = player.position.z - 2.8;
  const posY = 0;

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
  let group = new THREE.Group();

  if (itemType === 'marble_table') {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 24), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2 }));
    top.position.y = 1.1;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
    leg.position.y = 0.55;
    group.add(top); group.add(leg);
  } else if (itemType === 'ancient_throne') {
    const throneMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), throneMat);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.25), throneMat);
    back.position.set(0, 1.5, -0.45);
    group.add(seat); group.add(back);
  } else if (itemType === 'ancient_urn') {
    const urnMat = new THREE.MeshStandardMaterial({ color: 0xb35422, roughness: 0.55 });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), urnMat);
    belly.position.y = 0.7;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 12), urnMat);
    neck.position.y = 1.2;
    group.add(belly); group.add(neck);
  } else if (itemType === 'greek_column') {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 7, 16), new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 0.3 }));
    col.position.y = 3.5;
    group.add(col);
  } else if (itemType === 'bar_stool') {
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
    stoolSeat.position.y = 1.0;
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 1.0, 12), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 }));
    stoolLeg.position.y = 0.5;
    group.add(stoolSeat); group.add(stoolLeg);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    box.position.y = 0.5;
    group.add(box);
  }

  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);
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

// ==========================================================================
// 6. JOYSTICK & EKLEMLİ YÜRÜYÜŞ MOTORU (WALK CYCLE)
// ==========================================================================
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
    isMoving = true;
  });

  joystick.on('end', () => {
    moveVector.x = 0;
    moveVector.y = 0;
    isMoving = false;
  });
}

let lastSocketSend = 0;
function animate() {
  requestAnimationFrame(animate);

  if (player && (moveVector.x !== 0 || moveVector.y !== 0)) {
    const speed = 0.13;
    player.position.x += moveVector.x * speed;
    player.position.z -= moveVector.y * speed;

    const angle = Math.atan2(moveVector.x, moveVector.y);
    player.rotation.y = angle;

    // Gerçekçi Bacak ve Kol Sallanması (Walk Cycle)
    walkCycle += 0.22;
    const joints = player.userData.joints;
    if (joints) {
      joints.leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
      joints.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
      joints.leftArm.rotation.x = -Math.sin(walkCycle) * 0.5;
      joints.rightArm.rotation.x = Math.sin(walkCycle) * 0.5;
      joints.pelvis.position.y = 1.8 + Math.abs(Math.sin(walkCycle * 2)) * 0.06;
    }

    const now = Date.now();
    if (socket && now - lastSocketSend > 50) {
      lastSocketSend = now;
      socket.emit('player_move', {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotY: player.rotation.y,
        isMoving: true
      });
    }
  } else if (player) {
    // Durma (Nefes Alma Salınımı)
    walkCycle += 0.035;
    const joints = player.userData.joints;
    if (joints) {
      joints.leftLeg.rotation.x = 0;
      joints.rightLeg.rotation.x = 0;
      joints.leftArm.rotation.x = 0;
      joints.rightArm.rotation.x = 0;
      joints.pelvis.position.y = 1.8 + Math.sin(walkCycle) * 0.02;
    }
  }

  // Kamera Takibi
  if (player) {
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + 4.3;
    camera.position.z = player.position.z + 7.8;
    camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==========================================================================
// 7. SOKET & DİĞER OYUNCULARI ÇİZME
// ==========================================================================
function setupSocket() {
  if (socket) return;
  socket = typeof io !== 'undefined' ? io() : null;
  if (!socket) return;

  const userNickname = document.getElementById('nickname')?.value || 'Misafir';
  const userCity = document.getElementById('city')?.value || '';
  const userDistrict = document.getElementById('district')?.value || '';
  const userRole = document.getElementById('role')?.value || '';
  const userAvatar = (typeof images !== 'undefined' && images[0]) ? images[0] : '';

  socket.emit('join_metaverse', {
    telegramId: window.currentUserId,
    nickname: userNickname,
    city: userCity,
    district: userDistrict,
    role: userRole,
    avatar: userAvatar,
    avatarConfig: myAvatarConfig,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    isGhost: isGhostMode
  });

  socket.on('current_players', players => {
    players.forEach(p => addOtherHumanoidPlayer(p));
  });

  socket.on('player_joined', pData => {
    addOtherHumanoidPlayer(pData);
  });

  socket.on('player_moved', data => {
    if (otherPlayers[data.socketId]) {
      const pGroup = otherPlayers[data.socketId].group;
      pGroup.position.set(data.x, data.y, data.z);
      pGroup.rotation.y = data.rotY;

      const joints = pGroup.userData.joints;
      if (joints && data.isMoving) {
        pGroup.userData.step = (pGroup.userData.step || 0) + 0.22;
        joints.leftLeg.rotation.x = Math.sin(pGroup.userData.step) * 0.6;
        joints.rightLeg.rotation.x = -Math.sin(pGroup.userData.step) * 0.6;
      }
    }
  });

  socket.on('player_updated_avatar', data => {
    if (otherPlayers[data.socketId]) {
      const oldGroup = otherPlayers[data.socketId].group;
      const pos = { x: oldGroup.position.x, y: oldGroup.position.y, z: oldGroup.position.z };
      const rotY = oldGroup.rotation.y;
      const pData = otherPlayers[data.socketId].data;
      pData.avatarConfig = data.avatarConfig;

      scene.remove(oldGroup);
      delete otherPlayers[data.socketId];

      addOtherHumanoidPlayer(Object.assign(pData, pos, { rotY }));
    }
  });

  socket.on('venue_theme_changed', data => {
    setVenueTheme(data.themeName);
  });

  socket.on('player_said', data => {
    if (otherPlayers[data.socketId]) {
      showBubbleOnMesh(otherPlayers[data.socketId].group, data.text);
    }
  });

  socket.on('match_notification', ({ user1, user2 }) => {
    if (window.currentUserId === user1 || window.currentUserId === user2) {
      alert("🎉 TEBRİKLER! Karşılıklı kalpleştiniz! DM kutusundan sohbet açıldı!");
      if (typeof checkInboxBadge === 'function') checkInboxBadge();
    }
  });

  socket.on('player_left', socketId => {
    if (otherPlayers[socketId]) {
      scene.remove(otherPlayers[socketId].group);
      delete otherPlayers[socketId];
    }
  });
}

function addOtherHumanoidPlayer(pData) {
  if (otherPlayers[pData.socketId] || pData.telegramId === window.currentUserId) return;

  const cfg = pData.avatarConfig || { gender: 'male', skinColor: '#f0c7a1', hairStyle: 'greek_curls' };
  const group = createHumanoidAvatar(cfg);

  const nameSprite = createNameSprite(pData.nickname);
  nameSprite.position.set(0, 3.8, 0);
  group.add(nameSprite);

  group.position.set(pData.x, pData.y, pData.z);
  if (pData.rotY) group.rotation.y = pData.rotY;
  group.userData = pData;
  scene.add(group);

  otherPlayers[pData.socketId] = { group, data: pData };
}

function createNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 11, 22, 0.75)';
  ctx.roundRect(8, 8, 240, 48, 14);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 21px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 39);

  const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

// ==========================================================================
// 8. ETKİLEŞİM, SOHBET BALONU & ŞİKAYET BİLDİRİMİ
// ==========================================================================
function onSceneClick(event) {
  const container = document.getElementById('canvas-container');
  if (!container || !camera) return;

  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const meshes = Object.values(otherPlayers).map(p => p.group);
  const intersects = raycaster.intersectObjects(meshes, true);
  if (intersects.length > 0) {
    let clicked = intersects[0].object;
    while (clicked.parent && !clicked.userData.telegramId) {
      clicked = clicked.parent;
    }
    if (clicked.userData && clicked.userData.telegramId) {
      openMetaverseProfileModal(clicked.userData);
    }
  }
}

function openMetaverseProfileModal(data) {
  currentTargetUser = data;
  document.getElementById('metaProfileName').innerText = data.nickname;
  document.getElementById('metaProfileMeta').innerText = `${data.role || 'Rol Yok'} • ${data.city || 'Şehir Yok'}`;
  document.getElementById('metaProfileDistance').innerText = `📍 ${data.district || 'Merkez'}`;
  document.getElementById('metaProfileImg').src = data.avatar || 'https://via.placeholder.com/80';
  document.getElementById('metaverseProfileModal').classList.remove('hidden');
}

function closeMetaverseProfileModal() {
  document.getElementById('metaverseProfileModal').classList.add('hidden');
  currentTargetUser = null;
}

function sendHeartToCurrentTarget() {
  if (!currentTargetUser || !socket) return;
  socket.emit('send_world_heart', {
    fromUserId: window.currentUserId,
    toUserId: currentTargetUser.telegramId
  });
  alert(`❤️ ${currentTargetUser.nickname} kullanıcısına Olimpos kalbi gönderildi! Karşılık verdiğinde DM açılacak.`);
  closeMetaverseProfileModal();
}

function sendWorldChat() {
  const input = document.getElementById('world-chat-input');
  if (!input || !player) return;
  const text = input.value.trim();
  if (!text) return;

  showBubbleOnMesh(player, text);
  if (socket) socket.emit('world_chat_message', { text });
  input.value = '';
}

function showBubbleOnMesh(targetMesh, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 130;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(14, 13, 23, 0.9)';
  ctx.roundRect(10, 10, 280, 110, 18);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text.substring(0, 22), 150, 70);

  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
  bubble.position.set(0, 4.4, 0);
  bubble.scale.set(3.2, 1.5, 1);
  targetMesh.add(bubble);
  setTimeout(() => targetMesh.remove(bubble), 4500);
}

function sendMetaverseReportPrompt() {
  const reason = prompt("🚨 Olimpos Meclisine Şikayet Bildir:\n(Mekandaki uygunsuz davranış, hile veya rahatsızlık sebebi)");
  if (!reason || !reason.trim()) return;

  fetch('/api/metaverse/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterId: window.currentUserId || 'Anonim',
      reportedUserId: currentTargetUser ? currentTargetUser.telegramId : null,
      type: 'chat_abuse',
      reason: reason.trim(),
      location: player ? { x: player.position.x, y: player.position.y, z: player.position.z } : { x: 0, y: 0, z: 0 }
    })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) alert("✅ Şikayetiniz YT Masasına koordinatlarınızla birlikte iletildi.");
    else alert("Şikayet iletilemedi: " + (res.message || "Bilinmeyen hata"));
  })
  .catch(() => alert("Sunucu bağlantı hatası oluştu."));
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
