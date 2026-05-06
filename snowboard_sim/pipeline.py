from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Dict

import numpy as np

from .controller import LQRController
from .model import (
    DemoScenario,
    ModelParams,
    ReferencePath,
    effective_edge_angle,
    initial_state,
    reference_state,
    rk4_step,
    tracking_error,
)


STATE_NAMES = ["x", "y", "psi", "speed", "phi", "phi_dot", "eta", "eta_dot"]


@dataclass
class SimulationResult:
    params: ModelParams
    path: ReferencePath
    scenario: DemoScenario
    controller: LQRController
    time: np.ndarray
    states: np.ndarray
    references: Dict[str, np.ndarray]
    control: Dict[str, np.ndarray]
    derived: Dict[str, np.ndarray]
    metrics: Dict[str, float | bool | str]


def simulate_demo(
    params: ModelParams | None = None,
    path: ReferencePath | None = None,
    scenario: DemoScenario | None = None,
) -> SimulationResult:
    params = params or ModelParams()
    path = path or ReferencePath()
    scenario = scenario or DemoScenario()
    controller = LQRController.from_params(params)

    time = np.arange(0.0, params.duration + params.dt, params.dt)
    states = np.zeros((time.size, 8))
    state = initial_state(params)

    ref_y = np.zeros(time.size)
    ref_psi = np.zeros(time.size)
    ref_curvature = np.zeros(time.size)
    ref_theta = np.zeros(time.size)
    ref_phi = np.zeros(time.size)
    ref_phi_dot = np.zeros(time.size)
    ref_eta = np.zeros(time.size)
    ref_eta_dot = np.zeros(time.size)
    ref_u = np.zeros(time.size)
    ref_grip = np.zeros(time.size)
    ref_edge_from_lean = np.zeros(time.size)
    ref_edge_from_hip = np.zeros(time.size)

    torque = np.zeros(time.size)
    raw_torque = np.zeros(time.size)
    feedforward = np.zeros(time.size)
    integral_state = np.zeros(time.size)

    lateral_error = np.zeros(time.size)
    heading_error = np.zeros(time.size)
    roll_error = np.zeros(time.size)
    hip_error = np.zeros(time.size)
    edge_angle = np.zeros(time.size)
    edge_from_lean = np.zeros(time.size)
    edge_from_hip = np.zeros(time.size)
    torso_angle = np.zeros(time.size)
    grip = np.zeros(time.size)
    roll_impulse = np.zeros(time.size)
    yaw_push = np.zeros(time.size)
    terrain_roll_moment = np.zeros(time.size)
    speed_drag_adjustment = np.zeros(time.size)

    for index, current_time in enumerate(time):
        ref = reference_state(state[0], state[3], params, path, scenario, t=current_time)
        control_result = controller.control(state, ref)
        current_error = tracking_error(state, ref)

        states[index, :] = state

        ref_y[index] = ref.y
        ref_psi[index] = ref.psi
        ref_curvature[index] = ref.curvature
        ref_theta[index] = ref.theta_eff
        ref_phi[index] = ref.phi
        ref_phi_dot[index] = ref.phi_dot
        ref_eta[index] = ref.eta
        ref_eta_dot[index] = ref.eta_dot
        ref_u[index] = ref.u_ff
        ref_grip[index] = ref.grip
        ref_edge_from_lean[index] = ref.phi
        ref_edge_from_hip[index] = params.hip_com_weight * ref.eta

        torque[index] = control_result.torque
        raw_torque[index] = control_result.raw_torque
        feedforward[index] = control_result.feedforward_torque
        integral_state[index] = controller.integral_error

        lateral_error[index] = current_error[0]
        heading_error[index] = current_error[1]
        roll_error[index] = current_error[2]
        hip_error[index] = current_error[4]
        edge_angle[index] = effective_edge_angle(state, params)
        edge_from_lean[index] = state[4]
        edge_from_hip[index] = params.hip_com_weight * state[6]
        torso_angle[index] = state[4] + state[6]
        grip[index] = ref.grip
        roll_impulse[index] = scenario.roll_impulse(current_time)
        yaw_push[index] = scenario.yaw_push(current_time)
        terrain_roll_moment[index] = scenario.terrain_roll_moment(state[0], current_time, params)
        speed_drag_adjustment[index] = scenario.speed_drag_adjustment(state[0], current_time)

        if index < time.size - 1:
            state = rk4_step(state, control_result.torque, params, scenario, current_time)

    control_energy = float(np.sum(torque**2) * params.dt)
    rmse_lateral = float(np.sqrt(np.mean(lateral_error**2)))
    max_roll_deg = float(np.rad2deg(np.max(np.abs(states[:, 4]))))
    max_hip_deg = float(np.rad2deg(np.max(np.abs(states[:, 6]))))
    max_edge_deg = float(np.rad2deg(np.max(np.abs(edge_angle))))
    peak_torque = float(np.max(np.abs(torque)))
    avg_speed = float(np.mean(states[:, 3]))
    success = bool(
        max_roll_deg < params.roll_angle_limit_deg + 0.5
        and max_hip_deg < params.hip_angle_limit_deg + 0.5
    )

    metrics = {
        "rmse_lateral_m": rmse_lateral,
        "peak_roll_deg": max_roll_deg,
        "peak_hip_deg": max_hip_deg,
        "peak_edge_deg": max_edge_deg,
        "peak_torque_nm": peak_torque,
        "control_energy": control_energy,
        "average_speed_mps": avg_speed,
        "success": success,
        "summary": (
            "Stable carve tracking with a weighted hip joint, torque saturation, "
            "and recovery through a gust plus low-grip section."
        ),
    }

    return SimulationResult(
        params=params,
        path=path,
        scenario=scenario,
        controller=controller,
        time=time,
        states=states,
        references={
            "y": ref_y,
            "psi": ref_psi,
            "curvature": ref_curvature,
            "theta_eff": ref_theta,
            "phi": ref_phi,
            "phi_dot": ref_phi_dot,
            "eta": ref_eta,
            "eta_dot": ref_eta_dot,
            "u_ff": ref_u,
            "grip": ref_grip,
            "edge_from_lean": ref_edge_from_lean,
            "edge_from_hip": ref_edge_from_hip,
        },
        control={
            "torque": torque,
            "raw_torque": raw_torque,
            "feedforward": feedforward,
            "integral_state": integral_state,
        },
        derived={
            "lateral_error": lateral_error,
            "heading_error": heading_error,
            "roll_error": roll_error,
            "hip_error": hip_error,
            "edge_angle": edge_angle,
            "edge_from_lean": edge_from_lean,
            "edge_from_hip": edge_from_hip,
            "torso_angle": torso_angle,
            "grip": grip,
            "roll_impulse": roll_impulse,
            "yaw_push": yaw_push,
            "terrain_roll_moment": terrain_roll_moment,
            "speed_drag_adjustment": speed_drag_adjustment,
        },
        metrics=metrics,
    )


def scenario_presets() -> list[dict[str, object]]:
    return [
        {
            "key": "blue_groomer",
            "label": "Blue Groomer",
            "description": (
                "Mellow slope, wider turns, and lighter disturbances. Good for explaining the model."
            ),
            "params": ModelParams(
                slope_angle_deg=14.0,
                nominal_speed=10.0,
                turn_drag=1.2,
                terrain_roll_gain=6.2,
            ),
            "path": ReferencePath(amplitude=1.1, wavelength=42.0, ramp_length=18.0),
            "scenario": DemoScenario(
                grip_loss_start=46.0,
                grip_loss_end=66.0,
                gust_time=5.8,
                push_time=9.0,
                grip_drop=0.14,
                chatter_amplitude=0.02,
                terrain_gain_scale=0.85,
                gust_gain=0.55,
                gust_rebound_gain=0.18,
                yaw_push_gain=0.1,
                speed_drag_penalty=0.12,
            ),
        },
        {
            "key": "all_mountain",
            "label": "All-Mountain Carve",
            "description": (
                "Balanced preset with the weighted hip joint, a gust, an edge upset, and a visible low-grip section."
            ),
            "params": ModelParams(),
            "path": ReferencePath(),
            "scenario": DemoScenario(gust_time=6.0, push_time=9.7, yaw_push_gain=0.28),
        },
        {
            "key": "steep_technical",
            "label": "Steep Technical",
            "description": (
                "Steeper pitch and sharper disturbances. This preset stresses the controller the most."
            ),
            "params": ModelParams(
                slope_angle_deg=19.5,
                nominal_speed=11.6,
                turn_drag=0.95,
                terrain_roll_gain=8.3,
            ),
            "path": ReferencePath(amplitude=1.25, wavelength=37.0, ramp_length=16.0),
            "scenario": DemoScenario(
                grip_loss_start=50.0,
                grip_loss_end=79.0,
                gust_time=5.7,
                push_time=8.8,
                grip_drop=0.28,
                chatter_amplitude=0.04,
                terrain_gain_scale=1.2,
                gust_gain=1.0,
                gust_rebound_gain=0.28,
                yaw_push_gain=0.2,
                speed_drag_penalty=0.22,
            ),
        },
    ]


def model_explanation() -> dict[str, object]:
    return {
        "angles": [
            {
                "label": "Lean angle phi",
                "detail": (
                    "phi is the board-plus-lower-body roll angle relative to world vertical. "
                    "It is the main planar lean state that tilts the board into the carve."
                ),
            },
            {
                "label": "Hip angle eta",
                "detail": (
                    "eta is the torso angle relative to the lower body. Positive eta means the torso "
                    "articulates across the hip and shifts mass without requiring the whole board to lean equally."
                ),
            },
            {
                "label": "Effective edge angle theta_eff",
                "detail": (
                    "The board does not carve from phi alone. In this model theta_eff = phi + alpha * eta, "
                    "where alpha is the upper-body COM contribution."
                ),
            },
        ],
        "weightEffect": [
            {
                "label": "Lower system mass",
                "detail": (
                    "Board mass and lower-body mass form the lower rigid segment. They set the base roll inertia "
                    "and how much the board resists fast changes in lean."
                ),
            },
            {
                "label": "Upper-body mass",
                "detail": (
                    "The torso mass above the hip increases hip inertia and creates a lever arm. That lever arm is "
                    "what lets torso motion generate roll torque back into the board."
                ),
            },
            {
                "label": "Mass coupling alpha",
                "detail": (
                    "alpha comes from the torso COM moment divided by the total COM moment. Larger upper-body weight "
                    "or height makes hip articulation matter more in the effective edge angle."
                ),
            },
        ],
        "equations": [
            "x_dot = v cos(psi),  y_dot = v sin(psi)",
            "psi_dot = v * kappa + d_yaw(t)",
            "kappa = grip * g * tan(theta_eff) / v^2",
            "theta_eff = phi + alpha * eta",
            "I_phi * phi_ddot = -k_phi sin(phi) - c_phi phi_dot + k_eta eta + tau_terrain + d_gust(t)",
            "I_eta * eta_ddot = u - c_eta eta_dot - k_eta0 eta - k_cross phi",
        ],
    }


def build_scenario_bundle(
    *,
    key: str,
    label: str,
    description: str,
    params: ModelParams,
    path: ReferencePath,
    scenario: DemoScenario,
) -> Dict[str, object]:
    result = simulate_demo(params=params, path=path, scenario=scenario)
    time = result.time
    states = result.states

    state_payload = {
        name: np.round(states[:, idx], 6).tolist() for idx, name in enumerate(STATE_NAMES)
    }

    path_samples_x = np.linspace(0.0, float(states[-1, 0] + 18.0), 420)
    path_samples = [result.path.sample(float(x_pos)) for x_pos in path_samples_x]

    event_markers = []
    for marker in result.scenario.event_markers():
        enriched = dict(marker)
        x_pos = float(enriched.get("x", 0.0))
        if not x_pos and float(enriched.get("time", 0.0)) > 0.0:
            time_index = int(round(float(enriched["time"]) / result.params.dt))
            x_index = min(time_index, len(states) - 1)
            x_pos = float(states[x_index, 0])
            enriched["x"] = x_pos

        sample = result.path.sample(x_pos)
        enriched["y"] = float(sample["y"])

        if "x_start" in enriched and "x_end" in enriched:
            start_sample = result.path.sample(float(enriched["x_start"]))
            end_sample = result.path.sample(float(enriched["x_end"]))
            enriched["y_start"] = float(start_sample["y"])
            enriched["y_end"] = float(end_sample["y"])

        event_markers.append(enriched)

    upper_body_mass_share = result.params.upper_body_mass / result.params.total_mass

    return {
        "meta": {
            "key": key,
            "label": label,
            "description": description,
            "slopeAngleDeg": result.params.slope_angle_deg,
            "nominalSpeedMps": result.params.nominal_speed,
            "pathAmplitudeM": result.path.amplitude,
            "pathWavelengthM": result.path.wavelength,
            "alphaHipToEdge": result.params.hip_com_weight,
            "upperBodyMassShare": upper_body_mass_share,
            "hipToRollRatio": result.params.hip_to_roll_ratio,
        },
        "params": result.params.to_serializable(),
        "pathConfig": asdict(result.path),
        "scenarioConfig": asdict(result.scenario),
        "metrics": result.metrics,
        "time": np.round(time, 6).tolist(),
        "states": state_payload,
        "reference": {
            key: np.round(values, 6).tolist() for key, values in result.references.items()
        },
        "control": {
            key: np.round(values, 6).tolist() for key, values in result.control.items()
        },
        "derived": {
            key: np.round(values, 6).tolist() for key, values in result.derived.items()
        },
        "pathSamples": path_samples,
        "events": event_markers,
    }


def build_demo_bundle() -> Dict[str, object]:
    presets = scenario_presets()
    scenario_order = [preset["key"] for preset in presets]
    scenarios = {
        preset["key"]: build_scenario_bundle(
            key=preset["key"],
            label=preset["label"],
            description=preset["description"],
            params=preset["params"],
            path=preset["path"],
            scenario=preset["scenario"],
        )
        for preset in presets
    }

    return {
        "meta": {
            "title": "Snowboard Carving Control With Weighted Hip Joint",
            "subtitle": (
                "Planar carving dynamics, saturation-limited LQR tracking, "
                "and a rider torso mass connected through a hip joint."
            ),
            "futureHooks": [
                "Swap in gain-scheduled LQR or MPC in snowboard_sim/controller.py.",
                "Replace the planar roll model with a fuller rigid-body or sidecut-contact model.",
                "Add an RL policy and compare it against the same disturbance bundle and metrics.",
            ],
            "modelExplanation": model_explanation(),
        },
        "defaultScenarioKey": "all_mountain",
        "scenarioOrder": scenario_order,
        "scenarios": scenarios,
    }


def write_demo_bundle(
    output_path: str | Path,
    bundle: Dict[str, object] | None = None,
) -> Path:
    bundle = bundle or build_demo_bundle()
    output_path = Path(output_path)
    output_path.write_text(
        "window.SNOWBOARD_DEMO_DATA = " + json.dumps(bundle, indent=2) + ";\n",
        encoding="utf-8",
    )
    return output_path
