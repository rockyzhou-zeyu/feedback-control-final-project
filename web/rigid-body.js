(function () {
  const canvas = document.getElementById("rigidBodyCanvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");

  function arrow(x1, y1, x2, y2, color, label) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(angle - 0.35), y2 - 12 * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - 12 * Math.cos(angle + 0.35), y2 - 12 * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = "600 14px Avenir Next, Trebuchet MS, sans-serif";
      ctx.fillText(label, x2 + 8, y2 - 6);
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(timestamp) {
    const t = timestamp / 1000;
    const roll = 0.18 * Math.sin(0.8 * t);
    const hip = 0.1 * Math.cos(0.9 * t + 0.4);
    const yaw = 0.22 * Math.sin(0.55 * t);
    const pitch = 0.09 * Math.cos(0.7 * t + 0.2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "rgba(241, 251, 255, 1)");
    bg.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#16303b";
    ctx.font = "700 22px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("Side / Roll-Pitch View", 40, 42);
    ctx.fillText("Top / Yaw-Contact View", 580, 42);

    const groundY = 390;
    ctx.strokeStyle = "rgba(22, 48, 59, 0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, groundY + 20);
    ctx.lineTo(500, groundY - 26);
    ctx.stroke();

    const baseX = 250;
    const baseY = 350;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(-roll + 0.35 * pitch);
    ctx.fillStyle = "#16303b";
    roundedRect(-92, -10, 184, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#f26d3d";
    roundedRect(-74, -5, 148, 10, 5);
    ctx.fill();
    ctx.restore();

    const hipX = baseX;
    const hipY = baseY - 70;
    const shoulderX = hipX + 78 * Math.sin(-(roll + hip));
    const shoulderY = hipY - 78 * Math.cos(-(roll + hip));

    ctx.strokeStyle = "#0f7c90";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    ctx.strokeStyle = "#f26d3d";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.fillStyle = "#16303b";
    ctx.beginPath();
    ctx.arc(shoulderX, shoulderY - 16, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f7c90";
    ctx.beginPath();
    ctx.arc(baseX, baseY - 42, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f26d3d";
    ctx.beginPath();
    ctx.arc(hipX + 0.52 * (shoulderX - hipX), hipY + 0.52 * (shoulderY - hipY), 12, 0, Math.PI * 2);
    ctx.fill();

    arrow(156, 184, 156, 116, "#16303b", "gravity");
    arrow(180, 386, 180, 316, "#0f7c90", "front normal");
    arrow(320, 370, 320, 304, "#0f7c90", "rear normal");
    arrow(hipX + 16, hipY - 8, hipX + 64, hipY - 34, "#f26d3d", "hip torque");

    ctx.strokeStyle = "rgba(15, 124, 144, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(baseX, baseY - 6, 48, -Math.PI / 2, -Math.PI / 2 + roll, roll < 0);
    ctx.stroke();
    ctx.fillStyle = "#0f7c90";
    ctx.font = "600 15px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("roll", baseX + 48, baseY - 24);

    ctx.strokeStyle = "rgba(242, 109, 61, 0.5)";
    ctx.beginPath();
    ctx.arc(hipX, hipY, 36, -Math.PI / 2 + roll, -Math.PI / 2 + roll + hip, hip < 0);
    ctx.stroke();
    ctx.fillStyle = "#f26d3d";
    ctx.fillText("hip", hipX + 40, hipY - 20);

    ctx.fillStyle = "#5f7a84";
    ctx.font = "600 15px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("Added pitch lets the nose and tail share load differently.", 40, 450);
    ctx.fillText("Added yaw and angular momentum let us model counter-rotation.", 40, 474);

    const topCx = 820;
    const topCy = 282;
    ctx.save();
    ctx.translate(topCx, topCy);
    ctx.rotate(yaw);
    ctx.fillStyle = "rgba(15, 124, 144, 0.08)";
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.bezierCurveTo(45, -106, 38, -40, 28, 0);
    ctx.bezierCurveTo(38, 40, 45, 106, 0, 150);
    ctx.bezierCurveTo(-45, 106, -38, 40, -28, 0);
    ctx.bezierCurveTo(-38, -40, -45, -106, 0, -150);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#16303b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.bezierCurveTo(45, -106, 38, -40, 28, 0);
    ctx.bezierCurveTo(38, 40, 45, 106, 0, 150);
    ctx.bezierCurveTo(-45, 106, -38, 40, -28, 0);
    ctx.bezierCurveTo(-38, -40, -45, -106, 0, -150);
    ctx.closePath();
    ctx.stroke();

    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(22, 48, 59, 0.34)";
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(0, 150);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#0f7c90";
    ctx.beginPath();
    ctx.arc(-30, -86, 12, 0, Math.PI * 2);
    ctx.arc(30, 86, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f26d3d";
    ctx.beginPath();
    ctx.arc(30, -86, 12, 0, Math.PI * 2);
    ctx.arc(-30, 86, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    arrow(topCx + 120, topCy - 110, topCx + 188, topCy - 110, "#16303b", "v");
    arrow(topCx + 20, topCy, topCx + 86, topCy - 62, "#f26d3d", "yaw rate");
    arrow(topCx - 54, topCy - 130, topCx - 128, topCy - 160, "#0f7c90", "front edge force");
    arrow(topCx + 42, topCy + 130, topCx + 116, topCy + 160, "#0f7c90", "rear edge force");

    ctx.fillStyle = "#5f7a84";
    ctx.fillText("Front and rear contacts can engage differently once we model yaw and pitch.", 580, 450);
    ctx.fillText("That is the realism layer missing from the current lumped grip scalar.", 580, 474);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
