(function () {
  const bundle = window.SNOWBOARD_DEMO_DATA;
  if (!bundle) {
    throw new Error("demo_data.js did not load");
  }

  const sceneCanvas = document.getElementById("sceneCanvas");
  const telemetryCanvas = document.getElementById("telemetryCanvas");

  const sceneCtx = sceneCanvas.getContext("2d");
  const telemetryCtx = telemetryCanvas.getContext("2d");

  const playButton = document.getElementById("playButton");
  const restartButton = document.getElementById("restartButton");
  const timeSlider = document.getElementById("timeSlider");
  const scenarioSelect = document.getElementById("scenarioSelect");
  const timeLabel = document.getElementById("timeLabel");
  const statusPill = document.getElementById("statusPill");

  let currentScenarioKey = bundle.defaultScenarioKey;
  let currentTime = 0;
  let isPlaying = false;
  let previousStamp = null;
  const recoveryStroke = "rgba(47, 176, 113, 0.92)";
  const recoveryGlow = "rgba(47, 176, 113, 0.20)";
  const recoveryFill = "rgba(47, 176, 113, 0.14)";

  function currentScenario() {
    return bundle.scenarios[currentScenarioKey];
  }

  function currentTimeSeries() {
    return currentScenario().time;
  }

  function currentDt() {
    const series = currentTimeSeries();
    return series.length > 1 ? series[1] - series[0] : 0.02;
  }

  function currentFinalTime() {
    const series = currentTimeSeries();
    return series[series.length - 1];
  }

  function transientConfig(kind) {
    if (kind === "gust") {
      return {
        activeRadius: 0.35,
        recoveryDuration: 1.1,
        label: "gust",
      };
    }
    if (kind === "edge_upset") {
      return {
        activeRadius: 0.25,
        recoveryDuration: 1.35,
        label: "heading upset",
      };
    }
    return null;
  }

  function eventToIndex(eventTime) {
    return clamp(Math.round(eventTime / currentDt()), 0, currentTimeSeries().length - 1);
  }

  function activeTransient(frameTime) {
    const scenario = currentScenario();
    for (const event of scenario.events) {
      const config = transientConfig(event.kind);
      if (!config) {
        continue;
      }
      if (Math.abs(frameTime - event.time) < config.activeRadius) {
        return { event, config };
      }
    }
    return null;
  }

  function recoveryTransient(frameTime) {
    const scenario = currentScenario();
    for (const event of scenario.events) {
      const config = transientConfig(event.kind);
      if (!config) {
        continue;
      }
      const start = event.time + config.activeRadius;
      const end = start + config.recoveryDuration;
      if (frameTime >= start && frameTime <= end) {
        return { event, config, start, end };
      }
    }
    return null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
  }

  function deg(rad) {
    return (rad * 180) / Math.PI;
  }

  function seriesValue(section, key, t) {
    const scenario = currentScenario();
    const series = scenario[section][key];
    const time = currentTimeSeries();
    if (series.length === 1) {
      return series[0];
    }

    const dt = currentDt();
    const index = clamp(Math.floor(t / dt), 0, series.length - 2);
    const alpha = (t - time[index]) / dt;
    return lerp(series[index], series[index + 1], alpha);
  }

  function sampleFrame(t) {
    const scenario = currentScenario();
    return {
      time: t,
      x: seriesValue("states", "x", t),
      y: seriesValue("states", "y", t),
      psi: seriesValue("states", "psi", t),
      speed: seriesValue("states", "speed", t),
      phi: seriesValue("states", "phi", t),
      eta: seriesValue("states", "eta", t),
      torque: seriesValue("control", "torque", t),
      grip: seriesValue("derived", "grip", t),
      lateralError: seriesValue("derived", "lateral_error", t),
      edgeAngle: seriesValue("derived", "edge_angle", t),
      edgeFromLean: seriesValue("derived", "edge_from_lean", t),
      edgeFromHip: seriesValue("derived", "edge_from_hip", t),
      torsoAngle: seriesValue("derived", "torso_angle", t),
      rollImpulse: seriesValue("derived", "roll_impulse", t),
      yawPush: seriesValue("derived", "yaw_push", t),
      terrainRollMoment: seriesValue("derived", "terrain_roll_moment", t),
      refY: seriesValue("reference", "y", t),
      refPhi: seriesValue("reference", "phi", t),
      refEta: seriesValue("reference", "eta", t),
      refEdgeFromLean: seriesValue("reference", "edge_from_lean", t),
      refEdgeFromHip: seriesValue("reference", "edge_from_hip", t),
    };
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function worldToScreen(x, y, viewport, width, height) {
    return {
      x: ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * width,
      y: height - ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * height,
    };
  }

  function headingToScreenAngle(psi, viewport, width, height) {
    const screenXPerMeter = width / (viewport.yMax - viewport.yMin);
    const screenYPerMeter = height / (viewport.xMax - viewport.xMin);
    return Math.atan2(-Math.cos(psi) * screenYPerMeter, Math.sin(psi) * screenXPerMeter);
  }

  function populateScenarioSelect() {
    bundle.scenarioOrder.forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = bundle.scenarios[key].meta.label;
      scenarioSelect.appendChild(option);
    });
    scenarioSelect.value = currentScenarioKey;
  }

  function updateScenarioText() {
    const scenario = currentScenario();
    document.getElementById("heroTitle").textContent = "Live Carve Tracking";
    document.getElementById("scenarioTag").textContent = scenario.meta.label;
  }

  function updateMetricCards() {
    const metrics = currentScenario().metrics;
    document.getElementById("rmseValue").textContent = `${metrics.rmse_lateral_m.toFixed(2)} m`;
    document.getElementById("edgeValue").textContent = `${metrics.peak_edge_deg.toFixed(1)} deg`;
    document.getElementById("torqueValue").textContent = `${metrics.peak_torque_nm.toFixed(0)} Nm`;
    document.getElementById("speedValue").textContent = `${metrics.average_speed_mps.toFixed(1)} m/s`;
  }

  function resetTimeline(autoplay = true) {
    currentTime = 0;
    isPlaying = autoplay;
    playButton.textContent = isPlaying ? "Pause" : "Play";
    timeSlider.max = String(currentTimeSeries().length - 1);
    timeSlider.value = "0";
  }

  function setScenario(key) {
    currentScenarioKey = key;
    updateScenarioText();
    updateMetricCards();
    resetTimeline(true);
    render();
  }

  function updateLiveReadout(frame) {
    document.getElementById("liveSpeed").textContent = `${frame.speed.toFixed(2)} m/s`;
    document.getElementById("liveLean").textContent = `${deg(frame.phi).toFixed(1)} deg`;
    document.getElementById("liveHip").textContent = `${deg(frame.eta).toFixed(1)} deg`;
    document.getElementById("liveEdge").textContent = `${deg(frame.edgeAngle).toFixed(1)} deg`;
    document.getElementById("liveError").textContent = `${frame.lateralError.toFixed(2)} m`;
    document.getElementById("liveTorque").textContent = `${frame.torque.toFixed(0)} Nm`;

    const scenario = currentScenario();
    const activeLowGrip = scenario.events.find(
      (event) =>
        event.kind === "low_grip_patch" && frame.x >= event.x_start && frame.x <= event.x_end,
    );
    const activeEvent = activeTransient(frame.time);
    const recoveryEvent = recoveryTransient(frame.time);

    if (activeEvent?.event.kind === "gust") {
      statusPill.textContent = "Cross-slope gust";
    } else if (activeEvent?.event.kind === "edge_upset") {
      statusPill.textContent = "Heading upset";
    } else if (recoveryEvent) {
      statusPill.textContent = `Recovering from ${recoveryEvent.config.label}`;
    } else if (activeLowGrip) {
      statusPill.textContent = "Crossing low-grip snow";
    } else {
      statusPill.textContent = "Stable carve tracking";
    }
  }

  function drawScene(frame) {
    const scenario = currentScenario();
    const pathSamples = scenario.pathSamples;
    const width = sceneCanvas.width;
    const height = sceneCanvas.height;
    const viewport = {
      xMin: Math.max(frame.x - 28, 0),
      xMax: frame.x + 52,
      yMin: -5.7,
      yMax: 5.7,
    };

    sceneCtx.clearRect(0, 0, width, height);
    const sky = sceneCtx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#dff4ff");
    sky.addColorStop(1, "#f8fcff");
    sceneCtx.fillStyle = sky;
    sceneCtx.fillRect(0, 0, width, height);

    const lowGripPatch = scenario.events.find((event) => event.kind === "low_grip_patch");
    if (lowGripPatch) {
      const patchTopY = worldToScreen(lowGripPatch.x_end, 0, viewport, width, height).y;
      const patchBottomY = worldToScreen(lowGripPatch.x_start, 0, viewport, width, height).y;
      sceneCtx.fillStyle = "rgba(173, 224, 255, 0.28)";
      sceneCtx.fillRect(0, patchTopY, width, patchBottomY - patchTopY);
      sceneCtx.fillStyle = "#0f7c90";
      sceneCtx.font = "700 16px Avenir Next, Trebuchet MS, sans-serif";
      sceneCtx.fillText("Low-grip zone", 18, Math.max(36, patchTopY + 24));
    }

    sceneCtx.save();
    sceneCtx.strokeStyle = "rgba(12, 124, 144, 0.08)";
    sceneCtx.lineWidth = 1;
    for (let gx = Math.ceil(viewport.xMin / 8) * 8; gx <= viewport.xMax; gx += 8) {
      const start = worldToScreen(gx, viewport.yMin, viewport, width, height);
      const end = worldToScreen(gx, viewport.yMax, viewport, width, height);
      sceneCtx.beginPath();
      sceneCtx.moveTo(start.x, start.y);
      sceneCtx.lineTo(end.x, end.y);
      sceneCtx.stroke();
    }
    for (let gy = viewport.yMin; gy <= viewport.yMax; gy += 1) {
      const start = worldToScreen(viewport.xMin, gy, viewport, width, height);
      const end = worldToScreen(viewport.xMax, gy, viewport, width, height);
      sceneCtx.beginPath();
      sceneCtx.moveTo(start.x, start.y);
      sceneCtx.lineTo(end.x, end.y);
      sceneCtx.stroke();
    }
    sceneCtx.restore();

    const visiblePath = pathSamples.filter(
      (sample) => sample.x >= viewport.xMin - 6 && sample.x <= viewport.xMax + 6,
    );
    sceneCtx.save();
    sceneCtx.lineWidth = 6;
    sceneCtx.lineCap = "round";
    sceneCtx.strokeStyle = "rgba(15, 124, 144, 0.25)";
    sceneCtx.beginPath();
    visiblePath.forEach((sample, index) => {
      const point = worldToScreen(sample.x, sample.y, viewport, width, height);
      if (index === 0) {
        sceneCtx.moveTo(point.x, point.y);
      } else {
        sceneCtx.lineTo(point.x, point.y);
      }
    });
    sceneCtx.stroke();
    sceneCtx.restore();

    const activeIndex = clamp(Math.floor(frame.time / currentDt()), 0, currentTimeSeries().length - 1);
    const trailStart = Math.max(0, activeIndex - 140);
    sceneCtx.save();
    sceneCtx.lineWidth = 7;
    sceneCtx.lineCap = "round";
    sceneCtx.strokeStyle = "rgba(242, 109, 61, 0.94)";
    sceneCtx.beginPath();
    for (let index = trailStart; index <= activeIndex; index += 1) {
      const point = worldToScreen(
        scenario.states.x[index],
        scenario.states.y[index],
        viewport,
        width,
        height,
      );
      if (index === trailStart) {
        sceneCtx.moveTo(point.x, point.y);
      } else {
        sceneCtx.lineTo(point.x, point.y);
      }
    }
    sceneCtx.stroke();
    sceneCtx.restore();

    const recoveryInfo = recoveryTransient(frame.time);
    if (recoveryInfo) {
      const startIndex = Math.max(trailStart, eventToIndex(recoveryInfo.start));
      const endIndex = Math.min(activeIndex, eventToIndex(recoveryInfo.end));
      if (endIndex > startIndex) {
        sceneCtx.save();
        sceneCtx.lineCap = "round";
        sceneCtx.strokeStyle = recoveryGlow;
        sceneCtx.lineWidth = 16;
        sceneCtx.beginPath();
        for (let index = startIndex; index <= endIndex; index += 1) {
          const point = worldToScreen(
            scenario.states.x[index],
            scenario.states.y[index],
            viewport,
            width,
            height,
          );
          if (index === startIndex) {
            sceneCtx.moveTo(point.x, point.y);
          } else {
            sceneCtx.lineTo(point.x, point.y);
          }
        }
        sceneCtx.stroke();

        sceneCtx.strokeStyle = recoveryStroke;
        sceneCtx.lineWidth = 8;
        sceneCtx.beginPath();
        for (let index = startIndex; index <= endIndex; index += 1) {
          const point = worldToScreen(
            scenario.states.x[index],
            scenario.states.y[index],
            viewport,
            width,
            height,
          );
          if (index === startIndex) {
            sceneCtx.moveTo(point.x, point.y);
          } else {
            sceneCtx.lineTo(point.x, point.y);
          }
        }
        sceneCtx.stroke();
        sceneCtx.restore();
      }
    }

    scenario.events.forEach((event) => {
      if (event.kind === "low_grip_patch") {
        return;
      }
      if (event.x < viewport.xMin || event.x > viewport.xMax) {
        return;
      }
      const point = worldToScreen(event.x, event.y, viewport, width, height);
      sceneCtx.fillStyle = event.kind === "gust" ? "rgba(241, 187, 82, 0.95)" : "rgba(242, 109, 61, 0.95)";
      sceneCtx.beginPath();
      sceneCtx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      sceneCtx.fill();

      sceneCtx.fillStyle = "#16303b";
      sceneCtx.font = "600 16px Avenir Next, Trebuchet MS, sans-serif";
      sceneCtx.fillText(event.label, point.x + 12, point.y - 8);
    });

    const boardPoint = worldToScreen(frame.x, frame.y, viewport, width, height);
    const boardAngle = headingToScreenAngle(frame.psi, viewport, width, height);

    sceneCtx.save();
    sceneCtx.translate(boardPoint.x + 4, boardPoint.y + 7);
    sceneCtx.rotate(boardAngle);
    sceneCtx.fillStyle = "rgba(18, 48, 59, 0.12)";
    roundedRectPath(sceneCtx, -42, -8, 84, 16, 8);
    sceneCtx.fill();
    sceneCtx.restore();

    sceneCtx.save();
    sceneCtx.translate(boardPoint.x, boardPoint.y);
    sceneCtx.rotate(boardAngle);
    sceneCtx.fillStyle = "#16303b";
    roundedRectPath(sceneCtx, -42, -8, 84, 16, 8);
    sceneCtx.fill();
    sceneCtx.fillStyle = "#f26d3d";
    roundedRectPath(sceneCtx, -34, -4, 68, 8, 4);
    sceneCtx.fill();
    sceneCtx.fillStyle = "#ffffff";
    sceneCtx.beginPath();
    sceneCtx.arc(0, 0, 9, 0, Math.PI * 2);
    sceneCtx.fill();
    sceneCtx.restore();

    const gustEvent = scenario.events.find((event) => event.kind === "gust");
    if (gustEvent && Math.abs(frame.time - gustEvent.time) < 0.35) {
      const pulse = 28 + 22 * Math.sin((frame.time - gustEvent.time) * 18);
      sceneCtx.strokeStyle = "rgba(241, 187, 82, 0.55)";
      sceneCtx.lineWidth = 4;
      sceneCtx.beginPath();
      sceneCtx.arc(boardPoint.x, boardPoint.y, pulse, 0, Math.PI * 2);
      sceneCtx.stroke();
    }

    const edgeEvent = scenario.events.find((event) => event.kind === "edge_upset");
    if (edgeEvent && Math.abs(frame.time - edgeEvent.time) < 0.25) {
      const ring = 24 + 16 * Math.sin((frame.time - edgeEvent.time) * 22);
      sceneCtx.strokeStyle = "rgba(242, 109, 61, 0.55)";
      sceneCtx.lineWidth = 4;
      sceneCtx.beginPath();
      sceneCtx.arc(boardPoint.x, boardPoint.y, ring, 0, Math.PI * 2);
      sceneCtx.stroke();
    }

    drawPoseInset(frame, width, height);

    sceneCtx.fillStyle = "rgba(255, 255, 255, 0.93)";
    roundedRectPath(sceneCtx, 22, 22, 330, 84, 18);
    sceneCtx.fill();
    sceneCtx.fillStyle = "#16303b";
    sceneCtx.font = "700 20px Avenir Next, Trebuchet MS, sans-serif";
    sceneCtx.fillText(scenario.meta.label, 42, 52);
    sceneCtx.font = "500 15px Avenir Next, Trebuchet MS, sans-serif";
    sceneCtx.fillStyle = "#5f7a84";
    sceneCtx.fillText("Orange = actual path. Teal = target path.", 42, 80);
    sceneCtx.fillText("Blue = low grip. Gold / orange = disturbances.", 42, 100);

    if (recoveryInfo) {
      sceneCtx.fillStyle = recoveryFill;
      roundedRectPath(sceneCtx, 22, 116, 180, 40, 16);
      sceneCtx.fill();
      sceneCtx.fillStyle = "#1c6d47";
      sceneCtx.font = "700 15px Avenir Next, Trebuchet MS, sans-serif";
      sceneCtx.fillText("Recovery window", 42, 141);
    }
  }

  function drawPoseInset(frame, width, height) {
    const inset = { x: width - 280, y: 28, w: 238, h: 220 };
    modelCard(sceneCtx, inset.x, inset.y, inset.w, inset.h);

    sceneCtx.fillStyle = "#16303b";
    sceneCtx.font = "700 18px Avenir Next, Trebuchet MS, sans-serif";
    sceneCtx.fillText("Rider Posture", inset.x + 18, inset.y + 30);

    const groundY = inset.y + 164;
    sceneCtx.strokeStyle = "rgba(22, 48, 59, 0.28)";
    sceneCtx.lineWidth = 3;
    sceneCtx.beginPath();
    sceneCtx.moveTo(inset.x + 22, groundY + 18);
    sceneCtx.lineTo(inset.x + inset.w - 24, groundY - 18);
    sceneCtx.stroke();

    const baseX = inset.x + 110;
    const baseY = groundY - 6;
    const boardTilt = -frame.phi;
    const torsoTilt = -(frame.phi + frame.eta);

    sceneCtx.save();
    sceneCtx.translate(baseX, baseY);
    sceneCtx.rotate(boardTilt);
    sceneCtx.strokeStyle = "#16303b";
    sceneCtx.lineWidth = 6;
    sceneCtx.beginPath();
    sceneCtx.moveTo(-48, 0);
    sceneCtx.lineTo(48, 0);
    sceneCtx.stroke();
    sceneCtx.restore();

    const hipX = baseX;
    const hipY = baseY - 28;
    sceneCtx.strokeStyle = "#0f7c90";
    sceneCtx.lineWidth = 6;
    sceneCtx.beginPath();
    sceneCtx.moveTo(baseX, baseY);
    sceneCtx.lineTo(hipX, hipY);
    sceneCtx.stroke();

    const shoulderX = hipX + 54 * Math.sin(torsoTilt);
    const shoulderY = hipY - 54 * Math.cos(torsoTilt);
    sceneCtx.strokeStyle = "#f26d3d";
    sceneCtx.lineWidth = 7;
    sceneCtx.beginPath();
    sceneCtx.moveTo(hipX, hipY);
    sceneCtx.lineTo(shoulderX, shoulderY);
    sceneCtx.stroke();
    sceneCtx.fillStyle = "#16303b";
    sceneCtx.beginPath();
    sceneCtx.arc(shoulderX, shoulderY - 13, 10, 0, Math.PI * 2);
    sceneCtx.fill();

    sceneCtx.fillStyle = "#5f7a84";
    sceneCtx.font = "600 14px Avenir Next, Trebuchet MS, sans-serif";
    sceneCtx.fillText(`Lean = ${deg(frame.phi).toFixed(1)} deg`, inset.x + 18, inset.y + 194);
    sceneCtx.fillText(`Torso = ${deg(frame.eta).toFixed(1)} deg`, inset.x + 126, inset.y + 194);
    sceneCtx.fillText(`Edge = ${deg(frame.edgeAngle).toFixed(1)} deg`, inset.x + 18, inset.y + 214);
  }

  function modelCard(ctx, x, y, width, height) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    roundedRectPath(ctx, x, y, width, height, 18);
    ctx.fill();
    ctx.restore();
  }

  function drawTelemetry(frame) {
    const scenario = currentScenario();
    const width = telemetryCanvas.width;
    const height = telemetryCanvas.height;
    telemetryCtx.clearRect(0, 0, width, height);
    telemetryCtx.fillStyle = "rgba(255, 255, 255, 0.94)";
    telemetryCtx.fillRect(0, 0, width, height);

    const strips = [
      {
        label: "Path Error",
        actual: scenario.derived.lateral_error,
        reference: null,
        color: "#f26d3d",
        scale: 2.2,
      },
      {
        label: "Lean",
        actual: scenario.states.phi,
        reference: scenario.reference.phi,
        color: "#0f7c90",
        scale: 0.55,
      },
      {
        label: "Torso",
        actual: scenario.states.eta,
        reference: scenario.reference.eta,
        color: "#0aa7b6",
        scale: 0.45,
      },
      {
        label: "Hip Torque",
        actual: scenario.control.torque,
        reference: null,
        color: "#f1bb52",
        scale: 120,
      },
    ];

    strips.forEach((strip, stripIndex) => {
      const top = 16 + stripIndex * 58;
      const centerY = top + 24;
      const usableHeight = 32;

      scenario.events.forEach((event) => {
        const config = transientConfig(event.kind);
        if (!config) {
          return;
        }
        const startTime = event.time + config.activeRadius;
        const endTime = startTime + config.recoveryDuration;
        const xStart = 96 + ((width - 114) * startTime) / currentFinalTime();
        const xEnd = 96 + ((width - 114) * endTime) / currentFinalTime();
        telemetryCtx.fillStyle = recoveryFill;
        telemetryCtx.fillRect(xStart, top + 4, Math.max(0, xEnd - xStart), usableHeight + 4);
      });

      telemetryCtx.strokeStyle = "rgba(22, 48, 59, 0.12)";
      telemetryCtx.lineWidth = 1;
      telemetryCtx.beginPath();
      telemetryCtx.moveTo(96, centerY);
      telemetryCtx.lineTo(width - 18, centerY);
      telemetryCtx.stroke();

      telemetryCtx.fillStyle = "#16303b";
      telemetryCtx.font = "700 14px Avenir Next, Trebuchet MS, sans-serif";
      telemetryCtx.fillText(strip.label, 18, centerY - 6);

      const drawLine = (series, color, alpha) => {
        if (!series) {
          return;
        }
        telemetryCtx.strokeStyle = color;
        telemetryCtx.globalAlpha = alpha;
        telemetryCtx.lineWidth = 2.5;
        telemetryCtx.beginPath();
        for (let index = 0; index < currentTimeSeries().length; index += 1) {
          const x = 96 + ((width - 114) * index) / (currentTimeSeries().length - 1);
          const y = centerY - (series[index] / strip.scale) * usableHeight;
          if (index === 0) {
            telemetryCtx.moveTo(x, y);
          } else {
            telemetryCtx.lineTo(x, y);
          }
        }
        telemetryCtx.stroke();
        telemetryCtx.globalAlpha = 1;
      };

      drawLine(strip.reference, "rgba(22, 48, 59, 0.24)", 1);
      drawLine(strip.actual, strip.color, 1);
    });

    const cursorX = 96 + ((width - 114) * frame.time) / currentFinalTime();
    telemetryCtx.strokeStyle = "#16303b";
    telemetryCtx.lineWidth = 2;
    telemetryCtx.beginPath();
    telemetryCtx.moveTo(cursorX, 10);
    telemetryCtx.lineTo(cursorX, height - 12);
    telemetryCtx.stroke();

    telemetryCtx.fillStyle = "#1c6d47";
    telemetryCtx.font = "700 13px Avenir Next, Trebuchet MS, sans-serif";
    telemetryCtx.fillText("Green bands = recovery windows", width - 250, 18);
  }

  function render() {
    const frame = sampleFrame(currentTime);
    updateLiveReadout(frame);
    timeSlider.value = String(Math.round(currentTime / currentDt()));
    timeLabel.textContent = `${currentTime.toFixed(2)} s`;
    drawScene(frame);
    drawTelemetry(frame);
  }

  function tick(timestamp) {
    if (previousStamp === null) {
      previousStamp = timestamp;
    }

    if (isPlaying) {
      const elapsed = (timestamp - previousStamp) / 1000;
      currentTime += elapsed;
      if (currentTime >= currentFinalTime()) {
        currentTime = currentFinalTime();
        isPlaying = false;
        playButton.textContent = "Play";
      }
    }

    previousStamp = timestamp;
    render();
    requestAnimationFrame(tick);
  }

  playButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playButton.textContent = isPlaying ? "Pause" : "Play";
  });

  restartButton.addEventListener("click", () => {
    resetTimeline(true);
    render();
  });

  timeSlider.addEventListener("input", (event) => {
    currentTime = Number(event.target.value) * currentDt();
    render();
  });

  scenarioSelect.addEventListener("change", (event) => {
    setScenario(event.target.value);
  });

  populateScenarioSelect();
  setScenario(currentScenarioKey);
  requestAnimationFrame(tick);
})();
