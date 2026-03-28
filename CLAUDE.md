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
