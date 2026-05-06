(function () {
  const bundle = window.SNOWBOARD_DEMO_DATA;
  if (!bundle) {
    throw new Error("demo_data.js did not load");
  }

  const selector = document.getElementById("settingsScenarioSelect");
  const description = document.getElementById("settingsDescription");
  const pills = document.getElementById("settingsPills");
  const operatingGrid = document.getElementById("operatingGrid");
  const massGrid = document.getElementById("massGrid");
  const limitsGrid = document.getElementById("limitsGrid");
  const canvas = document.getElementById("settingsCanvas");
  const ctx = canvas.getContext("2d");

  let currentScenarioKey = bundle.defaultScenarioKey;

  function currentScenario() {
    return bundle.scenarios[currentScenarioKey];
  }

  function cardHTML(items) {
    return items
      .map(
        (item) =>
          `<div class="spec-item"><strong>${item.label}</strong><span>${item.value}</span></div>`,
      )
      .join("");
  }

  function populateSelector() {
    bundle.scenarioOrder.forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = bundle.scenarios[key].meta.label;
      selector.appendChild(option);
    });
    selector.value = currentScenarioKey;
  }

  function drawMassCanvas() {
    const scenario = currentScenario();
    const params = scenario.params;
    const lowerShare = params.lower_system_mass / params.total_mass;
    const upperShare = params.upper_body_mass / params.total_mass;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "rgba(241, 251, 255, 1)");
    bg.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#16303b";
    ctx.font = "700 22px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("Two-Segment Rider Model", 42, 42);

    const centerX = 240;
    const baseY = 350;
    ctx.strokeStyle = "rgba(22, 48, 59, 0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, 52);
    ctx.lineTo(centerX, baseY);
    ctx.stroke();

    ctx.fillStyle = "#16303b";
    ctx.fillRect(centerX - 90, baseY, 180, 16);

    const lowerHeight = 120;
    const upperHeight = 144;
    const hipY = baseY - 124;
    ctx.strokeStyle = "#0f7c90";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(centerX, baseY);
    ctx.lineTo(centerX, hipY);
    ctx.stroke();

    ctx.strokeStyle = "#f26d3d";
    ctx.beginPath();
    ctx.moveTo(centerX, hipY);
    ctx.lineTo(centerX, hipY - upperHeight);
    ctx.stroke();

    ctx.fillStyle = "#0f7c90";
    ctx.beginPath();
    ctx.arc(centerX, baseY - params.lower_com_height * 210, 15 + 22 * lowerShare, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f26d3d";
    ctx.beginPath();
    ctx.arc(centerX, baseY - params.upper_com_height * 210, 15 + 22 * upperShare, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#16303b";
    ctx.beginPath();
    ctx.arc(centerX, hipY - upperHeight - 22, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "600 16px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillStyle = "#0f7c90";
    ctx.fillText("Lower system: board + legs", 330, 126);
    ctx.fillText(
      `${params.lower_system_mass.toFixed(1)} kg, COM ${params.lower_com_height.toFixed(2)} m`,
      330,
      150,
    );
    ctx.fillStyle = "#f26d3d";
    ctx.fillText("Upper body about the hip joint", 330, 212);
    ctx.fillText(
      `${params.upper_body_mass.toFixed(1)} kg, COM ${params.upper_com_height.toFixed(2)} m`,
      330,
      236,
    );
    ctx.fillStyle = "#16303b";
    ctx.fillText(`theta_eff = phi + alpha eta`, 330, 296);
    ctx.fillText(`alpha = ${params.hip_com_weight.toFixed(2)}`, 330, 320);
    ctx.fillText(`I_phi = ${params.roll_inertia.toFixed(2)}, I_eta = ${params.hip_inertia.toFixed(2)}`, 330, 344);

    ctx.fillStyle = "#5f7a84";
    ctx.fillText("phi is lower-body lean, eta is torso rotation relative to the lower body.", 42, 430);
  }

  function renderScenario() {
    const scenario = currentScenario();
    const params = scenario.params;
    const path = scenario.pathConfig;
    const disturbance = scenario.scenarioConfig;

    document.getElementById("metricSlope").textContent = `${params.slope_angle_deg.toFixed(1)} deg`;
    document.getElementById("metricSpeed").textContent = `${params.nominal_speed.toFixed(1)} m/s`;
    document.getElementById("metricMass").textContent = `${params.total_mass.toFixed(1)} kg`;
    document.getElementById("metricAlpha").textContent = params.hip_com_weight.toFixed(2);

    description.textContent = scenario.meta.description;
    pills.innerHTML = `
      <span>Path amplitude ${path.amplitude.toFixed(2)} m</span>
      <span>Turn spacing ${path.wavelength.toFixed(1)} m</span>
      <span>Upper-body share ${(100 * scenario.meta.upperBodyMassShare).toFixed(0)}%</span>
    `;

    operatingGrid.innerHTML = cardHTML([
      { label: "Slope Angle", value: `${params.slope_angle_deg.toFixed(1)} deg` },
      { label: "Nominal Speed", value: `${params.nominal_speed.toFixed(1)} m/s` },
      { label: "Path Amplitude", value: `${path.amplitude.toFixed(2)} m` },
      { label: "Turn Spacing", value: `${path.wavelength.toFixed(1)} m` },
    ]);

    massGrid.innerHTML = cardHTML([
      { label: "Lower System", value: `${params.lower_system_mass.toFixed(1)} kg` },
      { label: "Upper Body", value: `${params.upper_body_mass.toFixed(1)} kg` },
      { label: "alpha", value: params.hip_com_weight.toFixed(2) },
      { label: "Hip-to-Roll Ratio", value: params.hip_to_roll_ratio.toFixed(2) },
    ]);

    limitsGrid.innerHTML = cardHTML([
      { label: "Torque Limit", value: `${params.torque_limit.toFixed(0)} Nm` },
      { label: "Roll Limit", value: `${params.roll_angle_limit_deg.toFixed(1)} deg` },
      { label: "Hip Limit", value: `${params.hip_angle_limit_deg.toFixed(1)} deg` },
      { label: "Edge Limit", value: `${params.edge_angle_limit_deg.toFixed(1)} deg` },
      {
        label: "Low-Grip Zone",
        value: `${disturbance.grip_loss_start.toFixed(0)} m to ${disturbance.grip_loss_end.toFixed(0)} m`,
      },
      {
        label: "Disturbance Times",
        value: `gust ${disturbance.gust_time.toFixed(1)} s, edge ${disturbance.push_time.toFixed(1)} s`,
      },
    ]);

    drawMassCanvas();
  }

  selector.addEventListener("change", (event) => {
    currentScenarioKey = event.target.value;
    renderScenario();
  });

  populateSelector();
  renderScenario();
})();
