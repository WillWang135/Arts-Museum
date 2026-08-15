/* ============================================================
   FLOORPLAN DRAWING (hero + minimap)
   ============================================================ */
function drawFloorplan(ctx, w, h, o) {
  o = o || {};
  const dark = !!o.dark;
  const pad = dark ? 10 : 26;
  const reach = G.APO + G.WING_LEN + 1.5;
  const s = Math.min((w - pad * 2) / (reach * 2), (h - pad * 2) / (reach * 2));
  const X = v => w / 2 + v * s, Z = v => h / 2 + v * s;

  ctx.clearRect(0, 0, w, h);
  const ink = dark ? "rgba(255,255,255,.92)" : "#15181B";
  const soft = dark ? "rgba(255,255,255,.26)" : "#DCDDD7";
  const fill = dark ? "rgba(255,255,255,.07)" : "#F4F4F0";

  const n = State.art.filter(a => !a.featured).length;
  const layout = computeLayout(Math.max(n, 1));
  const open = layout.open;
  const step = Math.PI * 2 / G.SEG;

  /* wings / alcoves as floor plates */
  WING_DIR.forEach((u, k) => {
    const v = { x: -u.z, z: u.x };
    const isWing = open[k];
    const L = isWing ? G.WING_LEN : G.ALCOVE_D;
    const halfW = isWing ? G.WING_HALF : G.ALCOVE_HALF;
    const a = { x: u.x * G.APO + v.x * halfW, z: u.z * G.APO + v.z * halfW };
    const b = { x: u.x * (G.APO + L) + v.x * halfW, z: u.z * (G.APO + L) + v.z * halfW };
    const c = { x: u.x * (G.APO + L) - v.x * halfW, z: u.z * (G.APO + L) - v.z * halfW };
    const d = { x: u.x * G.APO - v.x * halfW, z: u.z * G.APO - v.z * halfW };
    ctx.beginPath();
    ctx.moveTo(X(a.x), Z(a.z)); ctx.lineTo(X(b.x), Z(b.z));
    ctx.lineTo(X(c.x), Z(c.z)); ctx.lineTo(X(d.x), Z(d.z)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = dark ? 1 : 1.6; ctx.stroke();
  });

  /* rotunda floor */
  ctx.beginPath();
  for (let i = 0; i < G.SEG; i++) {
    const a = (i + 0.5) * step;
    const px = X(Math.cos(a) * G.R), pz = Z(Math.sin(a) * G.R);
    i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz);
  }
  ctx.closePath();
  ctx.fillStyle = dark ? "rgba(255,255,255,.1)" : "#FFFFFF";
  ctx.fill();

  /* rotunda walls, skipping doorways */
  ctx.lineWidth = dark ? 1.4 : 2.4; ctx.strokeStyle = ink; ctx.lineCap = "butt";
  for (let i = 0; i < G.SEG; i++) {
    const a0 = (i - 0.5) * step, a1 = (i + 0.5) * step;
    const isDoor = DOOR_SEGS.indexOf(i) !== -1;
    const p0 = { x: Math.cos(a0) * G.R, z: Math.sin(a0) * G.R };
    const p1 = { x: Math.cos(a1) * G.R, z: Math.sin(a1) * G.R };
    if (!isDoor) {
      ctx.beginPath(); ctx.moveTo(X(p0.x), Z(p0.z)); ctx.lineTo(X(p1.x), Z(p1.z)); ctx.stroke();
    } else {
      const j0 = { x: p0.x + (p1.x - p0.x) * 0.16, z: p0.z + (p1.z - p0.z) * 0.16 };
      const j1 = { x: p0.x + (p1.x - p0.x) * 0.84, z: p0.z + (p1.z - p0.z) * 0.84 };
      ctx.beginPath(); ctx.moveTo(X(p0.x), Z(p0.z)); ctx.lineTo(X(j0.x), Z(j0.z)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(j1.x), Z(j1.z)); ctx.lineTo(X(p1.x), Z(p1.z)); ctx.stroke();
      ctx.save();
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = soft;
      ctx.beginPath(); ctx.moveTo(X(j0.x), Z(j0.z)); ctx.lineTo(X(j1.x), Z(j1.z)); ctx.stroke();
      ctx.restore();
    }
  }

  /* feature wall */
  ctx.save();
  ctx.fillStyle = "#F2B233";
  ctx.fillRect(X(-4.5), Z(-0.45), 9 * s, 0.9 * s);
  ctx.strokeStyle = dark ? "rgba(0,0,0,.4)" : "#B8811A"; ctx.lineWidth = 1;
  ctx.strokeRect(X(-4.5), Z(-0.45), 9 * s, 0.9 * s);
  ctx.restore();

  /* hanging positions */
  if (State.art.length) {
    ctx.fillStyle = dark ? "#7FE0CE" : "#0E4C44";
    layout.slots.slice(0, n).forEach(sl => {
      ctx.beginPath();
      ctx.arc(X(sl.x + sl.nx * 0.4), Z(sl.z + sl.nz * 0.4), dark ? 2.2 : 3.6, 0, 6.3);
      ctx.fill();
    });
  }

  /* decor markers */
  if (!dark) {
    ctx.fillStyle = "#DCDDD7";
    [45, 135, 225, 315].forEach(deg => {
      const a = deg * Math.PI / 180;
      ctx.beginPath(); ctx.arc(X(Math.cos(a) * 9.4), Z(Math.sin(a) * 9.4), 4, 0, 6.3); ctx.fill();
    });
  }

  /* visitor */
  if (o.player) {
    const px = X(o.player.x), pz = Z(o.player.z), ang = o.player.yaw;
    ctx.save();
    ctx.translate(px, pz); ctx.rotate(ang);
    ctx.fillStyle = "#F2B233";
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4.6); ctx.lineTo(-5, -4.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
