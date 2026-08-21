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
  /* Someone standing in front of a work is picked before it, so you can
     ask them to move rather than clicking straight through them. */
  const vHits = raycaster.intersectObjects(VisitorObjs, true);
  if (vHits.length && vHits[0].distance <= VISITOR_REACH &&
      (!hits.length || vHits[0].distance < hits[0].distance)) {
    let vo = vHits[0].object;
    while (vo && !vo.userData.visitor) vo = vo.parent;
    if (vo) return { visitor: vo.userData.visitor, point: vHits[0].point, distance: vHits[0].distance };
  }
  if (!hits.length) return null;
  let o = hits[0].object;
  /* Read the badge off the object actually struck, before walking up to the
     frame it belongs to - otherwise a play button reads as its artwork. */
  const faded = o.material && o.material.transparent && o.material.opacity <= 0.08;
  const control = (o.userData.control && !faded) ? o.userData.control : null;
  /* A music strip carries the panel rather than a track id, because the
     playlist changes which song it is working; asking the panel means the
     buttons always act on whatever is loaded now. */
  const panel = o.userData.panel || null;
  const viaPanel = panel && panel.art ? panel.art.id : null;
  const controlArtId = control ? (viaPanel !== null ? viaPanel : (o.userData.mediaArtId !== undefined ? o.userData.mediaArtId : null)) : null;
  const openArtId = o.userData.open ? viaPanel : (o.userData.openArtId !== undefined ? o.userData.openArtId : null);
  const seekArtId = o.userData.seek ? viaPanel : (o.userData.seekArtId !== undefined ? o.userData.seekArtId : null);
  const struck = o;
  while (o && !o.userData.frame) o = o.parent;
  if (!o) return null;
  return { frame: o.userData.frame, control: control, controlArtId: controlArtId,
           openArtId: openArtId, seekArtId: seekArtId, object: struck, panel: panel,
           point: hits[0].point, distance: hits[0].distance };
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
  /* Somebody in the way is dealt with first - they are the reason you
     cannot get to whatever is behind them. */
  if (hit.visitor) return askVisitorToMove(hit.visitor, performance.now());

  /* A button is a button, whichever sticker happens to be selected. */
  if (hit.control && hit.frame) {
    /* the playlist keys act on the strip, not on any one track */
    if (hit.control === "next") { playlistNext(hit.panel); return true; }
    if (hit.control === "prev") { playlistPrev(hit.panel); return true; }
    if (hit.control === "mode") { cyclePlaylistMode(hit.panel); return true; }
    const target = (hit.controlArtId !== null && hit.controlArtId !== undefined)
      ? State.art.find(a => a.id === hit.controlArtId) || hit.frame.art
      : hit.frame.art;
    if (hit.control === "play") toggleMedia(target);
    else if (hit.control === "mute") toggleMediaMute(target);
    return true;
  }
  /* pointing at the waveform jumps to that point in the track */
  if (hit.seekArtId !== null && hit.seekArtId !== undefined && !stamp) {
    if (seekMediaTo(hit.seekArtId, hit.object, hit.point)) return true;
  }

  /* the body of a music strip opens the track it belongs to */
  if (hit.openArtId !== null && hit.openArtId !== undefined && !stamp) {
    const track = State.art.find(a => a.id === hit.openArtId);
    if (track) { openArtwork(hit.frame, track); return true; }
  }
  if (hit.frame) {
    if (stamp) placeSticker(hit.frame, hit.point);
    else openArtwork(hit.frame);
    return true;
  }
  return false;
}
