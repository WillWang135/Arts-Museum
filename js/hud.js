/* ============================================================
   HUD WIRING  --  the chips along the top and the sticker tray.
   ============================================================ */

/* Every HUD control goes through this rather than a plain click listener.

   The HUD sits inside a pointer-events:none layer and the chips carry a
   backdrop-filter, a pairing some mobile browsers handle badly: the tap
   lands, but the click the browser is supposed to synthesise afterwards
   never arrives, so the button looks dead. Acting on touchend removes that
   dependency, and preventDefault stops the synthetic click running the
   same action twice. Desktop keeps using click exactly as before. */
function onTap(el, fn) {
  if (!el) return;
  let handled = 0;
  el.addEventListener("touchend", e => {
    e.preventDefault();
    e.stopPropagation();
    handled = performance.now();
    fn(e);
  }, { passive: false });
  el.addEventListener("click", e => {
    if (performance.now() - handled < 700) return;   // already ran on the tap
    fn(e);
  });
}

/* fill the sticker tray icons, each labelled with its number key */
const STAMP_KEY = { flower: "1", heart: "2", tick: "3", star: "4", erase: "5" };
document.querySelectorAll(".stamp").forEach(b => {
  b.innerHTML = SVG[b.dataset.stamp] + '<span class="key">' + STAMP_KEY[b.dataset.stamp] + "</span>";
});

function toggleView() {
  Player.third = !Player.third;
  $("view-btn").innerHTML = "View: <b>" + (Player.third ? "Third person" : "First person") + "</b>";
}
function toggleMap() {
  mapOn = !mapOn;
  $("minimap").classList.toggle("hidden", !mapOn);
  $("map-btn").classList.toggle("on", mapOn);
}
let guestStickerNote = false;
function setStamp(k) {
  stamp = (stamp === k) ? null : k;
  if (stamp && State.guest && !guestStickerNote) {
    guestStickerNote = true;
    setTimeout(() => toast("Your stickers stay on this device"), 2200);
  }
  document.querySelectorAll(".stamp").forEach(b => b.classList.toggle("on", b.dataset.stamp === stamp));
  $("gl").style.cursor = stamp ? "pointer" : "crosshair";
  if (stamp && stamp !== "erase") toast("Click beside a frame to award " + STAMPS[stamp].label.toLowerCase());
  else if (stamp === "erase") toast("Click a sticker to remove it");
}
document.querySelectorAll(".stamp").forEach(b => onTap(b, ev => {
  ev.stopPropagation();
  setStamp(b.dataset.stamp);
}));
function refreshCodeChip() {
  const chip = $("code-chip");
  const code = State.session.code;
  chip.classList.toggle("hidden", !code);
  if (code) chip.innerHTML = "Code: <b>" + prettyCode(code) + "</b>";
}
onTap($("code-chip"), () => {
  const link = joinLink(State.session.code);
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(
    () => toast("Join link copied"), () => toast("Join code " + prettyCode(State.session.code)));
  else toast("Join code " + prettyCode(State.session.code));
});
onTap($("view-btn"), toggleView);
onTap($("map-btn"), toggleMap);
onTap($("help-btn"), openHelp);
onTap($("save-btn"), () => { saveMuseum(); toast("Museum saved to your downloads"); });
onTap($("quality-btn"), () => { quality = quality === "high" ? "low" : "high"; applyQuality(); });
/* Wrapped, not passed directly - exitMuseum lives in js/main.js, which
   loads after this file. See the same note in js/join.js. */
onTap($("exit-btn"), () => exitMuseum());
