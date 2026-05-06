(function () {
  const canvas = document.getElementById("sidecutCanvas");
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
    ctx.lineTo(x2 - 10 * Math.cos(angle - 0.35), y2 - 10 * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - 10 * Math.cos(angle + 0.35), y2 - 10 * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = "600 14px Avenir Next, Trebuchet MS, sans-serif";
      ctx.fillText(label, x2 + 8, y2 - 6);
    }
  }

  function draw(timestamp) {
    const t = timestamp / 1000;
    const edgeAngle = 0.35 + 0.18 * Math.sin(0.9 * t);
    const contactShift = 18 * Math.sin(0.7 * t + 0.4);
    const penetration = 16 + 10 * Math.sin(0.8 * t);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "rgba(241, 251, 255, 1)");
    bg.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#16303b";
    ctx.font = "700 22px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("Top View: Sidecut Geometry", 40, 42);
    ctx.fillText("Cross Section: Edge Bite Into Snow", 600, 42);

    const cx = 270;
    const cy = 290;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "#16303b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -180);
    ctx.bezierCurveTo(54, -130, 38, -46, 28, 0);
    ctx.bezierCurveTo(38, 46, 54, 130, 0, 180);
    ctx.bezierCurveTo(-54, 130, -38, 46, -28, 0);
    ctx.bezierCurveTo(-38, -46, -54, -130, 0, -180);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = "rgba(22, 48, 59, 0.25)";
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, -184);
    ctx.lineTo(0, 184);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(15, 124, 144, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(210, 0, 240, Math.PI * 0.74, Math.PI * 1.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-210, 0, 240, -Math.PI * 0.26, Math.PI * 0.26);
    ctx.stroke();

    ctx.fillStyle = "#0f7c90";
    ctx.beginPath();
    ctx.arc(28, -118 + contactShift, 11, 0, Math.PI * 2);
    ctx.arc(28, 118 - contactShift, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f26d3d";
    ctx.beginPath();
    ctx.arc(-28, -90 + 0.6 * contactShift, 10, 0, Math.PI * 2);
    ctx.arc(-28, 90 - 0.6 * contactShift, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    arrow(364, 210, 430, 172, "#0f7c90", "carved force");
    arrow(318, 144, 392, 116, "#f1bb52", "sidecut radius");
    arrow(188, 290, 188, 214, "#16303b", "velocity");

    ctx.fillStyle = "#5f7a84";
    ctx.font = "600 15px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("Contact points move as the edge length and pressure distribution change.", 40, 478);
    ctx.fillText("A sidecut model uses this geometry instead of one lumped curvature law.", 40, 500);

    const baseX = 780;
    const snowY = 378;
    ctx.strokeStyle = "rgba(22, 48, 59, 0.28)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(590, snowY);
    ctx.lineTo(1020, snowY);
    ctx.stroke();

    ctx.fillStyle = "rgba(173, 224, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(590, snowY);
    ctx.lineTo(1020, snowY);
    ctx.lineTo(1020, 520);
    ctx.lineTo(590, 520);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(baseX, snowY - penetration);
    ctx.rotate(-edgeAngle);
    ctx.fillStyle = "#16303b";
    ctx.fillRect(-110, -9, 220, 18);
    ctx.fillStyle = "#f26d3d";
    ctx.fillRect(-110, 8, 220, 6);
    ctx.restore();

    ctx.strokeStyle = "rgba(15, 124, 144, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(baseX, snowY, 62, -Math.PI / 2, -Math.PI / 2 + edgeAngle, false);
    ctx.stroke();
    ctx.fillStyle = "#0f7c90";
    ctx.font = "600 15px Avenir Next, Trebuchet MS, sans-serif";
    ctx.fillText("edge angle beta", baseX + 52, snowY - 28);

    arrow(baseX + 110, snowY - 84, baseX + 160, snowY - 146, "#0f7c90", "snow normal");
    arrow(baseX - 6, snowY - penetration - 82, baseX - 6, snowY - penetration - 146, "#f26d3d", "load");

    ctx.fillStyle = "#5f7a84";
    ctx.fillText("Penetration and edge angle decide whether the board really bites or washes.", 600, 478);
    ctx.fillText("That turns the low-grip story into a contact-geometry story.", 600, 500);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
