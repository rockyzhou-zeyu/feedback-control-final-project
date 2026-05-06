from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import linalg, signal

from .model import ModelParams, ReferenceState, clamp, tracking_error


@dataclass
class ControlResult:
    torque: float
    raw_torque: float
    feedforward_torque: float
    error: np.ndarray


@dataclass
class LQRController:
    params: ModelParams
    gain: np.ndarray
    q_weights: np.ndarray
    r_weight: np.ndarray
    integral_limit: float = 4.0
    integral_error: float = 0.0

    @classmethod
    def from_params(cls, params: ModelParams) -> "LQRController":
        a_matrix, b_matrix = tracking_linear_model(params)
        discrete_a, discrete_b, _, _, _ = signal.cont2discrete(
            (a_matrix, b_matrix, np.eye(a_matrix.shape[0]), np.zeros((a_matrix.shape[0], 1))),
            params.dt,
        )

        q_weights = np.diag([68.0, 120.0, 36.0, 78.0, 10.0, 34.0, 5.0])
        r_weight = np.array([[0.24]])

        riccati = linalg.solve_discrete_are(discrete_a, discrete_b, q_weights, r_weight)
        gain = np.linalg.solve(
            discrete_b.T @ riccati @ discrete_b + r_weight,
            discrete_b.T @ riccati @ discrete_a,
        )
        return cls(params=params, gain=gain, q_weights=q_weights, r_weight=r_weight)

    def reset(self) -> None:
        self.integral_error = 0.0

    def control(self, state: np.ndarray, ref: ReferenceState) -> ControlResult:
        error = tracking_error(state, ref)
        self.integral_error = clamp(
            self.integral_error + error[0] * self.params.dt,
            -self.integral_limit,
            self.integral_limit,
        )

        augmented_error = np.concatenate(([self.integral_error], error))
        feedback_torque = float(self.gain @ augmented_error)
        raw_torque = ref.u_ff - feedback_torque
        torque = clamp(raw_torque, -self.params.torque_limit, self.params.torque_limit)
        if torque != raw_torque:
            self.integral_error *= 0.94

        return ControlResult(
            torque=torque,
            raw_torque=raw_torque,
            feedforward_torque=ref.u_ff,
            error=augmented_error,
        )


def tracking_linear_model(params: ModelParams) -> tuple[np.ndarray, np.ndarray]:
    a_matrix = np.zeros((7, 7))
    b_matrix = np.zeros((7, 1))

    speed = params.nominal_speed
    curvature_gain = params.gravity / speed

    a_matrix[0, 1] = 1.0
    a_matrix[1, 2] = speed
    a_matrix[2, 3] = curvature_gain
    a_matrix[2, 5] = curvature_gain * params.hip_com_weight
    a_matrix[3, 4] = 1.0
    a_matrix[4, 3] = -params.roll_stiffness / params.roll_inertia
    a_matrix[4, 4] = -params.roll_damping / params.roll_inertia
    a_matrix[4, 5] = params.hip_to_roll_stiffness / params.roll_inertia
    a_matrix[5, 6] = 1.0
    a_matrix[6, 3] = -params.hip_cross_coupling / params.hip_inertia
    a_matrix[6, 5] = -params.hip_passive_stiffness / params.hip_inertia
    a_matrix[6, 6] = -params.hip_damping / params.hip_inertia

    b_matrix[6, 0] = 1.0 / params.hip_inertia
    return a_matrix, b_matrix
