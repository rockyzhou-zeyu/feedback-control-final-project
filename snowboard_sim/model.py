from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Dict

import numpy as np


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def wrap_angle(angle: float) -> float:
    return math.atan2(math.sin(angle), math.cos(angle))


def smoothstep(value: float, edge0: float, edge1: float) -> float:
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    x = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def soft_window(value: float, start: float, end: float, blend: float = 3.0) -> float:
    left = smoothstep(value, start, start + blend)
    right = 1.0 - smoothstep(value, end - blend, end)
    return clamp(left * right, 0.0, 1.0)


def gaussian(value: float, center: float, width: float) -> float:
    width = max(width, 1e-6)
    return math.exp(-((value - center) / width) ** 2)


@dataclass
class ModelParams:
    gravity: float = 9.81
    slope_angle_deg: float = 17.0
    board_mass: float = 4.8
    lower_body_mass: float = 28.0
    upper_body_mass: float = 44.0
    lower_com_height: float = 0.32
    upper_com_height: float = 0.86
    hip_pivot_height: float = 0.58
    hip_leverage_gain: float = 0.60
    hip_passive_stiffness: float = 185.0
    hip_cross_coupling: float = 22.0
    roll_damping_ratio: float = 0.92
    hip_damping_ratio: float = 0.88
    edge_angle_limit_deg: float = 28.0
    roll_angle_limit_deg: float = 22.0
    hip_angle_limit_deg: float = 20.0
    torque_limit: float = 120.0
    nominal_speed: float = 11.0
    min_speed: float = 5.0
    max_speed: float = 18.0
    dt: float = 0.02
    duration: float = 16.0
    linear_drag: float = 0.085
    quadratic_drag: float = 0.018
    turn_drag: float = 1.1
    terrain_roll_gain: float = 7.5
    board_length: float = 1.58

    @property
    def lower_system_mass(self) -> float:
        return self.board_mass + self.lower_body_mass

    @property
    def total_mass(self) -> float:
        return self.lower_system_mass + self.upper_body_mass

    @property
    def weighted_com_height(self) -> float:
        numerator = (
            self.lower_system_mass * self.lower_com_height
            + self.upper_body_mass * self.upper_com_height
        )
        return numerator / self.total_mass

    @property
    def upper_relative_height(self) -> float:
        return max(self.upper_com_height - self.hip_pivot_height, 0.12)

    @property
    def roll_inertia(self) -> float:
        return (
            self.lower_system_mass * self.lower_com_height**2
            + self.upper_body_mass * self.upper_com_height**2
        )

    @property
    def hip_inertia(self) -> float:
        return self.upper_body_mass * self.upper_relative_height**2

    @property
    def roll_stiffness(self) -> float:
        return self.total_mass * self.gravity * self.weighted_com_height

    @property
    def roll_damping(self) -> float:
        return (
            2.0
            * self.roll_damping_ratio
            * math.sqrt(self.roll_stiffness * self.roll_inertia)
        )

    @property
    def hip_damping(self) -> float:
        return (
            2.0
            * self.hip_damping_ratio
            * math.sqrt(self.hip_passive_stiffness * self.hip_inertia)
        )

    @property
    def hip_to_roll_stiffness(self) -> float:
        return (
            self.hip_leverage_gain
            * self.upper_body_mass
            * self.gravity
            * self.upper_relative_height
        )

    @property
    def hip_to_roll_ratio(self) -> float:
        return self.hip_to_roll_stiffness / self.roll_stiffness

    @property
    def hip_com_weight(self) -> float:
        lower_moment = self.lower_system_mass * self.lower_com_height
        upper_moment = self.upper_body_mass * self.upper_com_height
        return upper_moment / (lower_moment + upper_moment)

    @property
    def slope_angle_rad(self) -> float:
        return math.radians(self.slope_angle_deg)

    @property
    def edge_angle_limit(self) -> float:
        return math.radians(self.edge_angle_limit_deg)

    @property
    def roll_angle_limit(self) -> float:
        return math.radians(self.roll_angle_limit_deg)

    @property
    def hip_angle_limit(self) -> float:
        return math.radians(self.hip_angle_limit_deg)

    def to_serializable(self) -> Dict[str, float]:
        payload = asdict(self)
        payload.update(
            {
                "lower_system_mass": self.lower_system_mass,
                "total_mass": self.total_mass,
                "weighted_com_height": self.weighted_com_height,
                "upper_relative_height": self.upper_relative_height,
                "roll_inertia": self.roll_inertia,
                "hip_inertia": self.hip_inertia,
                "roll_stiffness": self.roll_stiffness,
                "roll_damping": self.roll_damping,
                "hip_damping": self.hip_damping,
                "hip_to_roll_stiffness": self.hip_to_roll_stiffness,
                "hip_to_roll_ratio": self.hip_to_roll_ratio,
                "hip_com_weight": self.hip_com_weight,
                "edge_angle_limit_rad": self.edge_angle_limit,
                "roll_angle_limit_rad": self.roll_angle_limit,
                "hip_angle_limit_rad": self.hip_angle_limit,
            }
        )
        return payload


@dataclass
class ReferencePath:
    amplitude: float = 1.4
    wavelength: float = 35.0
    ramp_length: float = 20.0

    @property
    def wave_number(self) -> float:
        return 2.0 * math.pi / self.wavelength

    def sample(self, x_pos: float) -> Dict[str, float]:
        x_clamped = max(x_pos, 0.0)
        k = self.wave_number
        envelope = 1.0 - math.exp(-x_clamped / self.ramp_length)
        d_env = math.exp(-x_clamped / self.ramp_length) / self.ramp_length
        dd_env = -math.exp(-x_clamped / self.ramp_length) / (self.ramp_length**2)

        sin_term = math.sin(k * x_clamped)
        cos_term = math.cos(k * x_clamped)

        lateral = self.amplitude * envelope * sin_term
        lateral_slope = self.amplitude * (
            d_env * sin_term + envelope * k * cos_term
        )
        lateral_curvature_num = self.amplitude * (
            dd_env * sin_term + 2.0 * d_env * k * cos_term - envelope * k * k * sin_term
        )
        heading = math.atan(lateral_slope)
        curvature = lateral_curvature_num / ((1.0 + lateral_slope**2) ** 1.5)

        return {
            "x": x_clamped,
            "y": lateral,
            "heading": heading,
            "curvature": curvature,
        }


@dataclass
class ReferenceState:
    x: float
    y: float
    psi: float
    curvature: float
    grip: float
    theta_eff: float
    phi: float
    phi_dot: float
    eta: float
    eta_dot: float
    u_ff: float

    def to_serializable(self) -> Dict[str, float]:
        return asdict(self)


@dataclass
class DemoScenario:
    grip_loss_start: float = 52.0
    grip_loss_end: float = 77.0
    gust_time: float = 5.0
    push_time: float = 9.3
    grip_drop: float = 0.22
    chatter_amplitude: float = 0.03
    terrain_gain_scale: float = 1.0
    gust_gain: float = 0.85
    gust_rebound_gain: float = 0.25
    yaw_push_gain: float = 0.16
    speed_drag_penalty: float = 0.18

    def edge_grip(self, x_pos: float, t: float) -> float:
        icy_patch = soft_window(x_pos, self.grip_loss_start, self.grip_loss_end, blend=6.0)
        chatter = self.chatter_amplitude * math.sin(0.55 * t + 0.09 * x_pos)
        return clamp(1.0 - self.grip_drop * icy_patch + chatter, 0.65, 1.05)

    def speed_drag_adjustment(self, x_pos: float, _: float) -> float:
        soft_patch = soft_window(x_pos, self.grip_loss_start, self.grip_loss_end, blend=6.0)
        return self.speed_drag_penalty * soft_patch

    def terrain_roll_moment(self, x_pos: float, t: float, params: ModelParams) -> float:
        rolling_noise = (
            0.55 * math.sin(0.42 * x_pos)
            + 0.30 * math.sin(0.93 * x_pos + 0.5)
            + 0.12 * math.sin(2.2 * t)
        )
        activity = soft_window(x_pos, 12.0, 120.0, blend=10.0)
        return params.terrain_roll_gain * self.terrain_gain_scale * activity * rolling_noise

    def roll_impulse(self, t: float) -> float:
        return self.gust_gain * gaussian(t, self.gust_time, 0.18) - self.gust_rebound_gain * gaussian(
            t, self.gust_time + 0.35, 0.24
        )

    def hip_impulse(self, t: float) -> float:
        return 0.0 * gaussian(t, self.push_time, 0.2)

    def yaw_push(self, t: float) -> float:
        return self.yaw_push_gain * gaussian(t, self.push_time, 0.16)

    def event_markers(self) -> list[Dict[str, float | str]]:
        return [
            {
                "kind": "gust",
                "time": self.gust_time,
                "x": 0.0,
                "label": "Cross-slope gust",
                "detail": "A short lateral gust kicks the rider off the trim line.",
            },
            {
                "kind": "edge_upset",
                "time": self.push_time,
                "x": 0.0,
                "label": "Edge upset",
                "detail": "A fast yaw disturbance tests recovery once the board is already carving.",
            },
            {
                "kind": "low_grip_patch",
                "time": 0.0,
                "x": 0.5 * (self.grip_loss_start + self.grip_loss_end),
                "x_start": self.grip_loss_start,
                "x_end": self.grip_loss_end,
                "label": "Low-grip patch",
                "detail": "Reduced edge hold simulates a polished or icy section of snow.",
            },
        ]


def initial_state(params: ModelParams) -> np.ndarray:
    return np.array([0.0, -0.55, 0.03, params.nominal_speed - 0.6, 0.0, 0.0, 0.0, 0.0])


def reference_state(
    x_pos: float,
    speed: float,
    params: ModelParams,
    path: ReferencePath,
    scenario: DemoScenario,
    t: float = 0.0,
    sample_dx: float = 0.35,
) -> ReferenceState:
    current = path.sample(x_pos)
    next_sample = path.sample(x_pos + sample_dx)

    grip = scenario.edge_grip(x_pos, t)
    speed_safe = max(speed, params.min_speed)
    theta_eff = math.atan(
        current["curvature"] * speed_safe * speed_safe / (params.gravity * max(grip, 0.35))
    )
    theta_eff = clamp(theta_eff, -0.94 * params.edge_angle_limit, 0.94 * params.edge_angle_limit)

    eta = theta_eff / (params.hip_to_roll_ratio + params.hip_com_weight)
    phi = params.hip_to_roll_ratio * eta

    next_theta_eff = math.atan(
        next_sample["curvature"] * speed_safe * speed_safe / (params.gravity * max(grip, 0.35))
    )
    next_theta_eff = clamp(
        next_theta_eff, -0.94 * params.edge_angle_limit, 0.94 * params.edge_angle_limit
    )
    next_eta = next_theta_eff / (params.hip_to_roll_ratio + params.hip_com_weight)
    next_phi = params.hip_to_roll_ratio * next_eta

    phi_dot = speed_safe * (next_phi - phi) / sample_dx
    eta_dot = speed_safe * (next_eta - eta) / sample_dx
    u_ff = params.hip_passive_stiffness * eta + params.hip_cross_coupling * phi

    return ReferenceState(
        x=current["x"],
        y=current["y"],
        psi=current["heading"],
        curvature=current["curvature"],
        grip=grip,
        theta_eff=theta_eff,
        phi=phi,
        phi_dot=phi_dot,
        eta=eta,
        eta_dot=eta_dot,
        u_ff=u_ff,
    )


def tracking_error(state: np.ndarray, ref: ReferenceState) -> np.ndarray:
    return np.array(
        [
            state[1] - ref.y,
            wrap_angle(state[2] - ref.psi),
            state[4] - ref.phi,
            state[5] - ref.phi_dot,
            state[6] - ref.eta,
            state[7] - ref.eta_dot,
        ]
    )


def effective_edge_angle(state: np.ndarray, params: ModelParams) -> float:
    theta_eff = state[4] + params.hip_com_weight * state[6]
    return clamp(theta_eff, -params.edge_angle_limit, params.edge_angle_limit)


def dynamics(
    state: np.ndarray,
    torque_cmd: float,
    params: ModelParams,
    scenario: DemoScenario,
    t: float,
) -> np.ndarray:
    x_pos, y_pos, psi, speed, phi, phi_dot, eta, eta_dot = state

    applied_torque = clamp(torque_cmd, -params.torque_limit, params.torque_limit)
    grip = scenario.edge_grip(x_pos, t)
    theta_eff = effective_edge_angle(state, params)
    speed_safe = max(speed, params.min_speed)
    curvature = grip * params.gravity * math.tan(theta_eff) / (speed_safe * speed_safe)

    x_dot = speed * math.cos(psi)
    y_dot = speed * math.sin(psi)
    psi_dot = speed * curvature + scenario.yaw_push(t)

    drive = params.gravity * math.sin(params.slope_angle_rad)
    v_dot = (
        drive
        - params.linear_drag * speed
        - params.quadratic_drag * speed * abs(speed)
        - params.turn_drag * abs(curvature) * speed * speed
        - scenario.speed_drag_adjustment(x_pos, t)
    )

    roll_torque = (
        -params.roll_stiffness * math.sin(phi)
        - params.roll_damping * phi_dot
        + params.hip_to_roll_stiffness * eta
        + scenario.terrain_roll_moment(x_pos, t, params)
    )
    phi_dd = roll_torque / params.roll_inertia + scenario.roll_impulse(t)

    hip_torque = (
        applied_torque
        - params.hip_damping * eta_dot
        - params.hip_passive_stiffness * eta
        - params.hip_cross_coupling * phi
    )
    eta_dd = hip_torque / params.hip_inertia + scenario.hip_impulse(t)

    return np.array([x_dot, y_dot, psi_dot, v_dot, phi_dot, phi_dd, eta_dot, eta_dd])


def rk4_step(
    state: np.ndarray,
    torque_cmd: float,
    params: ModelParams,
    scenario: DemoScenario,
    t: float,
) -> np.ndarray:
    dt = params.dt
    k1 = dynamics(state, torque_cmd, params, scenario, t)
    k2 = dynamics(state + 0.5 * dt * k1, torque_cmd, params, scenario, t + 0.5 * dt)
    k3 = dynamics(state + 0.5 * dt * k2, torque_cmd, params, scenario, t + 0.5 * dt)
    k4 = dynamics(state + dt * k3, torque_cmd, params, scenario, t + dt)
    candidate = state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
    return apply_state_limits(candidate, params)


def apply_state_limits(state: np.ndarray, params: ModelParams) -> np.ndarray:
    bounded = state.copy()
    bounded[3] = clamp(bounded[3], params.min_speed, params.max_speed)

    clipped_phi = clamp(bounded[4], -params.roll_angle_limit, params.roll_angle_limit)
    if clipped_phi != bounded[4]:
        bounded[4] = clipped_phi
        bounded[5] *= 0.2

    clipped_eta = clamp(bounded[6], -params.hip_angle_limit, params.hip_angle_limit)
    if clipped_eta != bounded[6]:
        bounded[6] = clipped_eta
        bounded[7] *= 0.2

    bounded[2] = wrap_angle(bounded[2])
    return bounded
