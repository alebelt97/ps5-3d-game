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

function loop() {
  requestAnimationFrame(loop);

  var now = Date.now();
  var dt  = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

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
    capsule.rotation.y = Math.atan2(wx, wz);
  }

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
loop();
