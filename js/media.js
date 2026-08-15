/* ============================================================
   MEDIA  --  audio and video artworks.

   An artwork record carries three fields that matter here:

     kind    "image" | "audio" | "video"   (absent means image)
     src     what hangs on the wall - the picture, the poster frame
             lifted from a video, or a generated sleeve for a track
     media   the audio or video itself, as a data URL

   Keeping src meaning "the thing on the wall" for every kind is what
   lets the floorplan, the thumbnails, the frames and the save file carry
   on working untouched.

   Nothing ever starts on its own. A clip only plays because somebody
   pressed play, and only one plays at a time, so a room full of videos
   cannot turn into a wall of noise.
   ============================================================ */

const MEDIA_MIME = {
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "video/mp4": "video",
  "video/quicktime": "video"
};
const MEDIA_EXT = { mp3: "audio", mp4: "video", mov: "video" };
const IMAGE_EXT = { png: "image", jpg: "image", jpeg: "image" };

function fileKind(file) {
  const mime = (file.type || "").toLowerCase();
  if (/^image\/(png|jpe?g)$/.test(mime)) return "image";
  if (MEDIA_MIME[mime]) return MEDIA_MIME[mime];
  /* Windows and some phones hand over an empty or odd type, so fall back
     to the extension rather than refusing a file the museum can play. */
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return MEDIA_EXT[ext] || IMAGE_EXT[ext] || null;
}
function artKind(art) { return art && art.kind ? art.kind : "image"; }
function isPlayable(art) { const k = artKind(art); return k === "audio" || k === "video"; }

/* ---------- the live elements ---------- */
/* Keyed by artwork id and kept outside the scene, so rebuilding the museum
   - switching the lighting, say - never interrupts what is playing. */
const MediaEls = {};

function mediaPool() { return $("media-pool"); }

function mediaEntry(art) {
  if (!isPlayable(art) || !art.media) return null;
  const have = MediaEls[art.id];
  if (have) return have;

  const el = document.createElement(artKind(art) === "audio" ? "audio" : "video");
  el.src = art.media;
  el.preload = "metadata";
  el.loop = true;              /* only ever reachable once somebody pressed play */
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.crossOrigin = "anonymous";
  mediaPool().appendChild(el);

  const entry = { art: art, kind: artKind(art), el: el, tex: null, started: false, failed: false };
  el.addEventListener("error", () => { entry.failed = true; refreshMediaControls(art.id); });
  el.addEventListener("play", () => refreshMediaControls(art.id));
  el.addEventListener("pause", () => refreshMediaControls(art.id));
  el.addEventListener("volumechange", () => refreshMediaControls(art.id));
  MediaEls[art.id] = entry;
  return entry;
}

function mediaPlaying(art) {
  const e = MediaEls[art && art.id];
  return !!(e && !e.el.paused && !e.el.ended);
}
function mediaMuted(art) {
  const e = MediaEls[art && art.id];
  return !!(e && e.el.muted);
}

/* ---------- playback, one at a time ---------- */
function pauseAllMedia(exceptId) {
  Object.keys(MediaEls).forEach(id => {
    if (String(id) === String(exceptId)) return;
    const e = MediaEls[id];
    if (!e.el.paused) e.el.pause();
  });
}

function playMedia(art) {
  const e = mediaEntry(art);
  if (!e) return;
  if (e.failed) { toast("This file will not play in this browser"); return; }
  pauseAllMedia(art.id);                       /* never two soundtracks at once */
  e.started = true;
  const p = e.el.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      /* Browsers block sound that the visitor did not ask for. Every call
         here follows a click, so this is rare - but if it happens, say so
         rather than leaving a play button that appears to do nothing. */
      e.failed = true;
      refreshMediaControls(art.id);
      toast("The browser blocked playback — tap the artwork and try again");
    });
  }
  refreshMediaControls(art.id);
}

function pauseMedia(art) {
  const e = MediaEls[art && art.id];
  if (e && !e.el.paused) e.el.pause();
  refreshMediaControls(art && art.id);
}

function toggleMedia(art) {
  if (mediaPlaying(art)) pauseMedia(art);
  else playMedia(art);
}

function toggleMediaMute(art) {
  const e = mediaEntry(art);
  if (!e) return;
  e.el.muted = !e.el.muted;
  toast(e.el.muted ? "Sound off" : "Sound on");
  refreshMediaControls(art.id);
}

/* Called on the way out of the museum, and whenever the artwork list is
   replaced, so nothing carries on playing into a screen that no longer
   shows it. */
function stopAllMedia() {
  Object.keys(MediaEls).forEach(id => {
    const e = MediaEls[id];
    if (!e.el.paused) e.el.pause();
    e.started = false;
  });
}

function disposeMedia(artId) {
  const e = MediaEls[artId];
  if (!e) return;
  e.el.pause();
  e.el.removeAttribute("src");
  e.el.load();
  if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
  if (e.tex) e.tex.dispose();
  delete MediaEls[artId];
}
function disposeAllMedia() {
  Object.keys(MediaEls).forEach(disposeMedia);
}

/* ---------- the picture on the wall ---------- */
/* A video hangs as a live texture: one frame decoded while it is paused,
   refreshed every frame while it plays. Built by hand rather than with
   THREE.VideoTexture, which re-uploads to the GPU on every single frame
   even when nothing is moving. */
function videoTextureFor(art) {
  const e = mediaEntry(art);
  if (!e || e.kind !== "video") return null;
  if (e.tex) return e.tex;

  const t = new THREE.Texture(e.el);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.encoding = THREE.sRGBEncoding;
  /* Rebuilding the museum disposes the textures it made. This one belongs to
     the clip, not to the build, so keep it out of that sweep - otherwise
     changing the lighting leaves every video a black rectangle. */
  KeepTex.add(t);
  e.tex = t;

  /* Nudge it onto the first frame so a paused video shows the picture
     rather than a black rectangle. */
  const show = () => { t.needsUpdate = true; needsRender = true; };
  e.el.addEventListener("loadeddata", show);
  e.el.addEventListener("seeked", show);
  if (e.el.readyState >= 2) show();
  else e.el.addEventListener("loadedmetadata", () => { try { e.el.currentTime = 0.04; } catch (err) {} }, { once: true });
  return t;
}

/* Pushed once per rendered frame: only whatever is actually moving gets
   re-uploaded to the GPU. */
function tickMediaTextures() {
  Object.keys(MediaEls).forEach(id => {
    const e = MediaEls[id];
    if (e.tex && !e.el.paused && e.el.readyState >= 2) e.tex.needsUpdate = true;
  });
}

/* ---------- generated cover art for a track ---------- */
/* An MP3 has no picture, so it gets one: a sleeve in the gallery's own
   palette, drawn the same way every other surface here is. */
function audioCover(title) {
  const W = 640, H = 640, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");

  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#12665B"); g.addColorStop(1, "#0E4C44");
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  x.strokeStyle = "rgba(255,255,255,.10)"; x.lineWidth = 2;
  for (let r = 96; r < 400; r += 26) { x.beginPath(); x.arc(W / 2, H / 2 - 24, r, 0, 6.3); x.stroke(); }

  x.strokeStyle = "#F2B233"; x.lineWidth = 3;
  x.strokeRect(30, 30, W - 60, H - 60);

  /* a quaver: two note heads, stems, and a beam across the top */
  x.fillStyle = "#FBF8F1"; x.strokeStyle = "#FBF8F1";
  [[248, 404], [392, 372]].forEach(p => {
    x.save(); x.translate(p[0], p[1]); x.rotate(-0.32);
    x.beginPath(); x.ellipse(0, 0, 52, 38, 0, 0, 6.3); x.fill(); x.restore();
  });
  x.lineWidth = 15; x.lineCap = "round";
  x.beginPath(); x.moveTo(296, 392); x.lineTo(296, 196); x.stroke();
  x.beginPath(); x.moveTo(440, 360); x.lineTo(440, 164); x.stroke();
  x.lineWidth = 30;
  x.beginPath(); x.moveTo(292, 192); x.lineTo(444, 160); x.stroke();

  x.fillStyle = "rgba(251,248,241,.92)";
  x.font = "700 30px Helvetica, Arial, sans-serif";
  x.textAlign = "center";
  x.fillText("AUDIO", W / 2, 546);
  x.font = "italic 25px Georgia, serif";
  x.fillStyle = "rgba(251,248,241,.66)";
  x.fillText((title || "Untitled track").slice(0, 26), W / 2, 588);

  return c.toDataURL("image/jpeg", 0.88);
}

/* Shown when a video will not decode - a .mov using a codec this browser
   does not carry, most often. The work still hangs and still takes
   stickers; only the picture is missing. */
function videoFallbackCover(title) {
  const W = 640, H = 400, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#272C31"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#C9A961"; x.lineWidth = 3; x.strokeRect(24, 24, W - 48, H - 48);
  x.fillStyle = "#FBF8F1";
  x.beginPath(); x.moveTo(268, 150); x.lineTo(392, 200); x.lineTo(268, 250); x.closePath(); x.fill();
  x.font = "700 24px Helvetica, Arial, sans-serif"; x.textAlign = "center";
  x.fillStyle = "rgba(251,248,241,.86)";
  x.fillText((title || "Video").slice(0, 28), W / 2, 318);
  x.font = "400 17px Helvetica, Arial, sans-serif";
  x.fillStyle = "rgba(251,248,241,.5)";
  x.fillText("Video", W / 2, 350);
  return c.toDataURL("image/jpeg", 0.86);
}

/* ---------- the buttons that hang on the frame ---------- */
/* Drawn to canvases like every other surface here. Four small badges,
   swapped by changing which one the material points at. */
const mediaIcons = {};
function mediaIconTexture(name) {
  if (mediaIcons[name]) return mediaIcons[name];
  const S = 128, c = document.createElement("canvas");
  c.width = S; c.height = S;
  const x = c.getContext("2d");

  const r = 26, pad = 8, w = S - pad * 2;
  x.fillStyle = "rgba(12,14,16,.82)";
  x.beginPath();
  x.moveTo(pad + r, pad);
  x.arcTo(pad + w, pad, pad + w, pad + w, r);
  x.arcTo(pad + w, pad + w, pad, pad + w, r);
  x.arcTo(pad, pad + w, pad, pad, r);
  x.arcTo(pad, pad, pad + w, pad, r);
  x.closePath();
  x.fill();
  x.strokeStyle = "rgba(255,255,255,.32)"; x.lineWidth = 3; x.stroke();

  x.fillStyle = "#FFFFFF"; x.strokeStyle = "#FFFFFF";
  x.lineWidth = 9; x.lineCap = "round"; x.lineJoin = "round";
  if (name === "play") {
    x.beginPath(); x.moveTo(50, 38); x.lineTo(92, 64); x.lineTo(50, 90); x.closePath(); x.fill();
  } else if (name === "pause") {
    x.fillRect(46, 40, 12, 48);
    x.fillRect(70, 40, 12, 48);
  } else {
    /* speaker cone, shared by both sound states */
    x.beginPath();
    x.moveTo(44, 54); x.lineTo(58, 54); x.lineTo(74, 38); x.lineTo(74, 90); x.lineTo(58, 74); x.lineTo(44, 74);
    x.closePath(); x.fill();
    if (name === "unmuted") {
      x.lineWidth = 6;
      [10, 18].forEach((d, i) => {
        x.beginPath();
        x.arc(78, 64, d + 4, -0.85, 0.85);
        x.stroke();
      });
    } else {
      x.lineWidth = 8;
      x.beginPath(); x.moveTo(84, 50); x.lineTo(104, 78); x.stroke();
      x.beginPath(); x.moveTo(104, 50); x.lineTo(84, 78); x.stroke();
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  KeepTex.add(t);                     /* shared across rebuilds, never disposed */
  mediaIcons[name] = t;
  return t;
}

/* Repoint each badge at the icon matching what the clip is doing now. */
function refreshMediaControls(artId) {
  if (artId === undefined || artId === null) return;
  for (let i = 0; i < Frames.length; i++) {
    const f = Frames[i];
    if (!f.art || f.art.id !== artId || !f.controls) continue;
    const playing = mediaPlaying(f.art);
    if (f.controls.play) f.controls.play.material.map = mediaIconTexture(playing ? "pause" : "play");
    if (f.controls.mute) f.controls.mute.material.map = mediaIconTexture(mediaMuted(f.art) ? "muted" : "unmuted");
    needsRender = true;
  }
  syncOverlayMediaButtons(artId);
}

/* ---------- reading a file at upload time ---------- */
/* Pulls the dimensions and a poster frame out of a clip without decoding
   the whole thing. Resolves with nulls rather than rejecting, so an
   unplayable file still becomes an artwork. */
function probeVideo(dataUrl) {
  return new Promise(resolve => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    let done = false;
    const finish = out => { if (done) return; done = true; clearTimeout(timer); v.removeAttribute("src"); resolve(out); };
    const timer = setTimeout(() => finish({ w: 0, h: 0, poster: null }), 12000);

    v.addEventListener("error", () => finish({ w: 0, h: 0, poster: null }));
    v.addEventListener("loadedmetadata", () => {
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return finish({ w: 0, h: 0, poster: null });
      /* a moment in rather than frame zero, which is often black */
      const at = Math.min(0.12, (v.duration || 1) * 0.05);
      const grab = () => {
        try {
          const long = Math.max(w, h), k = long > MAX_EDGE ? MAX_EDGE / long : 1;
          const c = document.createElement("canvas");
          c.width = Math.max(2, Math.round(w * k));
          c.height = Math.max(2, Math.round(h * k));
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          finish({ w: w, h: h, poster: c.toDataURL("image/jpeg", 0.82) });
        } catch (err) { finish({ w: w, h: h, poster: null }); }
      };
      v.addEventListener("seeked", grab, { once: true });
      try { v.currentTime = at; } catch (err) { grab(); }
    });
    v.src = dataUrl;
  });
}

function probeAudio(dataUrl) {
  return new Promise(resolve => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    let done = false;
    const finish = ok => { if (done) return; done = true; clearTimeout(timer); a.removeAttribute("src"); resolve(ok); };
    const timer = setTimeout(() => finish(false), 8000);
    a.addEventListener("error", () => finish(false));
    a.addEventListener("loadedmetadata", () => finish(true));
    a.src = dataUrl;
  });
}
