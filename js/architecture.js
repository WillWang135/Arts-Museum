/* ============================================================
   ARCHITECTURE  --  the rotunda, its wings and alcoves.
   ============================================================ */
function buildShell(open) {
  const step = Math.PI * 2 / G.SEG;
  const hi = quality === "high";
  const Y_LOW = 0.34, Y_RAIL = 3.2;      // gold panel reveals

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);

  /* rotunda walls with gold panel linework */
  for (let i = 0; i < G.SEG; i++) {
    const isDoor = DOOR_SEGS.indexOf(i) !== -1;
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

  /* wings and alcoves */
  WING_DIR.forEach((u, k) => {
    const v = { x: -u.z, z: u.x };
    const isWing = open[k];
    const L = isWing ? G.WING_LEN : G.ALCOVE_D;
    const half = isWing ? G.WING_HALF : G.ALCOVE_HALF;
    const H = isWing ? G.WING_H : 4.6;
    const ry = Math.atan2(u.x, u.z);   // local +Z aligned with u
    const at = (s, t, y) => ({ x: u.x * s + v.x * t, y: y, z: u.z * s + v.z * t });

    /* Front wall either side of the doorway. It reaches 0.10 m into the
       opening and 0.30 m into the side wall, so neither end lines up flush
       with another surface - flush ends are what caused the flicker here. */
    const revealT = G.DOOR_W / 2 - 0.10;
    const fill = (half + 0.30) - revealT;
    if (fill > 0.06) {
      [1, -1].forEach(sg => {
        const p = at(G.APO + 0.30, sg * (revealT + fill / 2), H / 2);
        box(fill, H + 0.12, 0.7, MAT.wall, p.x, H / 2, p.z, ry);   // over-runs floor and ceiling
        /* deeper than the upright trim so the two never share a plane */
        const sp = at(G.APO - 0.04, sg * (revealT - 0.05 + fill / 2), 0.1);
        box(fill, 0.2, 0.20, MAT.base, sp.x, 0.1, sp.z, ry);
      });
    }

    /* side walls — inner face sits exactly on the hang line at |t| = half */
    [1, -1].forEach(sg => {
      const p = at(G.APO + L / 2, sg * (half + G.WALL_T / 2), H / 2);
      const w = new THREE.Mesh(new THREE.BoxGeometry(G.WALL_T, H, L), MAT.wall);
      w.position.set(p.x, p.y, p.z); w.rotation.y = ry;
      w.castShadow = true; w.receiveShadow = true; root.add(w);

      const bp = at(G.APO + L / 2, sg * (half - 0.08), 0.1);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, L), MAT.base);
      b.position.set(bp.x, bp.y, bp.z); b.rotation.y = ry; root.add(b);

      [Y_LOW, Y_RAIL, H - 0.62].forEach((yy, qi) => {
        const lp = at(G.APO + L / 2, sg * (half - 0.03), yy);
        const ln = new THREE.Mesh(new THREE.BoxGeometry(0.045, qi === 2 ? 0.016 : 0.022, L - 0.4), MAT.brass);
        ln.position.set(lp.x, yy, lp.z); ln.rotation.y = ry; root.add(ln);
      });
      const cv = at(G.APO + L / 2, sg * (half - 0.22), H - 0.55);
      const cove = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, L - 1.2), MAT.cove);
      cove.position.set(cv.x, H - 0.55, cv.z); cove.rotation.y = ry; root.add(cove);
    });

    /* end wall */
    const e = at(G.APO + L + G.WALL_T / 2, 0, H / 2);
    box(half * 2 + G.WALL_T, H, G.WALL_T, MAT.wall, e.x, e.y, e.z, ry);
    const eb = at(G.APO + L - 0.08, 0, 0.1);
    box(half * 2, 0.2, 0.16, MAT.base, eb.x, eb.y, eb.z, ry);
    [Y_LOW, Y_RAIL].forEach(yy => {
      const lp = at(G.APO + L - 0.03, 0, yy);
      plain(half * 2 - 0.3, 0.022, 0.045, MAT.brass, lp.x, yy, lp.z, ry);
    });

    /* ceiling */
    const cp = at(G.APO + L / 2, 0, H);
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 0.8, L + 0.8), MAT.ceiling);
    cm.position.set(cp.x, H, cp.z);
    cm.rotation.order = "YXZ"; cm.rotation.set(Math.PI / 2, ry, 0);
    root.add(cm);

    /* glazed rooflight running down the middle of the room */
    const rw = isWing ? 2.5 : 1.5, rl = Math.max(1.6, L - (isWing ? 5.0 : 1.4));
    const rt = skyTexture();
    rt.repeat.set(1, Math.max(1, rl / rw / 1.9));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(rw, rl), new THREE.MeshBasicMaterial({ map: rt }));
    glass.position.set(cp.x, H - 0.04, cp.z);
    glass.rotation.order = "YXZ"; glass.rotation.set(Math.PI / 2, ry, 0);
    root.add(glass);
    Anim.skies.push({ tex: rt, ux: 0.0011, uy: 0.0042 });

    /* brass rooflight frame and mullions */
    [[rw + 0.14, 0.05, 0, rl / 2], [rw + 0.14, 0.05, 0, -rl / 2],
     [0.05, rl + 0.14, rw / 2, 0], [0.05, rl + 0.14, -rw / 2, 0]].forEach(f => {
      const p = at(G.APO + L / 2 + f[3], f[2], H - 0.06);
      plain(f[0], 0.07, f[1], MAT.brass, p.x, H - 0.06, p.z, ry);
    });
    const bars = Math.max(1, Math.round(rl / 2.6));
    for (let b = 1; b < bars; b++) {
      const off = -rl / 2 + rl * b / bars;
      const p = at(G.APO + L / 2 + off, 0, H - 0.06);
      plain(rw, 0.055, 0.045, MAT.brass, p.x, H - 0.06, p.z, ry);
    }

    const sp = at(G.APO + L / 2, 0, 0);
    sunPool(sp.x, sp.z, isWing ? 4.2 : 2.6, isWing ? rl * 0.8 : 2.6, k * 1.7);

    Nav.zones.push({
      ux: u.x, uz: u.z, vx: v.x, vz: v.z,
      s0: G.APO + 1.05, s1: G.APO + L - 0.45, half: half - 0.45,
      t0: G.APO - 1.6, t1: G.APO + 1.3, doorHalf: G.DOOR_W / 2 - 0.45
    });

    /* ---- furnishing a side room ----
       Fewer things, further apart. Four rules decide every position: nothing
       within two and a half metres of a hang line, so no object is ever
       standing in front of a drawing; nothing in the lane between the door
       and the far wall; every gap a visitor might walk through at least a
       metre and a half wide, which is comfortably more than they are; and
       everything placed by index, so a rebuild puts the same room back.

       Seating lives here rather than in the rotunda, and it is one long
       bench a side - not a scatter of chairs. */
    if (isWing) {
      const CLEAR = 2.5;                       /* off the side walls */
      const t1 = half - CLEAR;                 /* 3.5 m: the furthest anything sits */

      /* one piece down the middle, with a rope in front of it */
      const m1 = at(G.APO + L * 0.5, 0, 0);
      const drum = k % 2 === 1;
      const top = makePlinth(m1.x, m1.z, drum ? 0.94 : 1.02, drum ? 0.34 : 0.42,
        drum ? MAT.limestone : MAT.travertine, drum ? "drum" : "box");
      if (drum) makeBowl(m1.x, m1.z, top, MAT.limestone, 1.0);
      else makeSculpture(m1.x, m1.z, top, k, 1.05);
      /* Turned to stand ACROSS the room in front of the piece. At ry+90 the
         rope ran the length of the wing instead, straight through the plinth
         it was supposed to be protecting - and its far post landed inside
         the plinth's own collision circle, which is exactly the kind of
         overlap a visitor gets caught in. */
      const bar = at(G.APO + L * 0.5 - 1.5, 0, 0);
      makeBarrier(bar.x, bar.z, ry + Math.PI, 2.3);

      /* A long bench a side, turned along the room and set two metres off
         the wall: enough to walk behind, enough to sit and look, and the
         lane down the middle stays open end to end. */
      /* ry-90 turns a prop's length along the room; ry+180 turns it across.
         A group's local +X points at (cos, -sin) of its rotation, which is
         easy to get a quarter turn wrong - and a bench across the room
         instead of along it stands right where people walk. */
      const BENCH_T = half - 2.6;              /* 3.4 m out, 2 m off the wall */
      const alongRoom = ry - Math.PI / 2;
      const bA = at(G.APO + 3.4, BENCH_T, 0), bB = at(G.APO + 8.4, -BENCH_T, 0);
      makeBench(bA.x, bA.z, alongRoom, 3.0);
      makeBench(bB.x, bB.z, alongRoom, 3.0);

      /* one case to look into, at the far end of the same side as the first
         bench - past it, so neither ever has to be squeezed around */
      const vt = at(G.APO + L - 2.4, BENCH_T, 0);
      makeVitrine(vt.x, vt.z, alongRoom, k);
    } else {
      /* An alcove is three metres deep. One vessel, and nothing else. */
      const m1 = at(G.APO + L * 0.52, 0, 0);
      const top = makePlinth(m1.x, m1.z, 1.0, 0.33, MAT.limestone, "drum");
      if (k % 2 === 0) makeVase(m1.x, m1.z, top, MAT.terracotta, true, 0.92);
      else makeVase(m1.x, m1.z, top, MAT.olive, false, 0.92);
    }
  });

  /* ---- furnishing the rotunda ----
     A room to walk through and stand in, so it carries pieces and nothing to
     sit on. The wall is at 13.73 m and hangs work on twelve of its sixteen
     facets; the plinths sit at 9 m, which leaves four and a half metres of
     clear floor in front of every picture. The four doorways lie on the axes,
     and those lanes are left completely open. */
  [45, 135, 225, 315].forEach((deg, i) => {
    const a = deg * Math.PI / 180, r = 9.0;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const drum = i % 2 === 1;
    const top = makePlinth(x, z, drum ? 1.04 : 1.10, drum ? 0.36 : 0.44,
      drum ? MAT.limestone : MAT.travertine, drum ? "drum" : "box");
    if (i === 1) makeVase(x, z, top, MAT.terracotta, true, 1.0);
    else if (i === 3) makeBowl(x, z, top, MAT.limestone, 1.05);
    else makeSculpture(x, z, top, i + 2, 1.12);
    if (i % 2 === 0) {
      const br = 7.7;
      makeBarrier(Math.cos(a) * br, Math.sin(a) * br, -a + Math.PI / 2, 2.3);
    }
  });

  /* Two quiet pieces behind the feature wall, where the room would
     otherwise read as empty floor. Set out at 10.5 m and well off the
     diagonals, so they clear the corner plinths at 9 m and leave the lane
     from the south door to the wall completely open. */
  makeArchway(3.6, -10.4, 0.4, 1.0);
  makeVitrine(-3.6, -10.4, 0.3, 2);
  makeLabelStand(-5.4, -9.2, 0.6);
}
