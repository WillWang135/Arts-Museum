/* ============================================================
   LED TITLE RING
   A dot-matrix strip wrapped into a full circle above the
   feature wall. The title repeats as many times as will fit,
   so short names fill the loop and long ones stay readable.
   ============================================================ */
const LED_VIEW = 2 / 3;              // fraction of the strip the ring shows

function ledTitleTexture(title) {
  const text = (title || "Student Art Museum").toUpperCase();
  /* 4096x512 keeps the strip at 8:1, which is the ratio the ring geometry
     below is built to. Matching the two is what stops the text stretching. */
  const W = 4096, H = 512;
  const PITCH = 10;                      // spacing of the LED dots
  const DOT = PITCH - 3;
  const measure = document.createElement("canvas").getContext("2d");

  /* shrink the type until one copy plus a clear gap fits the loop */
  let font = 300, tw = 0;
  for (;;) {
    measure.font = "800 " + font + "px Helvetica, Arial, sans-serif";
    tw = measure.measureText(text).width;
    if (tw <= W * 0.84 || font <= 96) break;
    font -= 8;
  }

  const gap = Math.max(320, font * 1.35);
  const repeats = Math.max(1, Math.floor(W / (tw + gap)));
  const slot = W / repeats;

  /* 1. the lit characters, on their own layer */
  const lit = cvs(W, H), lx = lit.getContext("2d");
  lx.font = "800 " + font + "px Helvetica, Arial, sans-serif";
  lx.textAlign = "center";
  lx.textBaseline = "middle";
  lx.fillStyle = "#FFFFFF";
  for (let i = 0; i < repeats; i++) lx.fillText(text, slot * (i + 0.5), H / 2 + 4);

  /* 2. punch the dot grid through them so the glyphs read as LEDs */
  lx.globalCompositeOperation = "destination-out";
  lx.fillStyle = "#000";
  for (let y = 0; y < H; y += PITCH) lx.fillRect(0, y + DOT, W, PITCH - DOT);
  for (let x = 0; x < W; x += PITCH) lx.fillRect(x + DOT, 0, PITCH - DOT, H);
  lx.globalCompositeOperation = "source-over";

  /* 3. compose: dark panel, unlit dots, then the lit text over the top */
  const c = cvs(W, H), x = c.getContext("2d");
  const bandTop = H * (1 - LED_VIEW) / 2, bandH = H * LED_VIEW;
  x.fillStyle = "#0A0D10"; x.fillRect(0, 0, W, H);
  const bg = x.createLinearGradient(0, bandTop, 0, bandTop + bandH);
  bg.addColorStop(0, "#0A0D10"); bg.addColorStop(0.5, "#12171B"); bg.addColorStop(1, "#080A0C");
  x.fillStyle = bg; x.fillRect(0, bandTop, W, bandH);

  x.fillStyle = "rgba(255,255,255,.05)";
  for (let yy = 0; yy < H; yy += PITCH) {
    for (let xx = 0; xx < W; xx += PITCH) x.fillRect(xx, yy, DOT, DOT);
  }

  x.shadowColor = "rgba(255,196,92,.95)"; x.shadowBlur = 30;
  x.globalAlpha = 0.92; x.drawImage(lit, 0, 0);
  x.shadowBlur = 12; x.globalAlpha = 1; x.drawImage(lit, 0, 0);
  x.shadowBlur = 0;

  /* amber wash over the lit pixels only */
  x.globalCompositeOperation = "source-atop";
  const warm = x.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, "rgba(255,218,142,.30)");
  warm.addColorStop(1, "rgba(255,168,52,.30)");
  x.fillStyle = warm; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over";

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  /* Show only the middle band of the strip. The panel gets shorter and the
     letters fill far more of it, while the pixels-per-metre stay square in
     both directions, which is what keeps the type from stretching. */
  t.repeat.set(1, LED_VIEW);
  t.offset.set(0, (1 - LED_VIEW) / 2);
  return { map: t, repeats: repeats, aspect: (W / H) / LED_VIEW };
}

function buildTitleRing(title) {
  const built = ledTitleTexture(title);
  const R = 3.0;
  /* height derived from the texture ratio, so letters keep their true shape */
  const H = (2 * Math.PI * R) / built.aspect;
  const Y = 6.9;

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, H, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: built.map, side: THREE.DoubleSide, toneMapped: false }));
  ring.position.y = Y;
  root.add(ring);

  /* a soft bloom sleeve so the letters throw light into the room */
  const glowMap = built.map.clone();
  glowMap.needsUpdate = true;
  glowMap.wrapS = glowMap.wrapT = THREE.RepeatWrapping;
  glowMap.repeat = built.map.repeat;
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.055, R + 0.055, H + 0.2, 96, 1, true),
    new THREE.MeshBasicMaterial({
      map: glowMap, side: THREE.DoubleSide, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
  glow.position.y = Y;
  root.add(glow);
  glowMap.offset = built.map.offset;               // share the scroll

  /* brass rims and slender hangers up to the ceiling */
  [Y + H / 2 + 0.045, Y - H / 2 - 0.045].forEach(y => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.035, 0.045, 10, 72), MAT.brass);
    rim.rotation.x = Math.PI / 2; rim.position.y = y; rim.castShadow = true; root.add(rim);
  });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const len = Math.max(0.2, G.WALL_H - Y - H / 2 - 0.12);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 8), MAT.brass);
    rod.position.set(Math.cos(a) * R, Y + H / 2 + len / 2, Math.sin(a) * R);
    root.add(rod);
  }

  Anim.ticker = { map: built.map, glow: glow, speed: 0.055 };
}
