from __future__ import annotations

from pathlib import Path

from snowboard_sim import build_demo_bundle, write_demo_bundle


def main() -> None:
    project_root = Path(__file__).resolve().parent
    web_dir = project_root / "web"
    output_path = web_dir / "demo_data.js"

    bundle = build_demo_bundle()
    write_demo_bundle(output_path, bundle)
    default_key = bundle["defaultScenarioKey"]
    default_scenario = bundle["scenarios"][default_key]

    print("Generated:", output_path)
    print("Open:", web_dir / "index.html")
    print("Default scenario:", default_scenario["meta"]["label"])
    print("Tracking RMSE (m):", round(default_scenario["metrics"]["rmse_lateral_m"], 3))
    print("Peak torque (Nm):", round(default_scenario["metrics"]["peak_torque_nm"], 1))
    print("Peak edge angle (deg):", round(default_scenario["metrics"]["peak_edge_deg"], 1))


if __name__ == "__main__":
    main()
