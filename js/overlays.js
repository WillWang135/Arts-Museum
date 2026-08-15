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
  overlayRoot().innerHTML = "";
  needsRender = true;
}
function overlayOpen() { return overlayRoot().childElementCount > 0; }

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

function openArtwork(frame) {
  if (document.pointerLockElement) document.exitPointerLock();
  const a = frame.art;
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
              (frame.isFeature ? ' &middot; Featured work' : '') +
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

  const expand = veil.querySelector("[data-expand]");
  expand.addEventListener("click", () => {
    const full = card.classList.toggle("is-full");
    expand.textContent = full ? "Fit the window" : "Fill the screen";
  });

  if (playable) {
    veil.querySelector("[data-media-play]").addEventListener("click", () => toggleMedia(a));
    const mute = veil.querySelector("[data-media-mute]");
    if (mute) mute.addEventListener("click", () => toggleMediaMute(a));
  }

  veil.addEventListener("click", e => { if (e.target === veil || e.target.hasAttribute("data-close")) closeOverlay(); });
  overlayRoot().appendChild(veil);
  syncOverlayMediaButtons(a.id);
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
        '<dt>Click a work</dt><dd>Read its name, artist and story.</dd>' +
        '<dt>1 2 3 4</dt><dd>Pick a sticker, then click beside a frame to award it. A work shows eight at a time; any beyond that are still counted, and appear as room frees up.</dd>' +
        '<dt>5</dt><dd>Eraser. Click a sticker to take it back off.</dd>' +
        '<dt>0</dt><dd>Put the stickers away.</dd>' +
        '<dt>M</dt><dd>Show or hide the floorplan.</dd>' +
      '</dl>' +
      '<p style="margin:22px 0 0;color:var(--slate);font-size:13.5px">On a phone or tablet, drag the left circle to walk and drag anywhere else to look. Tap a work to open it.</p>' +
    '</div>';
  veil.addEventListener("click", e => { if (e.target === veil || e.target.hasAttribute("data-close")) closeOverlay(); });
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
