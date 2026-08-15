/* ============================================================
   RUNTIME STATE
   Everything the 3D files read and write in common. Declared
   in one place so load order never matters to the rest.
   ============================================================ */

/* ---------- scene ---------- */
let renderer, scene, camera, clock, maxAniso;
let root = null;                 // everything rebuildable hangs off this
const Frames = [];               // {group, art, pos, normal, slots, used}
const Pickables = [];
const StickerObjs = [];
const Nav = { rot: 13.3, zones: [], boxes: [], circles: [] };
const Anim = { skies: [], pools: [], shafts: [], ticker: null };
const KeepTex = new Set();       // textures cached across rebuilds - never disposed
const KeepGeo = new Set();       // shared box geometry, reused by every figure
const KeepMat = new Set();       // shared figure materials
let dirLight = null, featureSpots = [], spotPool = [];
let quality = "high";
let needsRender = true;

/* ---------- the visit ---------- */
const Player = { x: 0, z: 9.6, yaw: 0, pitch: -0.03, vx: 0, vz: 0, third: false, bob: 0, moving: 0 };
const Visitors = [];
const keys = Object.create(null);
let avatar = null, avatarParts = null, raycaster = null;
let running = false, locked = false, stamp = null;
let fov = 62, fovTarget = 62;
let mapOn = true, lastSpot = 0, lastMap = 0, lastAim = 0, hoverFrame = null;
const touchState = { move: null, look: null, mx: 0, mz: 0 };

/* Built in initThree, not at parse time: touching THREE while the page is
   still loading breaks the whole script if the library is unavailable. */
let ndc = null;

/* A Windows touchscreen laptop reports touch AND a mouse. Treating those
   devices as "touch" used to switch mouse-look off entirely, so keep the
   two questions separate and let both input methods work at once. */
function hasTouch() {
  return (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}
function hasMouse() {
  if (!window.matchMedia) return true;                      // assume a mouse if we cannot ask
  return window.matchMedia("(any-pointer: fine)").matches;
}
function isTouchOnly() { return hasTouch() && !hasMouse(); }
function isTouch() { return isTouchOnly(); }                // legacy name, same meaning
