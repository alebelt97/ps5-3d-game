# Combat / Enemies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add wave-based combat — two enemy types, melee attack button, health bar, kill-count targets across 5 waves — to the existing Three.js 3D game.

**Architecture:** All logic is added to the existing three files (`game.js`, `style.css`, `index.html`) using the established ES5 `var` style. Enemy objects are plain JS objects held in a global `enemies[]` array. The game loop gains calls to enemy AI, spawn, attack, and HUD update functions each frame. No new files or dependencies.

**Tech Stack:** Three.js r128 (CDN global `THREE`), vanilla ES5 JS, CSS3, Google Fonts Nunito (already loaded).

---

## File Map

| File | What changes |
|------|-------------|
| `index.html` | Replace `#hud` text div with `#hud-top` container (health bar, wave info, cooldown SVG); add `#wave-clear`, `#overlay`, `#vignette` divs |
| `style.css` | Styles for all new HUD elements, vignette, wave-clear text, overlay |
| `game.js` | Add state variables, enemy system, attack system, wave system, HUD updater, loop integration |

---

## Task 1: HTML — New HUD + Overlay Elements

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the existing `#hud` div and add new elements**

Open `index.html`. Replace the entire `<div id="hud">` line and add the new elements so the `<body>` looks exactly like this (keep `<canvas>`, `<div id="title">`, `<div id="crosshair">`, `<div id="err">`, and all `<script>` tags unchanged):

```html
  <canvas id="c"></canvas>
  <div id="title">PS5 3D</div>
  <div id="crosshair"></div>

  <!-- Top HUD bar -->
  <div id="hud-top">
    <div id="health-wrap">
      <div id="health-bar"><div id="health-fill"></div></div>
      <span class="hud-label">HP</span>
    </div>
    <div id="wave-info">Wave 1 · 0/6</div>
    <div id="cooldown-wrap">
      <svg id="cooldown-svg" width="36" height="36" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none"
          stroke="rgba(255,255,255,0.15)" stroke-width="3"/>
        <circle id="cooldown-circle" cx="20" cy="20" r="16" fill="none"
          stroke="rgba(255,255,255,0.85)" stroke-width="3"
          stroke-dasharray="100.53" stroke-dashoffset="0"
          transform="rotate(-90 20 20)"/>
      </svg>
      <span class="hud-label">ATK</span>
    </div>
  </div>

  <!-- Wave clear flash -->
  <div id="wave-clear"></div>

  <!-- Game over / win overlay -->
  <div id="overlay">
    <div class="overlay-box">
      <h2 id="overlay-title"></h2>
      <p id="overlay-sub"></p>
      <p class="overlay-hint">Press R / Options to restart</p>
    </div>
  </div>

  <!-- Damage vignette -->
  <div id="vignette"></div>

  <!-- Controls hint (bottom) -->
  <div id="hud">WASD / left stick — move &nbsp;·&nbsp; arrows / right stick — look &nbsp;·&nbsp; Space / Cross — attack</div>
```

- [ ] **Step 2: Verify the page still loads without errors**

Open `index.html` in a browser. The title, crosshair, and 3D scene should still appear. No JS errors in the console. The old controls hint text is now updated at the bottom.

- [ ] **Step 3: Commit**

```bash
cd "/Users/User/Claude Cowork/ps5-3d-game"
git add index.html
git commit -m "feat: add combat HUD and overlay elements to index.html"
```

---

## Task 2: CSS — HUD, Overlay, and Vignette Styles

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Append all new styles to the end of `style.css`**

```css
/* ── Top HUD bar ─────────────────────────────────────────────────────────── */
#hud-top {
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  pointer-events: none;
}

.hud-label {
  display: block;
  font: 700 10px/1 'Nunito', sans-serif;
  color: rgba(255,255,255,0.45);
  text-align: center;
  margin-top: 3px;
  letter-spacing: 0.08em;
}

/* Health bar */
#health-wrap { display: flex; flex-direction: column; align-items: flex-start; min-width: 130px; }

#health-bar {
  width: 130px;
  height: 10px;
  background: rgba(255,255,255,0.12);
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
}

#health-fill {
  height: 100%;
  width: 100%;
  background: #cc2222;
  border-radius: 6px;
  transition: width 0.08s linear, background-color 0.4s ease;
}

#health-fill.regen { background: #22cc55; }

/* Wave info */
#wave-info {
  font: 700 13px/1 'Nunito', sans-serif;
  color: rgba(255,255,255,0.75);
  text-align: center;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  letter-spacing: 0.04em;
}

/* Cooldown arc */
#cooldown-wrap { display: flex; flex-direction: column; align-items: flex-end; }

/* Wave clear flash */
#wave-clear {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font: 900 36px/1 'Nunito', sans-serif;
  color: #ffd580;
  text-shadow: 0 0 20px rgba(255, 213, 128, 0.7);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* Game over / win overlay */
#overlay {
  display: none;
  position: fixed;
  inset: 0;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  z-index: 100;
}

.overlay-box {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 18px;
  padding: 40px 56px;
  text-align: center;
  backdrop-filter: blur(12px);
}

#overlay-title {
  font: 900 42px/1 'Nunito', sans-serif;
  background: linear-gradient(135deg, #ff6b35, #ffd580);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12px;
}

#overlay-sub {
  font: 700 16px/1.4 'Nunito', sans-serif;
  color: rgba(255,255,255,0.6);
  margin-bottom: 20px;
}

.overlay-hint {
  font: 700 13px/1 'Nunito', sans-serif;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.05em;
}

/* Damage vignette */
#vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 0px rgba(200, 30, 30, 0);
  transition: box-shadow 0.25s ease-out;
  z-index: 50;
}

#vignette.damaged {
  box-shadow: inset 0 0 80px rgba(200, 30, 30, 0.65);
  transition: box-shadow 0.05s ease-in;
}
```

- [ ] **Step 2: Verify styles in browser**

Open `index.html`. You should see:
- A health bar in the top-left (red fill, 130px wide)
- "Wave 1 · 0/6" centered at the top
- A small circle SVG in the top-right
- The 3D scene is still fully visible behind all elements

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add combat HUD, overlay, and vignette CSS styles"
```

---

## Task 3: State Variables

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add combat state variables after the existing constants block**

In `game.js`, find this block:

```js
var SPEED     = 5;   // units/sec
var CAM_SPEED = 2;   // radians/sec
var prevTime  = Date.now();
```

Insert the following block **immediately after** those three lines:

```js
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
var vignetteTimeout = null;
```

- [ ] **Step 2: Verify no syntax errors**

Open `index.html` in browser. Console must be clean — no errors. The game still runs normally (capsule moves, camera follows).

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat: add combat and wave state variables"
```

---

## Task 4: Enemy Creation and Spawn System

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add `makeEnemy()` and `updateSpawn()` after the state variables block**

Insert after the state variable block (after `var prevAttackInput = false;`):

```js
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
```

- [ ] **Step 2: Add `startWave()` immediately after**

```js
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
```

- [ ] **Step 3: Verify in browser**

Add a temporary call `startWave(1);` at the very bottom of `game.js` (after `loop();`). Open the browser. After 0.5s you should see a small orange sphere and/or red cube appear far away on the plane. Remove that temp call before committing.

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "feat: add enemy creation and wave spawn system"
```

---

## Task 5: Enemy AI and Player Damage

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add `updateEnemies()` after `startWave()`**

```js
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

  // Clean up dead enemies
  enemies = enemies.filter(function(e) { return !e.dead; });
}
```

- [ ] **Step 2: Verify AI works**

Temporarily add `startWave(1);` at the bottom and open the browser. Enemies should walk toward the player capsule. Walk into their path — the screen edges should pulse red (vignette). Remove the temp call before committing.

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat: add enemy AI (seek/attack states) and player damage"
```

---

## Task 6: Attack System

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add `flashEnemy()`, `killEnemy()`, `hitEnemy()`, and `performAttack()` after `updateEnemies()`**

```js
// ─── Attack system ────────────────────────────────────────────────────────────
function flashEnemy(e) {
  var origHex = e.type === 'scout' ? 0xff8c00 : 0xcc2222;
  e.mesh.material.color.setHex(0xffffff);
  setTimeout(function() {
    if (!e.dead) e.mesh.material.color.setHex(origHex);
  }, 80);
}

function killEnemy(e) {
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

  killCount++;
  if (waveActive && killCount >= killTarget) {
    completeWave();
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
```

- [ ] **Step 2: Verify attack works**

Temporarily add `startWave(1);` at bottom and open the browser. Walk near an enemy, press Space. The capsule should briefly squash. Orange scout should disappear (scale to 0). Red tank should flash white, require a second hit to die. Remove temp call before committing.

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat: add melee attack system with hitbox, cooldown, and kill animations"
```

---

## Task 7: Wave Management, Game Over, Win, Restart

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add wave management functions after `tryAttack()`**

```js
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
```

- [ ] **Step 2: Wire restart key into the existing keydown listener**

Find this block in `game.js`:

```js
window.addEventListener('keydown', function(e) {
  keys[e.code] = true;
  // Prevent arrow keys scrolling the PS5 browser
  if (e.code.indexOf('Arrow') === 0) e.preventDefault();
});
```

Replace it with:

```js
window.addEventListener('keydown', function(e) {
  keys[e.code] = true;
  if (e.code.indexOf('Arrow') === 0) e.preventDefault();
  if (e.code === 'KeyR' && (gameIsOver || gameWon)) restartGame();
});
```

- [ ] **Step 3: Commit**

```bash
git add game.js
git commit -m "feat: add wave management, game over/win overlays, and restart logic"
```

---

## Task 8: HUD Updater

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Add `updateHUD()` after the wave management block**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add game.js
git commit -m "feat: add updateHUD() for health bar, wave counter, and cooldown arc"
```

---

## Task 9: Loop Integration — Wire Everything Together

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Replace the existing `loop()` function**

Find the entire `function loop() { ... }` block and replace it with:

```js
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
```

- [ ] **Step 2: Replace the start block at the bottom**

Find:
```js
updateCamera();
loop();
```

Replace with:
```js
updateCamera();
startWave(1);
loop();
```

- [ ] **Step 3: Verify full gameplay in browser**

Open `index.html`. Check all of the following:
- Enemies spawn near the edges at wave start (0.5s stagger)
- Enemies walk toward the player (orange spheres faster, red cubes slower)
- Press Space — capsule squashes, nearby enemies take damage / die (scale to 0)
- Cooldown arc drains and refills over 0.6s
- Health bar shrinks when enemies are next to the player; screen edges pulse red
- Wave clears when 6 enemies are killed: "Wave Clear!" text appears, health bar turns green, regens over 3s
- Wave 2 starts automatically with 8 enemies
- After Wave 5: "You Win!" overlay
- Let health drain to 0: "Game Over" overlay with wave + kill count
- Press R: game restarts at Wave 1

- [ ] **Step 4: Commit**

```bash
git add game.js
git commit -m "feat: wire all combat systems into game loop, start Wave 1 on load"
```

---

## Task 10: CLAUDE.md Update + GitHub Push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect the new architecture**

Replace the contents of `CLAUDE.md` with:

```markdown
# CLAUDE.md

Vanilla HTML/CSS/JS 3D game — wave-based combat. No build step. Open `index.html` in any browser.

## GitHub Pages URL
`https://alebelt97.github.io/ps5-3d-game/`

## Files

| File | Purpose |
|---|---|
| `index.html` | Canvas shell; HUD (health bar, wave info, cooldown SVG); overlay; vignette; loads CDN scripts |
| `style.css` | Viewport fill, Nunito font, title gradient, crosshair, HUD, overlay, vignette |
| `game.js` | Scene, character, camera, input, enemy AI, wave system, attack system, HUD updater, game loop |

## CDN dependencies

| Library | Version | Purpose |
|---|---|---|
| Three.js | 0.128.0 | 3D renderer — **r128 required** for PS5 WebKit compat; no CapsuleGeometry |
| Google Fonts — Nunito | — | Rounded typeface for HUD/title |

> `THREE` is a CDN global. No local type declarations — LSP warnings are false positives.

## Architecture

### Key globals (`game.js`)
| Variable | Description |
|---|---|
| `capsule` | Orange group (CylinderGeometry + 2×SphereGeometry + nose cone) at y=1.0 |
| `enemies[]` | Array of `{type, mesh, health, aiState, dead}` objects |
| `playerHealth` | Current HP (0–100); game over when reaches 0 |
| `attackCooldown` | Seconds until next attack is ready (0 = ready) |
| `waveNum` | Current wave (1–5) |
| `killCount` | Kills this wave |
| `killTarget` | Kills needed to clear wave (from WAVE_SIZES) |
| `WAVE_SIZES` | `[0, 6, 8, 11, 14, 18]` — enemies per wave (index 0 unused) |

### Game loop call order (each frame)
1. `pollGamepad()` — update gpAxes
2. Camera yaw + player movement
3. `tryAttack(dt)` — tick cooldown, squash timer, check input
4. `updateSpawn(dt)` — stagger-spawn queued enemies
5. `updateEnemies(dt)` — seek/attack AI, deal damage, vignette
6. `updateBetweenWaves(dt)` — health regen, start next wave
7. `updateHUD()` — sync health bar, wave counter, cooldown arc
8. `updateCamera()` + `renderer.render()`

### Enemy types
| Type | Speed | HP | Damage | Geometry |
|------|-------|----|--------|----------|
| Scout | 4.5 | 1 | 8/sec | Orange SphereGeometry(0.35) |
| Tank | 2.0 | 2 | 20/sec | Red BoxGeometry(0.7) |

### Input
- **Keyboard**: WASD = move, Arrow Left/Right = rotate camera, Space = attack, R = restart (when overlay shown)
- **Gamepad (DualSense)**: Axis 0/1 = left stick, Axis 2 = right stick X, Button 0 (Cross) = attack, Button 9 (Options) = restart
- Dead zone: `DEAD = 0.12`

### PS5 notes (out of scope for v1)
- Three.js r128 used (no class fields, compatible with older WebKit)
- WebGL1 context pre-created with `failIfMajorPerformanceCaveat: false`
- No shadow maps
- All JS written in ES5 (`var`, no arrow functions)
```

- [ ] **Step 2: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with combat system architecture"
git push origin main
```

- [ ] **Step 3: Verify GitHub Pages**

Visit `https://alebelt97.github.io/ps5-3d-game/` after a few minutes. The game should load with the new combat HUD and wave system.
