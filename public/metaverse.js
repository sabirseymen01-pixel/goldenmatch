// ==========================================================================
// GOLDENMATCH - 3D METAVERSE İNSANSI ANİMASYON, AVATAR & MEKAN MOTORU
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
let currentVenueTheme = 'ancient_greek';

// Kullanıcı Katmanlı Avatar Konfigürasyonu
let myAvatarConfig = {
  gender: 'male',
  skinColor: '#f0c7a1',
  eyeColor: '#2980b9',
  eyeShape: 'almond',
  hairStyle: 'greek_curls',
  hairColor: '#4a2f1b',
  hat: 'none',
  glasses: 'none',
  necklace: 'none',
  outfitTop: 'greek_tunic',
  outfitTopColor: '#ffffff',
  outfitBottom: 'classic_pants',
  outfitBottomColor: '#1a1a24',
  shoes: 'gladiator_sandals'
};

try {
  const saved = localStorage.getItem('gm_avatar_config');
  if (saved) myAvatarConfig = Object.assign(myAvatarConfig, JSON.parse(saved));
} catch (e) {}

// ==========================================================================
// 1. SAHNE VE ATMOSFER (ANTİK YUNAN OLİMPOS MİMARİSİ)
// ==========================================================================
function initMetaverse() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  if (renderer && scene) {
    onWindowResize();
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090a14);
  scene.fog = new THREE.FogExp2(0x090a14, 0.024);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Işıklandırma
  const ambientLight = new THREE.AmbientLight(0xffeedd, 0.7);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0x8fa3bf, 1.3);
  moonLight.position.set(25, 45, 20);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 1024;
  moonLight.shadow.mapSize.height = 1024;
  scene.add(moonLight);

  const goldCenterSpot = new THREE.SpotLight(0xd4af37, 3.2, 55, Math.PI / 3, 0.45);
  goldCenterSpot.position.set(0, 19, 0);
  goldCenterSpot.castShadow = true;
  scene.add(goldCenterSpot);

  buildAncientGreekLounge();

  player = buildHumanoidAvatarMesh(myAvatarConfig);
  scene.add(player);

  setupJoystick();
  loadSavedWorldItems();
  populateYtItemDrawer();
  setupSocket();

  renderer.domElement.addEventListener('pointerdown', onSceneClick);
  window.addEventListener('resize', onWindowResize);
  animate();
}

function buildAncientGreekLounge() {
  // Mermer Zemin
  const floorGeo = new THREE.PlaneGeometry(100, 100);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x202128,
    roughness: 0.28,
    metalness: 0.35
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Mermer Dorik Sütunlar
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xdfdfdf, roughness: 0.22 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });

  const coords = [
    [-15, -15], [15, -15], [-15, 15], [15, 15],
    [-8, -19], [8, -19], [-19, 0], [19, 0]
  ];

  coords.forEach(([px, pz]) => {
    const colGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.7, 20), pillarMat);
    base.position.y = 0.35;
    colGroup.add(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 10.5, 24), pillarMat);
    shaft.position.y = 5.6;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    colGroup.add(shaft);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), goldMat);
    cap.position.y = 11;
    colGroup.add(cap);

    colGroup.position.set(px, 0, pz);
    scene.add(colGroup);
  });

  // U-Bar Tezgahı
  const barGroup = new THREE.Group();
  const marbleBarMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.15, metalness: 0.1 });
  const woodTopMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.35 });

  const frontBar = new THREE.Mesh(new THREE.BoxGeometry(17, 2.6, 2.6), marbleBarMat);
  frontBar.position.set(0, 1.3, -13.5);
  frontBar.castShadow = true;
  frontBar.receiveShadow = true;
  barGroup.add(frontBar);

  const topWood = new THREE.Mesh(new THREE.BoxGeometry(17.4, 0.25, 3.0), woodTopMat);
  topWood.position.set(0, 2.65, -13.5);
  barGroup.add(topWood);

  scene.add(barGroup);

  // Meşaleler
  spawnTorchFire(-8, 3.8, -14);
  spawnTorchFire(8, 3.8, -14);

  // Sabit Amforalar
  renderItemMesh('ancient_urn', { x: -6, y: 0.8, z: -11.5 });
  renderItemMesh('ancient_urn', { x: 6, y: 0.8, z: -11.5 });
}

function spawnTorchFire(x, y, z) {
  const torchLight = new THREE.PointLight(0xff7a00, 3.4, 20, 1.4);
  torchLight.position.set(x, y, z);
  scene.add(torchLight);

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa033 })
  );
  flame.position.set(x, y, z);
  scene.add(flame);
}

// ==========================================================================
// 2. İNSANSI EKLEMLİ AVATAR & KATMANLI KIYAFET DONATIMI
// ==========================================================================
function buildHumanoidAvatarMesh(cfg) {
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinColor || '#f0c7a1', roughness: 0.55 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: cfg.eyeColor || '#2980b9', roughness: 0.2 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hairColor || '#4a2f1b', roughness: 0.5 });
  const topMat = new THREE.MeshStandardMaterial({ color: cfg.outfitTopColor || '#ffffff', roughness: 0.45 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: cfg.outfitBottomColor || '#1a1a24', roughness: 0.45 });
  const shoesMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.55 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });

  // 1. Pelvis (Kök Eklem)
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.8;
  root.add(pelvis);

  // 2. Gövde & Üst Giyim Katmanı
  const torsoWidth = isFemale ? 0.72 : 0.92;
  const torsoChest = isFemale ? 0.82 : 1.05;
  const torsoGeo = new THREE.CylinderGeometry(torsoChest * 0.45, torsoWidth * 0.4, 1.3, 16);
  const torso = new THREE.Mesh(torsoGeo, cfg.outfitTop !== 'none' ? topMat : skinMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  pelvis.add(torso);

  // 3. Boyun & Baş
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
  eyeL.position.set(-0.13, 0.05, 0.34);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
  eyeR.position.set(0.13, 0.05, 0.34);
  headGroup.add(eyeR);

  // Saç Modeli
  if (cfg.hairStyle && cfg.hairStyle !== 'none') {
    attachHairStyle(headGroup, cfg.hairStyle, hairMat);
  }

  // Şapka / Taç Katmanı
  if (cfg.hat === 'gold_wreath') {
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 24), goldMat);
    wreath.rotation.x = Math.PI / 2.2;
    wreath.position.set(0, 0.22, 0.02);
    headGroup.add(wreath);
  } else if (cfg.hat === 'party_cap') {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), topMat);
    cap.position.set(0, 0.55, 0);
    headGroup.add(cap);
  } else if (cfg.hat === 'fedora') {
    const fedora = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.28, 16), bottomMat);
    fedora.position.set(0, 0.36, 0);
    headGroup.add(fedora);
  }

  // Gözlük Katmanı
  if (cfg.glasses === 'sunglasses_dark') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }));
    glasses.position.set(0, 0.06, 0.37);
    headGroup.add(glasses);
  } else if (cfg.glasses === 'aviator_gold') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.12), goldMat);
    glasses.position.set(0, 0.06, 0.37);
    headGroup.add(glasses);
  } else if (cfg.glasses === 'cyber_visor') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.2), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    visor.position.set(0, 0.06, 0.37);
    headGroup.add(visor);
  }

  // Kolye / Gerdanlık Katmanı
  if (cfg.necklace === 'gold_chain') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 12, 24), goldMat);
    chain.rotation.x = Math.PI / 2.4;
    chain.position.set(0, 1.35, 0.08);
    pelvis.add(chain);
  } else if (cfg.necklace === 'pearl_choker') {
    const choker = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 12, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    choker.rotation.x = Math.PI / 2.4;
    choker.position.set(0, 1.38, 0.06);
    pelvis.add(choker);
  }

  // 4. Eklemli Kollar (Omuz & Dirsek)
  const armOffset = isFemale ? 0.46 : 0.60;

  const leftArm = new THREE.Group();
  leftArm.position.set(-armOffset, 1.25, 0);
  pelvis.add(leftArm);
  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.65, 12), cfg.outfitTop !== 'none' ? topMat : skinMat);
  leftBicep.position.y = -0.32;
  leftArm.add(leftBicep);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12), skinMat);
  leftForearm.position.y = -0.85;
  leftArm.add(leftForearm);

  const rightArm = new THREE.Group();
  rightArm.position.set(armOffset, 1.25, 0);
  pelvis.add(rightArm);
  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.65, 12), cfg.outfitTop !== 'none' ? topMat : skinMat);
  rightBicep.position.y = -0.32;
  rightArm.add(rightBicep);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12), skinMat);
  rightForearm.position.y = -0.85;
  rightArm.add(rightForearm);

  // 5. Eklemli Bacaklar (Kalça & Diz)
  const legOffset = isFemale ? 0.21 : 0.27;

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-legOffset, 0, 0);
  pelvis.add(leftLeg);
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.85, 12), cfg.outfitBottom !== 'none' ? bottomMat : skinMat);
  leftThigh.position.y = -0.42;
  leftThigh.castShadow = true;
  leftLeg.add(leftThigh);
  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 12), skinMat);
  leftShin.position.y = -1.18;
  leftLeg.add(leftShin);
  if (cfg.shoes !== 'none') {
    const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.42), shoesMat);
    leftFoot.position.set(0, -1.65, 0.1);
    leftLeg.add(leftFoot);
  }

  const rightLeg = new THREE.Group();
  rightLeg.position.set(legOffset, 0, 0);
  pelvis.add(rightLeg);
  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.85, 12), cfg.outfitBottom !== 'none' ? bottomMat : skinMat);
  rightThigh.position.y = -0.42;
  rightThigh.castShadow = true;
  rightLeg.add(rightThigh);
  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.85, 12), skinMat);
  rightShin.position.y = -1.18;
  rightLeg.add(rightShin);
  if (cfg.shoes !== 'none') {
    const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.42), shoesMat);
    rightFoot.position.set(0, -1.65, 0.1);
    rightLeg.add(rightFoot);
  }

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

function attachHairStyle(headGroup, style, hairMat) {
  if (style === 'greek_curls') {
    const curls = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hairMat);
      const angle = (i / 9) * Math.PI * 1.6 - Math.PI * 0.8;
      curl.position.set(Math.sin(angle) * 0.32, 0.28 + Math.random() * 0.08, Math.cos(angle) * 0.28);
      curls.add(curl);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.39, 16, 16), hairMat);
    cap.position.set(0, 0.1, -0.05);
    curls.add(cap);
    headGroup.add(curls);
  } else if (style === 'long_braid') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), hairMat);
    cap.position.set(0, 0.1, -0.06);
    headGroup.add(cap);
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
// 3. ANİMASYON DÖNGÜSÜ & İNSANSI EYLEMLER (YÜRÜME, OTURMA, ÇÖMELME)
// ==========================================================================
let lastSendTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const joints = player?.userData?.joints;

  // 1. Hareket Halinde (Yürüme)
  if (player && (moveVector.x !== 0 || moveVector.y !== 0)) {
    currentActionState = 'walk';
    const speed = 0.13;
    player.position.x += moveVector.x * speed;
    player.position.z -= moveVector.y * speed;

    const angle = Math.atan2(moveVector.x, moveVector.y);
    player.rotation.y = angle;

    walkCycle += 0.22;
    if (joints) {
      joints.leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
      joints.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
      joints.leftArm.rotation.x = -Math.sin(walkCycle) * 0.5;
      joints.rightArm.rotation.x = Math.sin(walkCycle) * 0.5;
      joints.pelvis.position.y = 1.8 + Math.abs(Math.sin(walkCycle * 2)) * 0.06;
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
    // 2. Durma Eylemleri
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
      // Idle (Nefes Alma Salınımı)
      currentActionState = 'idle';
      walkCycle += 0.035;
      if (joints) {
        joints.leftLeg.rotation.x = 0;
        joints.rightLeg.rotation.x = 0;
        joints.leftArm.rotation.x = 0;
        joints.rightArm.rotation.x = 0;
        joints.pelvis.position.y = 1.8 + Math.sin(walkCycle) * 0.02;
      }
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

// Otur / Kalk Butonu
function togglePlayerSit() {
  const btn = document.getElementById('action-sit-btn');
  if (currentActionState === 'sit') {
    currentActionState = 'idle';
    btn.classList.remove('active');
  } else {
    currentActionState = 'sit';
    document.getElementById('action-crouch-btn')?.classList.remove('active');
    btn.classList.add('active');
  }
  syncActionStateWithSocket();
}

// Çömel Butonu
function togglePlayerCrouch() {
  const btn = document.getElementById('action-crouch-btn');
  if (currentActionState === 'crouch') {
    currentActionState = 'idle';
    btn.classList.remove('active');
  } else {
    currentActionState = 'crouch';
    document.getElementById('action-sit-btn')?.classList.remove('active');
    btn.classList.add('active');
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

// Mekandan Çıkış (Keşfet'e Dönüş)
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

    const light = new THREE.AmbientLight(0xffffff, 0.9);
    previewScene.add(light);
    const pSpot = new THREE.PointLight(0xd4af37, 2.4, 25);
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
  previewMesh = buildHumanoidAvatarMesh(myAvatarConfig);
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
    player = buildHumanoidAvatarMesh(myAvatarConfig);
    player.position.set(curPos.x, curPos.y, curPos.z);
    scene.add(player);
  }

  if (socket) {
    socket.emit('update_avatar_look', {
      telegramId: window.currentUserId,
      avatarConfig: myAvatarConfig
    });
  }

  alert("✨ Yeni tarzın mühürlendi! Karakterin güncellendi.");
}

// ==========================================================================
// 5. YT MASASI: ÇEKİLEBİLİR 30+ ZENGİN EŞYA KATALOĞU
// ==========================================================================
const YT_CATALOG_ITEMS = [
  { type: 'greek_column', name: 'Mermer Sütun', icon: '🏛️' },
  { type: 'ancient_throne', name: 'Olimpos Tahtı', icon: '👑' },
  { type: 'marble_table', name: 'Ziyafet Masası', icon: '🍽️' },
  { type: 'bar_stool', name: 'Sedir Tabure', icon: '🪑' },
  { type: 'ancient_urn', name: 'Şarap Amforası', icon: '🏺' },
  { type: 'torch_post', name: 'Ateş Meşalesi', icon: '🔥' },
  { type: 'bronze_statue', name: 'Tanrı Heykeli', icon: '🗿' },
  { type: 'vip_sofa', name: 'Deri VIP Koltuk', icon: '🛋️' },
  { type: 'mosaic_fountain', name: 'Mozaik Çeşme', icon: '⛲' },
  { type: 'crystal_goblet', name: 'Altın Kadeh', icon: '🍷' },
  { type: 'cyber_orb', name: 'Neon Işık Küresi', icon: '🔮' },
  { type: 'dj_booth', name: 'Parti DJ Kabini', icon: '🎧' }
];

function enterMetaverseAsGhost() {
  isGhostMode = true;
  isAdminEditor = true;
  switchTab('metaverse');
  document.getElementById('yt-open-editor-btn')?.classList.remove('hidden');
  alert("👻 Hayalet Modu Devrede!\nMekandasınız, oyuncular sizi görmüyor. Eşya ekleyip temayı yönetebilirsiniz.");

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
  drawer.classList.toggle('hidden');
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
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.15 });

  if (itemType === 'marble_table') {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.15, 24), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2 }));
    top.position.y = 1.1;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.1, 16), goldMat);
    leg.position.y = 0.55;
    group.add(top); group.add(leg);
  } else if (itemType === 'ancient_throne') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), goldMat);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.25), goldMat);
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
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 7.5, 20), new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.25 }));
    col.position.y = 3.75;
    group.add(col);
  } else if (itemType === 'bar_stool') {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
    seat.position.y = 1.0;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 1.0, 12), goldMat);
    leg.position.y = 0.5;
    group.add(seat); group.add(leg);
  } else if (itemType === 'torch_post') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0x3d2716 }));
    post.position.y = 1.6;
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff7700 }));
    fire.position.y = 3.3;
    group.add(post); group.add(fire);
  } else if (itemType === 'vip_sofa') {
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3 }));
    sofa.position.y = 0.4;
    group.add(sofa);
  } else if (itemType === 'cyber_orb') {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    orb.position.y = 1.2;
    group.add(orb);
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

function setVenueTheme(themeName) {
  currentVenueTheme = themeName;
  if (themeName === 'cyber_lounge') {
    scene.background = new THREE.Color(0x05050f);
    scene.fog.color = new THREE.Color(0x05050f);
    alert("🌃 Konsept: Cyber Neon aktif!");
  } else if (themeName === 'dionysus_rave') {
    scene.background = new THREE.Color(0x18050e);
    scene.fog.color = new THREE.Color(0x18050e);
    alert("🍷 Konsept: Dionysos Kızıl Şölen aktif!");
  } else {
    scene.background = new THREE.Color(0x090a14);
    scene.fog.color = new THREE.Color(0x090a14);
    alert("🏛 Konsept: Antik Olimpos Partisi aktif!");
  }

  if (socket) {
    socket.emit('change_venue_theme', { themeName });
  }
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
          joints.pelvis.position.y = 1.8;
          joints.leftLeg.rotation.x = Math.sin(pGroup.userData.step) * 0.6;
          joints.rightLeg.rotation.x = -Math.sin(pGroup.userData.step) * 0.6;
        } else {
          joints.pelvis.position.y = 1.8;
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

  socket.on('venue_theme_changed', data => {
    setVenueTheme(data.themeName);
  });

  socket.on('player_said', data => {
    if (otherPlayers[data.socketId]) {
      showBubbleOnMesh(otherPlayers[data.socketId].group, data.text);
    }
  });

  // METAVERSE ↔ DM EŞLEŞME BİLDİRİMİ
  socket.on('match_notification', ({ user1, user2 }) => {
    if (window.currentUserId === user1 || window.currentUserId === user2) {
      alert("🎉 TEBRİKLER! Karşılıklı kalpleştiniz!\nDM kutunuza mesaj düştü, sohbete başlayabilirsiniz.");
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
  const group = buildHumanoidAvatarMesh(cfg);

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
  ctx.fillStyle = 'rgba(10, 11, 22, 0.8)';
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
// 7. ETKİLEŞİM, SOHBET BALONU & ŞİKAYET BİLDİRİMİ
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
  alert(`❤️ ${currentTargetUser.nickname} kullanıcısına kalp atıldı! Karşı taraf da kalpleşirse DM kutusunda sohbet açılacak.`);
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
  const reason = prompt("🚨 Olimpos Meclisine Şikayet Bildir:\n(Uygunsuz davranış, hile veya rahatsızlık sebebi)");
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
    if (res.success) alert("✅ Şikayetiniz YT Masasına koordinatlarınızla iletildi.");
    else alert("Hata: " + (res.message || "Bilinmiyor"));
  })
  .catch(() => alert("Sunucu bağlantı hatası oluştu."));
}

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

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !camera || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
