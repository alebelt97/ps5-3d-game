# CLAUDE.md

Vanilla HTML/CSS/JS 3D game. No build step. Open `index.html` in any browser.

## GitHub Pages URL
`https://alebelt97.github.io/ps5-3d-game/`

## Files

| File | Purpose |
|---|---|
| `index.html` | Full-screen canvas shell, title, crosshair, HUD hint, loads CDN scripts |
| `style.css` | Viewport fill, Nunito font, title gradient, crosshair, HUD |
| `game.js` | Scene setup, character, camera, game loop, keyboard + gamepad input |

## CDN dependencies

| Library | Version | Purpose |
|---|---|---|
| Three.js | 0.160.0 | 3D renderer, scene, geometry, lighting |
| Google Fonts — Nunito | — | Rounded typeface for HUD/title |

> `THREE` is a CDN global. No local type declarations — LSP warnings about unknown names are false positives.

## Architecture

### Scene (`game.js`)
- `renderer` — `WebGLRenderer`, shadow maps enabled
- `scene` — dark navy background (`0x1a1a2e`), `Fog(0x1a1a2e, 30, 80)`
- `camera` — `PerspectiveCamera(60°)`, follow-camera controlled by `cameraYaw`

### Key objects
| Variable | Description |
|---|---|
| `capsule` | Orange `CapsuleGeometry(0.4, 0.8)` at `y=1.0` — the player character |
| `nose` | White cone child of `capsule` — shows facing direction |
| `ground` | `PlaneGeometry(200×200)` receiving shadows |
| `grid` | `GridHelper(200, 40)` for spatial reference |

### Camera system
```js
const CAM_OFFSET = new THREE.Vector3(0, 3, 7);  // behind + above
let cameraYaw = 0;  // radians, right stick X / arrow keys
```
`updateCamera()` rotates `CAM_OFFSET` by `cameraYaw` each frame.

### Input
- **Keyboard**: WASD = move, Arrow Left/Right = rotate camera
- **Gamepad (DualSense)**: Axis 0/1 = left stick (strafe/fwd), Axis 2 = right stick X (camera yaw)
- Dead zone: `DEAD = 0.12`
- Movement vector is rotated by `cameraYaw` so forward is always camera-relative

### Constants
| Name | Value | Purpose |
|---|---|---|
| `SPEED` | 5 units/s | Character movement speed |
| `CAM_SPEED` | 2 rad/s | Camera rotation speed |
| `DEAD` | 0.12 | Gamepad stick dead zone |
| `ATTACK_CD` | 0.6 s | Attack cooldown duration |
| `COOLDOWN_CIRC` | 100.53 | SVG circle circumference (2π×16) for cooldown ring |

### Combat state variables (`game.js`)
| Variable | Purpose |
|---|---|
| `playerHealth` / `playerMaxHealth` | Current and max HP (starts 100) |
| `attackCooldown` | Seconds remaining until attack is ready |
| `isAttacking` / `attackSquashTimer` | Attack animation state |
| `enemies` | Array of live enemy objects |
| `waveNum` / `killCount` / `killTarget` | Wave progress tracking |
| `waveActive` / `betweenWaves` / `betweenTimer` | Wave lifecycle flags |
| `spawnQueue` / `spawnTimer` | Staggered enemy spawning |
| `gameIsOver` / `gameWon` | Terminal game state flags |
| `WAVE_SIZES` | `[0,6,8,11,14,18]` — enemy count per wave (waves 1–5) |
| `prevAttackInput` | Edge-detect for attack button press |

### Enemy system functions (`game.js`)
| Function | Purpose |
|---|---|
| `makeEnemy(type)` | Creates a `'scout'` (orange sphere, 1HP, fast) or `'tank'` (red cube, 2HP, slow); spawns at random angle, radius 40 |
| `updateSpawn(dt)` | Drains `spawnQueue` every 0.5 s while wave is active |
| `startWave(n)` | Resets kill count, sets `spawnQueue` from `WAVE_SIZES[n]`, activates wave |
| `updateEnemies(dt)` | Moves all live enemies toward player; deals damage on contact; removes `dead` enemies; controls vignette |

### Enemy AI
- **seek**: move toward player at 4.5 u/s (scout) or 2.0 u/s (tank) while `dist > 1.2`
- **attack**: deal 8 HP/s (scout) or 20 HP/s (tank) continuously while in contact
- `triggerGameOver()` is called when `playerHealth` reaches 0 (defined in a later task — hoisted at runtime)
