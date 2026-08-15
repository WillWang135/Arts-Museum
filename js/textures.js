/* ============================================================
   PROCEDURAL TEXTURES
   Every surface is drawn to a canvas at run time, so the
   museum ships with no image files at all.
   ============================================================ */
/* ---------- procedural textures ---------- */
function cvs(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/* wide-plank oak, staggered joints */
function woodFloorTexture() {
  const W = 1024, H = 1024, c = cvs(W, H), x = c.getContext("2d");
  const rows = 8, ph = H / rows;
  const tones = [[201, 163, 118], [190, 151, 106], [209, 172, 127], [183, 145, 101], [196, 158, 113]];
  x.fillStyle = "#8C6B47"; x.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) {
    const y0 = r * ph;
    let px = -((r * 149) % 430);
    while (px < W) {
      const len = 280 + ((r * 97 + Math.abs(px) * 13) % 360);
      const t = tones[(r + Math.abs(Math.floor(px / 90))) % tones.length];
      const j = ((r * 31 + Math.abs(px)) % 15) - 7;
      x.fillStyle = "rgb(" + (t[0] + j) + "," + (t[1] + j) + "," + (t[2] + j) + ")";
      x.fillRect(px, y0 + 1.5, len - 3.5, ph - 3);
      x.save();
      x.beginPath(); x.rect(px, y0 + 1.5, len - 3.5, ph - 3); x.clip();
      for (let g = 0; g < 13; g++) {
        x.globalAlpha = 0.06 + Math.random() * 0.08;
        x.strokeStyle = g % 3 === 0 ? "#65482A" : "#E0C193";
        x.lineWidth = 0.6 + (g % 3) * 0.55;
        const gy = y0 + 5 + Math.random() * (ph - 10);
        x.beginPath(); x.moveTo(px - 4, gy);
        for (let s = 1; s <= 6; s++) x.lineTo(px + len * s / 6, gy + (Math.random() - 0.5) * 4.5);
        x.stroke();
      }
      x.globalAlpha = 1; x.restore();
      x.fillStyle = "rgba(70,48,28,.35)";
      x.fillRect(px + len - 3.5, y0 + 1.5, 3.5, ph - 3);
      px += len;
    }
    x.fillStyle = "rgba(74,52,30,.32)";
    x.fillRect(0, y0, W, 1.6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(42, 42);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  return t;
}

/* seamless drifting sky for the rooflights */
let skyBase = null;
function skyTexture() {
  if (!skyBase) {
    const W = 1024, H = 512, c = cvs(W, H), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7FB6E4"); g.addColorStop(0.5, "#AFD5F0"); g.addColorStop(1, "#E4F1FB");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const puffs = [];
    for (let i = 0; i < 13; i++) {
      puffs.push({ x: Math.random() * W, y: 70 + Math.random() * (H - 190), r: 48 + Math.random() * 92, a: 0.30 + Math.random() * 0.34 });
    }
    puffs.forEach(p => {
      [0, W, -W].forEach(off => {
        for (let k = 0; k < 9; k++) {
          const cxp = p.x + off + (Math.random() - 0.5) * p.r * 2.0;
          const cyp = p.y + (Math.random() - 0.5) * p.r * 0.6;
          const pr = p.r * (0.4 + Math.random() * 0.65);
          const rg = x.createRadialGradient(cxp, cyp - pr * 0.15, 0, cxp, cyp, pr);
          rg.addColorStop(0, "rgba(255,255,255," + (p.a * 0.62) + ")");
          rg.addColorStop(0.55, "rgba(252,253,255," + (p.a * 0.22) + ")");
          rg.addColorStop(1, "rgba(250,252,255,0)");
          x.fillStyle = rg;
          x.beginPath(); x.arc(cxp, cyp, pr, 0, 6.3); x.fill();
        }
      });
    });
    skyBase = new THREE.CanvasTexture(c);
    skyBase.encoding = THREE.sRGBEncoding;
    skyBase.anisotropy = maxAniso;
  }
  const t = skyBase.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function radialTexture(stops) {
  const S = 256, c = cvs(S, S), x = c.getContext("2d");
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}
let poolTex = null, blobTex = null;
function poolTexture() {
  if (!poolTex) poolTex = radialTexture([[0, "rgba(255,246,220,.92)"], [0.45, "rgba(255,238,198,.34)"], [1, "rgba(255,236,190,0)"]]);
  return poolTex;
}
function blobTexture() {
  if (!blobTex) blobTex = radialTexture([[0, "rgba(0,0,0,.5)"], [0.55, "rgba(0,0,0,.2)"], [1, "rgba(0,0,0,0)"]]);
  return blobTex;
}

/* The wall label grows to fit what is written on it, up to the width the
   caller allows - a fixed card cut half the titles off. Its height never
   changes, so the type is the same size on every label in the room; only
   the card gets longer. Returns the aspect so the caller can match the mesh.

   maxAspect is how wide the label may get relative to its own height, which
   is how the caller stops a label reaching its neighbours. */
const PLAQUE_H = 180;
const PLAQUE_PAD = 26;
const PLAQUE_MIN_W = 320;

function plaqueTexture(art, num, maxAspect) {
  const measure = cvs(8, 8).getContext("2d");
  const TITLE_F = "700 40px Helvetica, Arial, sans-serif";
  const AUTHOR_F = "italic 30px Georgia, serif";

  const maxW = Math.max(PLAQUE_MIN_W, Math.round(PLAQUE_H * (maxAspect || 3.56)));
  const room = maxW - PLAQUE_PAD * 2;

  /* Trimmed to the room actually available rather than to a fixed number of
     letters, so an ellipsis only appears when one is genuinely needed. */
  const fit = (text, font) => {
    measure.font = font;
    if (measure.measureText(text).width <= room) return text;
    let s = text;
    while (s.length > 1 && measure.measureText(s + "…").width > room) s = s.slice(0, -1);
    return s.replace(/[ ,;:.\-]+$/, "") + "…";
  };

  const title = fit(art.name || "Untitled", TITLE_F);
  const author = fit(art.author || "Student artist", AUTHOR_F);

  measure.font = TITLE_F;
  const tw = measure.measureText(title).width;
  measure.font = AUTHOR_F;
  const aw = measure.measureText(author).width;

  const W = Math.round(Math.min(maxW, Math.max(PLAQUE_MIN_W, Math.max(tw, aw) + PLAQUE_PAD * 2)));
  const c = cvs(W, PLAQUE_H), x = c.getContext("2d");
  x.fillStyle = "#FBF8F1"; x.fillRect(0, 0, W, PLAQUE_H);
  x.strokeStyle = "#C7A85C"; x.lineWidth = 3; x.strokeRect(7, 7, W - 14, PLAQUE_H - 14);
  x.fillStyle = "#0E4C44"; x.font = "600 22px Helvetica, Arial, sans-serif";
  x.fillText(pad3(num), PLAQUE_PAD, 44);
  x.fillStyle = "#15181B"; x.font = TITLE_F;
  x.fillText(title, PLAQUE_PAD, 92);
  x.fillStyle = "#5C6470"; x.font = AUTHOR_F;
  x.fillText(author, PLAQUE_PAD, 138);

  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  return { tex: t, aspect: W / PLAQUE_H };
}

const stickerCache = {};
function stickerTexture(kind) {
  if (stickerCache[kind]) return stickerCache[kind];
  const S = 256, c = cvs(S, S), x = c.getContext("2d");
  x.translate(S / 2, S / 2);
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 14; x.shadowOffsetY = 4;
  const R = 96;
  const outline = () => { x.lineJoin = "round"; x.lineWidth = 12; x.strokeStyle = "#FFFFFF"; x.stroke(); x.shadowColor = "transparent"; x.fill(); };

  if (kind === "flower") {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      x.beginPath();
      x.ellipse(Math.cos(a) * 44, Math.sin(a) * 44, 46, 38, a, 0, Math.PI * 2);
      x.fillStyle = "#F49AC1"; outline();
    }
    x.beginPath(); x.arc(0, 0, 34, 0, 6.3);
    x.fillStyle = "#FFD35C"; x.strokeStyle = "#FFFFFF"; x.lineWidth = 8; x.stroke(); x.fill();
  } else if (kind === "heart") {
    x.beginPath();
    x.moveTo(0, R * 0.86);
    x.bezierCurveTo(-R * 1.35, R * 0.1, -R * 0.78, -R * 1.02, 0, -R * 0.36);
    x.bezierCurveTo(R * 0.78, -R * 1.02, R * 1.35, R * 0.1, 0, R * 0.86);
    x.closePath();
    const g = x.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, "#F2708A"); g.addColorStop(1, "#D63E58");
    x.fillStyle = g; outline();
  } else if (kind === "tick") {
    x.beginPath(); x.arc(0, 0, 88, 0, 6.3);
    const g = x.createLinearGradient(0, -88, 0, 88);
    g.addColorStop(0, "#4FBF69"); g.addColorStop(1, "#2E8F47");
    x.fillStyle = g; outline();
    x.beginPath();
    x.moveTo(-40, 4); x.lineTo(-10, 36); x.lineTo(46, -34);
    x.strokeStyle = "#FFFFFF"; x.lineWidth = 20; x.lineCap = "round"; x.lineJoin = "round"; x.stroke();
  } else {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 42 : 100, a = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    const g = x.createLinearGradient(0, -100, 0, 100);
    g.addColorStop(0, "#FFD980"); g.addColorStop(1, "#EC9E12");
    x.fillStyle = g; outline();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  stickerCache[kind] = t;
  return t;
}

let glowTex = null;
function glowTexture() {
  if (!glowTex) {
    glowTex = radialTexture([[0, "rgba(255,244,210,.85)"], [0.45, "rgba(255,232,170,.28)"], [1, "rgba(255,232,170,0)"]]);
  }
  return glowTex;
}
