// ==========================================================================
// GOLDENMATCH - ULTRA-HD PARAMETRİK MEKAN & STİLİZE İNSANSI AVATAR MOTORU
// ==========================================================================

let scene, camera, renderer, player, joystick;
let moveVector = { x: 0, y: 0 };
let socket = null;
let otherPlayers = {};
let currentTargetUser = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Animasyon & Eylem Durumları ('idle', 'walk', 'sit', 'crouch')
let currentActionState = 'idle';
let walkCycle = 0;
let isMoving = false;

// Yönetici & Hayalet Modu
let isGhostMode = false;
let isAdminEditor = false;
let currentVenueTheme = 'golden_parametric';

// Kullanıcı Katmanlı & Stilize Avatar Konfigürasyonu (Görsel Referanslı)
let myAvatarConfig = {
  gender: 'female',
  skinColor: '#f7d2b7',
  eyeColor: '#9b59b6',
  eyeShape: 'almond',
  hairStyle: 'twin_pigtails',
  hairColor: '#00d2d3',
  hat: 'none',
  glasses: 'cyber_sunglasses',
  necklace: 'heavy_chain',
  outfitTop: 'bandage_corset',
  outfitTopColor: '#f0f0f5',
  outfitBottom: 'strapped_shorts',
  outfitBottomColor: '#f0f0f5',
  shoes: 'laced_boots',
  shoesColor: '#ffffff'
};

try {
  const saved = localStorage.getItem('gm_avatar_config');
  if (saved) myAvatarConfig = Object.assign(myAvatarConfig, JSON.parse(saved));
} catch (e) {}

// ==========================================================================
// 1. SAHNE VE PARAMETRİK DALGALI MEKAN KURULUMU
// ==========================================================================
function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  if (renderer && scene) {
    onWindowResize();
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x35658e);
  scene.fog = new THREE.FogExp2(0x35658e, 0.015);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Doğal Gün Işığı & Amfitiyatro Aydınlatması
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd47a88, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff7ea, 1.8);
  sunLight.position.set(30, 60, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.0001;
  scene.add(sunLight);

  // Parametrik Kademeli Mekanın İnşası
  buildParametricGoldenAuditorium();

  // Oyuncu Avatarının Yüklenmesi
  player = buildStylizedAvatarMesh(myAvatarConfig);
  scene.add(player);

  setupJoystick();
  loadSavedWorldItems();
  populateYtItemDrawer();
  setupSocket();

  renderer.domElement.addEventListener('pointerdown', onSceneClick);
  window.addEventListener('resize', onWindowResize);
  animate();
}

function buildParametricGoldenAuditorium() {
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xdf5d78, roughness: 0.35, metalness: 0.05 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.25, metalness: 0.1 });
  const goldSculptMat = new THREE.MeshStandardMaterial({ color: 0xe5a93c, metalness: 0.95, roughness: 0.15 });

  // 1. Kademeli Amfitiyatro Terasları
  for (let i = 0; i < 7; i++) {
    const radius = 32 - i * 3.8;
    const height = 0.5;
    const ringGeo = new THREE.CylinderGeometry(radius, radius + 1.2, height, 48);
    const stepMesh = new THREE.Mesh(ringGeo, pinkMat);
    stepMesh.position.set(0, (6 - i) * height - 2.5, 0);
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    scene.add(stepMesh);
  }

  // Zemin Tabanı
  const centerFloor = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.6, 32), pinkMat);
  centerFloor.position.set(0, -2.6, 0);
  centerFloor.receiveShadow = true;
  scene.add(centerFloor);

  // 2. Tavandaki Organik Parametrik Dalga Şeritleri
  for (let j = 0; j < 12; j++) {
    const ribbonGroup = new THREE.Group();
    const curveRadius = 14 + j * 2.2;
    const tubeGeo = new THREE.TorusGeometry(curveRadius, 0.45, 12, 64, Math.PI * 1.4);
    const ribbonMat = j % 2 === 0 ? whiteMat : pinkMat;
    const ribbon = new THREE.Mesh(tubeGeo, ribbonMat);
    ribbon.rotation.x = Math.PI / 2 + (j * 0.06);
    ribbon.rotation.y = (j * 0.18);
    ribbon.position.set(Math.sin(j) * 3, 14 + (j * 0.9), Math.cos(j) * 2);
    ribbon.castShadow = true;
    ribbonGroup.add(ribbon);
    scene.add(ribbonGroup);
  }

  // 3. Altın Sarmal Heykeller
  spawnGoldenSpiralSculpture(16, 1.2, -6, goldSculptMat);
  spawnGoldenSpiralSculpture(19, 1.6, -10, goldSculptMat);

  // 4. Arka Fütüristik Ekran Paneli & Bar Bankosu
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x111116 });
  const mainScreen = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 0.4), screenMat);
  mainScreen.position.set(-10, 4, -20);
  scene.add(mainScreen);

  buildModernCurvedBar();
}

function spawnGoldenSpiralSculpture(x, y, z, mat) {
  const group = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const geom = new THREE.TorusGeometry(1.6 - (i * 0.04), 0.14, 12, 32, Math.PI * 1.2);
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = Math.PI / 3;
    ring.rotation.z = i * 0.38;
    ring.position.y = i * 0.55;
    ring.castShadow = true;
    group.add(ring);
  }
  group.position.set(x, y, z);
  scene.add(group);
}

function buildModernCurvedBar() {
  const barMat = new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.2 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xe5a93c, metalness: 0.95, roughness: 0.1 });

  const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 2.4, 32, 1, false, 0, Math.PI), barMat);
  barMesh.rotation.y = -Math.PI / 2;
  barMesh.position.set(0, 1.2, -12);
  barMesh.castShadow = true;
  barMesh.receiveShadow = true;
  scene.add(barMesh);

  const trim = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.2, 32, 1, false, 0, Math.PI), goldTrim);
  trim.rotation.y = -Math.PI / 2;
  trim.position.set(0, 2.4, -12);
  scene.add(trim);
}

// ==========================================================================
// 2. STİLİZE İNSANSI AVATAR MİMARİSİ (CYBER-GLAM / GEN-Z)
// ==========================================================================
function buildStylizedAvatarMesh(cfg) {
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinColor || '#f7d2b7', roughness: 0.55 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: cfg.eyeColor || '#9b59b6', roughness: 0.1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hairColor || '#00d2d3', roughness: 0.35, metalness: 0.1 });
  const topMat = new THREE.MeshStandardMaterial({ color: cfg.outfitTopColor || '#ffffff', roughness: 0.4 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: cfg.outfitBottomColor || '#1a1a24', roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5a93c, metalness: 0.95, roughness: 0.15 });
  const bootsMat = new THREE.MeshStandardMaterial({ color: cfg.shoesColor || '#ffffff', roughness: 0.3 });

  // 1. Pelvis (Kök)
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.85;
  root.add(pelvis);

  // 2. Gövde & Korse Katmanı
  const torsoWidth = isFemale ? 0.68 : 0.92;
  const chestWidth = isFemale ? 0.82 : 1.08;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(chestWidth * 0.45, torsoWidth * 0.4, 1.3, 20), cfg.outfitTop !== 'none' ? topMat : skinMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  pelvis.add(torso);

  if (cfg.outfitTop === 'bandage_corset') {
    for (let b = 0; b < 3; b++) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.36 + (b * 0.02), 0.02, 8, 24), goldMat);
      strap.rotation.x = Math.PI / 2.3 + (b * 0.08);
      strap.position.set(0, 0.45 + (b * 0.22), 0);
      pelvis.add(strap);
    }
  }

  // 3. Boyun, Baş ve Yüz Detayları
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 16), skinMat);
  neck.position.y = 1.45;
  pelvis.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.85;
  pelvis.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
  headGeo.scale(1, 1.2, 1.08);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Çekik Gözler
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeL.position.set(-0.13, 0.06, 0.34);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeR.position.set(0.13, 0.06, 0.34);
  headGroup.add(eyeR);

  // Yüz Dövmesi / Makyaj Şeridi
  const faceDecal = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x9b59b6 }));
  faceDecal.position.set(0.16, 0.12, 0.33);
  faceDecal.rotation.z = -Math.PI / 4;
  headGroup.add(faceDecal);

  // Saç Modelleri
  attachStylizedHair(headGroup, cfg.hairStyle, hairMat);

  // Şapka / Taç Katmanı
  if (cfg.hat === 'gold_wreath') {
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 24), goldMat);
    wreath.rotation.x = Math.PI / 2.2;
    wreath.position.set(0, 0.22, 0.02);
    headGroup.add(wreath);
  }

  // Gözlükler
  if (cfg.glasses === 'cyber_sunglasses') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.16), new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.1 }));
    glasses.position.set(0, 0.06, 0.37);
    headGroup.add(glasses);
  }

  // Kolye
  if (cfg.necklace === 'heavy_chain') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 12, 28), goldMat);
    chain.rotation.x = Math.PI / 2.3;
    chain.position.set(0, 1.34, 0.08);
    pelvis.add(chain);
  }

  // 4. Kollar
  const armOffset = isFemale ? 0.45 : 0.60;

  const leftArm = new THREE.Group();
  leftArm.position.set(-armOffset, 1.25, 0);
  pelvis.add(leftArm);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  leftBicep.position.y = -0.32;
  leftArm.add(leftBicep);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.65, 14), topMat);
  leftForearm.position.y = -0.85;
  leftArm.add(leftForearm);

  const rightArm = new THREE.Group();
  rightArm.position.set(armOffset, 1.25, 0);
  pelvis.add(rightArm);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  rightBicep.position.y = -0.32;
  rightArm.add(rightBicep);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.65, 14), topMat);
  rightForearm.position.y = -0.85;
  rightArm.add(rightForearm);

  // 5. Bacaklar & Yüksek Platform Çizmeler
  const legOffset = isFemale ? 0.21 : 0.27;

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-legOffset, 0, 0);
  pelvis.add(leftLeg);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.85, 14), cfg.outfitBottom !== 'none' ? bottomMat : skinMat);
  leftThigh.position.y = -0.42;
  leftThigh.castShadow = true;
  leftLeg.add(leftThigh);
  
  const leftBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 1.15, 14), bootsMat);
  leftBoot.position.y = -1.15;
  leftBoot.castShadow = true;
  leftLeg.add(leftBoot);

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.44), bootsMat);
  leftFoot.position.set(0, -1.68, 0.1);
  leftLeg.add(leftFoot);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(legOffset, 0, 0);
  pelvis.add(rightLeg);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.85, 14), cfg.outfitBottom !== 'none' ? bottomMat : skinMat);
  rightThigh.position.y = -0.42;
  rightThigh.castShadow = true;
  rightLeg.add(rightThigh);

  const rightBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 1.15, 14), bootsMat);
  rightBoot.position.y = -1.15;
  rightBoot.castShadow = true;
  rightLeg.add(rightBoot);

  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.44), bootsMat);
  rightFoot.position.set(0, -1.68, 0.1);
  rightLeg.add(rightFoot);

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

function attachStylizedHair(headGroup, style, hairMat) {
  if (style === 'twin_pigtails') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 16), hairMat);
    cap.position.set(0, 0.12, -0.04);
    headGroup.add(cap);

    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), hairMat);
    bangs.position.set(0, 0.32, 0.33);
    headGroup.add(bangs);

    const tailL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 1.6, 12), hairMat);
    tailL.position.set(-0.48, 0.65, -0.15);
    tailL.rotation.z = Math.PI / 3.8;
    headGroup.add(tailL);

    const tailR = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 1.6, 12), hairMat);
    tailR.position.set(0.48, 0.65, -0.15);
    tailR.rotation.z = -Math.PI / 3.8;
    headGroup.add(tailR);
  } else if (style === 'dreadlocks') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), hairMat);
    cap.position.set(0, 0.12, -0.04);
    headGroup.add(cap);

    for (let d = 0; d < 12; d++) {
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.8, 8), hairMat);
      const angle = (d / 12) * Math.PI * 2;
      lock.position.set(Math.sin(angle) * 0.35, 0.1 - (d % 3 * 0.1), Math.cos(angle) * 0.35);
      lock.rotation.z = Math.sin(angle) * 0.4;
      headGroup.add(lock);
    }
  } else {
    const shortHair = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 16), hairMat);
    shortHair.position.set(0, 0.14, -0.04);
    headGroup.add(shortHair);
  }
}

// ==========================================================================
// 3. ANİMASYON DÖNGÜSÜ & İNSANSI EYLEMLER
// ==========================================================================
let lastSendTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const joints = player?.userData?.joints;

  if (player && (moveVector.x !== 0 || moveVector.y !== 0)) {
    currentActionState = 'walk';
    const speed = 0.14;
    player.position.x += moveVector.x * speed;
    player.position.z -= moveVector.y * speed;

    const angle = Math.atan2(moveVector.x, moveVector.y);
    player.rotation.y = angle;

    walkCycle += 0.22;
    if (joints) {
      joints.leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
      joints.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
      joints.leftArm.rotation.x = -Math.sin(walkCycle) * 0.48;
      joints.rightArm.rotation.x = Math.sin(walkCycle) * 0.48;
      joints.pelvis.position.y = 1.85 + Math.abs(Math.sin(walkCycle * 2)) * 0.06;
    }

    const now = Date.now();
    if (socket && now - lastSendTime > 50) {
      lastSendTime = now;
      socket.emit('player_move', {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotY: player.rotation.y,
        actionState: 'walk'
      });
    }
  } else if (player) {
    if (currentActionState === 'sit') {
      if (joints) {
        joints.pelvis.position.y = 1.0;
        joints.leftLeg.rotation.x = -Math.PI / 2.2;
        joints.rightLeg.rotation.x = -Math.PI / 2.2;
        joints.leftArm.rotation.x = -Math.PI / 6;
        joints.rightArm.rotation.x = -Math.PI / 6;
      }
    } else if (currentActionState === 'crouch') {
      if (joints) {
        joints.pelvis.position.y = 1.25;
        joints.leftLeg.rotation.x = -Math.PI / 3.5;
        joints.rightLeg.rotation.x = -Math.PI / 3.5;
        joints.leftArm.rotation.x = -Math.PI / 4;
        joints.rightArm.rotation.x = -Math.PI / 4;
      }
    } else {
      currentActionState = 'idle';
      walkCycle += 0.035;
      if (joints) {
        joints.leftLeg.rotation.x = 0;
        joints.rightLeg.rotation.x = 0;
        joints.leftArm.rotation.x = 0;
        joints.rightArm.rotation.x = 0;
        joints.pelvis.position.y = 1.85 + Math.sin(walkCycle) * 0.02;
      }
    }
  }

  if (player) {
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + 4.2;
    camera.position.z = player.position.z + 8.2;
    camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function togglePlayerSit() {
  const btn = document.getElementById('action-sit-btn');
  if (currentActionState === 'sit') {
    currentActionState = 'idle';
    btn?.classList.remove('active');
  } else {
    currentActionState = 'sit';
    document.getElementById('action-crouch-btn')?.classList.remove('active');
    btn?.classList.add('active');
  }
  syncActionStateWithSocket();
}

function togglePlayerCrouch() {
  const btn = document.getElementById('action-crouch-btn');
  if (currentActionState === 'crouch') {
    currentActionState = 'idle';
    btn?.classList.remove('active');
  } else {
    currentActionState = 'crouch';
    document.getElementById('action-sit-btn')?.classList.remove('active');
    btn?.classList.add('active');
  }
  syncActionStateWithSocket();
}

function syncActionStateWithSocket() {
  if (socket && player) {
    socket.emit('player_move', {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotY: player.rotation.y,
      actionState: currentActionState
    });
  }
}

function exitMetaverseToExplore() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  switchTab('explore');
}

// ==========================================================================
// 4. CANLI AVATAR STÜDYOSU (GİYDİR/ÇIKAR ÖNİZLEME MOTORU)
// ==========================================================================
let previewRenderer, previewScene, previewCamera, previewMesh;

function openAvatarCustomizer() {
  document.getElementById('avatarCustomizerModal').classList.remove('hidden');

  const container = document.getElementById('avatar-preview-canvas');
  if (!previewRenderer) {
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x131220);

    previewCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 50);
    previewCamera.position.set(0, 1.95, 4.8);
    previewCamera.lookAt(0, 1.75, 0);

    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(previewRenderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.95);
    previewScene.add(light);
    const pSpot = new THREE.PointLight(0xe5a93c, 2.5, 25);
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
    btnElem.parentElement.querySelectorAll('.choice-chip, .skin-tone-swatch').forEach(b => b.classList.remove('selected', 'active'));
    btnElem.classList.add(btnElem.classList.contains('skin-tone-swatch') ? 'active' : 'selected');
  }
  updatePreviewMesh();
}

function updatePreviewMesh() {
  if (previewMesh) previewScene.remove(previewMesh);
  previewMesh = buildStylizedAvatarMesh(myAvatarConfig);
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
    player = buildStylizedAvatarMesh(myAvatarConfig);
    player.position.set(curPos.x, curPos.y, curPos.z);
    scene.add(player);
  }

  if (socket) {
    socket.emit('update_avatar_look', {
      telegramId: window.currentUserId,
      avatarConfig: myAvatarConfig
    });
  }

  alert('✨ Yeni tarzın mühürlendi! Karakterin güncellendi.');
}

// ==========================================================================
// 5. YT MASASI: PARAMETRİK EŞYALAR & KATALOG
// ==========================================================================
const YT_CATALOG_ITEMS = [
  { type: 'golden_spiral', name: 'Altın Spiral Anıt', icon: '🎗️' },
  { type: 'pink_terrace', name: 'Kavisli Teras', icon: '🏛️' },
  { type: 'lounge_sofa', name: 'Fütüristik Loca Koltuğu', icon: '🛋️' },
  { type: 'modern_bar_counter', name: 'Kavisli Bar Masası', icon: '🍸' },
  { type: 'amphora_gold', name: 'Altın Küp', icon: '🏺' },
  { type: 'neon_sphere', name: 'Işık Küresi', icon: '🔮' }
];

function enterMetaverseAsGhost() {
  isGhostMode = true;
  isAdminEditor = true;
  switchTab('metaverse');
  document.getElementById('yt-open-editor-btn')?.classList.remove('hidden');
  alert('👻 Hayalet Modu Devrede!\nMekandasınız, oyuncular sizi görmüyor.');

  if (player) {
    player.traverse(child => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.35;
      }
    });
  }
}

function toggleYtItemDrawer() {
  const drawer = document.getElementById('ytItemDrawer');
  drawer?.classList.toggle('hidden');
}

function populateYtItemDrawer() {
  const grid = document.getElementById('yt-items-catalog');
  if (!grid) return;
  grid.innerHTML = '';

  YT_CATALOG_ITEMS.forEach(item => {
    const card = document.createElement('div');
    card.className = 'drawer-item-card';
    card.onclick = () => spawnItem(item.type);
    card.innerHTML = `
      <span class="drawer-item-icon">${item.icon}</span>
      <div class="drawer-item-name">${item.name}</div>
    `;
    grid.appendChild(card);
  });
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
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5a93c, metalness: 0.95, roughness: 0.15 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xdf5d78, roughness: 0.35 });

  if (itemType === 'golden_spiral') {
    spawnGoldenSpiralSculpture(pos.x, pos.y, pos.z, goldMat);
    return;
  } else if (itemType === 'pink_terrace') {
    const terrace = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.6, 24), pinkMat);
    terrace.position.y = 0.3;
    group.add(terrace);
  } else if (itemType === 'lounge_sofa') {
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1a24 }));
    sofa.position.y = 0.4;
    group.add(sofa);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), goldMat);
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
// 6. SOKET & DİĞER OYUNCULARI CANLI İZLEME
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
      if (joints) {
        if (data.actionState === 'sit') {
          joints.pelvis.position.y = 1.0;
          joints.leftLeg.rotation.x = -Math.PI / 2.2;
          joints.rightLeg.rotation.x = -Math.PI / 2.2;
        } else if (data.actionState === 'crouch') {
          joints.pelvis.position.y = 1.25;
          joints.leftLeg.rotation.x = -Math.PI / 3.5;
          joints.rightLeg.rotation.x = -Math.PI / 3.5;
        } else if (data.actionState === 'walk') {
          pGroup.userData.step = (pGroup.userData.step || 0) + 0.22;
          joints.pelvis.position.y = 1.85;
          joints.leftLeg.rotation.x = Math.sin(pGroup.userData.step) * 0.6;
          joints.rightLeg.rotation.x = -Math.sin(pGroup.userData.step) * 0.6;
        } else {
          joints.pelvis.position.y = 1.85;
          joints.leftLeg.rotation.x = 0;
          joints.rightLeg.rotation.x = 0;
        }
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

  socket.on('player_said', data => {
    if (otherPlayers[data.socketId]) {
      showBubbleOnMesh(otherPlayers[data.socketId].group, data.text);
    }
  });

  socket.on('match_notification', ({ user1, user2 }) => {
    if (window.currentUserId === user1 || window.currentUserId === user2) {
      alert('🎉 TEBRİKLER! Karşılıklı kalpleştiniz!\nDM kutunuza mesaj düştü, sohbete başlayabilirsiniz.');
      if (typeof checkUserProfile === 'function') checkUserProfile();
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

  const cfg = pData.avatarConfig || {};
  const group = buildStylizedAvatarMesh(cfg);

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
  ctx.fillStyle = 'rgba(10, 11, 22, 0.85)';
  ctx.roundRect(8, 8, 240, 48, 14);
  ctx.fill();
  ctx.strokeStyle = '#e5a93c';
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
// 7. ETKİLEŞİM & ŞİKAYET BİLDİRİMİ
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
  alert(`❤️ ${currentTargetUser.nickname} kullanıcısına kalp atıldı! Karşı taraf da kalpleşirse DM kutunda mesaj olarak açılacak.`);
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
  ctx.strokeStyle = '#e5a93c';
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
  const reason = prompt("🚨 Mekan Yönetimine Şikayet Bildir:\n(Uygunsuz davranış veya rahatsızlık sebebi)");
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
    if (res.success) alert('✅ Şikayetiniz koordinatlarınızla iletildi.');
    else alert('Hata: ' + (res.message || 'Bilinmiyor'));
  })
  .catch(() => alert('Sunucu bağlantı hatası oluştu.'));
}

function setupJoystick() {
  const zone = document.getElementById('joystick-zone');
  if (!zone) return;
  zone.innerHTML = '';

  joystick = nipplejs.create({
    zone: zone,
    mode: 'static',
    position: { left: '60px', top: '60px' },
    color: '#e5a93c',
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

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
