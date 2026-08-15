/* ============================================================
   MUSIC PANEL
   A track is not a picture, so it does not hang in a frame. It
   gets a strip of wall above a work instead: the title, a
   waveform that fills as the track runs, and one button.

   Drawn as light rather than as an object - additive blending,
   no panel behind it, nothing but the marks themselves - so it
   reads as something projected onto the plaster rather than a
   media player screwed to the wall.
   ============================================================ */

const MusicPanels = [];

const PANEL_W_MIN = 1.9;           /* metres - readable from across a room */
const PANEL_ASPECT = 4.2;          /* width : height */
const PANEL_BARS = 56;             /* waveform columns */

/* Every track gets the same waveform shape each time it is built, rather
   than a new random one per rebuild - the wall should not change because
   somebody switched the lighting. Derived from the title. */
function waveEnvelope(seedText) {
  let h = 2166136261;
  for (let i = 0; i < (seedText || "").length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const out = [];
  for (let i = 0; i < PANEL_BARS; i++) {
    const t = i / (PANEL_BARS - 1);
    /* a shallow arch so it reads as a phrase rather than a flat block */
    const arch = 0.42 + 0.58 * Math.sin(Math.PI * t);
    out.push(Math.max(0.12, Math.min(1, arch * (0.45 + rand() * 0.75))));
  }
  return out;
}

function drawMusicPanel(rec, progress, t, playing) {
  const c = rec.canvas, x = c.getContext("2d");
  const W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);

  const padX = 150, padTop = 30;
  const title = (rec.art.name || "Untitled track").toUpperCase();

  /* --- title, letterspaced the way the rest of the museum labels are --- */
  x.font = "600 40px Helvetica, Arial, sans-serif";
  x.textBaseline = "top";
  x.fillStyle = "rgba(255,246,228,.92)";
  x.shadowColor = "rgba(255,226,170,.55)";
  x.shadowBlur = 18;
  let letters = title.slice(0, 34).split("");
  let tx = padX;
  letters.forEach(ch => { x.fillText(ch, tx, padTop); tx += x.measureText(ch).width + 5; });

  /* --- the artist, quieter, on the same line to the right --- */
  if (rec.art.author) {
    x.font = "italic 27px Georgia, serif";
    x.shadowBlur = 10;
    x.fillStyle = "rgba(255,240,214,.5)";
    x.fillText(rec.art.author.slice(0, 26), tx + 24, padTop + 8);
  }

  /* --- waveform --- */
  const baseY = 168, maxH = 84, gap = 4;
  const barW = (W - padX - 90 - PANEL_BARS * gap) / PANEL_BARS;
  const played = Math.max(0, Math.min(1, progress));
  const head = played * PANEL_BARS;

  for (let i = 0; i < PANEL_BARS; i++) {
    const env = rec.env[i];
    /* while it runs, the bars around the playhead lift slightly - just
       enough to look alive, never enough to look like a visualiser */
    const near = playing ? Math.max(0, 1 - Math.abs(i - head) / 7) : 0;
    const breathe = playing ? 1 + 0.16 * Math.sin(t * 3.4 + i * 0.55) * (0.35 + near) : 1;
    const h = Math.max(3, env * maxH * breathe);
    const bx = padX + i * (barW + gap);

    const done = i < head;
    if (done) {
      x.fillStyle = "rgba(255,206,122,.95)";
      x.shadowColor = "rgba(255,190,90,.7)";
      x.shadowBlur = playing ? 16 : 8;
    } else {
      x.fillStyle = "rgba(255,244,224,.24)";
      x.shadowColor = "rgba(255,240,210,.18)";
      x.shadowBlur = 5;
    }
    x.fillRect(bx, baseY - h / 2, Math.max(2, barW), h);
  }

  /* the playhead itself: a hairline, brighter while running */
  const hx = padX + head * (barW + gap);
  x.shadowBlur = 20;
  x.shadowColor = "rgba(255,232,180,.9)";
  x.fillStyle = playing ? "rgba(255,250,238,.95)" : "rgba(255,246,226,.5)";
  x.fillRect(hx - 1.5, baseY - maxH * 0.72, 3, maxH * 1.44);

  x.shadowBlur = 0;
  rec.tex.needsUpdate = true;
}

/* Hangs the strip above a work. The host frame's group carries the wall's
   position and angle, so the panel only has to say how far up it sits. */
function buildMusicPanel(hostFrame, art) {
  const width = Math.max(PANEL_W_MIN, hostFrame.OW * 0.98);
  const height = width / PANEL_ASPECT;

  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 1024 / PANEL_ASPECT;
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = maxAniso;

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,     /* light on plaster, not a screen */
      toneMapped: false
    }));

  /* Clear of the frame and of the brass reveal that runs along the wall at
     3.2 m, so it never collides with either. */
  const wallLine = 3.2 - G.ART_Y;
  const y = Math.max(hostFrame.OH / 2 + height / 2 + 0.20, wallLine + height / 2 + 0.16);
  panel.position.set(0, y, 0.055);
  panel.renderOrder = 4;
  hostFrame.group.add(panel);

  /* the one control, sitting to the left of the title */
  const bs = height * 0.62;
  const btn = new THREE.Mesh(new THREE.PlaneGeometry(bs, bs),
    new THREE.MeshBasicMaterial({
      map: mediaIconTexture(mediaPlaying(art) ? "pause" : "play"),
      transparent: true, depthWrite: false, opacity: 0.92,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));
  btn.position.set(-width / 2 + bs * 0.62, y, 0.075);
  btn.renderOrder = 5;
  btn.userData.control = "play";
  btn.userData.frame = hostFrame;
  btn.userData.mediaArtId = art.id;
  hostFrame.group.add(btn);
  Pickables.push(btn);

  const rec = { art: art, host: hostFrame, canvas: canvas, tex: tex,
                panel: panel, button: btn, env: waveEnvelope(art.name || String(art.id)),
                lastDraw: -1 };
  drawMusicPanel(rec, 0, 0, false);
  MusicPanels.push(rec);
  return rec;
}

/* Repainting a canvas is not free, so it happens about twelve times a
   second while a track runs, and only when something actually changed
   while it is stopped. */
function updateMusicPanels(dt, t) {
  for (let i = 0; i < MusicPanels.length; i++) {
    const rec = MusicPanels[i];
    const e = MediaEls[rec.art.id];
    const playing = !!(e && !e.el.paused);
    const dur = e && e.el.duration ? e.el.duration : 0;
    const progress = dur ? (e.el.currentTime / dur) : 0;

    if (playing) {
      if (t - rec.lastDraw < 0.08) continue;
      rec.lastDraw = t;
      drawMusicPanel(rec, progress, t, true);
      needsRender = true;
    } else if (rec.lastDraw !== -2 || Math.abs((rec.shownProgress || 0) - progress) > 0.002) {
      /* settle into a still frame once, then leave it alone */
      rec.lastDraw = -2;
      rec.shownProgress = progress;
      drawMusicPanel(rec, progress, t, false);
      needsRender = true;
    }
  }
}

function refreshMusicPanel(artId) {
  for (let i = 0; i < MusicPanels.length; i++) {
    const rec = MusicPanels[i];
    if (rec.art.id !== artId) continue;
    rec.button.material.map = mediaIconTexture(mediaPlaying(rec.art) ? "pause" : "play");
    rec.lastDraw = -1;                 /* force a repaint on the next tick */
    needsRender = true;
  }
}

/* ---------- deciding where each track lives ---------- */
/* A track with its own cover hangs like any other work, with the strip
   above it. One without borrows a work already on the wall and sits above
   that instead, so a museum of drawings does not fill up with placeholder
   sleeves. Only when nothing is free does it fall back to hanging its own. */
function planMusic(featured, rest) {
  const guests = rest.filter(a => artKind(a) === "audio" && !hasCover(a));
  const hangs = rest.filter(a => guests.indexOf(a) === -1);

  /* prefer a wall work; the feature wall is a fine host too, just later */
  const hosts = hangs.slice();
  if (featured) hosts.push(featured);

  const pairs = {};        /* host artwork id -> the track sitting above it */
  const orphans = [];
  guests.forEach(g => {
    const host = hosts.shift();
    if (host) pairs[host.id] = g;
    else orphans.push(g);   /* nothing free: it hangs on its own sleeve */
  });

  return { wall: hangs.concat(orphans), pairs: pairs, orphans: orphans };
}
