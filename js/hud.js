/* ============================================================
   HUD WIRING  --  the chips along the top and the sticker tray.
   ============================================================ */

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
document.querySelectorAll(".stamp").forEach(b => b.addEventListener("click", ev => {
  ev.stopPropagation();
  setStamp(b.dataset.stamp);
}));
function refreshCodeChip() {
  const chip = $("code-chip");
  const code = State.session.code;
  chip.classList.toggle("hidden", !code);
  if (code) chip.innerHTML = "Code: <b>" + prettyCode(code) + "</b>";
}
$("code-chip").addEventListener("click", () => {
  const link = joinLink(State.session.code);
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(
    () => toast("Join link copied"), () => toast("Join code " + prettyCode(State.session.code)));
  else toast("Join code " + prettyCode(State.session.code));
});
$("view-btn").addEventListener("click", toggleView);
$("map-btn").addEventListener("click", toggleMap);
$("help-btn").addEventListener("click", openHelp);
$("save-btn").addEventListener("click", () => { saveMuseum(); toast("Museum saved to your downloads"); });
$("quality-btn").addEventListener("click", () => { quality = quality === "high" ? "low" : "high"; applyQuality(); });
/* Wrapped, not passed directly - exitMuseum lives in js/main.js, which
   loads after this file. See the same note in js/join.js. */
$("exit-btn").addEventListener("click", () => exitMuseum());
