# Snowboard Carving Control

This repository contains the final project report, simulation code, and browser
demo for a simplified snowboard carving control problem.

The project models a snowboard-rider system as a planar 8-state dynamical system
with a weighted torso connected through a hip joint. A saturation-limited LQR
controller tracks a smooth downhill carving path while recovering from a gust,
an edge upset, and a low-grip snow patch.

## Website

- [Final report](index.html)
- [Live browser demo](web/index.html)
- [Model settings and preset comparison](web/settings.html)

For GitHub Pages, publish from the `main` branch and `/ (root)` folder.

## Results

The demo exports three slope presets from the same simulation pipeline:

| Preset | RMS lateral error | Peak edge angle | Peak hip torque |
| --- | ---: | ---: | ---: |
| Blue Groomer | 0.148 m | 9.4 deg | 63.2 Nm |
| All-Mountain Carve | 0.202 m | 17.5 deg | 96.5 Nm |
| Steep Technical | 0.219 m | 18.8 deg | 109.7 Nm |

All three presets remain within the modeled roll and hip limits.

## Run Locally

From this directory:

```bash
python3 build_demo.py
```

This regenerates [web/demo_data.js](web/demo_data.js), which drives the static
browser demo. After rebuilding, open [index.html](index.html) for the report or
[web/index.html](web/index.html) for the interactive visualization.

## Model Summary

State vector:

```text
[x, y, psi, v, phi, phi_dot, eta, eta_dot]
```

- `x, y`: downhill and cross-slope position
- `psi`: heading
- `v`: speed
- `phi, phi_dot`: board/lower-body roll angle and roll rate
- `eta, eta_dot`: torso hip angle and hip rate

The key modeling idea is:

```text
theta_eff = phi + alpha * eta
```

Here `theta_eff` is the effective edge angle used by the carving curvature law.
The `alpha * eta` term makes torso motion physically relevant instead of only
visual: hip articulation shifts the effective edge angle and couples back into
the roll dynamics.

## Repository Map

- [index.html](index.html): final report and GitHub Pages entry point
- [report.css](report.css): report styling
- [assets/carve_tracking.gif](assets/carve_tracking.gif): animated result figure
- [build_demo.py](build_demo.py): one-command data rebuild
- [snowboard_sim/model.py](snowboard_sim/model.py): dynamics, parameters, references, disturbances
- [snowboard_sim/controller.py](snowboard_sim/controller.py): linearized tracking model and LQR controller
- [snowboard_sim/pipeline.py](snowboard_sim/pipeline.py): scenario presets, metrics, and web export
- [web/index.html](web/index.html): live demo page
- [web/app.js](web/app.js): playback, rendering, and scenario switching
- [web/styles.css](web/styles.css): browser demo styling

## Possible Extensions

- Replace the lumped grip law with a sidecut-contact model.
- Add gain scheduling or MPC for speed-varying tracking.
- Add a richer rigid-body model with pitch, yaw, and front/rear load transfer.
