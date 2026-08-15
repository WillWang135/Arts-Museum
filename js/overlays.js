/* ============================================================
   OVERLAYS  --  the artwork card, the help sheet and toasts.
   ============================================================ */
const overlayRoot = () => $("overlay-root");
function closeOverlay() { overlayRoot().innerHTML = ""; needsRender = true; }
function overlayOpen() { return overlayRoot().childElementCount > 0; }

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

  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="card" style="position:relative">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<figure><img alt=""></figure>' +
      '<div class="meta">' +
        '<div class="accession-line">' + pad3(num) + (frame.isFeature ? ' &middot; Featured work' : '') + '</div>' +
        '<h2></h2>' +
        '<p class="by"></p>' +
        '<div class="rule"></div>' +
        '<p class="desc"></p>' +
        '<div class="awards">' + (awards || '<span class="tag">No stickers yet</span>') + waitingNote + '</div>' +
      '</div>' +
    '</div>';
  veil.querySelector("img").src = a.src;
  veil.querySelector("h2").textContent = a.name || "Untitled";
  veil.querySelector(".by").textContent = a.author ? "by " + a.author : "Artist not named";
  veil.querySelector(".desc").textContent = a.desc || "No description was added for this piece.";
  veil.querySelectorAll(".awards svg").forEach(s => { s.style.width = "20px"; s.style.height = "20px"; s.style.verticalAlign = "-4px"; });
  veil.addEventListener("click", e => { if (e.target === veil || e.target.hasAttribute("data-close")) closeOverlay(); });
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
