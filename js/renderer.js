/* ============================================================
   RENDERER  --  bootstrap, quality, the animation loop and
   the per-frame updates that keep the room alive.
   ============================================================ */

/* ---------- spotlights follow the visitor ---------- */
function updateSpots(dt, now) {
  if (now - lastSpot > 220) {
    lastSpot = now;
    const cands = Frames.filter(f => !f.isFeature);
    cands.sort((a, b) => {
      const da = (a.pos.x - Player.x) * (a.pos.x - Player.x) + (a.pos.z - Player.z) * (a.pos.z - Player.z);
      const db = (b.pos.x - Player.x) * (b.pos.x - Player.x) + (b.pos.z - Player.z) * (b.pos.z - Player.z);
      return da - db;
    });
    spotPool.forEach((s, i) => { s.frame = cands[i] || null; });
  }
  spotPool.forEach(s => {
    const want = s.frame ? 3.3 : 0;
    s.light.intensity += (want - s.light.intensity) * Math.min(1, dt * 4);
    if (s.frame) {
      const f = s.frame;
      s.light.position.set(f.pos.x + f.normal.x * 2.35, 4.85, f.pos.z + f.normal.z * 2.35);
      s.light.target.position.set(f.pos.x, f.pos.y - 0.05, f.pos.z);
      s.light.target.updateMatrixWorld();
    }
  });
}

/* ---------- daylight ---------- */
function updateDaylight(dt, t) {
  for (let i = 0; i < Anim.skies.length; i++) {
    const s = Anim.skies[i];
    s.tex.offset.x += s.ux * dt;
    s.tex.offset.y += s.uy * dt;
  }
  for (let i = 0; i < Anim.pools.length; i++) {
    const p = Anim.pools[i];
    p.mesh.position.x = p.x0 + Math.sin(t * 0.07 + p.phase) * 0.95;
    p.mesh.position.z = p.z0 + Math.cos(t * 0.052 + p.phase) * 0.65;
    p.mesh.material.opacity = 0.30 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.19 + p.phase));
  }
  if (Anim.ticker) {
    Anim.ticker.map.offset.x += Anim.ticker.speed * dt;
    if (Anim.ticker.glow) {
      Anim.ticker.glow.material.opacity = 0.26 + 0.09 * (0.5 + 0.5 * Math.sin(t * 1.35));
    }
  }
  for (let i = 0; i < Anim.shafts.length; i++) {
    Anim.shafts[i].material.opacity = 0.040 + 0.018 * (0.5 + 0.5 * Math.sin(t * 0.13));
    Anim.shafts[i].rotation.y = t * 0.011;
  }
}

/* ---------- minimap ---------- */
function paintMinimap() {
  const c = $("minimap");
  if (c.classList.contains("hidden")) return;
  drawFloorplan(c.getContext("2d"), c.width, c.height, {
    dark: true,
    player: { x: Player.x, z: Player.z, yaw: Math.atan2(-Math.cos(Player.yaw), -Math.sin(Player.yaw)) }
  });
}

/* ---------- three bootstrap ---------- */
function initThree() {
  const canvas = $("gl");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.25));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  maxAniso = renderer.capabilities.getMaxAnisotropy();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xE6DDCC);
  scene.fog = new THREE.Fog(0xE9E0D0, 58, 140);

  camera = new THREE.PerspectiveCamera(fov, 1, 0.12, 200);   // tighter range = far more depth precision
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  buildMaterials();
  avatar = buildAvatar();
  resize();
}

function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function applyQuality() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.25));
  renderer.shadowMap.enabled = quality === "high";
  $("quality-btn").innerHTML = "Lighting: <b>" + (quality === "high" ? "High" : "Smooth") + "</b>";
  buildMuseum();
  resize();
}

/* ---------- loop ---------- */
function frameLoop() {
  if (!running) return;
  requestAnimationFrame(frameLoop);
  const dt = Math.min(clock.getDelta(), 0.06);
  const now = performance.now(), t = now / 1000;

  if (!overlayOpen()) stepPlayer(dt);
  updateCamera(dt);
  updateVisitors(dt, t);
  updateSpots(dt, now);
  updateDaylight(dt, t);
  pulseStickers(t, dt);
  tickMediaTextures();          // only whatever is actually moving

  if (now - lastMap > 90) { lastMap = now; paintMinimap(); }

  if (!overlayOpen() && now - lastAim > 90) {
    lastAim = now;
    const hit = castFrom(ndcCenterIfLocked());
    const near = hit && hit.distance < 14;
    hoverFrame = near && hit.frame ? hit.frame : null;
    const r = $("reticle"), hn = $("hint");
    r.classList.toggle("aim", !!near);
    if (near && stamp === "erase" && hit.sticker) hint(hn, "Click to remove this sticker");
    else if (near && hit.control === "play") hint(hn, mediaPlaying(hoverFrame.art) ? "Click to pause" : "Click to play");
    else if (near && hit.control === "mute") hint(hn, mediaMuted(hoverFrame.art) ? "Click for sound" : "Click to mute");
    else if (near && hoverFrame && stamp) hint(hn, "Click to award " + STAMPS[stamp].label.toLowerCase());
    else if (near && hoverFrame) hint(hn, (hoverFrame.art.name || "Untitled") + " — click to read");
    else hn.classList.remove("show");
  }

  renderer.render(scene, camera);
}
function hint(el, text) { if (el.textContent !== text) el.textContent = text; el.classList.add("show"); }
function ndcCenterIfLocked() {
  if (!ndc) return null;
  if (locked || isTouchOnly()) ndc.set(0, 0);
  return ndc;
}
