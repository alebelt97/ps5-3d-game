// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffd580, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

// ─── Ground ───────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x16213e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(200, 40, 0x334466, 0x223355);
scene.add(grid);

// ─── Character (capsule) ─────────────────────────────────────────────────────
const capsule = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.8, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0xff6b35 })
);
capsule.position.y = 1.0;
capsule.castShadow = true;
scene.add(capsule);

// Small direction indicator (nose) so rotation is obvious
const nose = new THREE.Mesh(
  new THREE.ConeGeometry(0.15, 0.4, 6),
  new THREE.MeshLambertMaterial({ color: 0xffffff })
);
nose.position.set(0, 0.2, -0.55);
nose.rotation.x = Math.PI / 2;
capsule.add(nose);

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
const CAM_OFFSET = new THREE.Vector3(0, 3, 7);
let cameraYaw = 0; // radians

function updateCamera() {
  const offset = CAM_OFFSET.clone()
    .applyEuler(new THREE.Euler(0, cameraYaw, 0));
  camera.position.copy(capsule.position).add(offset);
  camera.lookAt(capsule.position.x, capsule.position.y + 1, capsule.position.z);
}

// ─── Keyboard input ───────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

// ─── Gamepad input ────────────────────────────────────────────────────────────
const DEAD = 0.12;
let gpAxes = [0, 0, 0, 0];

function pollGamepad() {
  const gp = navigator.getGamepads
    ? [...navigator.getGamepads()].find(g => g)
    : null;
  if (gp) {
    gpAxes = Array.from(gp.axes).slice(0, 4).map(a => Math.abs(a) > DEAD ? a : 0);
  }
}

window.addEventListener('gamepadconnected', e => {
  console.log('Gamepad connected:', e.gamepad.id);
});

// ─── Game loop ────────────────────────────────────────────────────────────────
const SPEED     = 5;   // units/sec
const CAM_SPEED = 2;   // radians/sec

let prevTime = performance.now();

function loop() {
  requestAnimationFrame(loop);

  const now = performance.now();
  const dt  = Math.min((now - prevTime) / 1000, 0.05);
  prevTime  = now;

  pollGamepad();

  // ── Camera yaw: right stick X or arrow keys ──────────────────────────────
  let yawDelta = gpAxes[2];
  if (keys['ArrowLeft'])  yawDelta -= 1;
  if (keys['ArrowRight']) yawDelta += 1;
  cameraYaw -= yawDelta * CAM_SPEED * dt;

  // ── Movement: left stick or WASD ─────────────────────────────────────────
  // Note: arrow keys only rotate camera (no strafe conflict on keyboard)
  let mx = gpAxes[0];
  let mz = gpAxes[1];
  if (keys['KeyA']) mx -= 1;
  if (keys['KeyD']) mx += 1;
  if (keys['KeyW']) mz -= 1;
  if (keys['KeyS']) mz += 1;

  if (mx !== 0 || mz !== 0) {
    const len = Math.hypot(mx, mz);
    const nx  = mx / len;
    const nz  = mz / len;

    // Rotate move vector by cameraYaw so forward = camera-forward
    const cos = Math.cos(cameraYaw);
    const sin = Math.sin(cameraYaw);
    const wx  =  nx * cos + nz * sin;
    const wz  = -nx * sin + nz * cos;

    capsule.position.x += wx * SPEED * dt;
    capsule.position.z += wz * SPEED * dt;

    // Face character toward movement direction
    capsule.rotation.y = Math.atan2(wx, wz);
  }

  updateCamera();
  renderer.render(scene, camera);
}

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ─── Start ────────────────────────────────────────────────────────────────────
updateCamera();
loop();
