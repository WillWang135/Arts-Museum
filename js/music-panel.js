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

/* ============================================================
   THE FEATURE-WALL PLAYLIST
   Every other strip works one track. The one on the feature wall
   works the whole museum: previous, play, next, and a mode that
   decides what happens when a song runs out.
   ============================================================ */
const PLAYLIST_BAY_W = 404;        /* wide enough for a transport row and a key row */
const PLAYLIST_MODES = ["order", "repeat", "shuffle"];
const PLAYLIST_LABEL = { order: "IN ORDER", repeat: "REPEAT", shuffle: "SHUFFLE" };
/* said as a sentence, for the hint that appears when a key is looked at */
const PLAYLIST_HINT = {
  order:   "Play the tracks in order",
  repeat:  "Repeat this track",
  shuffle: "Shuffle the tracks",
};
const Playlist = { mode: "shuffle", history: [] };   /* shuffle by default */

function playlistTracks() {
  return State.art.filter(a => artKind(a) === "audio" && a.media);
}
function featurePanel() {
  for (let i = 0; i < MusicPanels.length; i++) {
    if (MusicPanels[i].isPlaylist) return MusicPanels[i];
  }
  return null;
}

/* Repeat is the only mode that wants the element looping on its own; the
   other two need the clip to end so there is something to act on. Every
   other track in the museum keeps looping as it always did. */
function applyPlaylistLoop(rec) {
  Object.keys(MediaEls).forEach(id => { MediaEls[id].el.loop = true; });
  if (!rec || !rec.art) return;
  const e = MediaEls[rec.art.id];
  if (e) e.el.loop = (Playlist.mode === "repeat");
}

/* Swap the track the feature strip is working. Title, waveform, clock and
   buttons all come from rec.art, so they follow from this one assignment;
   the picture on the wall only changes if the new track brought one of its
   own, rather than dropping a generic sleeve over a hanging artwork. */
function playlistLoad(rec, art, remember, forcePlay) {
  if (!rec || !art) return;
  const shouldPlay = forcePlay === undefined ? mediaPlaying(rec.art) : forcePlay;

  if (art === rec.art) {                    /* only one track: start it over */
    const same = mediaEntry(art);
    if (same) { try { same.el.currentTime = 0; } catch (err) {} }
    if (shouldPlay) playMedia(art);
    rec.lastDraw = -1;
    return;
  }

  if (remember && rec.art) Playlist.history.push(rec.art.id);
  pauseMedia(rec.art);

  rec.art = art;
  rec.env = waveEnvelope(art.name || String(art.id));
  rec.titleStrip = null;                    /* rebuilt at the new title's width */
  rec.lastDraw = -1;

  const e = mediaEntry(art);
  if (e) { try { e.el.currentTime = 0; } catch (err) {} }

  if (hasCover(art)) setFramePicture(rec.host, art.cover);
  else restoreFramePicture(rec.host);

  applyPlaylistLoop(rec);
  refreshMediaControls(art.id);
  if (shouldPlay) playMedia(art);
  needsRender = true;
}

function playlistNext(rec, auto) {
  const list = playlistTracks();
  if (!rec || !list.length) return;
  let want;
  if (Playlist.mode === "shuffle" && list.length > 1) {
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (list[i] === rec.art);
    want = list[i];
  } else {
    const cur = list.indexOf(rec.art);
    want = list[(cur + 1 + list.length) % list.length];
  }
  playlistLoad(rec, want, true, auto ? true : undefined);
}

/* Previous walks the history rather than the running order, so in shuffle it
   returns to what actually played instead of drawing another random card. */
function playlistPrev(rec) {
  const list = playlistTracks();
  if (!rec || !list.length) return;
  while (Playlist.history.length) {
    /* Pop once, into a variable. Inside the find predicate this ran for every
       artwork in the museum, draining the history and comparing against a
       different id each time - so Previous quietly fell through to stepping
       the running order instead of retracing what was actually played. */
    const id = Playlist.history.pop();
    const back = State.art.find(a => a.id === id);
    if (back && back !== rec.art) { playlistLoad(rec, back, false); return; }
  }
  const cur = list.indexOf(rec.art);
  playlistLoad(rec, list[(cur - 1 + list.length) % list.length], false);
}

function setPlaylistMode(rec, mode) {
  if (PLAYLIST_MODES.indexOf(mode) === -1) return;
  Playlist.mode = mode;
  applyPlaylistLoop(rec);
  if (rec) rec.lastDraw = -1;
  toast("Playback: " + PLAYLIST_LABEL[mode].toLowerCase());
  needsRender = true;
}
function cyclePlaylistMode(rec) {
  const i = PLAYLIST_MODES.indexOf(Playlist.mode);
  setPlaylistMode(rec, PLAYLIST_MODES[(i + 1) % PLAYLIST_MODES.length]);
}

/* A clip only reaches its end when it is not looping, which is to say when
   the feature strip is in order or shuffle. */
function onMediaEnded(artId) {
  const rec = featurePanel();
  if (!rec || !rec.art || rec.art.id !== artId) return;
  if (Playlist.mode === "repeat") return;
  playlistNext(rec, true);
}

/* One description of the strip's geometry, in canvas pixels, read by both
   the drawing and the invisible planes you aim at - so a button is always
   exactly where it looks. */
function panelLayout(rec) {
  const canvasH = Math.round(1024 / PANEL_ASPECT);
  const bayW = rec.isPlaylist ? PLAYLIST_BAY_W : BAY_W;
  const bx = PANEL_PAD, by = PANEL_PAD;
  const bw = 1024 - PANEL_PAD * 2, bh = canvasH - PANEL_PAD * 2;
  const cy = canvasH / 2;
  const divX = bx + bayW;
  const colX = divX + GUTTER;
  const colRight = bx + bw - 26;

  /* The playlist bay carries two rows: the transport above, and the mode
     and queue keys beneath it. Moving those off the title line is what
     gives a long song name the width it was short of. */
  const transportY = rec.isPlaylist ? by + 88 : cy;
  const buttons = rec.isPlaylist
    ? [{ name: "prev", cx: bx + bayW * 0.20, cy: transportY, r: 37 },
       { name: "play", cx: bx + bayW * 0.50, cy: transportY, r: 45 },
       { name: "next", cx: bx + bayW * 0.80, cy: transportY, r: 37 }]
    : [{ name: "play", cx: bx + bayW / 2, cy: cy, r: 47 }];

  const smallY = by + bh - 62;
  const keys = rec.isPlaylist
    ? [{ name: "mode", mode: "repeat",  cx: bx + bayW * 0.145, cy: smallY, r: 25 },
       { name: "mode", mode: "order",   cx: bx + bayW * 0.382, cy: smallY, r: 25 },
       { name: "mode", mode: "shuffle", cx: bx + bayW * 0.618, cy: smallY, r: 25 },
       { name: "queue",                 cx: bx + bayW * 0.855, cy: smallY, r: 25 }]
    : [];

  const CLOCK_W = 96;
  return { canvasH, bayW, bx, by, bw, bh, cy, divX, colX, colRight,
           colW: colRight - colX, buttons, keys,
           titleRoom: (colRight - colX) - CLOCK_W - 20 };
}

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
const TITLE_GAP = 130;                /* clear air between one repeat and the next */

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

  /* One continuous loop rather than a run-and-reset: the name is drawn
     twice, a gap apart, and the pair slides by exactly one repeat before
     wrapping. Because the second copy is already in view when the first
     leaves, the wrap lands on identical pixels and never shows as a jump. */
  const cycleW = full + TITLE_GAP;
  const offset = ((t * SCROLL_SPEED) % cycleW + cycleW) % cycleW;
  paint(sx, -offset);
  paint(sx, -offset + cycleW);

  /* a brass lozenge sitting in each gap, so it is obvious where one
     repetition ends and the next begins */
  const diamond = cx => {
    if (cx < -14 || cx > s.width + 14) return;
    sx.save();
    sx.translate(cx, stripH / 2); sx.rotate(Math.PI / 4);
    sx.fillStyle = "rgba(" + GOLD + ",.55)";
    sx.fillRect(-4, -4, 8, 8);
    sx.restore();
  };
  diamond(-offset + full + TITLE_GAP / 2);
  diamond(-offset + full + TITLE_GAP / 2 - cycleW);

  /* soften both ends so letters arrive and leave rather than being sliced */
  sx.globalCompositeOperation = "destination-out";
  const fade = 26;
  const g1 = sx.createLinearGradient(0, 0, fade, 0);
  g1.addColorStop(0, "rgba(0,0,0,1)"); g1.addColorStop(1, "rgba(0,0,0,0)");
  sx.fillStyle = g1; sx.fillRect(0, 0, fade, stripH);
  const g2 = sx.createLinearGradient(s.width - fade, 0, s.width, 0);
  g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "rgba(0,0,0,1)");
  sx.fillStyle = g2; sx.fillRect(s.width - fade, 0, fade, stripH);
  sx.globalCompositeOperation = "source-over";

  x.drawImage(s, left, baseY - stripH / 2);

  /* a hairline at the left margin, marking where the title area starts */
  x.fillStyle = "rgba(" + GOLD + ",.45)";
  x.fillRect(left - 11, baseY - 13, 2.5, 26);
}

/* A round brass-ringed key in the bay. The middle one is play or pause; the
   outer two step through the playlist. */
function drawBayButton(x, b, cyIgnored, playing) {
  const cy = b.cy;
  x.beginPath(); x.arc(b.cx, cy, b.r, 0, 6.3);
  x.fillStyle = "rgba(255,226,170,.10)";
  x.fill();
  x.lineWidth = 2;
  x.strokeStyle = "rgba(" + GOLD + "," + (b.name === "play" ? 0.55 : 0.38) + ")";
  x.stroke();

  x.fillStyle = "rgba(255,240,214," + (b.name === "play" ? 0.95 : 0.8) + ")";
  x.shadowColor = "rgba(255,206,130,.5)";
  x.shadowBlur = b.name === "play" ? 8 : 5;

  const tri = (cx, dir, w, h) => {
    x.beginPath();
    x.moveTo(cx - dir * w / 2, cy - h / 2);
    x.lineTo(cx + dir * w / 2, cy);
    x.lineTo(cx - dir * w / 2, cy + h / 2);
    x.closePath(); x.fill();
  };

  if (b.name === "play") {
    if (playing) {
      x.fillRect(b.cx - 12, cy - 16, 8.5, 32);
      x.fillRect(b.cx + 3.5, cy - 16, 8.5, 32);
    } else {
      tri(b.cx + 3, 1, 26, 34);
    }
  } else if (b.name === "next") {
    tri(b.cx - 4, 1, 16, 22);
    tri(b.cx + 7, 1, 16, 22);
    x.fillRect(b.cx + 14, cy - 11, 3.5, 22);
  } else {
    tri(b.cx + 4, -1, 16, 22);
    tri(b.cx - 7, -1, 16, 22);
    x.fillRect(b.cx - 17.5, cy - 11, 3.5, 22);
  }
  x.shadowBlur = 0;
}

/* The mode and queue keys: the icons a music player uses, at a size that
   still reads on a wall. Only the mode in force is lit, so which one is
   active is apparent without a word of explanation. */
function drawPanelKey(x, k) {
  const active = k.name === "mode" && Playlist.mode === k.mode;
  const cy = k.cy, r = k.r;

  if (active) {
    x.beginPath(); x.arc(k.cx, cy, r, 0, 6.3);
    x.fillStyle = "rgba(" + GOLD + ",.22)";
    x.fill();
    x.lineWidth = 1.6;
    x.strokeStyle = "rgba(" + GOLD + ",.72)";
    x.stroke();
  }

  const on = active ? 0.98 : 0.42;
  x.strokeStyle = "rgba(" + GOLD + "," + on + ")";
  x.fillStyle = "rgba(" + GOLD + "," + on + ")";
  x.lineWidth = 2.6;
  x.lineCap = "round";
  x.lineJoin = "round";
  if (active) { x.shadowColor = "rgba(255,206,130,.55)"; x.shadowBlur = 7; }

  const up = (px, py) => {
    x.beginPath();
    x.moveTo(px - 5, py + 5);
    x.lineTo(px, py - 4);
    x.lineTo(px + 5, py + 5);
    x.closePath(); x.fill();
  };
  const down = (px, py) => {
    x.beginPath();
    x.moveTo(px - 5, py - 5);
    x.lineTo(px, py + 4);
    x.lineTo(px + 5, py - 5);
    x.closePath(); x.fill();
  };
  const arrow = (px, py, dir) => {
    x.beginPath();
    x.moveTo(px - dir * 5, py - 5);
    x.lineTo(px + dir * 4, py);
    x.lineTo(px - dir * 5, py + 5);
    x.closePath(); x.fill();
  };

  if (k.mode === "repeat") {
    /* A loop broken at two corners, each end turning back on itself. The
       first attempt closed the loop and read as a plain box on the wall;
       the two arrowheads are what say "round again". */
    x.beginPath();
    x.moveTo(k.cx - 7, cy - 8); x.lineTo(k.cx + 6, cy - 8);
    x.arcTo(k.cx + 11, cy - 8, k.cx + 11, cy - 3, 5);
    x.lineTo(k.cx + 11, cy - 1); x.stroke();
    down(k.cx + 11, cy + 3);
    x.beginPath();
    x.moveTo(k.cx + 7, cy + 8); x.lineTo(k.cx - 6, cy + 8);
    x.arcTo(k.cx - 11, cy + 8, k.cx - 11, cy + 3, 5);
    x.lineTo(k.cx - 11, cy + 1); x.stroke();
    up(k.cx - 11, cy - 3);
  } else if (k.mode === "order") {
    /* a list read straight down: the arrow points down the running order,
       which is what tells it apart from the queue key beside it. */
    [-7, 0, 7].forEach(dy => {
      x.beginPath();
      x.moveTo(k.cx - 12, cy + dy);
      x.lineTo(k.cx + 2, cy + dy);
      x.stroke();
    });
    x.beginPath(); x.moveTo(k.cx + 9, cy - 9); x.lineTo(k.cx + 9, cy + 4); x.stroke();
    down(k.cx + 9, cy + 10);
  } else if (k.mode === "shuffle") {
    /* two paths crossing: anything next */
    x.beginPath(); x.moveTo(k.cx - 11, cy - 7); x.lineTo(k.cx + 4, cy + 7); x.stroke();
    x.beginPath(); x.moveTo(k.cx - 11, cy + 7); x.lineTo(k.cx + 4, cy - 7); x.stroke();
    arrow(k.cx + 8, cy - 7, 1);
    arrow(k.cx + 8, cy + 7, 1);
  } else {
    /* queue: a list of tracks, each with its own mark - a shape no mode key
       uses, so the one button that opens something is never mistaken for
       one that changes how the music runs. */
    [-8, 0, 8].forEach(dy => {
      x.beginPath(); x.arc(k.cx - 11, cy + dy, 1.9, 0, 6.3); x.fill();
      x.beginPath(); x.moveTo(k.cx - 4, cy + dy); x.lineTo(k.cx + 11, cy + dy); x.stroke();
    });
  }
  x.shadowBlur = 0;
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
  const L = panelLayout(rec);
  const cy = L.cy;
  L.buttons.forEach(b => drawBayButton(x, b, cy, playing));

  const divX = L.divX;
  const dv = x.createLinearGradient(0, by + 22, 0, by + bh - 22);
  dv.addColorStop(0, "rgba(" + GOLD + ",0)");
  dv.addColorStop(0.5, "rgba(" + GOLD + ",.38)");
  dv.addColorStop(1, "rgba(" + GOLD + ",0)");
  x.fillStyle = dv;
  x.fillRect(divX, by + 22, 1.5, bh - 44);

  /* ---- the right-hand column ---- */
  const colX = L.colX;
  const colW = L.colW;
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
  /* mode and queue keys live in the bay, beside the transport */
  L.keys.forEach(k => drawPanelKey(x, k));

  /* Fixed reserves rather than measured ones, so the title never has to
     reflow because a clock ticked from 0:59 to 1:00. */
  const room = L.titleRoom;
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
  /* The strip on the feature wall runs the whole museum's music; every other
     one works the single track hanging above it. */
  const isPlaylist = !!hostFrame.isFeature;
  /* The playlist strip is given more width, because it has a transport, four
     keys and a song title to fit - but only enough more that it still reads
     as part of the wall rather than a fascia bolted across it. */
  const width = isPlaylist
    ? Math.max(3.2, hostFrame.OW * 1.22)
    : Math.max(PANEL_W_MIN, hostFrame.OW * 1.04);
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
  const clearance = isPlaylist ? 0.14 : 0.20;   /* the feature wall has a top */
  const y = Math.max(hostFrame.OH / 2 + height / 2 + clearance,
                     wallLineLocal + height / 2 + 0.16);
  panel.position.set(0, y, 0.055);
  panel.renderOrder = 4;
  hostFrame.group.add(panel);

  const rec = { art: art, host: hostFrame, canvas: canvas, tex: tex,
                panel: panel, isPlaylist: isPlaylist, badgeOpacity: 0,
                env: waveEnvelope(art.name || String(art.id)), lastDraw: -1 };

  const L = panelLayout(rec);
  const lx = px => (px / 1024 - 0.5) * width;
  const ly = py => (0.5 - py / L.canvasH) * height;

  /* Everything you press is painted into the strip, so these planes are
     invisible and exist only to be aimed at. Each carries the panel rather
     than a track id: the playlist swaps which song it is working, and the
     buttons have to follow it rather than stay pinned to the first one. */
  const hit = (w, h, cx, cyy, z, data) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), musicHitMaterial());
    m.position.set(cx, y + cyy, z);
    m.userData.frame = hostFrame;
    m.userData.panel = rec;
    Object.keys(data).forEach(k => { m.userData[k] = data[k]; });
    hostFrame.group.add(m);
    Pickables.push(m);
    return m;
  };

  /* the body opens the track; anything in the bay sits in front of it */
  rec.body = hit(width, height, 0, 0, 0.062, { open: true });

  L.buttons.forEach(b => {
    const w = (b.r * 2.1 / 1024) * width;
    const h = (b.r * 2.1 / L.canvasH) * height;
    const key = b.name === "play" ? { control: "play" }
              : b.name === "next" ? { control: "next" } : { control: "prev" };
    const mesh = hit(w, h, lx(b.cx), ly(b.cy), 0.078, key);
    if (b.name === "play") rec.button = mesh;
  });

  /* one target per key, so choosing a mode is a single press rather than
     cycling through the ones you did not want */
  L.keys.forEach(k => {
    const w = (k.r * 2.2 / 1024) * width;
    const h = (k.r * 2.2 / L.canvasH) * height;
    hit(w, h, lx(k.cx), ly(k.cy), 0.078,
        k.name === "queue" ? { control: "queue" } : { control: "mode", mode: k.mode });
  });

  /* A strip over the waveform you can point at to jump through the track.
     Taller than the bars themselves so it is comfortable to hit with a
     reticle or a thumb, without the drawn waveform changing at all. */
  const seekTopPx = L.canvasH - 124, seekBotPx = L.canvasH - 6;
  rec.seek = hit(((L.colRight - L.colX) / 1024) * width,
                 ((seekBotPx - seekTopPx) / L.canvasH) * height,
                 lx((L.colX + L.colRight) / 2), ly((seekTopPx + seekBotPx) / 2),
                 0.070, { seek: true });

  /* And a badge on the work itself, so the track can be started from the
     picture as well as from the strip - whatever that picture happens to be:
     a sleeve, a supplied cover, a drawing it was paired with, or the piece
     on the feature wall. It takes the next place in the frame's control row,
     so a video hosting a track lays all three out side by side. */
  const badge = makeFrameControl(hostFrame, mediaPlaying(art) ? "pause" : "play");
  badge.userData.control = "play";
  badge.userData.frame = hostFrame;
  badge.userData.panel = rec;
  rec.badge = badge;

  if (isPlaylist) applyPlaylistLoop(rec);
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
function planMusic(featured, rest, featuredTrack) {
  const guests = rest.filter(a => artKind(a) === "audio" && !hasCover(a));
  const hangs = rest.filter(a => guests.indexOf(a) === -1);

  /* A track never hosts another track: it already needs that stretch of wall
     for its own strip. Offering one as a host cost it its panel entirely,
     which is why a museum of five songs only ever showed four.

     Pictures are asked before videos. A video already carries a play and a
     mute of its own, so hosting a track puts a third button in the same row
     - it fits, but it is crowded, and there is usually a plain picture
     going spare. */
  const pictures = hangs.filter(a => artKind(a) === "image");
  const videos = hangs.filter(a => artKind(a) === "video");
  const hosts = pictures.concat(videos);
  if (featured && artKind(featured) !== "audio") hosts.push(featured);

  const pairs = {};        /* host artwork id -> the track sitting above it */
  const orphans = [];

  /* A track chosen for the feature wall claims that wall ahead of the queue,
     so the piece standing in for it is the one it ends up above. */
  if (featuredTrack && featured) {
    pairs[featured.id] = featuredTrack;
    const taken = hosts.indexOf(featured);
    if (taken !== -1) hosts.splice(taken, 1);
  }

  guests.forEach(g => {
    const host = hosts.shift();
    if (host) pairs[host.id] = g;
    else orphans.push(g);   /* nothing free: it hangs on its own sleeve */
  });

  return { wall: hangs.concat(orphans), pairs: pairs, orphans: orphans };
}

/* Which works actually take a place on a wall, which is not the same as how
   many artworks there are: a track without a cover sits above another work
   rather than claiming a slot of its own.

   The floorplan and the 3D build must both ask this, or they disagree about
   how big the museum is - the map promising side rooms full of work that the
   museum never builds, because it was counting eight tracks that were only
   ever going to hang above something else. */
/* Featured music still needs something to look at. In order of preference:
   the cover it was given, then a picture from the collection standing in for
   it, and only failing both does it fall back to the sleeve the museum drew.
   The feature wall is the one place a bare music installation reads as an
   oversight rather than a choice. */
function featuredStandIn(track) {
  return State.art.find(a => a !== track && artKind(a) === "image")
      || State.art.find(a => a !== track && artKind(a) === "video")
      || null;
}

function hangingPlan() {
  const chosen = State.art.find(a => a.featured) || State.art[0] || null;
  let featured = chosen, featuredTrack = null;

  if (chosen && artKind(chosen) === "audio" && !hasCover(chosen)) {
    const stand = featuredStandIn(chosen);
    /* nothing to stand in: the track keeps the wall and hangs its own sleeve */
    if (stand) { featured = stand; featuredTrack = chosen; }
  }

  const rest = State.art.filter(a => a !== featured && a !== featuredTrack);
  const music = planMusic(featured, rest, featuredTrack);
  return { featured: featured, featuredTrack: featuredTrack,
           wall: music.wall, pairs: music.pairs };
}
function hangingCount() {
  return hangingPlan().wall.length;
}
