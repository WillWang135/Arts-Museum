/* ============================================================
   SELFIE MODE

   A souvenir photograph, not a screenshot. Press P (or tap the
   camera on a phone) and the view swings round in front of the
   visitor: they turn to face the lens, raise a phone, and whatever
   they had been looking at is now behind them - which is how
   anyone actually takes a picture in a gallery.

   Nothing about the visit changes. The player never moves, so
   leaving selfie mode simply hands the same position and heading
   back to the ordinary camera.
   ============================================================ */
const Selfie = {
  on: false,
  yaw: 0,            // orbit around the visitor, from where they were facing
  pitch: 0,          // how far above eye level the lens is held
  dist: 0,           // arm's length
  baseYaw: 0,        // the heading they had when they pressed P
  saved: null,       // what to give back on the way out
  want: false,       // a shot was asked for; taken at the end of this frame
  flash: 0           // 1 -> 0 over the moment after the shutter
};

const SELFIE_EYE = 1.60;          // the avatar's face, in metres
const SELFIE_AIM = 1.46;          // aimed at the chin, so the shoulders come in
const SELFIE_MIN = 1.05, SELFIE_MAX = 3.0;
const SELFIE_FOV = 58;
const SELFIE_DEFAULT = { yaw: -0.24, pitch: 0.21, dist: 1.72 };
/* How far off the face the lens aims, as a share of how wide the frame is
   where the visitor is standing. A fixed offset in metres put them against
   the right-hand edge on a phone and barely off centre on a wide monitor;
   measured against the frame it composes the same shot on both. */
const SELFIE_OFF = 0.26;

/* ---------- entering and leaving ---------- */
function selfieAvailable() { return running && avatar && !overlayOpen(); }

function enterSelfie() {
  if (Selfie.on || !selfieAvailable()) return;
  Selfie.on = true;
  Selfie.saved = { third: Player.third, pitch: Player.pitch, fov: fovTarget };
  Selfie.baseYaw = Player.yaw;
  Selfie.yaw = SELFIE_DEFAULT.yaw;
  Selfie.pitch = SELFIE_DEFAULT.pitch;
  Selfie.dist = SELFIE_DEFAULT.dist;
  Selfie.flash = 0;

  /* The visitor is standing still now, so drop any movement they were
     carrying and let go of the pointer - the shutter needs a cursor. */
  Player.vx = Player.vz = 0;
  for (const k in keys) keys[k] = false;
  touchState.mx = touchState.mz = 0;
  if (document.pointerLockElement) document.exitPointerLock();

  fovTarget = fov = SELFIE_FOV;               // a phone's lens, not a room's
  document.body.classList.add("selfie-on");
  $("selfie-bar").classList.remove("hidden");
  $("selfie-btn").classList.add("on");
  setStamp(null);
  toast("Drag to reframe · press the shutter · P to leave");
  needsRender = true;
}

function exitSelfie() {
  if (!Selfie.on) return;
  Selfie.on = false;
  const s = Selfie.saved || {};
  Player.third = !!s.third;
  Player.pitch = s.pitch === undefined ? -0.02 : s.pitch;
  fovTarget = s.fov === undefined ? 62 : s.fov;
  Selfie.saved = null;
  selfiePose(false);
  document.body.classList.remove("selfie-on");
  $("selfie-bar").classList.add("hidden");
  $("selfie-btn").classList.remove("on");
  needsRender = true;
}

function toggleSelfie() {
  if (Selfie.on) exitSelfie();
  else if (selfieAvailable()) enterSelfie();
}

/* ---------- reframing ---------- */
/* Small adjustments only. The lens stays on the visitor - what moves is
   where it is held, which is exactly the freedom an arm gives you. */
function nudgeSelfie(dyaw, dpitch) {
  Selfie.yaw = Math.max(-1.15, Math.min(1.15, Selfie.yaw + dyaw));
  Selfie.pitch = Math.max(-0.32, Math.min(0.72, Selfie.pitch + dpitch));
  needsRender = true;
}
function zoomSelfie(d) {
  Selfie.dist = Math.max(SELFIE_MIN, Math.min(SELFIE_MAX, Selfie.dist + d));
  needsRender = true;
}

/* ---------- the pose ---------- */
/* The raised arm is the whole illusion. Without it the figure just stands
   there being photographed by nobody. */
function selfiePose(on) {
  if (!avatarParts) return;
  const arm = avatarParts.arms[1].pivot, off = avatarParts.arms[0].pivot;
  if (avatarPhone) avatarPhone.visible = !!on;
  if (!on) return;
  avatarParts.legs.forEach(l => { l.pivot.rotation.x = 0; });
  /* Up and OUT, not straight at the lens. Pointed at the camera the arm
     foreshortens into a stub across the chest and the phone disappears;
     swung wide, both read from any angle, which is the pose the reference
     sheet uses. */
  arm.rotation.set(-2.70, 0, 0.62);
  off.rotation.set(-0.16, 0, 0.14);            // the other one, relaxed
  avatarParts.body.rotation.set(0, 0.10, 0);   // a quarter turn into the shot
  avatarParts.head.rotation.set(0.05, 0.10, 0.04);
}

/* ---------- the camera ---------- */
/* 1 on anything wider than about 4:3, opening out to 1.55 on a phone held
   upright. Capped, because backing off far enough to fit a portrait frame
   properly stops looking like an arm and starts looking like a tripod. */
function selfieReach() {
  const a = (camera && camera.aspect) || 1.6;
  return Math.min(1.55, Math.max(1, 1.3 / a));
}

function updateSelfieCamera(dt) {
  const yaw = Selfie.baseYaw + Selfie.yaw;
  /* Behind them, relative to the way they were looking. Turning to face the
     lens is what puts the artwork they were admiring into the picture. */
  const bx = Math.sin(yaw), bz = Math.cos(yaw);
  /* A tall phone screen sees a narrow slice of the room for the same
     vertical lens, so the arm gets held further out on one. Held at the
     desktop distance, a portrait frame was all shoulders and no gallery. */
  const reach = Selfie.dist * selfieReach();
  const flat = reach * Math.cos(Selfie.pitch);
  const rise = reach * Math.sin(Selfie.pitch);

  avatar.visible = true;
  avatar.position.set(Player.x, 0, Player.z);
  avatar.rotation.y = yaw;                     // squared up to the lens
  selfiePose(true);

  camera.position.set(Player.x + bx * flat, SELFIE_EYE + rise, Player.z + bz * flat);

  fov += (fovTarget - fov) * Math.min(1, dt * 8);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  /* Aimed a little to one side of the face and a little below it, which
     drops the visitor off centre and leaves the room behind them room to
     be seen. */
  const halfW = reach * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
  const off = halfW * SELFIE_OFF;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  camera.rotation.set(0, 0, 0);
  camera.lookAt(Player.x + rx * -off, SELFIE_AIM, Player.z + rz * -off);

  /* The shutter steps aside while the print is up, and comes back the
     moment it is closed. Read off the overlay rather than bookkept, so it
     cannot fall out of step with however the card was dismissed. */
  $("selfie-bar").classList.toggle("hidden", overlayOpen());

  if (Selfie.flash > 0) {
    Selfie.flash = Math.max(0, Selfie.flash - dt * 2.4);
    $("selfie-flash").style.opacity = String(Selfie.flash);
  }
}

/* ---------- taking the picture ---------- */
/* Asked for here, taken in the frame loop. The canvas only holds a picture
   for the instant after it is drawn, so the read has to happen in the same
   turn as the render or it comes back blank. */
function requestSelfieShot() {
  if (!Selfie.on || Selfie.want) return;
  Selfie.want = true;
}

/* Badges and play buttons float in the scene rather than sit on the walls,
   so they are interface, not exhibition, and they stay out of the photo. */
function hideSceneUI(hide) {
  const kept = [];
  Frames.forEach(f => {
    if (!f.controls) return;
    [f.controls.play, f.controls.mute].forEach(m => {
      if (!m || (hide && !m.visible)) return;
      kept.push(m);
      m.visible = !hide;
    });
  });
  MusicPanels.forEach(p => {
    if (!p.badge || (hide && !p.badge.visible)) return;
    kept.push(p.badge);
    p.badge.visible = !hide;
  });
  return kept;
}

/* Called from the frame loop, straight after the scene is drawn. */
function captureSelfie() {
  Selfie.want = false;
  const hidden = hideSceneUI(true);
  renderer.render(scene, camera);
  let url = null;
  try { url = renderer.domElement.toDataURL("image/png"); } catch (err) { url = null; }
  hidden.forEach(m => { m.visible = true; });
  if (!url) { toast("This browser would not let the photo be saved"); return; }
  Selfie.flash = 1;
  $("selfie-flash").style.opacity = "1";
  openSelfiePreview(url);
}

/* ---------- the print ---------- */
function selfieFilename() {
  const t = (museumTitle() || "museum").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (t || "museum") + "-selfie.png";
}

function openSelfiePreview(url) {
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="card shot">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<div class="shot-stage"><img alt="Your photograph in the museum"></div>' +
      '<div class="shot-bar">' +
        '<span class="eyebrow">' + museumTitle() + '</span>' +
        '<div class="row">' +
          '<button class="btn btn-quiet" type="button" data-retake>Take another</button>' +
          '<button class="btn btn-primary" type="button" data-save>Save photo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  veil.querySelector("img").src = url;
  wireVeil(veil);
  onTap(veil.querySelector("[data-retake]"), e => { e.stopPropagation(); closeOverlay(); });
  onTap(veil.querySelector("[data-save]"), e => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = url;
    a.download = selfieFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Photo saved to your downloads");
  });
  overlayRoot().appendChild(veil);
}
