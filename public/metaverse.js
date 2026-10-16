// ==========================================================================
// GOLDENMATCH - ULTRA-HD 4D PARAMETRİK MEKAN & GTA-TPS İNSANSI MOTORU
// ==========================================================================

let scene, camera, renderer, player, joystick;
let composer, bloomPass;
let moveVector = { x: 0, y: 0 };
let socket = null;
let otherPlayers = {};
let currentTargetUser = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Kullanıcı Tarafından Canlı Yönetilen Meta Ayarlar Portu Parametreleri
let cameraSettings = {
  distance: 9.0,      // GTA ferah takip mesafesi
  fov: 65,            // Doğal derinlik açısı
  heightOffset: 1.8,  // Omuz hizası
  exposure: 1.15      // Sinematik pozlama
};

// GTA / Minecraft Tarzı 3. Şahıs Dinamik Kamera Açıları
let camYaw = 0;         // Yatay dönüş açısı
let camPitch = 0.28;     // Dikey bakış açısı
const camTarget = new THREE.Vector3();
let isPointerOrbiting = false;
let lastPointerX = 0, lastPointerY = 0;

// Animasyon & Eylem Durumları
let currentActionState = 'idle';
let walkCycle = 0;
let isMoving = false;
let isSprinting = false;

// Işıklar & Ambiyans
let hemiLight, sunLight, chandelierLight;
let isGhostMode = false;
let isAdminEditor = false;
let currentVenueTheme = 'golden_parametric';

// Kullanıcı Katmanlı & Stilize Avatar Konfigürasyonu
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
  const savedCam = localStorage.getItem('gm_camera_settings');
  if (savedCam) cameraSettings = Object.assign(cameraSettings, JSON.parse(savedCam));
} catch (e) {}

// ==========================================================================
// 1. PROCEDURAL THE SIMS PBR DOKU ÜRETECİLERİ (ROBLOX HİSSİNİ BİTİREN KISIM)
// ==========================================================================
function createProceduralParquet() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d180f';
  ctx.fillRect(0, 0, 1024, 1024);

  const rows = 16, cols = 8;
  const w = 1024 / cols, h = 1024 / rows;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const shift = (i % 2) * (w / 2);
      const x = (j * w + shift) % 1024;
      const y = i * h;
      const tone = 20 + Math.floor(Math.sin(i * 3 + j * 5) * 8);
      ctx.fillStyle = `rgb(${tone + 40}, ${tone + 20}, ${tone + 8})`;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createProceduralMarble() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f5ef';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 90);
  ctx.bezierCurveTo(150, 220, 310, 130, 512, 430);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100, 90, 85, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.bezierCurveTo(230, 270, 360, 380, 512, 190);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

// ==========================================================================
// 2. SAHNE, SİNEMATİK POST-PROCESSING VE PARAMETRİK MEKAN
// ==========================================================================
function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  if (renderer && scene) {
    onWindowResize();
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x161320);
  scene.fog = new THREE.FogExp2(0x161320, 0.012);

  camera = new THREE.PerspectiveCamera(cameraSettings.fov, container.clientWidth / container.clientHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cameraSettings.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const renderPass = new THREE.RenderPass(scene, camera);
  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.42, 0.4, 0.86
  );
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  hemiLight = new THREE.HemisphereLight(0xfff0e6, 0x221a2e, 0.65);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xffeed6, 1.9);
  sunLight.position.set(25, 45, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.00015;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.camera.left = -30;
  sunLight.shadow.camera.right = 30;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -30;
  scene.add(sunLight);

  buildParametricGoldenAuditorium();

  player = buildStylizedAvatarMesh(myAvatarConfig);
  scene.add(player);

  setupJoystick();
  setupKeyboardControls();
  setupGTAOrbitControls(container);
  loadSavedWorldItems();
  populateYtItemDrawer();
  setupSocket();

  renderer.domElement.addEventListener('pointerdown', onSceneClick);
  window.addEventListener('resize', onWindowResize);
  syncSettingsPortUI();
  animate();
}

function buildParametricGoldenAuditorium() {
  const parquetTex = createProceduralParquet();
  const marbleTex = createProceduralMarble();

  const floorMat = new THREE.MeshStandardMaterial({
    map: parquetTex,
    roughness: 0.28,
    metalness: 0.05
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    map: marbleTex,
    roughness: 0.16,
    metalness: 0.08
  });
  const pinkVelvetMat = new THREE.MeshStandardMaterial({
    color: 0xd95272,
    roughness: 0.45,
    metalness: 0.05
  });
  const goldSculptMat = new THREE.MeshStandardMaterial({
    color: 0xdfb76c,
    metalness: 0.92,
    roughness: 0.18
  });

  const centerFloor = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.6, 48), floorMat);
  centerFloor.position.set(0, -2.6, 0);
  centerFloor.receiveShadow = true;
  scene.add(centerFloor);

  for (let i = 0; i < 7; i++) {
    const radius = 34 - i * 3.6;
    const height = 0.55;
    const ringGeo = new THREE.CylinderGeometry(radius, radius + 1.2, height, 48);
    const stepMesh = new THREE.Mesh(ringGeo, pinkVelvetMat);
    stepMesh.position.set(0, (6 - i) * height - 2.5, 0);
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    scene.add(stepMesh);
  }

  for (let j = 0; j < 12; j++) {
    const ribbonGroup = new THREE.Group();
    const curveRadius = 14 + j * 2.2;
    const tubeGeo = new THREE.TorusGeometry(curveRadius, 0.45, 12, 64, Math.PI * 1.4);
    const ribbonMat = j % 2 === 0 ? marbleMat : pinkVelvetMat;
    const ribbon = new THREE.Mesh(tubeGeo, ribbonMat);
    ribbon.rotation.x = Math.PI / 2 + (j * 0.06);
    ribbon.rotation.y = (j * 0.18);
    ribbon.position.set(Math.sin(j) * 3, 14 + (j * 0.9), Math.cos(j) * 2);
    ribbon.castShadow = true;
    ribbonGroup.add(ribbon);
    scene.add(ribbonGroup);
  }

  const chandelierGeo = new THREE.TorusGeometry(3.6, 0.06, 16, 64);
  const chandelier = new THREE.Mesh(
    chandelierGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe0a3 })
  );
  chandelier.rotation.x = Math.PI / 2;
  chandelier.position.set(0, 8.5, 0);
  scene.add(chandelier);

  chandelierLight = new THREE.PointLight(0xffb359, 1.4, 25, 1.5);
  chandelierLight.position.set(0, 8.2, 0);
  chandelierLight.castShadow = true;
  scene.add(chandelierLight);

  spawnGoldenSpiralSculpture(16, 1.2, -6, goldSculptMat);
  spawnGoldenSpiralSculpture(-16, 1.2, -6, goldSculptMat);
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
  const barMat = new THREE.MeshStandardMaterial({ color: 0x181720, roughness: 0.22 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xdfb76c, metalness: 0.92, roughness: 0.15 });

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
// 3. STİLİZE İNSANSI AVATAR MİMARİSİ (CYBER-GLAM / GEN-Z)
// ==========================================================================
function buildStylizedAvatarMesh(cfg) {
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinColor || '#f7d2b7', roughness: 0.65 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: cfg.eyeColor || '#9b59b6', roughness: 0.1 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hairColor || '#00d2d3', roughness: 0.35, metalness: 0.1 });
  const topMat = new THREE.MeshStandardMaterial({ color: cfg.outfitTopColor || '#ffffff', roughness: 0.45 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: cfg.outfitBottomColor || '#1a1a24', roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xdfb76c, metalness: 0.92, roughness: 0.18 });
  const bootsMat = new THREE.MeshStandardMaterial({ color: cfg.shoesColor || '#ffffff', roughness: 0.35 });

  const pelvis = new THREE.Group();
  pelvis.position.y = 1.85;
  root.add(pelvis);

  const torsoWidth = isFemale ? 0.68 : 0.92;
  const chestWidth = isFemale ? 0.82 : 1.08;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(chestWidth * 0.45, torsoWidth * 0.4, 1.3, 20),
    cfg.outfitTop !== 'none' ? topMat : skinMat
  );
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

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeL.position.set(-0.13, 0.06, 0.34);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeR.position.set(0.13, 0.06, 0.34);
  headGroup.add(eyeR);

  const faceDecal = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x9b59b6 }));
  faceDecal.position.set(0.16, 0.12, 0.33);
  faceDecal.rotation.z = -Math.PI / 4;
  headGroup.add(faceDecal);

  attachStylizedHair(headGroup, cfg.hairStyle, hairMat);

  if (cfg.hat === 'gold_wreath') {
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 24), goldMat);
    wreath.rotation.x = Math.PI / 2.2;
    wreath.position.set(0, 0.22, 0.02);
    headGroup.add(wreath);
  }

  if (cfg.glasses === 'cyber_sunglasses') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.16), new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.1 }));
    glasses.position.set(0, 0.06, 0.37);
    headGroup.add(glasses);
  }

  if (cfg.necklace === 'heavy_chain') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 12, 28), goldMat);
    chain.rotation.x = Math.PI / 2.3;
    chain.position.set(0, 1.34, 0.08);
    pelvis.add(chain);
  }

  const armOffset = isFemale ? 0.45 : 0.60;

  const leftArm = new THREE.Group();
  leftArm.position.set(-armOffset, 1.25, 0);
  pelvis.add(leftArm);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  leftBicep.position.y = -0.32;
  leftBicep.castShadow = true;
  leftArm.add(leftBicep);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.65, 14), topMat);
  leftForearm.position.y = -0.85;
  leftForearm.castShadow = true;
  leftArm.add(leftForearm);

  const rightArm = new THREE.Group();
  rightArm.position.set(armOffset, 1.25, 0);
  pelvis.add(rightArm);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  rightBicep.position.y = -0.32;
  rightBicep.castShadow = true;
  rightArm.add(rightBicep);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.65, 14), topMat);
  rightForearm.position.y = -0.85;
  rightForearm.castShadow = true;
  rightArm.add(rightForearm);

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
  leftFoot.castShadow = true;
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
  rightFoot.castShadow = true;
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
// 4. CANLI META AYARLAR PORTU YÖNETİMİ
// ==========================================================================
window.toggleMetaSettingsPort = function() {
  const modal = document.getElementById('metaSettingsPort');
  modal?.classList.toggle('hidden');
};

window.onMetaSettingChange = function(type, value) {
  const val = parseFloat(value);
  if (type === 'distance') {
    cameraSettings.distance = val;
    document.getElementById('label-cam-dist').innerText = val.toFixed(1) + 'm';
  } else if (type === 'fov') {
    cameraSettings.fov = val;
    document.getElementById('label-cam-fov').innerText = val + '°';
    if (camera) {
      camera.fov = val;
      camera.updateProjectionMatrix();
    }
  } else if (type === 'height') {
    cameraSettings.heightOffset = val;
    document.getElementById('label-cam-height').innerText = val.toFixed(1) + 'm';
  } else if (type === 'exposure') {
    cameraSettings.exposure = val;
    document.getElementById('label-cam-exp').innerText = val.toFixed(2);
    if (renderer) renderer.toneMappingExposure = val;
  }
  localStorage.setItem('gm_camera_settings', JSON.stringify(cameraSettings));
};

window.applyPerspectivePreset = function(preset, btnElem) {
  document.querySelectorAll('.view-preset-btns .view-btn').forEach(b => b.classList.remove('active'));
  if (btnElem) btnElem.classList.add('active');

  if (preset === 'wide') {
    cameraSettings.distance = 9.5;
    cameraSettings.fov = 68;
    cameraSettings.heightOffset = 1.8;
  } else if (preset === 'close') {
    cameraSettings.distance = 5.5;
    cameraSettings.fov = 55;
    cameraSettings.heightOffset = 1.6;
  } else if (preset === 'top') {
    cameraSettings.distance = 14.0;
    cameraSettings.fov = 48;
    cameraSettings.heightOffset = 4.2;
  } else if (preset === 'fps') {
    cameraSettings.distance = 0.4;
    cameraSettings.fov = 85;
    cameraSettings.heightOffset = 1.7;
  }

  syncSettingsPortUI();
  if (camera) {
    camera.fov = cameraSettings.fov;
    camera.updateProjectionMatrix();
  }
  localStorage.setItem('gm_camera_settings', JSON.stringify(cameraSettings));
};

function syncSettingsPortUI() {
  const sDist = document.getElementById('slider-cam-dist');
  const sFov = document.getElementById('slider-cam-fov');
  const sHeight = document.getElementById('slider-cam-height');
  const sExp = document.getElementById('slider-cam-exp');

  if (sDist) sDist.value = cameraSettings.distance;
  if (sFov) sFov.value = cameraSettings.fov;
  if (sHeight) sHeight.value = cameraSettings.heightOffset;
  if (sExp) sExp.value = cameraSettings.exposure;

  document.getElementById('label-cam-dist')?.innerText = cameraSettings.distance.toFixed(1) + 'm';
  document.getElementById('label-cam-fov')?.innerText = cameraSettings.fov + '°';
  document.getElementById('label-cam-height')?.innerText = cameraSettings.heightOffset.toFixed(1) + 'm';
  document.getElementById('label-cam-exp')?.innerText = cameraSettings.exposure.toFixed(2);
}

// ==========================================================================
// 5. GTA TARZI KAMERA VE İNSANSI ANİMASYON DÖNGÜSÜ
// ==========================================================================
function setupGTAOrbitControls(container) {
  container.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
      isPointerOrbiting = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
  });

  window.addEventListener('mouseup', () => { isPointerOrbiting = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isPointerOrbiting) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    camYaw -= dx * 0.0055;
    camPitch += dy * 0.0055;
    camPitch = Math.max(-0.15, Math.min(Math.PI / 2.6, camPitch));
  });

  container.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t.clientX > window.innerWidth * 0.35) {
      isPointerOrbiting = true;
      lastPointerX = t.clientX;
      lastPointerY = t.clientY;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!isPointerOrbiting) return;
    const t = e.touches[0];
    const dx = t.clientX - lastPointerX;
    const dy = t.clientY - lastPointerY;
    lastPointerX = t.clientX;
    lastPointerY = t.clientY;

    camYaw -= dx * 0.0075;
    camPitch += dy * 0.0075;
    camPitch = Math.max(-0.15, Math.min(Math.PI / 2.6, camPitch));
  }, { passive: true });

  container.addEventListener('touchend', () => { isPointerOrbiting = false; });
}

let lastSendTime = 0;
const animClock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = animClock.getDelta();
  const joints = player?.userData?.joints;

  if (player && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05)) {
    currentActionState = 'walk';
    const currentSpeed = isSprinting ? 6.2 : 3.4;

    const inputAngle = Math.atan2(moveVector.x, moveVector.y);
    const targetHeading = camYaw + inputAngle;

    player.rotation.y += THREE.MathUtils.clamp(
      THREE.MathUtils.euclideanModulo(targetHeading - player.rotation.y + Math.PI, Math.PI * 2) - Math.PI,
      -delta * 14,
      delta * 14
    );

    player.position.x += Math.sin(targetHeading) * currentSpeed * delta;
    player.position.z += Math.cos(targetHeading) * currentSpeed * delta;

    walkCycle += delta * (isSprinting ? 14 : 9);
    if (joints) {
      joints.leftLeg.rotation.x = Math.sin(walkCycle) * (isSprinting ? 0.75 : 0.55);
      joints.rightLeg.rotation.x = -Math.sin(walkCycle) * (isSprinting ? 0.75 : 0.55);
      joints.leftArm.rotation.x = -Math.sin(walkCycle) * (isSprinting ? 0.6 : 0.45);
      joints.rightArm.rotation.x = Math.sin(walkCycle) * (isSprinting ? 0.6 : 0.45);
      joints.pelvis.position.y = 1.85 + Math.abs(Math.sin(walkCycle * 2)) * 0.07;
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
      walkCycle += delta * 2;
      if (joints) {
        joints.leftLeg.rotation.x = 0;
        joints.rightLeg.rotation.x = 0;
        joints.leftArm.rotation.x = 0;
        joints.rightArm.rotation.x = 0;
        joints.pelvis.position.y = 1.85 + Math.sin(walkCycle) * 0.02;
      }
    }
  }

  if (player && camera) {
    const desiredX = player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * cameraSettings.distance;
    const desiredY = player.position.y + cameraSettings.heightOffset + Math.sin(camPitch) * cameraSettings.distance;
    const desiredZ = player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * cameraSettings.distance;

    camera.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), 0.16);
    camTarget.set(player.position.x, player.position.y + (cameraSettings.heightOffset * 0.8), player.position.z);
    camera.lookAt(camTarget);
  }

  if (composer) {
    composer.render();
  } else if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==========================================================================
// 6. JOYSTICK, EYLEM VE SOKET KONTROLLERİ
// ==========================================================================
window.toggleSprint = function() {
  isSprinting = !isSprinting;
  const btn = document.getElementById('action-sprint-btn');
  if (btn) btn.style.borderColor = isSprinting ? '#d4af37' : 'rgba(212,175,55,0.5)';
};

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

window.setMetaverseAmbiance = function(mode, el) {
  document.querySelectorAll('.amb-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');

  if (mode === 'sunset') {
    scene.background.set(0x18101a);
    scene.fog.color.set(0x18101a);
    sunLight.color.set(0xff753a);
    sunLight.intensity = 2.2;
    hemiLight.intensity = 0.45;
    chandelierLight.intensity = 1.4;
    renderer.toneMappingExposure = 1.12;
  } else if (mode === 'day') {
    scene.background.set(0xd2deea);
    scene.fog.color.set(0xd2deea);
    sunLight.color.set(0xffffff);
    sunLight.intensity = 2.0;
    hemiLight.intensity = 0.75;
    chandelierLight.intensity = 0.5;
    renderer.toneMappingExposure = 1.2;
  } else if (mode === 'night') {
    scene.background.set(0x07080d);
    scene.fog.color.set(0x07080d);
    sunLight.color.set(0x354b66);
    sunLight.intensity = 0.35;
    hemiLight.intensity = 0.2;
    chandelierLight.intensity = 2.4;
    renderer.toneMappingExposure = 1.3;
  }
};

function setupKeyboardControls() {
  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, ShiftLeft: false };

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (keys[e.code] !== undefined) keys[e.code] = true;
    updateKeyMove();
  });

  window.addEventListener('keyup', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (keys[e.code] !== undefined) keys[e.code] = false;
    updateKeyMove();
  });

  function updateKeyMove() {
    let x = 0, y = 0;
    if (keys.KeyW) y += 1;
    if (keys.KeyS) y -= 1;
    if (keys.KeyD) x += 1;
    if (keys.KeyA) x -= 1;

    if (!joystick || (moveVector.x === 0 && moveVector.y === 0)) {
      moveVector.x = x;
      moveVector.y = y;
      isMoving = (x !== 0 || y !== 0);
    }
    isSprinting = !!keys.ShiftLeft;
  }
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
// 7. CANLI AVATAR STÜDYOSU (GİYDİR/ÇIKAR ÖNİZLEME)
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
// 8. YT MASASI: PARAMETRİK EŞYALAR & KATALOG
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
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xdfb76c, metalness: 0.92, roughness: 0.18 });
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
// 9. SOKET & DİĞER OYUNCULARI CANLI İZLEME
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
// 10. ETKİLEŞİM & ŞİKAYET BİLDİRİMİ
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
  if (!zone || typeof nipplejs === 'undefined') return;
  zone.innerHTML = '';

  joystick = nipplejs.create({
    zone: zone,
    mode: 'static',
    position: { left: '60px', top: '60px' },
    color: '#e5a93c',
    size: 90
  });

  joystick.on('move', (evt, data) => {
    if (data && data.vector) {
      moveVector.x = data.vector.x;
      moveVector.y = data.vector.y;
      isMoving = true;
    }
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
  if (composer) composer.setSize(container.clientWidth, container.clientHeight);
}
