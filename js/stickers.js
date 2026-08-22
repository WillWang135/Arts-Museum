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

/* A surface that can take reactions: a hung frame, or the presentation
   screen. Both have a group to hang them in, eight positions, and an id to
   record them against - and for the screen that id is the slide showing,
   not the deck, so a reaction stays on the page it was left on. */
function surfaceId(surface) {
  return surface.art ? surface.art.id : surface.stickerId;
}

function attachSticker(surface, slotIndex, kind, record) {
  const slot = surface.slots[slotIndex];
  if (!slot || slot.taken) return null;
  const g = stickerMesh(kind, surface.scale);
  g.position.set(slot.x, slot.y, slot.z);
  g.userData.frame = surface;
  g.userData.slotIndex = slotIndex;
  g.userData.kind = kind;
  surface.group.add(g);
  slot.taken = g;
  StickerObjs.push(g.userData.sprite);
  g.userData.sprite.userData.holder = g;
  if (record) State.stickers.push({ artId: surfaceId(surface), slot: slotIndex, type: kind });
  return g;
}

/* A frame carries eight sticker positions. Awards past that are still kept
   in State.stickers - they simply have no position yet, recorded as
   slot:null - so the count on the artwork card stays honest and nothing a
   class awarded is thrown away. Free a position and the oldest waiting
   sticker moves into it. */
const MAX_VISIBLE_STICKERS = 8;

function visibleLimit(surface) {
  return Math.min(surface.slots.length, MAX_VISIBLE_STICKERS);
}
function firstFreeSlot(frame) {
  const limit = visibleLimit(frame);
  for (let i = 0; i < limit; i++) if (!frame.slots[i].taken) return i;
  return -1;
}
/* the earliest award for this work that is recorded but not on the wall */
function firstWaiting(artId) {
  return State.stickers.find(r => r.artId === artId && (r.slot === null || r.slot === undefined));
}

function popIn(g) {
  if (!g) return;
  g.scale.setScalar(0.1);
  g.userData.pop = 0;
}

function restoreStickers() {
  /* First pass keeps every sticker where it was, so a rebuild - changing
     the lighting, say - does not shuffle the wall around. */
  const placed = new Set();
  State.stickers.forEach((rec, i) => {
    const f = Frames.find(fr => fr.art.id === rec.artId);
    if (!f || rec.slot === null || rec.slot === undefined) return;
    if (rec.slot < visibleLimit(f) && f.slots[rec.slot] && !f.slots[rec.slot].taken) {
      attachSticker(f, rec.slot, rec.type, false);
      placed.add(i);
    }
  });
  /* Second pass hangs whatever is left wherever there is room, in the order
     it was awarded. Anything with nowhere to go stays recorded, unplaced. */
  State.stickers.forEach((rec, i) => {
    if (placed.has(i)) return;
    const f = Frames.find(fr => fr.art.id === rec.artId);
    if (!f) { rec.slot = null; return; }
    const idx = firstFreeSlot(f);
    rec.slot = idx < 0 ? null : idx;
    if (idx >= 0) attachSticker(f, idx, rec.type, false);
  });
}

/* ---------- reactions on a presentation slide ----------
   The screen is one surface showing many pages, so its reactions are torn
   down and rebuilt every time the slide changes. Anything recorded against
   a slide that is not showing simply is not on the wall - which is the
   whole point: a reaction left on slide three must not appear on slide four. */
function clearSlideStickers() {
  if (!DeckScreen || !DeckScreen.slots) return;
  DeckScreen.slots.forEach(s => {
    if (!s.taken) return;
    const g = s.taken;
    const si = StickerObjs.indexOf(g.userData.sprite);
    if (si >= 0) StickerObjs.splice(si, 1);
    DeckScreen.group.remove(g);
    s.taken = null;
  });
}

function restoreSlideStickers() {
  if (!DeckScreen || !DeckScreen.slots) return;
  clearSlideStickers();
  const id = deckCurrentId();
  DeckScreen.stickerId = id;
  if (id === null || id === undefined) { syncViewerStickers(); return; }

  const mine = State.stickers.filter(r => r.artId === id);
  const placed = new Set();
  mine.forEach(rec => {
    if (rec.slot === null || rec.slot === undefined) return;
    if (rec.slot < visibleLimit(DeckScreen) && !DeckScreen.slots[rec.slot].taken) {
      attachSticker(DeckScreen, rec.slot, rec.type, false);
      placed.add(rec);
    }
  });
  mine.forEach(rec => {
    if (placed.has(rec)) return;
    const idx = firstFreeSlot(DeckScreen);
    rec.slot = idx < 0 ? null : idx;
    if (idx >= 0) attachSticker(DeckScreen, idx, rec.type, false);
  });
  syncViewerStickers();
}

function placeSticker(surface, worldPoint) {
  const local = surface.group.worldToLocal(worldPoint.clone());
  const limit = visibleLimit(surface);
  let best = -1, bestD = Infinity;
  for (let i = 0; i < limit; i++) {
    const s = surface.slots[i];
    if (s.taken) continue;
    const d = (s.x - local.x) * (s.x - local.x) + (s.y - local.y) * (s.y - local.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  const name = surface.art ? (surface.art.name || "Untitled") : ("slide " + deckLabel());

  if (best < 0) {
    /* Every position is taken. Record it anyway - it counts on the card,
       and it takes the first place that frees up. */
    State.stickers.push({ artId: surfaceId(surface), slot: null, type: stamp });
    toast(STAMPS[stamp].label + " — counted, wall is full at " + MAX_VISIBLE_STICKERS);
    return;
  }
  popIn(attachSticker(surface, best, stamp, true));
  if (!surface.art) syncViewerStickers();
  toast(STAMPS[stamp].label + " — " + name);
}

function removeSticker(sprite) {
  const g = sprite.userData.holder;
  if (!g) return;
  const surface = g.userData.frame, idx = g.userData.slotIndex;
  const id = surfaceId(surface);
  surface.slots[idx].taken = null;
  surface.group.remove(g);
  const si = StickerObjs.indexOf(sprite);
  if (si >= 0) StickerObjs.splice(si, 1);
  const ri = State.stickers.findIndex(r => r.artId === id && r.slot === idx);
  if (ri >= 0) State.stickers.splice(ri, 1);

  /* Promote the oldest sticker that has been waiting for a position. */
  const next = firstWaiting(id);
  if (next) {
    next.slot = idx;
    popIn(attachSticker(surface, idx, next.type, false));
    if (!surface.art) syncViewerStickers();
    toast("Sticker removed — another took its place");
    return;
  }
  if (!surface.art) syncViewerStickers();
  toast("Sticker removed");
}

function pulseStickers(t, dt) {
  const surfaces = DeckScreen && DeckScreen.slots ? Frames.concat([DeckScreen]) : Frames;
  surfaces.forEach(f => {
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
