# Combat / Enemies — Design Spec
**Date:** 2026-03-27
**Project:** ps5-3d-game

## Overview

Add a wave-based combat system to the existing 3rd-person 3D game. The player attacks enemies with a melee button, manages a health bar, and works toward a kill-count target to clear each wave. Five waves = win.

---

## Game State

New fields added to the existing game state:

```
Player state
  health        0–100, starts at 100
  maxHealth     100
  attackCooldown  0–0.6s countdown (0 = ready)
  isAttacking   bool, true for 150ms on swing

enemies[]       array of active enemy objects
  type          'scout' | 'tank'
  mesh          THREE.Mesh (sphere for scout, box for tank)
  position      vec3 (synced to mesh.position)
  velocity      vec3
  health        1 (scout) | 2 (tank)
  aiState       'seek' | 'attack'
  dead          bool

Wave state
  wave          current wave number (1–5)
  killCount     kills this wave
  killTarget    total enemies spawned this wave
  waveActive    bool
  betweenWaves  bool (true during 3s regen pause)
```

---

## Enemy Types

| Type   | Speed | Health | Contact damage | Visual              |
|--------|-------|--------|----------------|---------------------|
| Scout  | 4.5   | 1 hit  | 8 HP/sec       | Small orange sphere (r=0.35) |
| Tank   | 2.0   | 2 hits | 20 HP/sec      | Red box (0.7×0.7×0.7) |

Wave composition: roughly 60% scouts, 40% tanks (randomised per wave).

---

## Wave Progression

| Wave | Enemies spawned | Kill target |
|------|----------------|-------------|
| 1    | 6              | 6           |
| 2    | 8              | 8           |
| 3    | 11             | 11          |
| 4    | 14             | 14          |
| 5    | 18             | 18          |

Enemies spawn staggered 0.5s apart at random positions on the plane edge (radius 40 from origin). All enemies spawn before the kill target can be reached (no mid-wave reinforcements in v1).

---

## Combat Mechanics

### Attack
- **Input:** Space (keyboard) / Cross button index 0 (DualSense)
- **Cooldown:** 0.6 seconds
- **Hitbox:** sphere radius 2.5 units, centred 1.5 units in front of player
- **Effect:** all enemies in hitbox lose 1 HP; scouts die instantly, tanks stagger (1 HP remaining)
- **Player feedback:** capsule briefly scales X to 1.3 for 150ms ("punch" squash)

### Enemy AI
Simple two-state machine per enemy, updated each frame:
- `SEEK` — move straight toward player at type speed
- `ATTACK` — within 1.2 units of player: stop moving, deal damage continuously (HP/sec × dt)
- Transition: `SEEK → ATTACK` when distance < 1.2; `ATTACK → SEEK` when distance ≥ 1.2

No pathfinding. Straight-line movement is sufficient on a flat open plane.

### Health & Regen
- Player health drains while one or more enemies are in `ATTACK` state adjacent to player
- Multiple enemies stack damage additively
- **Between waves:** regen 25 HP/sec for 3 seconds (capped at 100), then next wave begins
- **Game over:** health reaches 0 at any time

---

## HUD Layout

```
┌─────────────────────────────────────────────────────┐
│ [████████░░] HP        Wave 2 · 6/10       [○○○●●] │
│  top-left              top-center          top-right │
└─────────────────────────────────────────────────────┘
```

- **Health bar** (top-left): red fill, glassmorphism container, label "HP"
- **Wave / kill counter** (top-center): "Wave N · X/Y kills"
- **Attack cooldown** (top-right): small circular arc that drains on attack and refills over 0.6s

All HUD elements are `position: fixed` divs in `index.html`. Styled in `style.css`.

---

## Visual Feedback

| Event             | Feedback                                              |
|-------------------|-------------------------------------------------------|
| Enemy hit         | Mesh flashes white for 80ms                           |
| Enemy death       | Mesh scales to 0 over 150ms, then removed from scene  |
| Player damaged    | Red vignette pulse on screen edges for 200ms (CSS inset box-shadow on body) |
| Wave complete     | "Wave Clear!" text centered, fades in/out over 1.5s   |
| Between waves     | Green health bar regen animation                      |
| Wave 5 cleared    | "You Win!" overlay (wave + kill count summary)        |
| Game over         | Dark overlay with final wave reached + total kills, restart prompt |

---

## File Changes

| File        | Changes |
|-------------|---------|
| `game.js`   | Add enemy system, wave system, attack logic, health/damage, HUD update functions — layered on top of existing movement/camera code |
| `style.css` | HUD element styles, health bar, cooldown arc, vignette effect, wave-clear / overlay text |
| `index.html`| Add health bar div, wave/kill counter div, cooldown arc div to existing HUD container |

**No new files. No new dependencies.**

---

## Win / Loss Conditions

- **Win:** clear Wave 5 → "You Win!" overlay
- **Loss:** health reaches 0 → "Game Over" overlay
- Both overlays show: restart button (R key / Options button)
- Future: could extend to Wave 6+ for endless mode, but v1 ships with 5 waves

---

## Out of Scope (v1)

- Enemy pathfinding around obstacles
- Ranged enemies
- Player dodge roll
- Power-ups or drops
- Sound effects
- Mobile / PS5 support (optimise after laptop is solid)
