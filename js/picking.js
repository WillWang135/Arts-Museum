/* ============================================================
   PICKING  --  what the reticle is pointing at.
   ============================================================ */
function castFrom(v) {
  if (!ndc || !raycaster || !camera) return null;
  raycaster.setFromCamera(v, camera);
  const hits = raycaster.intersectObjects(Pickables, true);
  const sHits = stamp === "erase" ? raycaster.intersectObjects(StickerObjs, false) : [];
  if (sHits.length && (!hits.length || sHits[0].distance <= hits[0].distance + 0.2)) {
    return { sticker: sHits[0].object, point: sHits[0].point, distance: sHits[0].distance };
  }
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.frame) o = o.parent;
  if (!o) return null;
  return { frame: o.userData.frame, point: hits[0].point, distance: hits[0].distance };
}

function currentAim(e) {
  if (locked || !e) { ndc.set(0, 0); }
  else {
    const r = renderer.domElement.getBoundingClientRect();
    const cx = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : r.width / 2);
    const cy = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : r.height / 2);
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  }
  return castFrom(ndc);
}

/* Returns true when the click landed on something - a work or a sticker.
   The caller uses that to tell "I meant to use this" apart from "I clicked
   empty wall", which on desktop toggles mouse look. */
function act(e) {
  const hit = currentAim(e);
  if (!hit || hit.distance > 14) return false;
  if (stamp === "erase") {
    if (hit.sticker) { removeSticker(hit.sticker); return true; }
    return false;                      // no sticker there: treat as empty space
  }
  if (hit.frame) {
    if (stamp) placeSticker(hit.frame, hit.point);
    else openArtwork(hit.frame);
    return true;
  }
  return false;
}
