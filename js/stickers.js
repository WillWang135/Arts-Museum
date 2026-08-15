/* ============================================================
   STICKERS  --  awarding, restoring and removing them.
   ============================================================ */
function stickerMesh(kind, scale) {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.scale.setScalar(0.86 * scale);
  g.add(glow);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stickerTexture(kind), transparent: true, depthWrite: false }));
  sp.scale.setScalar(0.36 * scale);
  g.add(sp);
  g.userData.glow = glow;
  g.userData.sprite = sp;
  g.userData.phase = Math.random() * 6.3;
  return g;
}

function attachSticker(frame, slotIndex, kind, record) {
  const slot = frame.slots[slotIndex];
  if (!slot || slot.taken) return null;
  const g = stickerMesh(kind, frame.scale);
  g.position.set(slot.x, slot.y, slot.z);
  g.userData.frame = frame;
  g.userData.slotIndex = slotIndex;
  g.userData.kind = kind;
  frame.group.add(g);
  slot.taken = g;
  StickerObjs.push(g.userData.sprite);
  g.userData.sprite.userData.holder = g;
  if (record) State.stickers.push({ artId: frame.art.id, slot: slotIndex, type: kind });
  return g;
}

function restoreStickers() {
  const keep = [];
  State.stickers.forEach(rec => {
    const f = Frames.find(fr => fr.art.id === rec.artId);
    if (f && f.slots[rec.slot] && !f.slots[rec.slot].taken) {
      attachSticker(f, rec.slot, rec.type, false);
      keep.push(rec);
    }
  });
  State.stickers = keep;
}

function placeSticker(frame, worldPoint) {
  const local = frame.group.worldToLocal(worldPoint.clone());
  let best = -1, bestD = Infinity;
  frame.slots.forEach((s, i) => {
    if (s.taken) return;
    const d = (s.x - local.x) * (s.x - local.x) + (s.y - local.y) * (s.y - local.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best < 0) { toast("This work is full of stickers"); return; }
  const g = attachSticker(frame, best, stamp, true);
  if (g) {
    g.scale.setScalar(0.1);
    g.userData.pop = 0;
    toast(STAMPS[stamp].label + " — " + (frame.art.name || "Untitled"));
  }
}

function removeSticker(sprite) {
  const g = sprite.userData.holder;
  if (!g) return;
  const frame = g.userData.frame, idx = g.userData.slotIndex;
  frame.slots[idx].taken = null;
  frame.group.remove(g);
  const si = StickerObjs.indexOf(sprite);
  if (si >= 0) StickerObjs.splice(si, 1);
  const ri = State.stickers.findIndex(r => r.artId === frame.art.id && r.slot === idx);
  if (ri >= 0) State.stickers.splice(ri, 1);
  toast("Sticker removed");
}

function pulseStickers(t, dt) {
  Frames.forEach(f => {
    f.slots.forEach(s => {
      if (!s.taken) return;
      const g = s.taken;
      g.userData.glow.material.opacity = 0.34 + 0.26 * (0.5 + 0.5 * Math.sin(t * 2.1 + g.userData.phase));
      if (g.userData.pop !== undefined && g.userData.pop < 1) {
        g.userData.pop = Math.min(1, g.userData.pop + dt * 3.4);
        const e = 1 + Math.sin(g.userData.pop * Math.PI) * 0.35;
        g.scale.setScalar(g.userData.pop * e);
      }
    });
  });
}
