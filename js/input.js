/* ============================================================
   INPUT  --  keyboard, mouse, pointer lock and touch.
   ============================================================ */
window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (overlayOpen()) { if (k === "escape") closeOverlay(); return; }
  if (!running) return;
  keys[k] = true;
  if (k === "v") toggleView();
  else if (k === "m") toggleMap();
  else if (k === "h" || k === "?") openHelp();
  else if (k === "z") fovTarget = 27;
  else if (k >= "1" && k <= "4") setStamp(["flower", "heart", "tick", "star"][+k - 1]);
  else if (k === "5") setStamp("erase");
  else if (k === "0") setStamp(null);
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(k) !== -1) e.preventDefault();
});
window.addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if (k === "z") fovTarget = 62;
});
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

/* Pointer lock is the nicest way to look around, but it is refused often
   enough - iframes without the pointer-lock permission, managed work
   laptops, and a short cool-down after Esc - that it cannot be the only
   way. Holding the left button and dragging always works, everywhere. */
let lookDrag = null, lockBlocked = false, toldAboutDrag = false, lockRetryAt = 0;

function noteDragLook() {
  if (toldAboutDrag || !running) return;
  toldAboutDrag = true;
  toast("Hold the left mouse button and drag to look around");
}
/* A refusal is not always permanent - browsers rate-limit re-locking for
   about a second after the pointer is released, which the click-to-toggle
   below runs into constantly. So back off briefly and allow a retry,
   rather than giving up on pointer lock for the rest of the session. The
   "just drag instead" hint is still only ever shown once. */
function markLockBlocked() {
  lockRetryAt = performance.now() + 1400;
  if (lockBlocked) return;
  lockBlocked = true;
  noteDragLook();
}
function tryPointerLock() {
  const el = $("gl");
  if (isTouchOnly() || !el.requestPointerLock) { markLockBlocked(); return false; }
  if (performance.now() < lockRetryAt) return false;
  try {
    const req = el.requestPointerLock();
    if (req && typeof req.catch === "function") req.catch(markLockBlocked);
  } catch (err) { markLockBlocked(); return false; }
  return true;
}

/* ---------- click to toggle mouse look ---------- */
/* Clicking empty wall swaps between walking (pointer captured, moving the
   mouse turns your head) and a free cursor for the HUD. Esc still works,
   and clicking a work or a sticker does that instead of toggling. */
let toldAboutToggle = false;

function releaseLook(explain) {
  if (document.pointerLockElement) document.exitPointerLock();
  if (explain && !toldAboutToggle) {
    toldAboutToggle = true;
    toast("Cursor free — click the gallery again to look around");
  }
}

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === $("gl");
  $("reticle").style.opacity = locked || isTouchOnly() ? "" : "0.28";
});
document.addEventListener("pointerlockerror", markLockBlocked);

document.addEventListener("mousemove", e => {
  if (locked) {
    Player.yaw -= (e.movementX || 0) * 0.0021;
    Player.pitch -= (e.movementY || 0) * 0.0021;
    Player.pitch = Math.max(-1.32, Math.min(1.32, Player.pitch));
    return;
  }
  if (lookDrag) {                                   // drag-to-look fallback
    const dx = e.clientX - lookDrag.x, dy = e.clientY - lookDrag.y;
    lookDrag.moved += Math.abs(dx) + Math.abs(dy);
    lookDrag.x = e.clientX; lookDrag.y = e.clientY;
    if (lookDrag.moved > 4) $("gl").classList.add("dragging");
    Player.yaw -= dx * 0.0034;
    Player.pitch -= dy * 0.0034;
    Player.pitch = Math.max(-1.32, Math.min(1.32, Player.pitch));
    return;
  }
  if (!running || !ndc || isTouchOnly()) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
});

let lastTouchAt = 0;
$("gl").addEventListener("mousedown", e => {
  if (e.button !== 0 || overlayOpen()) return;
  if (performance.now() - lastTouchAt < 700) return;   // synthetic click after a tap
  e.preventDefault();
  if (locked) {
    /* Captured, so the reticle is the pointer: use whatever it is on, and
       hand the cursor back when it is on nothing in particular. */
    if (!act(null)) releaseLook(true);
    return;
  }
  /* Not captured. Whether this turns out to be a click or a drag is decided
     on release - asking for the pointer now would snatch it from someone who
     only meant to drag the view around. */
  lookDrag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 };
});
window.addEventListener("mouseup", e => {
  if (e.button !== 0 || !lookDrag) return;
  const d = lookDrag;
  lookDrag = null;
  $("gl").classList.remove("dragging");
  if (locked) return;                               // lock arrived during the press
  if (d.moved >= 6) return;                         // a drag, not a click
  if (act({ clientX: d.sx, clientY: d.sy })) return;   // landed on a work or sticker
  tryPointerLock();                                 // empty wall: take the pointer
});
window.addEventListener("blur", () => { lookDrag = null; $("gl").classList.remove("dragging"); });
$("gl").addEventListener("wheel", e => {
  if (!running || overlayOpen()) return;
  e.preventDefault();
  fovTarget = Math.max(24, Math.min(62, fovTarget + (e.deltaY > 0 ? 4 : -4)));
}, { passive: false });

/* ---------- touch ---------- */
function enableTouchUI() {
  $("touch").style.display = "block";
  if (isTouchOnly()) $("gl").style.cursor = "default";
}
function setupTouch() {
  if (!hasTouch()) return;
  if (isTouchOnly()) enableTouchUI();
  else window.addEventListener("touchstart", enableTouchUI, { once: true, passive: true });
  const pad = $("pad-move"), nub = $("nub-move");
  let padId = null, cx0 = 0, cy0 = 0;
  pad.addEventListener("touchstart", e => {
    const t = e.changedTouches[0]; padId = t.identifier;
    const r = pad.getBoundingClientRect(); cx0 = r.left + r.width / 2; cy0 = r.top + r.height / 2;
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === padId) {
        let dx = t.clientX - cx0, dy = t.clientY - cy0;
        const d = Math.hypot(dx, dy), max = 48;
        if (d > max) { dx *= max / d; dy *= max / d; }
        nub.style.transform = "translate(" + dx + "px," + dy + "px)";
        touchState.mx = dx / max; touchState.mz = dy / max;
      } else if (touchState.look && t.identifier === touchState.look.id) {
        Player.yaw -= (t.clientX - touchState.look.x) * 0.005;
        Player.pitch -= (t.clientY - touchState.look.y) * 0.005;
        Player.pitch = Math.max(-1.3, Math.min(1.3, Player.pitch));
        touchState.look.x = t.clientX; touchState.look.y = t.clientY;
        touchState.look.moved += 1;
      }
    }
  }, { passive: true });
  window.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === padId) { padId = null; nub.style.transform = ""; touchState.mx = 0; touchState.mz = 0; }
      else if (touchState.look && t.identifier === touchState.look.id) {
        if (touchState.look.moved < 3) act({ clientX: touchState.look.sx, clientY: touchState.look.sy });
        touchState.look = null;
      }
    }
  });
  /* Bound to the canvas itself. The old approach used a transparent div
     pinned over the right of the screen, which also blocked mouse clicks
     on every button underneath it. */
  $("gl").addEventListener("touchstart", e => {
    lastTouchAt = performance.now();
    if (overlayOpen() || touchState.look) return;
    const t = e.changedTouches[0];
    touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, moved: 0 };
    e.preventDefault();
  }, { passive: false });
}
