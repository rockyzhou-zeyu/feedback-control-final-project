# Snowboard Carving Control Demo

This folder contains a simulation and browser-ready visualization for the snowboard carving final project:

- A planar carving model with a weighted rider torso connected through a hip joint
- A saturation-limited LQR controller for downhill carving trajectory tracking
- Separate disturbance channels for a gust, an edge upset, and a low-grip snow patch
- A browser demo with multiple slope presets, telemetry, disturbance strips, and an animated planar roll model

## Final Report Website

- [index.html](index.html): GitHub Pages entry point and final report
- [report.css](report.css): report styling

For GitHub Pages, publish from the `main` branch and `/ (root)` folder.

## Run It

From this directory:

```bash
python3 build_demo.py
```

That regenerates [web/demo_data.js](web/demo_data.js) and drives the animation in [web/index.html](web/index.html).

## Browser Pages

- [web/settings.html](web/settings.html): simulation settings, rider parameters, and preset comparison
- [web/index.html](web/index.html): cleaned live browser simulation

## Files

- [build_demo.py](build_demo.py): one-command build entrypoint
- [snowboard_sim/model.py](snowboard_sim/model.py): physics parameters, weighted hip-joint dynamics, disturbances, and integration
- [snowboard_sim/controller.py](snowboard_sim/controller.py): linearized tracking model and LQR design
- [snowboard_sim/pipeline.py](snowboard_sim/pipeline.py): simulation loop, metrics, multi-scenario export, and explanation bundle
- [web/index.html](web/index.html): demo layout
- [web/app.js](web/app.js): scenario switching, playback, and canvas rendering
- [web/styles.css](web/styles.css): visual styling

## What The Model Is

The current model is intentionally planar and control-oriented rather than full rigid-body snow contact dynamics.

State vector:

- `x, y, psi, v`: downhill position, cross-slope position, heading, and speed
- `phi, phi_dot`: lower-body and board roll angle plus roll rate
- `eta, eta_dot`: torso-to-lower-body hip angle plus hip rate

Reference path:

- The board tracks a smooth sinusoidal carving line in `y(x)`
- Curvature comes from the geometry of that reference line, not from a separate steering state

Control input:

- `u` is the hip torque command
- We saturate `u` instead of using MPC, matching the instructor feedback

Core equations:

- `x_dot = v cos(psi)`
- `y_dot = v sin(psi)`
- `psi_dot = v * kappa + d_yaw(t)`
- `kappa = grip * g * tan(theta_eff) / v^2`
- `theta_eff = phi + alpha * eta`
- `I_phi * phi_ddot = -k_phi sin(phi) - c_phi phi_dot + k_eta * eta + tau_terrain + d_gust(t)`
- `I_eta * eta_ddot = u - c_eta eta_dot - k_eta0 * eta - k_cross * phi`

This gives us a model that is simple enough to tune and explain in class, while still capturing:

- trajectory tracking
- speed-dependent carving curvature
- torso-to-board coupling
- lean limits and torque saturation
- recovery from disturbances

## How The Hip And Weight Matter

The rider is split into two coupled masses:

- Lower system mass: board + lower body
- Upper body mass: torso above the hip pivot

Those masses affect the model in three different ways:

1. Roll inertia:
The total mass distribution sets `I_phi`, so a heavier rider or higher COM makes whole-body lean slower to change.

2. Hip inertia:
The torso mass above the hip sets `I_eta`, so moving the torso is not free. A heavier torso needs more torque to swing quickly.

3. Effective edge contribution:
The upper-body COM moment produces `alpha`, the coefficient in `theta_eff = phi + alpha * eta`.

Interpretation:

- `phi` alone is the lower-body and board lean
- `eta` alone is the torso bending relative to that lower body
- `alpha * eta` is how much that torso bend actually changes the effective edge angle seen by the carve model

So the hip is not just “extra animation.” It changes the simulated carve because upper-body motion:

- shifts the COM
- feeds torque into the roll dynamics
- changes the effective edge angle through `alpha`

## Lean Angle vs Hip Angle

These two angles are different on purpose:

- `phi` is the lean of the board and lower body relative to vertical
- `eta` is the extra torso articulation relative to the lower body

In the demo:

- The live state panel shows `phi`, `eta`, and `theta_eff`
- The disturbance/telemetry panels show their time histories separately
- The planar roll model panel animates the lower segment and torso segment with labeled angles

This highlights a key physical point:

- a rider can increase effective edge angle without leaning the entire board-rider system by the same amount

## Disturbances

The three disturbance channels are visualized separately now:

- Low-grip patch: a spatial region where edge hold drops
- Cross-slope gust: a transient roll disturbance
- Edge upset: a transient yaw disturbance

In the demo:

- The slope view shades the low-grip region in blue
- Gust and edge upset are marked with different colors and event labels
- The disturbance panel shows grip, gust input, and edge-upset input on separate rows

This is important because the low-grip patch is a sustained position-based effect, while the edge upset is a short time-localized disturbance.

## Slope Presets

The demo now exports multiple presets from [snowboard_sim/pipeline.py](snowboard_sim/pipeline.py):

- `Blue Groomer`: gentler slope and smaller disturbances
- `All-Mountain Carve`: the balanced default demo
- `Steep Technical`: steeper pitch and stronger disturbances

The browser visualization lets you switch between them using the slope preset selector without rebuilding.

## What The Visualizer Is Showing

The browser demo is split into several views:

- Slope View: actual carve, reference carve, rider pose, and disturbance locations
- Tracking Telemetry: lateral error, lean, hip articulation, and torque
- Disturbance View: grip, gust, and edge-upset signals separated
- Planar Roll Model: a side-view decomposition of `phi`, `eta`, and `theta_eff`

That combination is meant to support both “look, it works” and “here is why it works.”

## Why A Browser Demo

I chose a self-contained HTML canvas demo instead of heavier 3D tooling for this iteration because:

- MDN documents the HTML `<canvas>` element as a broadly supported graphics surface: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas
- MDN recommends `requestAnimationFrame()` for browser-synced animation timing: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
- Plotly’s official animation docs note that the smoothest built-in transitions are mainly for scatter and bar traces, which is less ideal for a custom rider-and-slope scene: https://plotly.com/python/animations/
- three.js is powerful, but for this 2D control demo it would add more infrastructure than value right now: https://threejs.org/manual/en/animation-system.html

## Next Extensions

- Add gain scheduling or MPC for speed-varying tracking
- Add a richer sidecut or contact-based carving model
- Add RL as an optional comparison once the baseline controller is locked
- Export MP4 or GIF outputs directly from the simulation pipeline
