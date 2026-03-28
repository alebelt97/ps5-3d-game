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
