// ─── Renderer ────────────────────────────────────────────────────────────────
var canvas = document.getElementById('c');
// PS5 browser supports WebGL1 only — get the context explicitly so Three.js
// doesn't attempt a WebGL2 context (which fails silently on PS5).
var gl = canvas.getContext('webgl', { antialias: true })
      || canvas.getContext('experimental-webgl', { antialias: true });
var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// ─── Scene ────────────────────────────────────────────────────────────────────
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

// ─── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

var dirLight = new THREE.DirectionalLight(0xffd580, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width  = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near   = 0.5;
dirLight.shadow.camera.far    = 100;
dirLight.shadow.camera.left   = -30;
dirLight.shadow.camera.right  =  30;
dirLight.shadow.camera.top    =  30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

// ─── Ground ───────────────────────────────────────────────────────────────────
var ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x16213e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(200, 40, 0x334466, 0x223355));

// ─── Character ───────────────────────────────────────────────────────────────
// CapsuleGeometry is Three.js r143+; build a capsule from primitives for
// compatibility with the PS5 browser's older WebKit engine.
var capsuleMat = new THREE.MeshLambertMaterial({ color: 0xff6b35 });
var capsule = new THREE.Group();

var body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), capsuleMat);
body.castShadow = true;
capsule.add(body);

var capTop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), capsuleMat);
capTop.position.y = 0.4;
capTop.castShadow = true;
capsule.add(capTop);

var capBot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), capsuleMat);
capBot.position.y = -0.4;
capBot.castShadow = true;
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
