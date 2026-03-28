// ─── Renderer ────────────────────────────────────────────────────────────────
var canvas = document.getElementById('c');

// PS5 needs failIfMajorPerformanceCaveat:false or it refuses to create a context.
// antialias:false lowers the bar further. No shadows — they need depth-texture
// extensions that may be absent.
var ctxOpts = { antialias: false, failIfMajorPerformanceCaveat: false,
                alpha: false, depth: true, stencil: false };
var gl = canvas.getContext('webgl', ctxOpts)
      || canvas.getContext('experimental-webgl', ctxOpts);

// Show debug info on screen for a few seconds so we can tell what happened
(function() {
  var dbg = document.getElementById('dbg');
  if (dbg) {
    dbg.style.display = 'block';
    dbg.textContent = gl ? 'WebGL OK (' + (gl.constructor && gl.constructor.name || 'ctx') + ')' : 'WebGL context is null';
    setTimeout(function() { dbg.style.display = 'none'; }, 5000);
  }
}());

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

// ─── Character ───────────────────────────────────────────────────────────────
// CapsuleGeometry is Three.js r143+; build a capsule from primitives for
// compatibility with the PS5 browser's older WebKit engine.
var capsuleMat = new THREE.MeshLambertMaterial({ color: 0xff6b35 });
var capsule = new THREE.Group();

var body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), capsuleMat);
capsule.add(body);

var capTop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), capsuleMat);
capTop.position.y = 0.4;
capsule.add(capTop);

var capBot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), capsuleMat);
capBot.position.y = -0.4;
capsule.add(capBot);

// White cone "nose" — shows which way the character faces
var nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.15, 0.4, 6),
  new THREE.MeshLambertMaterial({ color: 0xffffff })
);
nose.position.set(0, 0.2, -0.55);
nose.rotation.x = Math.PI / 2;
capsule.add(nose);

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

var prevAttackInput = false;

// ─── Enemy system ─────────────────────────────────────────────────────────────
function makeEnemy(type) {
  var mat, mesh;
  if (type === 'scout') {
    mat  = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat);
  } else {
    mat  = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
  }
  var angle = Math.random() * Math.PI * 2;
  mesh.position.set(Math.cos(angle) * 40, 0.5, Math.sin(angle) * 40);
  scene.add(mesh);
  return { type: type, mesh: mesh, health: type === 'scout' ? 1 : 2, aiState: 'seek', dead: false };
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
  spawnTimer   = 0;
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
  }

  // Vignette: on while taking damage, fade out when not
  if (takingDamage) {
    document.getElementById('vignette').classList.add('damaged');
  } else {
    document.getElementById('vignette').classList.remove('damaged');
  }

  // Clean up dead enemies — remove mesh from scene before dropping from array
  enemies = enemies.filter(function(e) {
    if (e.dead) { scene.remove(e.mesh); return false; }
    return true;
  });
}

// ─── Attack system ────────────────────────────────────────────────────────────
function flashEnemy(e) {
  var origHex = e.type === 'scout' ? 0xff8c00 : 0xcc2222;
  e.mesh.material.color.setHex(0xffffff);
  setTimeout(function() {
    if (!e.dead) e.mesh.material.color.setHex(origHex);
  }, 80);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  var mesh      = e.mesh;
  var startTime = Date.now();
  var duration  = 150;
  function shrink() {
    var t = Math.min((Date.now() - startTime) / duration, 1);
    var s = 1 - t;
    mesh.scale.set(s, s, s);
    if (t < 1) { requestAnimationFrame(shrink); }
    else        { scene.remove(mesh); }
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
  prevAttackInput = false;

  for (var i = 0; i < enemies.length; i++) { scene.remove(enemies[i].mesh); }
  enemies = [];

  capsule.position.set(0, 1.0, 0);
  capsule.rotation.y = 0;

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

    if (mx !== 0 || mz !== 0) {
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
    if (gp2 && gp2.buttons && gp2.buttons[9] && gp2.buttons[9].pressed) {
      restartGame();
    }
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
