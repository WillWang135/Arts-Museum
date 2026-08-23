/* ============================================================
   ARCHITECTURE  --  the rotunda, its wings and alcoves.
   ============================================================ */
const Y_LOW = 0.34, Y_RAIL = 3.2;        // gold panel reveals, everywhere

function buildShell(layout) {
  const open = layout.open;
  const step = Math.PI * 2 / G.SEG;
  const hi = quality === "high";
  /* Y_LOW and Y_RAIL are module-level: the rooms are built by their own
     function now, and they line their reveals up with the rotunda's. */

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);

  /* rotunda walls with gold panel linework */
  for (let i = 0; i < G.SEG; i++) {
    /* Only a facet that actually leads somewhere is an opening. The rest
       are wall, and hang work - which is what keeps a small museum's
       rotunda full rather than punched through with eight empty doorways. */
    const isDoor = !!layout.doors[i];
    const rad = G.APO + G.WALL_T / 2;
    const lineR = G.APO - 0.035;

    if (!isDoor) {
      segSlab(i, G.CHORD + 0.06, G.WALL_H, G.WALL_T, rad, G.WALL_H / 2, MAT.wall);
      segSlab(i, G.CHORD + 0.06, 0.2, 0.16, G.APO - 0.06, 0.1, MAT.base);
      segSlab(i, G.CHORD + 0.06, 0.26, 0.2, G.APO - 0.08, G.WALL_H - 0.5, MAT.trim);
      segSlab(i, G.CHORD, 0.022, 0.04, lineR, Y_LOW, MAT.brass, 0, true);
      segSlab(i, G.CHORD, 0.022, 0.04, lineR, Y_RAIL, MAT.brass, 0, true);
      segSlab(i, G.CHORD, 0.016, 0.035, lineR, G.WALL_H - 0.78, MAT.brass, 0, true);
    } else {
      /* No side jambs here. They used to repeat the lintel above the opening
         and the wing's own front wall beside it, at exactly the same depth,
         which set those surfaces flickering. The lintel plus the room's front
         wall already close the gap, so one piece of geometry does the job. */
      const lintelH = G.WALL_H - G.DOOR_H;
      segSlab(i, G.CHORD + 0.06, lintelH, G.WALL_T, rad, G.DOOR_H + lintelH / 2, MAT.wall);
      segSlab(i, G.CHORD + 0.06, 0.26, 0.2, G.APO - 0.08, G.WALL_H - 0.5, MAT.trim);
      segSlab(i, G.CHORD, 0.016, 0.035, lineR, G.WALL_H - 0.78, MAT.brass, 0, true);
      segSlab(i, G.DOOR_W + 0.46, 0.16, 0.12, G.APO - 0.04, G.DOOR_H + 0.08, MAT.brass, 0, true);
      /* the upright trims sit just inside the reveal, their far edge buried
         in the wall so no two faces ever share a plane */
      [1, -1].forEach(sg => segSlab(i, 0.16, G.DOOR_H, 0.12, G.APO - 0.04, G.DOOR_H / 2, MAT.brass, sg * 1.86, true));
    }
    /* one vertical reveal per facet junction: each panel frames one work */
    if (hi) segSlab(i, 0.022, Y_RAIL - Y_LOW, 0.04, G.APO - 0.035, (Y_LOW + Y_RAIL) / 2, MAT.brass, G.CHORD / 2, true);
  }

  /* cove glow under the cornice lifts the whole room */
  for (let i = 0; i < G.SEG; i++) {
    segSlab(i, G.CHORD, 0.07, 0.03, G.APO - 0.26, G.WALL_H - 0.72, MAT.cove, 0, true);
  }

  /* ceiling ring + glazed oculus over the featured work */
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.9, G.R + 0.6, G.SEG, 1, step * 0.5), MAT.ceiling);
  ring.rotation.x = Math.PI / 2; ring.position.y = G.WALL_H; root.add(ring);

  const skyT = skyTexture();
  skyT.repeat.set(1.7, 1.7);
  const oculus = new THREE.Mesh(new THREE.CircleGeometry(4.9, 44), new THREE.MeshBasicMaterial({ map: skyT }));
  oculus.rotation.x = Math.PI / 2; oculus.position.y = G.WALL_H - 0.03; root.add(oculus);
  Anim.skies.push({ tex: skyT, ux: 0.0055, uy: 0.0016 });

  const torus = new THREE.Mesh(new THREE.TorusGeometry(4.95, 0.1, 10, 52), MAT.brass);
  torus.rotation.x = Math.PI / 2; torus.position.y = G.WALL_H - 0.07; root.add(torus);
  for (let i = 0; i < 6; i++) {
    plain(0.05, 0.05, 9.8, MAT.brass, 0, G.WALL_H - 0.07, 0, i * Math.PI / 6);
  }
  const hub = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.07, 8, 34), MAT.brass);
  hub.rotation.x = Math.PI / 2; hub.position.y = G.WALL_H - 0.07; root.add(hub);

  /* faint shaft of daylight from the oculus */
  if (hi) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(4.7, 8.4, G.WALL_H - 0.3, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xFFF0D2, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
    shaft.position.y = (G.WALL_H - 0.3) / 2;
    root.add(shaft);
    Anim.shafts.push(shaft);
  }
  sunPool(-6.6, 5.4, 7.4, 9.2, 0.4);
  sunPool(6.9, 4.6, 6.6, 8.4, 2.6);

  /* ---- the side rooms ----
     Each direction carries a chain of rooms reaching outward. A room with
     another beyond it has a doorway in its far wall rather than a wall, so
     a section of thirty works reads as one long gallery rather than three
     separate cupboards. */
  layout.rooms.forEach((room, index) => {
    buildSideRoom(room, index, layout);
  });

  /* and a piece in a recess wherever a square side has no room yet */
  layout.niches.forEach(k => buildNiche(k));


  /* ---- furnishing the rotunda ----
     A room to walk through and stand in, so it carries pieces and nothing to
     sit on. The wall is at 13.73 m and hangs work on twelve of its sixteen
     facets; the plinths sit at 9 m, which leaves four and a half metres of
     clear floor in front of every picture. The four doorways lie on the axes,
     and those lanes are left completely open. */
  /* No ropes out here. A barrier round an ordinary plinth says "this one is
     precious" about a piece that is not, and four of them said it about the
     whole room. The only rope in the museum is the one across the feature
     wall, where there is a reason for it. Empty floor is not a problem to be
     solved - it is the space people need to stand back and look. */
  [45, 135, 225, 315].forEach((deg, i) => {
    const a = deg * Math.PI / 180, r = 9.0;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const drum = i % 2 === 1;
    const top = makePlinth(x, z, drum ? 1.04 : 1.10, drum ? 0.36 : 0.44,
      drum ? MAT.limestone : MAT.travertine, drum ? "drum" : "box");
    if (i === 1) makeVase(x, z, top, MAT.terracotta, true, 1.0);
    else if (i === 3) makeBowl(x, z, top, MAT.limestone, 1.05);
    else makeSculpture(x, z, top, i + 2, 1.12);
  });

  /* Two quiet pieces behind the feature wall, where the room would
     otherwise read as empty floor. Set out at 10.5 m and well off the
     diagonals, so they clear the corner plinths at 9 m and leave the lane
     from the south door to the wall completely open. */
  makeArchway(3.6, -10.4, 0.4, 1.0);
  makeVitrine(-3.6, -10.4, 0.3, 2);
  makeLabelStand(-5.4, -9.2, 0.6);
}


/* ============================================================
   ONE SIDE ROOM
   ============================================================ */
function buildSideRoom(room, index, layout) {
  const k = room.dir;
  const u = WING_DIR[k], v = { x: -u.z, z: u.x };
  const half = room.half, H = G.WING_H;
  const L = room.s1 - room.s0;
  const ry = Math.atan2(u.x, u.z);              // local +Z aligned with u
  const at = (s, t, y) => ({ x: u.x * s + v.x * t, y: y, z: u.z * s + v.z * t });

  /* Front wall either side of the doorway. It reaches 0.10 m into the
     opening and 0.30 m into the side wall, so neither end lines up flush
     with another surface - flush ends are what caused the flicker here. */
  const revealT = G.DOOR_W / 2 - 0.10;
  const fill = (half + 0.30) - revealT;
  if (fill > 0.06) {
    [1, -1].forEach(sg => {
      const p = at(room.s0 + 0.30, sg * (revealT + fill / 2), H / 2);
      box(fill, H + 0.12, 0.7, MAT.wall, p.x, H / 2, p.z, ry);
      const sp = at(room.s0 - 0.04, sg * (revealT - 0.05 + fill / 2), 0.1);
      box(fill, 0.2, 0.20, MAT.base, sp.x, 0.1, sp.z, ry);
    });
    /* the lintel over the opening */
    const lp = at(room.s0 + 0.30, 0, G.DOOR_H + (H - G.DOOR_H) / 2);
    box(G.DOOR_W + 0.2, H - G.DOOR_H, 0.7, MAT.wall, lp.x, G.DOOR_H + (H - G.DOOR_H) / 2, lp.z, ry);
  }

  /* side walls - inner face sits exactly on the hang line at |t| = half */
  [1, -1].forEach(sg => {
    const p = at(room.s0 + L / 2, sg * (half + G.WALL_T / 2), H / 2);
    const w = new THREE.Mesh(new THREE.BoxGeometry(G.WALL_T, H, L), MAT.wall);
    w.position.set(p.x, p.y, p.z); w.rotation.y = ry;
    w.castShadow = true; w.receiveShadow = true; root.add(w);

    const bp = at(room.s0 + L / 2, sg * (half - 0.08), 0.1);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, L), MAT.base);
    b.position.set(bp.x, bp.y, bp.z); b.rotation.y = ry; root.add(b);

    [Y_LOW, Y_RAIL, H - 0.62].forEach((yy, qi) => {
      const lp = at(room.s0 + L / 2, sg * (half - 0.03), yy);
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.045, qi === 2 ? 0.016 : 0.022, L - 0.4), MAT.brass);
      ln.position.set(lp.x, yy, lp.z); ln.rotation.y = ry; root.add(ln);
    });
    const cv = at(room.s0 + L / 2, sg * (half - 0.22), H - 0.55);
    const cove = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, L - 1.2), MAT.cove);
    cove.position.set(cv.x, H - 0.55, cv.z); cove.rotation.y = ry; root.add(cove);
  });

  /* the far wall: solid when the section ends here, an opening when it
     carries on into the next room */
  if (room.last) {
    const e = at(room.s1 + G.WALL_T / 2, 0, H / 2);
    box(half * 2 + G.WALL_T, H, G.WALL_T, MAT.wall, e.x, e.y, e.z, ry);
    const eb = at(room.s1 - 0.08, 0, 0.1);
    box(half * 2, 0.2, 0.16, MAT.base, eb.x, eb.y, eb.z, ry);
    [Y_LOW, Y_RAIL].forEach(yy => {
      const lp = at(room.s1 - 0.03, 0, yy);
      plain(half * 2 - 0.3, 0.022, 0.045, MAT.brass, lp.x, yy, lp.z, ry);
    });
  } else {
    const revT = G.DOOR_W / 2;
    const wfill = half - revT;
    [1, -1].forEach(sg => {
      if (wfill <= 0.06) return;
      const p = at(room.s1 + G.WALL_T / 2, sg * (revT + wfill / 2), H / 2);
      box(wfill + 0.3, H, G.WALL_T, MAT.wall, p.x, H / 2, p.z, ry);
    });
    const lp = at(room.s1 + G.WALL_T / 2, 0, G.DOOR_H + (H - G.DOOR_H) / 2);
    box(G.DOOR_W + 0.2, H - G.DOOR_H, G.WALL_T, MAT.wall, lp.x, G.DOOR_H + (H - G.DOOR_H) / 2, lp.z, ry);
    /* the throat between one room and the next */
    [1, -1].forEach(sg => {
      const p = at(room.s1 + G.WALL_T + ROOM_GAP / 2, sg * (G.DOOR_W / 2 + G.WALL_T / 2), H / 2);
      box(G.WALL_T, H, ROOM_GAP, MAT.wall, p.x, H / 2, p.z, ry);
    });
    const cp2 = at(room.s1 + G.WALL_T + ROOM_GAP / 2, 0, H);
    const cm2 = new THREE.Mesh(new THREE.PlaneGeometry(G.DOOR_W + G.WALL_T * 2, ROOM_GAP + 0.4), MAT.ceiling);
    cm2.position.set(cp2.x, H, cp2.z);
    cm2.rotation.order = "YXZ"; cm2.rotation.set(Math.PI / 2, ry, 0);
    root.add(cm2);
  }

  /* ceiling */
  const cp = at(room.s0 + L / 2, 0, H);
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 0.8, L + 0.8), MAT.ceiling);
  cm.position.set(cp.x, H, cp.z);
  cm.rotation.order = "YXZ"; cm.rotation.set(Math.PI / 2, ry, 0);
  root.add(cm);

  /* glazed rooflight running down the middle of the room */
  const rw = 2.2, rl = Math.max(1.6, L - 4.0);
  const rt = skyTexture();
  rt.repeat.set(1, Math.max(1, rl / rw / 1.9));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(rw, rl), new THREE.MeshBasicMaterial({ map: rt }));
  glass.position.set(cp.x, H - 0.04, cp.z);
  glass.rotation.order = "YXZ"; glass.rotation.set(Math.PI / 2, ry, 0);
  root.add(glass);
  Anim.skies.push({ tex: rt, ux: 0.0011, uy: 0.0042 });

  [[rw + 0.14, 0.05, 0, rl / 2], [rw + 0.14, 0.05, 0, -rl / 2],
   [0.05, rl + 0.14, rw / 2, 0], [0.05, rl + 0.14, -rw / 2, 0]].forEach(f => {
    const p = at(room.s0 + L / 2 + f[3], f[2], H - 0.06);
    plain(f[0], 0.07, f[1], MAT.brass, p.x, H - 0.06, p.z, ry);
  });
  const bars = Math.max(1, Math.round(rl / 2.6));
  for (let b = 1; b < bars; b++) {
    const off = -rl / 2 + rl * b / bars;
    const p = at(room.s0 + L / 2 + off, 0, H - 0.06);
    plain(rw, 0.055, 0.045, MAT.brass, p.x, H - 0.06, p.z, ry);
  }

  const sp = at(room.s0 + L / 2, 0, 0);
  sunPool(sp.x, sp.z, 3.4, rl * 0.8, k * 1.7 + room.depth);

  /* Walkable: the room, its doorway, and - when one follows - the throat
     through to it, so a section really is one continuous walk. */
  Nav.zones.push({
    ux: u.x, uz: u.z, vx: v.x, vz: v.z,
    s0: room.s0 + 1.05, s1: room.s1 - 0.45, half: half - 0.45,
    t0: room.s0 - 1.6, t1: room.s0 + 1.3, doorHalf: G.DOOR_W / 2 - 0.45
  });
  if (!room.last) {
    /* The passage through to the next room, walkable end to end. Written as
       a room-shaped zone rather than a doorway one, because a doorway zone
       is a slot in a wall and this is a corridor - and with the wrong one
       here the opening was there to look through and not to walk through. */
    Nav.zones.push({
      ux: u.x, uz: u.z, vx: v.x, vz: v.z,
      s0: room.s1 - 1.0, s1: room.s1 + G.WALL_T + ROOM_GAP + 1.0,
      half: G.DOOR_W / 2 - 0.35,
      t0: room.s1, t1: room.s1 - 1, doorHalf: 0
    });
  }

  /* the name of the section, over the doorway you come in by */
  if (room.name && room.first) buildRoomSign(room, k);

  furnishRoom(room, index, ry, at, half, L);
}

/* A doorway with nothing behind it becomes a shallow recess with a piece in
   it, rather than a blank panel where an opening should be. */
function buildNiche(k) {
  const u = WING_DIR[k], v = { x: -u.z, z: u.x };
  const half = G.ALCOVE_HALF, L = G.ALCOVE_D, H = 4.6;
  const ry = Math.atan2(u.x, u.z);
  const at = (s, t, y) => ({ x: u.x * s + v.x * t, y: y, z: u.z * s + v.z * t });

  const revealT = G.DOOR_W / 2 - 0.10;
  const fill = (half + 0.30) - revealT;
  if (fill > 0.06) {
    [1, -1].forEach(sg => {
      const p = at(G.APO + 0.30, sg * (revealT + fill / 2), H / 2);
      box(fill, H + 0.12, 0.7, MAT.wall, p.x, H / 2, p.z, ry);
      const sp = at(G.APO - 0.04, sg * (revealT - 0.05 + fill / 2), 0.1);
      box(fill, 0.2, 0.20, MAT.base, sp.x, 0.1, sp.z, ry);
    });
  }
  [1, -1].forEach(sg => {
    const p = at(G.APO + L / 2, sg * (half + G.WALL_T / 2), H / 2);
    box(G.WALL_T, H, L, MAT.wall, p.x, H / 2, p.z, ry);
  });
  const e = at(G.APO + L + G.WALL_T / 2, 0, H / 2);
  box(half * 2 + G.WALL_T, H, G.WALL_T, MAT.wall, e.x, e.y, e.z, ry);
  const cp = at(G.APO + L / 2, 0, H);
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 0.8, L + 0.8), MAT.ceiling);
  cm.position.set(cp.x, H, cp.z);
  cm.rotation.order = "YXZ"; cm.rotation.set(Math.PI / 2, ry, 0);
  root.add(cm);
  const eb = at(G.APO + L - 0.08, 0, 0.1);
  box(half * 2, 0.2, 0.16, MAT.base, eb.x, eb.y, eb.z, ry);

  Nav.zones.push({
    ux: u.x, uz: u.z, vx: v.x, vz: v.z,
    s0: G.APO + 1.05, s1: G.APO + L - 0.45, half: half - 0.45,
    t0: G.APO - 1.6, t1: G.APO + 1.3, doorHalf: G.DOOR_W / 2 - 0.45
  });

  const m1 = at(G.APO + L * 0.52, 0, 0);
  const top = makePlinth(m1.x, m1.z, 1.0, 0.33, MAT.limestone, "drum");
  if (k % 2 === 0) makeVase(m1.x, m1.z, top, MAT.terracotta, true, 0.92);
  else makeVase(m1.x, m1.z, top, MAT.olive, false, 0.92);
}

/* The section's name, on a brass-edged plate above its doorway - read from
   the middle of the rotunda, well clear of the opening and of anything
   hanging inside. */
function buildRoomSign(room, k) {
  const u = WING_DIR[k];
  const ry = Math.atan2(u.x, u.z);
  const plate = roomSignTexture(room.index, room.name);
  const h = 0.74, w = h * plate.aspect;
  /* Between the top of the opening and the cornice: clear of the doorway,
     clear of the ceiling, and nothing hangs on a doorway facet anyway. */
  const y = G.DOOR_H + 0.16 + h / 2;

  /* Three surfaces five millimetres apart is three surfaces the depth buffer
     cannot tell apart at fourteen metres, and the sign blinked as the camera
     moved. They are properly spaced now - a case, a brass rim standing proud
     of it, and the lit face standing proud of that - and the face is opaque
     and offset toward the viewer besides, so nothing behind it can win a
     pixel it should not have. */
  const px = u.x * (G.APO - 0.22), pz = u.z * (G.APO - 0.22);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.10), MAT.darkStone);
  back.position.set(px, y, pz); back.rotation.y = ry;
  back.castShadow = true; root.add(back);

  /* the rim: a frame of four bars rather than a slab behind the face, so it
     is never in the same place as anything else */
  const rimT = 0.055, rimD = 0.05;
  const rimZ = 0.075;
  [[w + 0.20, rimT, 0, (h + rimT) / 2], [w + 0.20, rimT, 0, -(h + rimT) / 2],
   [rimT, h + 0.20, (w + rimT) / 2, 0], [rimT, h + 0.20, -(w + rimT) / 2, 0]].forEach(b => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], rimD), MAT.brass);
    m.position.set(px - u.x * rimZ + (-u.z) * b[2], y + b[3], pz - u.z * rimZ + u.x * b[2]);
    m.rotation.y = ry;
    root.add(m);
  });

  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: plate.tex, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));
  face.position.set(px - u.x * 0.085, y, pz - u.z * 0.085);
  face.rotation.y = ry + Math.PI;
  face.renderOrder = 3;
  root.add(face);
}


/* Fewer things, further apart. Four rules decide every position: nothing
   within two and a half metres of a hang line, so no object is ever standing
   in front of a drawing; nothing in the lane between the door and the far
   wall; every gap a visitor might walk through comfortably wider than they
   are; and everything placed by index, so a rebuild puts the same room back.

   Seating lives out here rather than in the rotunda, and it is one long
   bench a side - not a scatter of chairs. */
function furnishRoom(room, index, ry, at, half, L) {
  const k = room.dir + room.depth;
  const alongRoom = ry - Math.PI / 2;
  const mid = room.s0 + L / 2;

  /* Everything lives in the middle third of the room. The walls are for
     looking at, the middle is for standing in, and the two must not meet:
     a bench against a hang line is a bench you have to edge round to see
     what is above it. */
  const m1 = at(mid, 0, 0);
  const drum = k % 2 === 1;
  const top = makePlinth(m1.x, m1.z, drum ? 0.94 : 1.02, drum ? 0.32 : 0.40,
    drum ? MAT.limestone : MAT.travertine, drum ? "drum" : "box");
  if (drum) makeBowl(m1.x, m1.z, top, MAT.limestone, 1.0);
  else makeSculpture(m1.x, m1.z, top, k, 1.02);

  /* a piece either side of it, further along the room's own axis */
  const a1 = at(mid - 4.4, 0, 0), a2 = at(mid + 4.4, 0, 0);
  if (k % 3 === 0) { makeArchway(a1.x, a1.z, ry, 0.95); makeFloorStone(a2.x, a2.z, 0.95, MAT.limestoneLo); }
  else if (k % 3 === 1) { makeFloorStone(a1.x, a1.z, 0.95, MAT.pebble); makeVitrine(a2.x, a2.z, alongRoom, k); }
  else { makeVitrine(a1.x, a1.z, alongRoom, k); makeArchway(a2.x, a2.z, ry + Math.PI, 0.95); }

  /* Two long benches, one either side of the middle, turned along the room
     and facing the walls they serve. Set at 2.4 m from the centre line they
     leave 2.4 m of clear floor between bench and wall to stand and look,
     and 4.8 m down the middle to walk through. */
  const BENCH_T = 2.4;
  [1, -1].forEach(sg => {
    const b = at(mid, sg * BENCH_T, 0);
    makeBench(b.x, b.z, alongRoom, 3.2);
  });

  /* and the reading stand, in the first room of a section only */
  if (room.first) {
    const ls = at(room.s0 + 3.2, -2.6, 0);
    makeLabelStand(ls.x, ls.z, ry + Math.PI);
  }
}
