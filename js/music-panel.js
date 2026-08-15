/* ============================================================
   MUSIC PANEL
   A track is not a picture, so it does not hang in a frame. It
   gets a strip of wall above a work instead: the title, a
   waveform that fills as the track runs, and one button.

   One component, not four things side by side: a glass case
   with a thin brass edge, a button bay on the left with its own
   divider, then the title and the waveform stacked in what
   remains. Warm gold for the name, a cooler aqua for the
   waveform, so the two read apart at a glance.

   The whole thing is painted to a canvas each tick, which is
   what lets the waveform fill, a long title drift across, and
   the play glyph follow the track - all from one repaint.
   ============================================================ */

const MusicPanels = [];

const PANEL_W_MIN = 2.05;          /* metres - readable from across a room */
const PANEL_ASPECT = 4.0;          /* width : height */
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

/* One component, laid out in fixed zones so nothing can ever collide:
   a button bay on the left, a hairline divider, then the title line and the
   waveform stacked in the space that remains. Long titles are clipped, so
   the divider holds whatever the track is called. */
const PANEL_PAD = 10;
const BAY_W = 184;            /* the button's own area */
const GUTTER = 26;
const GOLD = "244,201,124";   /* title and frame - the museum's brass */
const AQUA = "150,214,201";   /* waveform - viridian's lighter cousin */

/* ---------- the title, and how a long one gets read ---------- */
/* A name that fits is simply drawn. One that does not is eased leftwards at
   a walking pace, held still at each end so you can read the beginning and
   the end properly, then returned to the start. It is drawn onto its own
   strip so both edges can be softened - text that fades out reads as more
   to come, where a hard cut just reads as broken. */
const TITLE_F = "700 38px Helvetica, Arial, sans-serif";
const TITLE_TRACK = 3.2;              /* letterspacing, as elsewhere in the museum */
const SCROLL_SPEED = 33;              /* px per second - a slow drift, not a ticker */
const SCROLL_HOLD_START = 2.2;        /* seconds held at the beginning */
const SCROLL_HOLD_END = 1.3;          /* and at the end, before going back */

function titleWidth(x, text) {
  return text.split("").reduce((w, ch) => w + x.measureText(ch).width + TITLE_TRACK, 0);
}

function drawScrollingTitle(rec, x, left, baseY, room, t) {
  const text = (rec.art.name || "Untitled track").toUpperCase();
  x.font = TITLE_F;
  const full = titleWidth(x, text);

  const paint = (ctx, originX) => {
    ctx.font = TITLE_F;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,196,96,.40)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "rgba(" + GOLD + ",.98)";
    let tx = originX;
    text.split("").forEach(ch => { ctx.fillText(ch, tx, ctx.canvas.height / 2); tx += ctx.measureText(ch).width + TITLE_TRACK; });
    ctx.shadowBlur = 0;
  };

  if (full <= room) {                 /* it fits: leave it still */
    rec.scrolls = false;
    x.save();
    x.textAlign = "left"; x.textBaseline = "middle";
    x.shadowColor = "rgba(255,196,96,.40)"; x.shadowBlur = 5;
    x.fillStyle = "rgba(" + GOLD + ",.98)";
    let tx = left;
    text.split("").forEach(ch => { x.fillText(ch, tx, baseY); tx += x.measureText(ch).width + TITLE_TRACK; });
    x.restore();
    x.shadowBlur = 0;
    return;
  }

  rec.scrolls = true;
  const stripH = 54;
  if (!rec.titleStrip || rec.titleStrip.width !== Math.ceil(room)) {
    rec.titleStrip = document.createElement("canvas");
    rec.titleStrip.width = Math.max(8, Math.ceil(room));
    rec.titleStrip.height = stripH;
  }
  const s = rec.titleStrip, sx = s.getContext("2d");
  sx.clearRect(0, 0, s.width, s.height);

  const travel = full - room;
  const travelTime = travel / SCROLL_SPEED;
  const cycle = SCROLL_HOLD_START + travelTime + SCROLL_HOLD_END;
  const p = ((t % cycle) + cycle) % cycle;
  let offset;
  if (p < SCROLL_HOLD_START) offset = 0;
  else if (p < SCROLL_HOLD_START + travelTime) offset = (p - SCROLL_HOLD_START) * SCROLL_SPEED;
  else offset = travel;

  paint(sx, -offset);

  /* soften both ends of the strip so letters arrive and leave rather than
     being sliced; the left edge only once something has moved past it */
  sx.globalCompositeOperation = "destination-out";
  const fade = 26;
  if (offset > 1) {
    const g1 = sx.createLinearGradient(0, 0, fade, 0);
    g1.addColorStop(0, "rgba(0,0,0,1)"); g1.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = g1; sx.fillRect(0, 0, fade, stripH);
  }
  if (offset < travel - 1) {
    const g2 = sx.createLinearGradient(s.width - fade, 0, s.width, 0);
    g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "rgba(0,0,0,1)");
    sx.fillStyle = g2; sx.fillRect(s.width - fade, 0, fade, stripH);
  }
  sx.globalCompositeOperation = "source-over";

  x.drawImage(s, left, baseY - stripH / 2);

  /* a small brass tick at the left margin: the mark the name starts from,
     so you always know where the beginning is */
  x.fillStyle = "rgba(" + GOLD + "," + (offset > 1 ? 0.8 : 0.35) + ")";
  x.fillRect(left - 11, baseY - 13, 2.5, 26);
}

function drawMusicPanel(rec, progress, t, playing) {
  const c = rec.canvas, x = c.getContext("2d");
  const W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  x.textBaseline = "middle";

  /* ---- the case: glass, with a thin brass edge ---- */
  const bx = PANEL_PAD, by = PANEL_PAD, bw = W - PANEL_PAD * 2, bh = H - PANEL_PAD * 2;
  x.save();
  x.beginPath();
  x.moveTo(bx + 16, by);
  x.arcTo(bx + bw, by, bx + bw, by + bh, 16);
  x.arcTo(bx + bw, by + bh, bx, by + bh, 16);
  x.arcTo(bx, by + bh, bx, by, 16);
  x.arcTo(bx, by, bx + bw, by, 16);
  x.closePath();

  const glass = x.createLinearGradient(0, by, 0, by + bh);
  glass.addColorStop(0, "rgba(30,34,38,.50)");
  glass.addColorStop(1, "rgba(14,18,21,.62)");
  x.fillStyle = glass;
  x.fill();
  x.lineWidth = 2.5;
  x.strokeStyle = "rgba(" + GOLD + ",.42)";
  x.stroke();
  x.clip();
  /* a soft wash of warm light across the top, as if lit from the ceiling */
  const wash = x.createLinearGradient(0, by, 0, by + bh * 0.8);
  wash.addColorStop(0, "rgba(255,222,160,.13)");
  wash.addColorStop(1, "rgba(255,210,140,0)");
  x.fillStyle = wash;
  x.fillRect(bx, by, bw, bh);
  x.restore();

  /* inner hairline, a couple of pixels in - the detail that makes it read
     as made rather than drawn */
  x.save();
  x.beginPath();
  x.moveTo(bx + 7 + 12, by + 7);
  x.arcTo(bx + bw - 7, by + 7, bx + bw - 7, by + bh - 7, 12);
  x.arcTo(bx + bw - 7, by + bh - 7, bx + 7, by + bh - 7, 12);
  x.arcTo(bx + 7, by + bh - 7, bx + 7, by + 7, 12);
  x.arcTo(bx + 7, by + 7, bx + bw - 7, by + 7, 12);
  x.closePath();
  x.lineWidth = 1;
  x.strokeStyle = "rgba(255,238,205,.10)";
  x.stroke();
  x.restore();

  /* ---- button bay, and the divider that keeps it clear ---- */
  const bayCX = bx + BAY_W / 2, cy = H / 2;
  const r = 47;
  x.beginPath(); x.arc(bayCX, cy, r, 0, 6.3);
  x.fillStyle = "rgba(255,226,170,.10)";
  x.fill();
  x.lineWidth = 2;
  x.strokeStyle = "rgba(" + GOLD + ",.55)";
  x.stroke();

  x.fillStyle = "rgba(255,240,214,.95)";
  x.shadowColor = "rgba(255,206,130,.5)";
  x.shadowBlur = 8;
  if (playing) {
    x.fillRect(bayCX - 13, cy - 17, 9, 34);
    x.fillRect(bayCX + 4, cy - 17, 9, 34);
  } else {
    x.beginPath();
    x.moveTo(bayCX - 12, cy - 19); x.lineTo(bayCX + 20, cy); x.lineTo(bayCX - 12, cy + 19);
    x.closePath(); x.fill();
  }
  x.shadowBlur = 0;

  const divX = bx + BAY_W;
  const dv = x.createLinearGradient(0, by + 22, 0, by + bh - 22);
  dv.addColorStop(0, "rgba(" + GOLD + ",0)");
  dv.addColorStop(0.5, "rgba(" + GOLD + ",.38)");
  dv.addColorStop(1, "rgba(" + GOLD + ",0)");
  x.fillStyle = dv;
  x.fillRect(divX, by + 22, 1.5, bh - 44);

  /* ---- the right-hand column ---- */
  const colX = divX + GUTTER;
  const colW = (bx + bw) - colX - 26;
  const titleY = by + 46;

  /* elapsed / total, right-aligned on the title line, so the numbers and the
     name share one baseline rather than floating apart */
  const clock = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    return m + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };
  const e = MediaEls[rec.art.id];
  const dur = e && isFinite(e.el.duration) ? e.el.duration : 0;
  const timeText = clock(dur * progress) + " / " + clock(dur);
  x.font = "500 22px Helvetica, Arial, sans-serif";
  x.textAlign = "right";
  x.fillStyle = "rgba(" + GOLD + ",.55)";
  x.fillText(timeText, colX + colW, titleY);
  const timeW = x.measureText(timeText).width;

  /* Warm gold, and only a whisper of bloom - a strong glow washed straight
     through the letters and made the name hard to read. A name too long for
     the space is drawn onto its own strip and eased across it, rather than
     being cut off where the clock begins. */
  const room = colW - timeW - 26;
  drawScrollingTitle(rec, x, colX, titleY, room, t);

  /* the artist, quieter still, tucked under the name */
  if (rec.art.author) {
    x.font = "italic 21px Georgia, serif";
    x.textAlign = "left";
    x.fillStyle = "rgba(255,236,205,.44)";
    x.fillText(rec.art.author.slice(0, 34), colX, titleY + 32);
  }

  /* ---- waveform ---- */
  const waveY = by + bh - 62, maxH = 84;
  const gap = 3.2;
  const barW = Math.max(2.4, (colW - PANEL_BARS * gap) / PANEL_BARS);
  const played = Math.max(0, Math.min(1, progress));
  const head = played * PANEL_BARS;

  /* a hairline the bars sit on, so the strip has a floor even at the quiet end */
  x.fillStyle = "rgba(" + AQUA + ",.13)";
  x.fillRect(colX, waveY - 0.5, colW, 1);

  for (let i = 0; i < PANEL_BARS; i++) {
    /* two clear registers rather than one even hedge: every third bar is a
       short one, and the envelope varies the rest */
    const minor = (i % 3) === 1;
    const env = rec.env[i] * (minor ? 0.44 : 1);
    const near = playing ? Math.max(0, 1 - Math.abs(i - head) / 6) : 0;
    const breathe = playing ? 1 + 0.20 * Math.sin(t * 3.6 + i * 0.5) * (0.3 + near) : 1;
    const h = Math.max(2.5, env * maxH * breathe);
    const px = colX + i * (barW + gap);
    const done = i < head;

    if (done) {
      x.fillStyle = "rgba(" + AQUA + "," + (minor ? 0.62 : 0.92) + ")";
      x.shadowColor = "rgba(" + AQUA + ",.55)";
      x.shadowBlur = playing ? 9 : 4;
    } else {
      x.fillStyle = "rgba(" + AQUA + "," + (minor ? 0.12 : 0.20) + ")";
      x.shadowBlur = 0;
    }
    x.fillRect(px, waveY - h / 2, barW, h);
  }
  x.shadowBlur = 0;

  /* the playhead: a warm hairline against the cool waveform */
  const hx = colX + head * (barW + gap);
  x.fillStyle = playing ? "rgba(" + GOLD + ",.95)" : "rgba(" + GOLD + ",.45)";
  x.shadowColor = "rgba(255,206,130,.6)";
  x.shadowBlur = playing ? 10 : 0;
  x.fillRect(hx - 1.25, waveY - maxH * 0.66, 2.5, maxH * 1.32);
  x.shadowBlur = 0;

  rec.tex.needsUpdate = true;
}

/* Hangs the strip above a work. The host frame's group carries the wall's
   position and angle, so the panel only has to say how far up it sits. */
function buildMusicPanel(hostFrame, art) {
  const width = Math.max(PANEL_W_MIN, hostFrame.OW * 1.04);
  const height = width / PANEL_ASPECT;

  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = Math.round(1024 / PANEL_ASPECT);
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = maxAniso;

  /* Ordinary alpha, not additive: the case has to be able to sit darker
     than the wall behind it, which is what gives the text something to read
     against. The warmth comes from what is drawn, not from the blend. */
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, toneMapped: false
    }));

  /* Clear of the frame and of the brass reveal along the wall at 3.2 m.
     Measured from the frame's own height, since the feature wall hangs its
     work higher than the rotunda does. */
  const wallLineLocal = 3.2 - (hostFrame.pos ? hostFrame.pos.y : G.ART_Y);
  const y = Math.max(hostFrame.OH / 2 + height / 2 + 0.20,
                     wallLineLocal + height / 2 + 0.16);
  panel.position.set(0, y, 0.055);
  panel.renderOrder = 4;
  hostFrame.group.add(panel);

  /* The button is painted into the panel so it shares the design. These two
     invisible planes are only there to be aimed at: the bay on the left
     works the track, the rest of the strip opens it. */
  const bayCX = (BAY_W / 2 + PANEL_PAD) / 1024 - 0.5;
  const btn = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.115, height * 0.78),
    musicHitMaterial());
  btn.position.set(bayCX * width, y, 0.078);
  btn.userData.control = "play";
  btn.userData.frame = hostFrame;
  btn.userData.mediaArtId = art.id;
  hostFrame.group.add(btn);
  Pickables.push(btn);

  const body = new THREE.Mesh(new THREE.PlaneGeometry(width, height), musicHitMaterial());
  body.position.set(0, y, 0.062);
  body.userData.frame = hostFrame;
  body.userData.openArtId = art.id;
  hostFrame.group.add(body);
  Pickables.push(body);

  /* And a badge on the work itself, so the track can be started from the
     picture as well as from the strip - whatever that picture happens to be:
     a sleeve, a supplied cover, a drawing it was paired with, or the piece
     on the feature wall. It sits bottom-left, where a video's own controls
     never go, so the two can share a frame without colliding. */
  const aw = hostFrame.W || hostFrame.OW, ah = hostFrame.H || hostFrame.OH;
  const bs = Math.min(0.21 * hostFrame.scale, ah * 0.26, aw * 0.19);
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(bs, bs),
    new THREE.MeshBasicMaterial({
      map: mediaIconTexture(mediaPlaying(art) ? "pause" : "play"),
      transparent: true, depthWrite: false, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));
  badge.position.set(-aw / 2 + bs * 0.62, -ah / 2 + bs * 0.66, 0.076);
  badge.renderOrder = 3;
  badge.userData.control = "play";
  badge.userData.frame = hostFrame;
  badge.userData.mediaArtId = art.id;
  hostFrame.group.add(badge);
  Pickables.push(badge);

  const rec = { art: art, host: hostFrame, canvas: canvas, tex: tex,
                panel: panel, button: btn, body: body, badge: badge, badgeOpacity: 0,
                env: waveEnvelope(art.name || String(art.id)), lastDraw: -1 };
  drawMusicPanel(rec, 0, 0, false);
  MusicPanels.push(rec);
  return rec;
}

/* Invisible but pickable. Deliberately not transparent - the picker treats a
   transparent control with no opacity as faded out and ignores it. */
function musicHitMaterial() {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
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

    /* A long name keeps moving whether or not the track is running, so the
       whole title can still be read on a stopped one. */
    if (playing || rec.scrolls) {
      if (t - rec.lastDraw < 0.08) continue;
      rec.lastDraw = t;
      drawMusicPanel(rec, progress, t, playing);
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

/* The play glyph is part of the painting now, so following the track just
   means repainting. This is what keeps the strip and the enlarged view in
   step whichever one you pressed. */
function refreshMusicPanel(artId) {
  for (let i = 0; i < MusicPanels.length; i++) {
    const rec = MusicPanels[i];
    if (rec.art.id !== artId) continue;
    rec.lastDraw = -1;                 /* force a repaint on the next tick */
    if (rec.badge) rec.badge.material.map = mediaIconTexture(mediaPlaying(rec.art) ? "pause" : "play");
    needsRender = true;
  }
}

/* The badge on the picture behaves like a video's controls: out of the way
   until you look at the work, and always present on a touch screen. */
function updateMusicBadgeFade(dt) {
  const touch = isTouchOnly();
  for (let i = 0; i < MusicPanels.length; i++) {
    const rec = MusicPanels[i];
    if (!rec.badge) continue;
    const target = touch ? 0.92 : (hoverFrame === rec.host ? 0.95 : 0);
    rec.badgeOpacity += (target - rec.badgeOpacity) * Math.min(1, dt * 9);
    rec.badge.material.opacity = rec.badgeOpacity;
    rec.badge.visible = rec.badgeOpacity > 0.02;
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

  /* A track never hosts another track: it already needs that stretch of wall
     for its own strip. Offering one as a host cost it its panel entirely,
     which is why a museum of five songs only ever showed four. */
  const hosts = hangs.filter(a => artKind(a) !== "audio");
  if (featured && artKind(featured) !== "audio") hosts.push(featured);

  const pairs = {};        /* host artwork id -> the track sitting above it */
  const orphans = [];
  guests.forEach(g => {
    const host = hosts.shift();
    if (host) pairs[host.id] = g;
    else orphans.push(g);   /* nothing free: it hangs on its own sleeve */
  });

  return { wall: hangs.concat(orphans), pairs: pairs, orphans: orphans };
}
