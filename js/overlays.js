/* ============================================================
   OVERLAYS  --  the artwork card, the help sheet and toasts.
   ============================================================ */
const overlayRoot = () => $("overlay-root");

/* The <video> and <audio> elements are shared with the museum itself - the
   same element feeds the texture on the wall - so the card borrows one
   while it is open and hands it back on the way out. It has to go back into
   the document rather than be dropped, or the browser stops decoding and
   the picture on the wall freezes. */
function releaseOverlayMedia() {
  const pool = $("media-pool");
  overlayRoot().querySelectorAll("video, audio").forEach(el => {
    el.removeAttribute("controls");
    if (pool && el.parentNode !== pool) pool.appendChild(el);
  });
}
function closeOverlay() {
  releaseOverlayMedia();
  /* the enlarged slide listens for the window resizing; it must not go on
     doing that after it has gone */
  overlayRoot().querySelectorAll(".veil").forEach(v => {
    if (v.__onResize) window.removeEventListener("resize", v.__onResize);
  });
  overlayRoot().innerHTML = "";
  needsRender = true;
}
function overlayOpen() { return overlayRoot().childElementCount > 0; }

/* Closing has to work by tap as well as by click: a phone may never deliver
   the click it is supposed to synthesise afterwards, which is what left the
   Close button dead on mobile. onTap covers both without double-firing. */
function wireVeil(veil) {
  veil.addEventListener("click", e => {
    if (e.target === veil) closeOverlay();
  });
  veil.querySelectorAll("[data-close]").forEach(btn => onTap(btn, e => {
    if (e && e.stopPropagation) e.stopPropagation();
    closeOverlay();
  }));
}

/* Keeps the card's own play/mute buttons in step when playback changes
   from anywhere - the badge on the wall, or the native controls. */
function syncOverlayMediaButtons(artId) {
  const card = overlayRoot().querySelector(".card[data-art-id='" + artId + "']");
  if (!card) return;
  const art = State.art.find(a => a.id === artId);
  if (!art) return;
  const play = card.querySelector("[data-media-play]");
  const mute = card.querySelector("[data-media-mute]");
  if (play) play.textContent = mediaPlaying(art) ? "Pause" : "Play";
  if (mute) mute.textContent = mediaMuted(art) ? "Sound on" : "Sound off";
}

/* the open playlist follows the transport, whichever end it was worked from */
function syncOpenPlaylistPanel() {
  const veil = overlayRoot().querySelector(".veil");
  if (veil && veil.__syncQueue) veil.__syncQueue();
}

/* art defaults to whatever hangs in the frame. A track that only has a strip
   on the wall passes itself instead, so it can be opened like anything else. */
function openArtwork(frame, art) {
  if (document.pointerLockElement) document.exitPointerLock();
  const a = art || frame.art;
  const isFeature = frame.isFeature && a === frame.art;
  const num = State.art.indexOf(a) + 1;
  const mine = State.stickers.filter(s => s.artId === a.id);
  const counts = {};
  mine.forEach(s => counts[s.type] = (counts[s.type] || 0) + 1);
  const awards = Object.keys(counts).map(k =>
    '<span title="' + STAMPS[k].label + '">' + SVG[k] + '</span> <span class="tag">' + counts[k] + '&times; ' + STAMPS[k].label + '</span>'
  ).join("");
  /* The wall shows eight at a time; the tally above counts every one
     awarded, so say so rather than letting the two look inconsistent. */
  const waiting = mine.filter(s => s.slot === null || s.slot === undefined).length;
  const waitingNote = waiting
    ? '<span class="tag">' + waiting + ' more awarded · ' + MAX_VISIBLE_STICKERS + ' shown at a time</span>'
    : "";

  const kind = artKind(a);
  const playable = isPlayable(a) && !!a.media;

  /* The work first and large, its label underneath - the way a gallery
     hangs it. The stage takes about three quarters of the screen; the
     button below swaps it to the whole screen for a closer look. */
  const mediaControls = playable
    ? '<button class="btn btn-primary" type="button" data-media-play>Play</button>' +
      (kind === "video" ? '<button class="btn" type="button" data-media-mute>Sound off</button>' : "")
    : "";

  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="card" data-art-id="' + a.id + '">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<div class="stage"><div class="stage-inner"></div></div>' +
      '<div class="meta">' +
        '<div class="metatop">' +
          '<div>' +
            '<div class="accession-line">' + pad3(num) +
              (isFeature ? ' &middot; Featured work' : '') +
              (playable ? ' &middot; ' + (kind === "audio" ? 'Audio' : 'Video') : '') + '</div>' +
            '<h2></h2>' +
            '<p class="by"></p>' +
          '</div>' +
          '<div class="mediabar">' + mediaControls +
            '<button class="btn btn-quiet" type="button" data-expand>Fill the screen</button>' +
          '</div>' +
        '</div>' +
        '<div class="rule"></div>' +
        '<p class="desc"></p>' +
        '<div class="awards">' + (awards || '<span class="tag">No stickers yet</span>') + waitingNote + '</div>' +
      '</div>' +
      /* Fullscreen hides the label block, so it carries its own way back to
         the fitted view; Close sits in the opposite corner as always. */
      '<div class="fs-bar"><button class="chip" type="button" data-expand>Fit to window</button></div>' +
    '</div>';

  const card = veil.querySelector(".card");
  const stage = veil.querySelector(".stage-inner");

  if (playable) {
    /* Borrow the element the museum is already using, so the card and the
       wall are never out of step with one another. */
    const entry = mediaEntry(a);
    const el = entry.el;
    const wasPlaying = !el.paused, at = el.currentTime;
    el.setAttribute("controls", "");
    /* A supplied cover stands in until the clip is first started, which is
       exactly what the poster attribute is for - so the enlarged view and
       the frame on the wall show the same picture. */
    if (kind === "video") {
      if (a.cover) el.setAttribute("poster", a.cover);
      else el.removeAttribute("poster");
    }
    stage.appendChild(el);
    /* Re-parenting keeps playback in every current browser, but restore the
       position if one ever decides otherwise. */
    if (Math.abs(el.currentTime - at) > 0.4) el.currentTime = at;
    if (wasPlaying && el.paused) el.play().catch(() => {});
    if (kind === "audio") {
      const cover = document.createElement("img");
      cover.alt = ""; cover.src = a.src; cover.className = "audio-cover";
      stage.insertBefore(cover, el);
    }
  } else {
    const im = document.createElement("img");
    im.alt = ""; im.src = a.src;
    stage.appendChild(im);
  }

  veil.querySelector("h2").textContent = a.name || "Untitled";
  veil.querySelector(".by").textContent = a.author ? "by " + a.author : "Artist not named";
  veil.querySelector(".desc").textContent = a.desc || "No description was added for this piece.";
  veil.querySelectorAll(".awards svg").forEach(s => { s.style.width = "20px"; s.style.height = "20px"; s.style.verticalAlign = "-4px"; });

  /* Two buttons, one job: the one in the label block fills the screen, the
     one pinned in the corner brings it back. Only ever one is visible, so
     neither needs its label swapped. */
  veil.querySelectorAll("[data-expand]").forEach(btn =>
    onTap(btn, () => { card.classList.toggle("is-full"); }));

  if (playable) {
    veil.querySelector("[data-media-play]").addEventListener("click", () => toggleMedia(a));
    const mute = veil.querySelector("[data-media-mute]");
    if (mute) mute.addEventListener("click", () => toggleMediaMute(a));
  }

  wireVeil(veil);
  overlayRoot().appendChild(veil);
  syncOverlayMediaButtons(a.id);
}

/* The museum's music, as a list. Deliberately built like the strip it opens
   from - dark glass, brass edge, the current track lit - rather than like a
   web player dropped on top of the gallery. Closing it touches nothing that
   is playing. */
function openPlaylistPanel(rec) {
  if (!rec) rec = featurePanel();
  if (!rec) return;
  if (document.pointerLockElement) document.exitPointerLock();

  const tracks = playlistTracks();
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="queue">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<div class="queue-head">' +
        '<span class="eyebrow">Museum playlist</span>' +
        '<h2>' + tracks.length + (tracks.length === 1 ? ' track' : ' tracks') + '</h2>' +
      '</div>' +
      '<div class="queue-list"></div>' +
    '</div>';

  const list = veil.querySelector(".queue-list");
  tracks.forEach((art, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "queue-row";
    row.dataset.trackId = art.id;
    row.innerHTML =
      '<span class="qn">' + pad3(i + 1) + '</span>' +
      '<span class="qc"><img alt=""></span>' +
      '<span class="qt"><b></b><i></i></span>' +
      '<span class="qs"></span>';
    row.querySelector("img").src = art.src;          /* its cover, where it has one */
    row.querySelector(".qt b").textContent = art.name || "Untitled track";
    row.querySelector(".qt i").textContent = art.author || "";
    list.appendChild(row);
  });

  const markCurrent = () => {
    list.querySelectorAll(".queue-row").forEach(row => {
      const isNow = +row.dataset.trackId === rec.art.id;
      row.classList.toggle("is-current", isNow);
      row.querySelector(".qs").textContent =
        isNow ? (mediaPlaying(rec.art) ? "Playing" : "Paused") : "";
    });
  };
  markCurrent();

  list.addEventListener("click", e => {
    const row = e.target.closest(".queue-row");
    if (!row) return;
    const art = State.art.find(a => a.id === +row.dataset.trackId);
    /* remembered, so Previous still retraces a hand-picked jump */
    if (art) playlistLoad(rec, art, true);
    markCurrent();
  });
  veil.__syncQueue = markCurrent;

  wireVeil(veil);
  overlayRoot().appendChild(veil);
}

function openHelp() {
  if (document.pointerLockElement) document.exitPointerLock();
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="sheet" style="position:relative">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<h2>Getting around</h2>' +
      '<dl class="keys">' +
        '<dt>W A S D</dt><dd>Walk forward, left, back and right. Arrow keys work too.</dd>' +
        '<dt>Mouse</dt><dd>Click an empty part of the gallery to look around \u2014 moving the mouse then turns your head. Click empty space again (or press Esc) to get the cursor back for the buttons. Clicking a work opens it instead of switching. If your browser will not hand over the mouse, hold the left button and drag \u2014 that always works.</dd>' +
        '<dt>Q / E</dt><dd>Turn left and right using the keyboard alone.</dd>' +
        '<dt>Shift</dt><dd>Sprint \u2014 about twice walking speed for crossing the galleries.</dd>' +
        '<dt>Z / scroll</dt><dd>Zoom in on the detail of a sketch.</dd>' +
        '<dt>V</dt><dd>Swap between first person and following your avatar.</dd>' +
        '<dt>Click a work</dt><dd>Read its name, artist and story, shown large with the label underneath.</dd>' +
        '<dt>Play button</dt><dd>Look at a video and its controls appear in the corner. A track has its own strip on the wall above a work, with a waveform that fills as it runs. Sound follows you: loudest up close, fading to nothing as you walk away. Three videos play at a time.</dd>' +
        '<dt>Click a visitor</dt><dd>Ask somebody standing in your way to step aside. They will move again after ten seconds.</dd>' +
        '<dt>Space</dt><dd>Play or pause whatever is open in the enlarged view. Click along a waveform to skip through a track.</dd>' +
        '<dt>1 2 3 4</dt><dd>Pick a sticker, then click beside a frame to award it. A work shows eight at a time; any beyond that are still counted, and appear as room frees up.</dd>' +
        '<dt>5</dt><dd>Eraser. Click a sticker to take it back off.</dd>' +
        '<dt>0</dt><dd>Put the stickers away.</dd>' +
        '<dt>M</dt><dd>Show or hide the floorplan.</dd>' +
        '<dt>Presentation</dt><dd>A PowerPoint added on the setup screen hangs on the back of the feature wall. The arrows under it step through the slides, and the number tells you where you are. Click the slide itself to look closer without leaving the room \u2014 the arrow keys work there too.</dd>' +
        '<dt>P</dt><dd>Selfie mode. You turn to face the camera with whatever you were looking at behind you \u2014 drag to reframe, scroll or use +/\u2212 for how far away the camera is held, then press the shutter. Save the photograph or take another. Press P again to carry on walking. On a phone, the Selfie chip does the same thing.</dd>' +
        '<dt>Feature wall</dt><dd>The strip above the featured work runs the whole museum\u2019s music: previous, play, next, and a mode for what happens when a song ends \u2014 repeat it, take the next in order, or shuffle.</dd>' +
        '<dt>Pause all</dt><dd>The chip under the map stops every track and video at once, wherever you are. Each one keeps its place, so starting it again carries on from there.</dd>' +
      '</dl>' +
      '<p style="margin:22px 0 0;color:var(--slate);font-size:13.5px">On a phone or tablet, drag the left circle to walk and drag anywhere else to look. Tap a work to open it.</p>' +
    '</div>';
  wireVeil(veil);
  overlayRoot().appendChild(veil);
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
}

/* ============================================================
   THE PRESENTATION, LARGER
   Not the fullscreen viewer. That one blacks the world out,
   which is right for a photograph and wrong here: the point of
   this is that the visitor has stepped closer to a screen on a
   wall, not opened a different application. So the gallery stays
   where it was, softened and dimmed, and the slide sits in front
   of it at about four fifths of the window.
   ============================================================ */
function deckViewer() { return overlayRoot().querySelector(".deck-view"); }

function syncDeckViewer() {
  const v = deckViewer();
  if (!v) return;
  const img = v.querySelector("img");
  const src = deckCurrent();
  if (src && img.getAttribute("src") !== src) img.src = src;
  v.querySelector(".deck-count").textContent = deckLabel();
  syncViewerStickers();
}

/* The same reactions, over the enlarged slide, in the same places they sit
   on the wall. Read straight off the screen's own slots rather than kept
   separately, so the two views cannot disagree about what is on a page. */
function syncViewerStickers() {
  const v = deckViewer();
  if (!v) return;
  const layer = v.querySelector(".deck-stickers");
  const img = v.querySelector(".deck-stage img");
  if (!layer || !img) return;
  layer.innerHTML = "";
  if (!DeckScreen || !DeckScreen.slots) return;

  /* positioned against the picture, wherever it has ended up inside the
     stage - a 4:3 slide in a 16:9 box does not fill it */
  const stage = v.querySelector(".deck-stage").getBoundingClientRect();
  const box = img.getBoundingClientRect();
  if (!box.width || !box.height) return;
  layer.style.left = (box.left - stage.left) + "px";
  layer.style.top = (box.top - stage.top) + "px";
  layer.style.width = box.width + "px";
  layer.style.height = box.height + "px";

  DeckScreen.slots.forEach((slot, i) => {
    if (!slot.taken) return;
    const n = DeckScreen.slotNorm[i];
    if (!n) return;
    const el = document.createElement("span");
    el.className = "deck-sticker";
    el.innerHTML = SVG[slot.taken.userData.kind] || "";
    el.style.left = ((0.5 + n.nx) * 100) + "%";
    el.style.top = ((0.5 - n.ny) * 100) + "%";
    layer.appendChild(el);
  });
}

function openDeckViewer() {
  if (!deckHas()) return;
  if (document.pointerLockElement) document.exitPointerLock();
  closeOverlay();

  const veil = document.createElement("div");
  veil.className = "veil deck-veil";
  veil.innerHTML =
    '<div class="deck-view">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<div class="deck-stage"><img alt="Presentation slide"><span class="deck-stickers"></span></div>' +
      '<div class="deck-bar">' +
        '<button class="deck-step" type="button" data-step="-1" aria-label="Previous slide">' +
          '<svg viewBox="0 0 24 24"><path d="M15 5l-8 7 8 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<span class="deck-count"></span>' +
        '<button class="deck-step" type="button" data-step="1" aria-label="Next slide">' +
          '<svg viewBox="0 0 24 24"><path d="M9 5l8 7-8 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

  wireVeil(veil);
  veil.querySelectorAll("[data-step]").forEach(b => onTap(b, e => {
    e.stopPropagation();
    deckGo(+b.dataset.step);
  }));
  /* The picture decides where the reactions go, so they are laid out again
     once it has actually arrived and once the window has settled. */
  const img = veil.querySelector(".deck-stage img");
  img.addEventListener("load", syncViewerStickers);
  veil.__onResize = () => syncViewerStickers();
  window.addEventListener("resize", veil.__onResize);

  overlayRoot().appendChild(veil);
  syncDeckViewer();
}
