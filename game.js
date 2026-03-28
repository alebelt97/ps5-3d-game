// ─── Renderer ────────────────────────────────────────────────────────────────
var canvas = document.getElementById('c');

// PS5 needs failIfMajorPerformanceCaveat:false or it refuses to create a context.
// antialias:false lowers the bar further. No shadows — they need depth-texture
// extensions that may be absent.
var ctxOpts = { antialias: false, failIfMajorPerformanceCaveat: false,
                alpha: false, depth: true, stencil: false };
var gl = canvas.getContext('webgl', ctxOpts)
      || canvas.getContext('experimental-webgl', ctxOpts);


if (!gl) { throw new Error('WebGL not available'); }

var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl });
renderer.setPixelRatio(1); // fixed 1:1 — PS5 doesn't need HiDPI scaling
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // shadows need extensions PS5 may lack

// ─── Scene ────────────────────────────────────────────────────────────────────
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

// ─── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

var dirLight = new THREE.DirectionalLight(0xffd580, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// ─── Ground ───────────────────────────────────────────────────────────────────
var ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x16213e })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(200, 40, 0x334466, 0x223355));

// ─── Character (Mario) ───────────────────────────────────────────────────────
// Built from primitives — faces local -Z direction. Group rotates with movement.
var capsule = new THREE.Group();

// Legs (dark brown boots/trousers)
var legMat = new THREE.MeshLambertMaterial({ color: 0x4a2800 });
var legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.40, 8), legMat);
legL.position.set(-0.14, -0.80, 0);
capsule.add(legL);
var legR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.40, 8), legMat);
legR.position.set(0.14, -0.80, 0);
capsule.add(legR);

// Torso — blue overalls
var torsoMat = new THREE.MeshLambertMaterial({ color: 0x1155cc });
var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.48, 10), torsoMat);
torso.position.set(0, -0.36, 0);
capsule.add(torso);

// Overalls bib — small box on front of torso
var bib = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.20, 0.10), torsoMat);
bib.position.set(0, -0.14, -0.25);
capsule.add(bib);

// Head — skin colour
var headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
var head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), headMat);
head.position.set(0, 0.33, 0);
capsule.add(head);

// Hat — red brim + tapered dome
var hatMat = new THREE.MeshLambertMaterial({ color: 0xcc1111 });
var hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), hatMat);
hatBrim.position.set(0, 0.71, 0);
capsule.add(hatBrim);
var hatDome = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.32, 10), hatMat);
hatDome.position.set(0, 0.90, 0);
capsule.add(hatDome);

capsule.position.y = 1.0;
scene.add(capsule);

// ─── Camera ───────────────────────────────────────────────────────────────────
var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
var CAM_DIST_X = 0;
var CAM_DIST_Y = 3;
var CAM_DIST_Z = 7;
var cameraYaw = 0;

function updateCamera() {
  var cos = Math.cos(cameraYaw);
  var sin = Math.sin(cameraYaw);
  camera.position.x = capsule.position.x + CAM_DIST_X * cos + CAM_DIST_Z * sin;
  camera.position.y = capsule.position.y + CAM_DIST_Y;
  camera.position.z = capsule.position.z - CAM_DIST_X * sin + CAM_DIST_Z * cos;
  camera.lookAt(capsule.position.x, capsule.position.y + 1, capsule.position.z);
}

// ─── Keyboard input ───────────────────────────────────────────────────────────
var keys = {};
window.addEventListener('keydown', function(e) {
  keys[e.code] = true;
  // Prevent arrow keys scrolling the PS5 browser
  if (e.code.indexOf('Arrow') === 0) e.preventDefault();
  if (e.code === 'KeyR' && (gameIsOver || gameWon)) restartGame();
});
window.addEventListener('keyup', function(e) { keys[e.code] = false; });

// ─── Gamepad input ────────────────────────────────────────────────────────────
var DEAD = 0.12;
var gpAxes = [0, 0, 0, 0];

function pollGamepad() {
  var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  var gp = null;
  for (var i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) { gp = gamepads[i]; break; }
  }
  if (gp && gp.axes) {
    for (var j = 0; j < 4; j++) {
      var a = gp.axes[j] || 0;
      gpAxes[j] = Math.abs(a) > DEAD ? a : 0;
    }
  }
}

window.addEventListener('gamepadconnected', function(e) {
  console.log('Gamepad connected: ' + e.gamepad.id);
});

// ─── Game loop ────────────────────────────────────────────────────────────────
var SPEED     = 5;   // units/sec
var CAM_SPEED = 2;   // radians/sec
var prevTime  = Date.now();

// ─── Combat state ─────────────────────────────────────────────────────────────
var playerHealth    = 100;
var playerMaxHealth = 100;
var attackCooldown  = 0;       // seconds remaining until attack is ready
var ATTACK_CD       = 0.6;     // total cooldown duration
var COOLDOWN_CIRC   = 100.53;  // SVG circle circumference (2π×16)
var isAttacking     = false;
var attackSquashTimer = 0;

var enemies = [];

var waveNum      = 1;
var killCount    = 0;
var killTarget   = 6;
var waveActive   = false;
var betweenWaves = false;
var betweenTimer = 0;
var spawnQueue   = 0;
var spawnTimer   = 0;
var gameIsOver   = false;
var gameWon      = false;

var WAVE_SIZES = [0, 6, 8, 11, 14, 18]; // index 0 unused; wave 1–5

var prevAttackInput  = false;
var prevOptionsInput = false;

var playerWalkTimer = 0;
var totalTime       = 0;

// ─── Enemy system ─────────────────────────────────────────────────────────────
function makeEnemy(type) {
  var group = new THREE.Group();
  var mats  = [];
  var legs  = [];

  if (type === 'scout') {
    // Goomba — round brown mushroom creature with angry brows and feet
    var footMatL = new THREE.MeshLambertMaterial({ color: 0x5c2d0a });
    var footMatR = new THREE.MeshLambertMaterial({ color: 0x5c2d0a });
    var bodyMat  = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    mats = [bodyMat, footMatL, footMatR];

    var gFootL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 8), footMatL);
    gFootL.position.set(-0.15, -0.41, 0);
    group.add(gFootL);

    var gFootR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 8), footMatR);
    gFootR.position.set(0.15, -0.41, 0);
    group.add(gFootR);
    legs = [gFootL, gFootR];

    var gBody = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), bodyMat);
    gBody.position.set(0, 0.10, 0);
    group.add(gBody);

    // Eyes (white + pupils) — face -Z; not in mats (fixed colour)
    var eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var pupilMat    = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var eyeWL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeWhiteMat);
    eyeWL.position.set(-0.14, 0.18, -0.37);
    group.add(eyeWL);
    var eyeWR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeWhiteMat);
    eyeWR.position.set(0.14, 0.18, -0.37);
    group.add(eyeWR);
    var pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), pupilMat);
    pupilL.position.set(-0.14, 0.17, -0.43);
    group.add(pupilL);
    var pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), pupilMat);
    pupilR.position.set(0.14, 0.17, -0.43);
    group.add(pupilR);

    // Angry brows — angled inward
    var browMat = new THREE.MeshLambertMaterial({ color: 0x3a1a00 });
    var browL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.05), browMat);
    browL.position.set(-0.14, 0.30, -0.35);
    browL.rotation.z = 0.35;
    group.add(browL);
    var browR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.05), browMat);
    browR.position.set(0.14, 0.30, -0.35);
    browR.rotation.z = -0.35;
    group.add(browR);

  } else {
    // Koopa — green shell creature with yellow legs and head
    var kLegMatL   = new THREE.MeshLambertMaterial({ color: 0xffe066 });
    var kLegMatR   = new THREE.MeshLambertMaterial({ color: 0xffe066 });
    var shellBMat  = new THREE.MeshLambertMaterial({ color: 0x228833 });
    var shellDMat  = new THREE.MeshLambertMaterial({ color: 0x33aa44 });
    var kHeadMat   = new THREE.MeshLambertMaterial({ color: 0xffe066 });
    mats = [kLegMatL, kLegMatR, shellBMat, shellDMat, kHeadMat];

    var kLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8), kLegMatL);
    kLegL.position.set(-0.18, -0.39, 0);
    group.add(kLegL);

    var kLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8), kLegMatR);
    kLegR.position.set(0.18, -0.39, 0);
    group.add(kLegR);
    legs = [kLegL, kLegR];

    var shellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.30, 12), shellBMat);
    shellBase.position.set(0, -0.13, 0);
    group.add(shellBase);

    var shellDome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 7), shellDMat);
    shellDome.position.set(0, 0.02, 0);
    group.add(shellDome);

    var kHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), kHeadMat);
    kHead.position.set(0, 0.62, 0);
    group.add(kHead);

    // Eyes — not in mats
    var kEyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var kEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), kEyeMat);
    kEyeL.position.set(-0.10, 0.66, -0.18);
    group.add(kEyeL);
    var kEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), kEyeMat);
    kEyeR.position.set(0.10, 0.66, -0.18);
    group.add(kEyeR);
  }

  var angle = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(angle) * 40, 0.5, Math.sin(angle) * 40);
  scene.add(group);
  return { type: type, mesh: group, mats: mats, legs: legs,
           walkPhase: Math.random() * Math.PI * 2,
           health: type === 'scout' ? 1 : 2, aiState: 'seek', dead: false, shrinking: false };
}

function updateSpawn(dt) {
  if (!waveActive || spawnQueue <= 0) return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 0.5;
    var type = Math.random() < 0.6 ? 'scout' : 'tank';
    enemies.push(makeEnemy(type));
    spawnQueue--;
  }
}

function startWave(n) {
  waveNum      = n;
  killCount    = 0;
  killTarget   = WAVE_SIZES[n];
  waveActive   = true;
  betweenWaves = false;
  spawnQueue   = killTarget;
  spawnTimer   = 0.5;
  document.getElementById('health-fill').classList.remove('regen');
}

function updateEnemies(dt) {
  var px = capsule.position.x;
  var pz = capsule.position.z;
  var takingDamage = false;

  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.dead) continue;

    var dx   = px - e.mesh.position.x;
    var dz   = pz - e.mesh.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 1.2) {
      e.aiState = 'seek';
      var spd = e.type === 'scout' ? 4.5 : 2.0;
      e.mesh.position.x += (dx / dist) * spd * dt;
      e.mesh.position.z += (dz / dist) * spd * dt;
    } else {
      e.aiState = 'attack';
      var dmg = e.type === 'scout' ? 8 : 20;
      playerHealth -= dmg * dt;
      takingDamage = true;
      if (playerHealth <= 0 && !gameIsOver && !gameWon) {
        playerHealth = 0;
        triggerGameOver();
      }
    }

    // Leg walk animation
    if (e.legs.length) {
      var walkSpd  = e.type === 'scout' ? 11 : 7;
      var swing    = Math.sin(totalTime * walkSpd + e.walkPhase) * 0.45;
      e.legs[0].rotation.x =  swing;
      e.legs[1].rotation.x = -swing;
    }
  }

  // Vignette: on while taking damage, fade out when not
  if (takingDamage) {
    document.getElementById('vignette').classList.add('damaged');
  } else {
    document.getElementById('vignette').classList.remove('damaged');
  }

  // Clean up dead enemies — only drop from array once shrink animation is done
  enemies = enemies.filter(function(e) {
    return !(e.dead && !e.shrinking);
  });
}

// ─── Attack system ────────────────────────────────────────────────────────────
function spawnAttackRing(hx, hz) {
  var mat  = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.8 });
  var geo  = new THREE.TorusGeometry(1, 0.10, 6, 20);
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(hx, 0.08, hz);
  mesh.rotation.x = -Math.PI / 2; // lay flat on ground
  scene.add(mesh);
  var start = Date.now();
  var dur   = 220;
  function animateRing() {
    var t = Math.min((Date.now() - start) / dur, 1);
    var s = 2.5 * t + 0.1; // expand from tiny → 2.5× (matches HIT_R)
    mesh.scale.set(s, s, s);
    mat.opacity = 0.8 * (1 - t);
    if (t < 1) { requestAnimationFrame(animateRing); }
    else        { scene.remove(mesh); mat.dispose(); geo.dispose(); }
  }
  requestAnimationFrame(animateRing);
}

function flashEnemy(e) {
  var origColors = [];
  for (var i = 0; i < e.mats.length; i++) {
    origColors.push(e.mats[i].color.getHex());
    e.mats[i].color.setHex(0xffffff);
  }
  setTimeout(function() {
    if (!e.dead) {
      for (var i = 0; i < e.mats.length; i++) {
        e.mats[i].color.setHex(origColors[i]);
      }
    }
  }, 80);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.shrinking = true;
  var mesh      = e.mesh;
  var startTime = Date.now();
  var duration  = 150;
  function shrink() {
    var t = Math.min((Date.now() - startTime) / duration, 1);
    var s = 1 - t;
    mesh.scale.set(s, s, s);
    if (t < 1) { requestAnimationFrame(shrink); }
    else        { scene.remove(mesh); e.shrinking = false; }
  }
  requestAnimationFrame(shrink);

  if (waveActive) {
    killCount++;
    if (killCount >= killTarget) {
      completeWave();
    }
  }
}

function hitEnemy(e) {
  e.health--;
  if (e.health <= 0) { killEnemy(e); }
  else               { flashEnemy(e); }
}

function performAttack() {
  attackCooldown    = ATTACK_CD;
  isAttacking       = true;
  attackSquashTimer = 0.15;
  capsule.scale.x   = 1.3;

  // Hitbox centre: 1.5 units in front of player
  var fwdX = Math.sin(capsule.rotation.y);
  var fwdZ = Math.cos(capsule.rotation.y);
  var hx   = capsule.position.x + fwdX * 1.5;
  var hz   = capsule.position.z + fwdZ * 1.5;
  var HIT_R = 2.5;

  spawnAttackRing(hx, hz);

  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.dead) continue;
    var dx   = e.mesh.position.x - hx;
    var dz   = e.mesh.position.z - hz;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= HIT_R) { hitEnemy(e); }
  }
}

function tryAttack(dt) {
  // Tick cooldown
  if (attackCooldown > 0) attackCooldown -= dt;
  if (attackCooldown < 0) attackCooldown = 0;

  // Tick squash
  if (isAttacking) {
    attackSquashTimer -= dt;
    if (attackSquashTimer <= 0) {
      isAttacking     = false;
      capsule.scale.x = 1.0;
    }
  }

  // Check input (edge trigger — fires once per press)
  var gp        = null;
  var gamepads  = navigator.getGamepads ? navigator.getGamepads() : [];
  for (var i = 0; i < gamepads.length; i++) { if (gamepads[i]) { gp = gamepads[i]; break; } }
  var gpAttack  = gp && gp.buttons && gp.buttons[0] && gp.buttons[0].pressed;
  var attacking = keys['Space'] || gpAttack;

  if (attacking && !prevAttackInput && attackCooldown === 0 && !gameIsOver && !gameWon) {
    performAttack();
  }
  prevAttackInput = attacking;
}

// ─── Wave management ──────────────────────────────────────────────────────────
function showWaveClear(msg) {
  var el      = document.getElementById('wave-clear');
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(function() { el.style.opacity = '0'; }, 1500);
}

function completeWave() {
  waveActive   = false;
  betweenWaves = true;
  betweenTimer = 0;

  if (waveNum >= 5) {
    showWaveClear('You Win!');
    setTimeout(triggerWin, 1500);
  } else {
    showWaveClear('Wave Clear!');
    document.getElementById('health-fill').classList.add('regen');
  }
}

function updateBetweenWaves(dt) {
  if (!betweenWaves || gameIsOver || gameWon) return;
  betweenTimer  += dt;
  playerHealth   = Math.min(playerMaxHealth, playerHealth + 25 * dt);
  if (betweenTimer >= 3) {
    betweenWaves = false;
    startWave(waveNum + 1);
  }
}

function triggerGameOver() {
  gameIsOver = true;
  document.getElementById('overlay-title').textContent = 'Game Over';
  document.getElementById('overlay-sub').textContent   =
    'Reached Wave ' + waveNum + ' · ' + killCount + ' total kills';
  document.getElementById('overlay').style.display = 'flex';
}

function triggerWin() {
  gameWon = true;
  document.getElementById('overlay-title').textContent = 'You Win!';
  document.getElementById('overlay-sub').textContent   = 'All 5 waves cleared!';
  document.getElementById('overlay').style.display     = 'flex';
}

function restartGame() {
  playerHealth    = playerMaxHealth;
  attackCooldown  = 0;
  isAttacking     = false;
  attackSquashTimer = 0;
  capsule.scale.x = 1.0;
  gameIsOver      = false;
  gameWon         = false;
  prevAttackInput  = false;
  prevOptionsInput = false;

  for (var i = 0; i < enemies.length; i++) { scene.remove(enemies[i].mesh); }
  enemies = [];

  capsule.position.set(0, 1.0, 0);
  capsule.rotation.y = 0;
  cameraYaw = 0;
  playerWalkTimer = 0;
  legL.rotation.x = 0;
  legR.rotation.x = 0;

  document.getElementById('overlay').style.display = 'none';
  document.getElementById('vignette').classList.remove('damaged');
  document.getElementById('health-fill').classList.remove('regen');

  startWave(1);
}

// ─── HUD updater ──────────────────────────────────────────────────────────────
function updateHUD() {
  // Health bar width
  var pct = Math.max(0, playerHealth / playerMaxHealth * 100);
  document.getElementById('health-fill').style.width = pct + '%';

  // Wave / kill counter
  document.getElementById('wave-info').textContent =
    'Wave ' + waveNum + ' · ' + killCount + '/' + killTarget;

  // Cooldown arc: offset 0 = full arc (ready), offset = CIRC = empty (on cooldown)
  var cdFraction = attackCooldown / ATTACK_CD; // 0=ready, 1=just used
  document.getElementById('cooldown-circle').style.strokeDashoffset =
    cdFraction * COOLDOWN_CIRC;
}

function loop() {
  requestAnimationFrame(loop);

  var now = Date.now();
  var dt  = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  if (!gameIsOver && !gameWon) {
    pollGamepad();

    // Camera yaw: right stick X or arrow keys
    var yawDelta = gpAxes[2];
    if (keys['ArrowLeft'])  yawDelta -= 1;
    if (keys['ArrowRight']) yawDelta += 1;
    cameraYaw -= yawDelta * CAM_SPEED * dt;

    // Movement: left stick or WASD
    var mx = gpAxes[0];
    var mz = gpAxes[1];
    if (keys['KeyA']) mx -= 1;
    if (keys['KeyD']) mx += 1;
    if (keys['KeyW']) mz -= 1;
    if (keys['KeyS']) mz += 1;

    var moving = (mx !== 0 || mz !== 0);
    if (moving) {
      var len = Math.sqrt(mx * mx + mz * mz);
      var nx  = mx / len;
      var nz  = mz / len;
      var cos = Math.cos(cameraYaw);
      var sin = Math.sin(cameraYaw);
      var wx  =  nx * cos + nz * sin;
      var wz  = -nx * sin + nz * cos;
      capsule.position.x += wx * SPEED * dt;
      capsule.position.z += wz * SPEED * dt;
      capsule.rotation.y  = Math.atan2(wx, wz);
    }

    // Player leg walk animation
    totalTime += dt;
    if (moving) {
      playerWalkTimer += dt;
      var pSwing = Math.sin(playerWalkTimer * 9) * 0.45;
      legL.rotation.x =  pSwing;
      legR.rotation.x = -pSwing;
    } else {
      legL.rotation.x *= 0.75;
      legR.rotation.x *= 0.75;
    }

    tryAttack(dt);
    updateSpawn(dt);
    updateEnemies(dt);
    updateBetweenWaves(dt);
  } else {
    // While overlay is visible, still allow Options button restart on gamepad
    pollGamepad();
    var gp2 = null;
    var gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var gi = 0; gi < gps.length; gi++) { if (gps[gi]) { gp2 = gps[gi]; break; } }
    var optionsNow = gp2 && gp2.buttons && gp2.buttons[9] && gp2.buttons[9].pressed;
    if (optionsNow && !prevOptionsInput) {
      restartGame();
    }
    prevOptionsInput = optionsNow;
  }

  updateHUD();
  updateCamera();
  renderer.render(scene, camera);
}

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Start ────────────────────────────────────────────────────────────────────
updateCamera();
startWave(1);
loop();
