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

let cameraSettings = {
  distance: 9.0,
  fov: 65,
  heightOffset: 1.8,
  exposure: 1.15
};

let camYaw = 0;
let camPitch = 0.28;
const camTarget = new THREE.Vector3();
let isPointerOrbiting = false;
let lastPointerX = 0, lastPointerY = 0;

let currentActionState = 'idle';
let walkCycle = 0;
let isMoving = false;
let isSprinting = false;

let hemiLight, sunLight, chandelierLight;
let isGhostMode = false;
let isAdminEditor = false;

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

  return new THREE.CanvasTexture(c);
}

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

  const floorMat = new THREE.MeshStandardMaterial({ map: parquetTex, roughness: 0.28, metalness: 0.05 });
  const centerFloor = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.6, 48), floorMat);
  centerFloor.position.set(0, -2.6, 0);
  centerFloor.receiveShadow = true;
  scene.add(centerFloor);

  chandelierLight = new THREE.PointLight(0xffb359, 1.4, 25, 1.5);
  chandelierLight.position.set(0, 8.2, 0);
  chandelierLight.castShadow = true;
  scene.add(chandelierLight);
}

function buildStylizedAvatarMesh(cfg) {
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinColor || '#f7d2b7', roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hairColor || '#00d2d3', roughness: 0.35, metalness: 0.1 });
  const topMat = new THREE.MeshStandardMaterial({ color: cfg.outfitTopColor || '#ffffff', roughness: 0.45 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: cfg.outfitBottomColor || '#1a1a24', roughness: 0.45 });
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

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.85;
  pelvis.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
  headGeo.scale(1, 1.2, 1.08);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 16), hairMat);
  cap.position.set(0, 0.12, -0.04);
  headGroup.add(cap);

  const armOffset = isFemale ? 0.45 : 0.60;

  const leftArm = new THREE.Group();
  leftArm.position.set(-armOffset, 1.25, 0);
  pelvis.add(leftArm);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  leftBicep.position.y = -0.32;
  leftArm.add(leftBicep);

  const rightArm = new THREE.Group();
  rightArm.position.set(armOffset, 1.25, 0);
  pelvis.add(rightArm);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.65, 14), skinMat);
  rightBicep.position.y = -0.32;
  rightArm.add(rightBicep);

  const legOffset = isFemale ? 0.21 : 0.27;

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-legOffset, 0, 0);
  pelvis.add(leftLeg);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.85, 14), bottomMat);
  leftThigh.position.y = -0.42;
  leftLeg.add(leftThigh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(legOffset, 0, 0);
  pelvis.add(rightLeg);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.85, 14), bottomMat);
  rightThigh.position.y = -0.42;
  rightLeg.add(rightThigh);

  root.userData.joints = { pelvis, headGroup, leftArm, rightArm, leftLeg, rightLeg };
  root.userData.config = cfg;
  return root;
}

window.toggleMetaSettingsPort = function() {
  document.getElementById('metaSettingsPort')?.classList.toggle('hidden');
};

window.onMetaSettingChange = function(type, value) {
  const val = parseFloat(value);
  if (type === 'distance') {
    cameraSettings.distance = val;
  } else if (type === 'fov') {
    cameraSettings.fov = val;
    if (camera) {
      camera.fov = val;
      camera.updateProjectionMatrix();
    }
  }
  localStorage.setItem('gm_camera_settings', JSON.stringify(cameraSettings));
};

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
}

const animClock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = animClock.getDelta();

  if (player && (Math.abs(moveVector.x) > 0.05 || Math.abs(moveVector.y) > 0.05)) {
    const currentSpeed = isSprinting ? 6.2 : 3.4;
    const inputAngle = Math.atan2(moveVector.x, moveVector.y);
    const targetHeading = camYaw + inputAngle;

    player.position.x += Math.sin(targetHeading) * currentSpeed * delta;
    player.position.z += Math.cos(targetHeading) * currentSpeed * delta;
  }

  if (player && camera) {
    const desiredX = player.position.x + Math.sin(camYaw) * Math.cos(camPitch) * cameraSettings.distance;
    const desiredY = player.position.y + cameraSettings.heightOffset + Math.sin(camPitch) * cameraSettings.distance;
    const desiredZ = player.position.z + Math.cos(camYaw) * Math.cos(camPitch) * cameraSettings.distance;

    camera.position.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), 0.16);
    camTarget.set(player.position.x, player.position.y + (cameraSettings.heightOffset * 0.8), player.position.z);
    camera.lookAt(camTarget);
  }

  if (composer) composer.render();
  else if (renderer && scene && camera) renderer.render(scene, camera);
}

function setupJoystick() {
  const zone = document.getElementById('joystick-zone');
  if (!zone || typeof nipplejs === 'undefined') return;
  zone.innerHTML = '';
  joystick = nipplejs.create({ zone: zone, mode: 'static', position: { left: '60px', top: '60px' }, color: '#e5a93c', size: 90 });
  joystick.on('move', (evt, data) => { if (data?.vector) { moveVector.x = data.vector.x; moveVector.y = data.vector.y; } });
  joystick.on('end', () => { moveVector.x = 0; moveVector.y = 0; });
}

function setupKeyboardControls() {
  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, ShiftLeft: false };
  window.addEventListener('keydown', (e) => { if (keys[e.code] !== undefined) keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { if (keys[e.code] !== undefined) keys[e.code] = false; });
}

function setupSocket() {
  if (socket) return;
  socket = typeof io !== 'undefined' ? io() : null;
}

function loadSavedWorldItems() {}
function populateYtItemDrawer() {}
function onSceneClick() {}
function syncSettingsPortUI() {}
function exitMetaverseToExplore() {
  if (socket) { socket.disconnect(); socket = null; }
  switchTab('explore');
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  if (composer) composer.setSize(container.clientWidth, container.clientHeight);
}
