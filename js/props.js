/* ============================================================
   MESH HELPERS AND FURNITURE

   The gallery's fit-out: plinths, the pieces that stand on them,
   seating, planters and the drifting daylight patches.

   Everything here is cut from the same six materials - cream
   limestone, speckled travertine, terracotta, olive, charcoal and
   pale oak - and built from a handful of primitives, faceted
   rather than smooth. That is what makes a room read as designed
   instead of decorated, and it keeps a whole building of props
   inside a few dozen draw calls.

   These are the supporting cast. Nothing here is taller than eye
   level in the middle of a room, nothing sits on a hang line, and
   every piece is placed by index rather than at random, so a
   rebuild puts the same objects back in the same places.
   ============================================================ */
function box(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  return m;
}
function plain(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  root.add(m);
  return m;
}

/* slab on a rotunda segment: local +X follows the wall, +Z faces outward */
function segSlab(segIndex, w, h, d, radius, y, mat, offsetAlong, flat) {
  const step = Math.PI * 2 / G.SEG, a = segIndex * step;
  const along = { x: -Math.sin(a), z: Math.cos(a) };
  const cx = Math.cos(a) * radius + along.x * (offsetAlong || 0);
  const cz = Math.sin(a) * radius + along.z * (offsetAlong || 0);
  return (flat ? plain : box)(w, h, d, mat, cx, y, cz, Math.PI / 2 - a);
}

/* ---------- small helpers ---------- */
/* A prop is a group so it can be positioned and turned as one thing, and
   so the parts inside it can be measured from the object's own origin. */
function propGroup(x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (ry) g.rotation.y = ry;
  root.add(g);
  return g;
}
function part(g, geo, mat, x, y, z, shadow) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
  g.add(m);
  return m;
}
/* Deterministic wobble. Random placement made a rebuild - switching the
   lighting, say - quietly rearrange the room, which looked like a bug. */
function jit(seed, i) { return (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1; }

/* ---------- plinths ---------- */
/* Three cuts, all from the reference: a plain rectangular block, a fluted
   drum, and a low slab for something that lies down rather than stands up.
   Returns the height of the top face, so the piece that goes on it does
   not have to know which kind it landed on. */
function makePlinth(x, z, h, r, mat, style) {
  const m = mat || MAT.travertine;
  const kind = style || "box";
  const g = propGroup(x, z);

  if (kind === "drum") {
    part(g, new THREE.CylinderGeometry(r, r, h, 22), m, 0, h / 2, 0);
    /* fluting: shallow uprights cut round the drum, cheap and legible */
    const flute = new THREE.BoxGeometry(r * 0.20, h * 0.94, r * 0.20);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16;
      const f = part(g, flute, m, Math.cos(a) * r * 0.96, h / 2, Math.sin(a) * r * 0.96, false);
      f.rotation.y = -a;
    }
    Nav.circles.push({ x, z, r: r * 1.1 + 0.4 });
  } else if (kind === "slab") {
    part(g, new THREE.BoxGeometry(r * 2.5, h, r * 1.9), m, 0, h / 2, 0);
    Nav.boxes.push({ x0: x - r * 1.5, z0: z - r * 1.2, x1: x + r * 1.5, z1: z + r * 1.2 });
  } else {
    part(g, new THREE.BoxGeometry(r * 1.75, h, r * 1.75), m, 0, h / 2, 0);
    Nav.circles.push({ x, z, r: r * 1.35 + 0.4 });
  }
  return h;
}

/* ---------- the pieces that stand on them ---------- */
/* A pierced ring on a short foot - the shape the reference sheet uses more
   than any other, and the one that reads best from across a room. */
function pieceRing(g, y, mat, s) {
  const ring = part(g, new THREE.TorusGeometry(0.20 * s, 0.085 * s, 8, 20), mat, 0, y + 0.30 * s, 0);
  ring.rotation.x = 0;
  part(g, new THREE.BoxGeometry(0.17 * s, 0.30 * s, 0.17 * s), mat, 0, y + 0.13 * s, 0);
}
/* An arch: two legs under a half round. */
function pieceArch(g, y, mat, s) {
  const leg = new THREE.BoxGeometry(0.13 * s, 0.30 * s, 0.20 * s);
  [-1, 1].forEach(sg => part(g, leg, mat, sg * 0.155 * s, y + 0.15 * s, 0));
  const top = part(g, new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.20 * s, 16, 1, false, 0, Math.PI),
    mat, 0, y + 0.30 * s, 0);
  top.rotation.x = Math.PI / 2;
  top.rotation.z = Math.PI;
}
/* A faceted boulder, the low-poly stone from the top row of the sheet. */
function pieceStone(g, y, mat, s, seed) {
  /* Sat on its own half-height rather than an eyeballed offset - the first
     version sank a centimetre into the plinth, which read as a modelling
     mistake from every angle. */
  const r = 0.26 * s, tall = 1.18;
  const m = part(g, new THREE.DodecahedronGeometry(r, 0), mat, 0, y + r * tall, 0);
  m.rotation.set(jit(seed, 1) * 0.5, jit(seed, 2) * 3.1, 0);
  m.scale.set(1, tall, 0.92);
}
/* Balanced pebbles: three flattened stones, each turned off the last. */
function pieceCairn(g, y, mat, s) {
  const sizes = [0.25, 0.20, 0.145];
  let up = y;
  sizes.forEach((r, i) => {
    const half = r * 0.62 * s;                      /* the flattening, applied */
    const p = part(g, new THREE.IcosahedronGeometry(r * s, 0), mat, 0, up + half, 0);
    p.scale.set(1.15, 0.62, 0.95);
    p.rotation.y = i * 1.1;
    up += half * 1.85;
  });
}
/* Sphere, disc and block stacked - the balancing totem. */
function pieceTotem(g, y, mat, s) {
  part(g, new THREE.BoxGeometry(0.24 * s, 0.12 * s, 0.24 * s), mat, 0, y + 0.06 * s, 0);
  const cone = part(g, new THREE.ConeGeometry(0.20 * s, 0.24 * s, 6), mat, 0, y + 0.24 * s, 0);
  cone.rotation.y = 0.4;
  part(g, new THREE.SphereGeometry(0.115 * s, 12, 9), mat, 0, y + 0.45 * s, 0);
}
/* An upright horseshoe, the charcoal piece from the second row. */
function pieceHook(g, y, mat, s) {
  const leg = new THREE.BoxGeometry(0.10 * s, 0.36 * s, 0.14 * s);
  [-1, 1].forEach(sg => part(g, leg, mat, sg * 0.125 * s, y + 0.18 * s, 0));
  part(g, new THREE.BoxGeometry(0.35 * s, 0.10 * s, 0.14 * s), mat, 0, y + 0.05 * s, 0);
}

const SCULPT = [pieceRing, pieceArch, pieceStone, pieceCairn, pieceTotem, pieceHook];
/* Shape and stone are cycled on different lengths, so no two plinths in a
   room carry the same pairing and nothing cream ever lands on a cream
   plinth, where the facets disappear and the piece reads as a lump. */
const SCULPT_MAT = ["charcoalLo", "terracottaLo", "oliveLo", "pebble"];

/* Puts one of the six on top of a plinth. Chosen by index, never at
   random, so the same plinth carries the same piece every rebuild. */
function makeSculpture(x, z, top, i, scale) {
  const n = ((i || 0) % 12 + 12) % 12;
  const k = n % SCULPT.length;
  const g = propGroup(x, z, (k * 0.7) % 1.6 - 0.8);
  SCULPT[k](g, top, MAT[SCULPT_MAT[n % SCULPT_MAT.length]], scale || 1, k + 1);
}

/* ---------- vessels ---------- */
/* A thrown pot: shoulder, waist and a small mouth. Handles optional, which
   is the difference between the terracotta amphora and the olive jar. */
function makeVase(x, z, top, mat, handles, scale) {
  const s = scale || 1;
  const prof = [[0.02, 0], [0.17, 0], [0.185, 0.03], [0.145, 0.08], [0.22, 0.20],
                [0.27, 0.36], [0.255, 0.52], [0.175, 0.66], [0.115, 0.74],
                [0.135, 0.79], [0.125, 0.82]];
  const g = propGroup(x, z);
  const pts = prof.map(p => new THREE.Vector2(p[0] * s, p[1] * s));
  part(g, new THREE.LatheGeometry(pts, 18), mat, 0, top, 0);
  if (handles) {
    [-1, 1].forEach(sg => {
      const h = part(g, new THREE.TorusGeometry(0.10 * s, 0.028 * s, 6, 12, Math.PI * 1.1),
        mat, sg * 0.20 * s, top + 0.55 * s, 0);
      h.rotation.set(Math.PI / 2, 0, sg > 0 ? -0.4 : Math.PI + 0.4);
      h.rotation.order = "ZYX";
    });
  }
}
/* A shallow bowl, for the fluted drums. */
function makeBowl(x, z, top, mat, scale) {
  const s = scale || 1;
  const prof = [[0.02, 0], [0.14, 0], [0.20, 0.05], [0.28, 0.19], [0.30, 0.24],
                [0.275, 0.245], [0.255, 0.20], [0.185, 0.075], [0.13, 0.035]];
  const g = propGroup(x, z);
  part(g, new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0] * s, p[1] * s)), 20), mat, 0, top, 0);
}

/* ---------- seating ---------- */
/* Travertine slab on a recessed oak plinth: the gallery bench from the
   third row of the sheet, and the one visitors actually sit on. */
function makeBench(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(2.0, 0.16, 0.62), MAT.travertine, 0, 0.44, 0);
  part(g, new THREE.BoxGeometry(1.62, 0.36, 0.44), MAT.paleWood, 0, 0.18, 0);
  const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
  const hw = 1.0 * c + 0.31 * s, hd = 1.0 * s + 0.31 * c;
  Nav.boxes.push({ x0: x - hw - 0.3, z0: z - hd - 0.3, x1: x + hw + 0.3, z1: z + hd + 0.3 });
}
/* Low olive daybed with a bolster along the back. */
function makeSofa(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(1.95, 0.26, 0.78), MAT.olive, 0, 0.35, 0);
  const bolster = part(g, new THREE.CylinderGeometry(0.16, 0.16, 1.9, 12), MAT.olive, 0, 0.56, -0.26);
  bolster.rotation.z = Math.PI / 2;
  const leg = new THREE.BoxGeometry(0.09, 0.22, 0.09);
  [[-0.85, 0.3], [0.85, 0.3], [-0.85, -0.3], [0.85, -0.3]].forEach(p =>
    part(g, leg, MAT.paleWood, p[0], 0.11, p[1]));
  const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
  const hw = 0.98 * c + 0.42 * s, hd = 0.98 * s + 0.42 * c;
  Nav.boxes.push({ x0: x - hw - 0.3, z0: z - hd - 0.3, x1: x + hw + 0.3, z1: z + hd + 0.3 });
}
/* Round upholstered stool on four turned legs, terracotta or olive. */
function makeStool(x, z, mat) {
  const g = propGroup(x, z);
  part(g, new THREE.CylinderGeometry(0.29, 0.29, 0.20, 16), mat || MAT.terracotta, 0, 0.40, 0);
  const leg = new THREE.CylinderGeometry(0.035, 0.028, 0.30, 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    part(g, leg, MAT.paleWood, Math.cos(a) * 0.19, 0.15, Math.sin(a) * 0.19);
  }
  Nav.circles.push({ x, z, r: 0.62 });
}
/* A little round table, for a corner that needs something at knee height. */
function makeSideTable(x, z, mat) {
  const g = propGroup(x, z);
  part(g, new THREE.CylinderGeometry(0.30, 0.30, 0.07, 18), mat || MAT.olive, 0, 0.48, 0);
  part(g, new THREE.CylinderGeometry(0.13, 0.17, 0.45, 14), MAT.limestone, 0, 0.225, 0);
  Nav.circles.push({ x, z, r: 0.62 });
}

/* ---------- planting ---------- */
/* Leaves are single tapered blades, faceted and double sided. Six of them
   round a pot reads as a plant from any distance a visitor stands at, and
   costs a fraction of anything modelled properly. */
function leafBlade(g, x, y, z, len, wide, tilt, spin, mat) {
  /* A tapered blade rather than a cone. A cone is only wide at its very
     base, so a potful of them read as grass; keeping most of the length
     near full width is what makes these look like leaves. */
  const blade = part(g, new THREE.CylinderGeometry(wide * 0.30, wide, len, 4), mat,
    x, y + len * 0.42, z, false);
  blade.scale.z = 0.18;
  blade.rotation.order = "YXZ";
  blade.rotation.y = spin;
  blade.rotation.x = tilt;
  blade.castShadow = true;
  return blade;
}
/* style: "broad" the big-leaf plant, "blades" the upright snake plant,
   "bushy" the fern. pot: "facet", "ribbed", "bowl" or "terracotta". */
function makePlanter(x, z, style, pot, scale) {
  const s = scale || 1;
  const g = propGroup(x, z);
  const kind = style || "broad";
  let rim = 0.52 * s, potR = 0.34 * s;

  if (pot === "ribbed") {
    part(g, new THREE.CylinderGeometry(potR, potR * 0.94, rim, 20), MAT.limestone, 0, rim / 2, 0);
    const flute = new THREE.BoxGeometry(potR * 0.22, rim * 0.94, potR * 0.22);
    for (let i = 0; i < 14; i++) {
      const a = i * Math.PI * 2 / 14;
      const f = part(g, flute, MAT.limestone, Math.cos(a) * potR * 0.95, rim / 2, Math.sin(a) * potR * 0.95, false);
      f.rotation.y = -a;
    }
  } else if (pot === "bowl") {
    rim = 0.46 * s; potR = 0.42 * s;
    const b = part(g, new THREE.SphereGeometry(potR, 16, 10, 0, 6.3, 0, Math.PI * 0.58), MAT.limestone, 0, rim, 0);
    b.rotation.x = Math.PI;
  } else if (pot === "terracotta") {
    rim = 0.40 * s; potR = 0.28 * s;
    part(g, new THREE.CylinderGeometry(potR, potR * 0.76, rim, 16), MAT.terracotta, 0, rim / 2 + 0.30 * s, 0);
    part(g, new THREE.CylinderGeometry(potR * 1.08, potR * 1.08, 0.05 * s, 16), MAT.terracotta, 0, rim + 0.30 * s - 0.02, 0);
    /* the little wooden stand from the sheet */
    const leg = new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.42 * s, 6);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const l = part(g, leg, MAT.paleWood, Math.cos(a) * potR * 0.72, 0.21 * s, Math.sin(a) * potR * 0.72);
      l.rotation.x = Math.cos(a) * 0.13; l.rotation.z = -Math.sin(a) * 0.13;
    }
    rim += 0.30 * s;
  } else {
    const p = part(g, new THREE.CylinderGeometry(potR, potR * 0.72, rim, 7), MAT.limestoneLo, 0, rim / 2, 0);
    p.rotation.y = 0.4;
  }

  if (kind === "blades") {                          /* upright, sword-shaped */
    for (let i = 0; i < 8; i++) {
      const a = i * 0.86;
      leafBlade(g, Math.cos(a) * potR * 0.26, rim - 0.04 * s, Math.sin(a) * potR * 0.26,
        (0.66 + (i % 3) * 0.15) * s, 0.10 * s, (i % 2 ? 0.13 : -0.10) + jit(2, i) * 0.05, a,
        i % 2 ? MAT.leafDeep : MAT.leafMid);
    }
  } else if (kind === "bushy") {                    /* short fronds, spread wide */
    for (let i = 0; i < 11; i++) {
      const a = i * 0.63;
      leafBlade(g, Math.cos(a) * potR * 0.34, rim - 0.05 * s, Math.sin(a) * potR * 0.34,
        (0.40 + (i % 3) * 0.11) * s, 0.15 * s, 0.62 + (i % 3) * 0.17, a,
        i % 2 ? MAT.leafMid : MAT.leafDeep);
    }
  } else {                                          /* the big-leafed one */
    for (let i = 0; i < 7; i++) {
      const a = i * 0.92;
      leafBlade(g, Math.cos(a) * potR * 0.28, rim - 0.04 * s, Math.sin(a) * potR * 0.28,
        (0.58 + (i % 3) * 0.13) * s, 0.20 * s, 0.30 + (i % 3) * 0.22, a,
        i % 2 ? MAT.leafDeep : MAT.leafMid);
    }
  }
  Nav.circles.push({ x, z, r: Math.max(0.78, potR + 0.5) });
}

/* a drifting daylight patch on the floor */
function sunPool(x, z, sx, sz, phase) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: 0.42
  }));
  m.scale.set(sx, sz, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.016, z);
  root.add(m);
  Anim.pools.push({ mesh: m, x0: x, z0: z, phase: phase || Math.random() * 6.3 });
}

/* ============================================================
   THE REST OF THE FIT-OUT
   Seating with a back to it, a case to look into, barriers to
   stand behind, and the floor pieces that fill a corner without
   asking to be looked at.
   ============================================================ */

/* A kidney of travertine on a recessed oak base - the bench from the
   reference sheet, built as three overlapping slabs so the curve reads
   without a lathe or a spline. */
function makeCurvedBench(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  const seat = new THREE.BoxGeometry(1.05, 0.17, 0.62);
  [[-0.66, 0.16, 0.26], [0, 0, 0], [0.66, -0.16, -0.26]].forEach(s => {
    const m = part(g, seat, MAT.travertine, s[0], 0.46, s[1]);
    m.rotation.y = s[2];
  });
  [-0.62, 0.62].forEach((dx, i) => {
    const b = part(g, new THREE.BoxGeometry(0.72, 0.30, 0.36), MAT.paleWood, dx, 0.19, i ? -0.15 : 0.15);
    b.rotation.y = i ? -0.26 : 0.26;
  });
  Nav.boxes.push({ x0: x - 1.5, z0: z - 0.95, x1: x + 1.5, z1: z + 0.95 });
}

/* Plain oak, thick top, plank legs. The quiet one. */
function makeWoodBench(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(1.85, 0.14, 0.52), MAT.paleWood, 0, 0.45, 0);
  [-0.72, 0.72].forEach(dx => {
    part(g, new THREE.BoxGeometry(0.13, 0.38, 0.46), MAT.paleWood, dx, 0.19, 0);
  });
  part(g, new THREE.BoxGeometry(1.30, 0.07, 0.10), MAT.paleWood, 0, 0.30, 0);   // stretcher
  const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
  const hw = 0.93 * c + 0.26 * s, hd = 0.93 * s + 0.26 * c;
  Nav.boxes.push({ x0: x - hw - 0.28, z0: z - hd - 0.28, x1: x + hw + 0.28, z1: z + hd + 0.28 });
}

/* Cream upholstery, oak plinth, one arm - the chair from the third row. */
function makeArmchair(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(0.86, 0.24, 0.82), MAT.linen, 0, 0.42, 0);        // seat
  part(g, new THREE.BoxGeometry(0.86, 0.52, 0.20), MAT.linen, 0, 0.66, -0.31);    // back
  part(g, new THREE.BoxGeometry(0.16, 0.26, 0.72), MAT.linen, -0.35, 0.60, 0.04); // one arm
  part(g, new THREE.BoxGeometry(0.78, 0.28, 0.74), MAT.paleWood, 0, 0.16, 0);     // base
  Nav.boxes.push({ x0: x - 0.72, z0: z - 0.72, x1: x + 0.72, z1: z + 0.72 });
}

/* A low case with something small in it: the detail that says museum
   rather than showroom. The glass is a single translucent box - cheap,
   and from any distance a visitor stands at, entirely convincing. */
function makeVitrine(x, z, ry, i) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(1.10, 0.74, 0.72), MAT.travertine, 0, 0.37, 0);
  /* Brass underneath and stone on top, so only a rim of metal shows. A full
     brass shelf went black: at 0.9 metalness a flat upward face with no
     environment to reflect has nothing to be bright with. */
  part(g, new THREE.BoxGeometry(1.18, 0.035, 0.80), MAT.brass, 0, 0.757, 0);
  part(g, new THREE.BoxGeometry(1.10, 0.030, 0.72), MAT.limestone, 0, 0.782, 0);
  const shelf = 0.797;
  const glass = part(g, new THREE.BoxGeometry(1.02, 0.60, 0.64), MAT.vitrine, 0, shelf + 0.30, 0, false);
  glass.renderOrder = 3;
  /* the thing on show, always darker than the shelf it stands on */
  const k = ((i || 0) % 3 + 3) % 3;
  if (k === 0) pieceCairn(g, shelf, MAT.charcoalLo, 0.58);
  else if (k === 1) pieceRing(g, shelf, MAT.terracottaLo, 0.60);
  else pieceStone(g, shelf, MAT.oliveLo, 0.62, 5);
  /* the label, angled on the shelf */
  const lab = part(g, new THREE.BoxGeometry(0.28, 0.012, 0.12), MAT.charcoal, 0.35, shelf + 0.01, 0.20, false);
  lab.rotation.x = -0.42;
  Nav.boxes.push({ x0: x - 0.9, z0: z - 0.7, x1: x + 0.9, z1: z + 0.7 });
}

/* A reading stand: the wall text, on the floor, where the wall is glass. */
function makeLabelStand(x, z, ry) {
  const g = propGroup(x, z, ry || 0);
  part(g, new THREE.BoxGeometry(0.30, 0.04, 0.24), MAT.charcoal, 0, 0.02, 0);
  part(g, new THREE.CylinderGeometry(0.028, 0.034, 0.92, 10), MAT.brass, 0, 0.48, 0);
  const plate = part(g, new THREE.BoxGeometry(0.40, 0.28, 0.02), MAT.limestone, 0, 1.02, 0.03);
  plate.rotation.x = -0.62;
  const ink = part(g, new THREE.BoxGeometry(0.28, 0.14, 0.004), MAT.charcoal, 0, 1.03, 0.05, false);
  ink.rotation.x = -0.62;
  Nav.circles.push({ x, z, r: 0.42 });
}

/* Museum barrier. Two brass posts and a rope that hangs between them -
   the same one the feature wall uses, made available to the rest of the
   building so a sculpture can be kept at arm's length too. */
function stanchion(g, px, pz, topY) {
  part(g, new THREE.CylinderGeometry(0.15, 0.18, 0.045, 20), MAT.brass, px, 0.022, pz);
  const foot = part(g, new THREE.SphereGeometry(0.09, 14, 10), MAT.brass, px, 0.065, pz, false);
  foot.scale.set(1, 0.6, 1);
  part(g, new THREE.CylinderGeometry(0.024, 0.030, topY - 0.06, 12), MAT.brass, px, (topY - 0.06) / 2 + 0.065, pz);
  const eye = part(g, new THREE.TorusGeometry(0.05, 0.013, 8, 16), MAT.brass, px, topY, pz, false);
  eye.rotation.y = Math.PI / 2;
  part(g, new THREE.SphereGeometry(0.048, 14, 10), MAT.brass, px, topY + 0.08, pz, false);
}
function makeBarrier(x, z, ry, span) {
  const g = propGroup(x, z, ry || 0);
  const half = (span || 2.4) / 2, topY = 0.88;
  stanchion(g, -half, 0, topY);
  stanchion(g, half, 0, topY);
  const pts = [];
  for (let s = 0; s <= 10; s++) {
    const u = s / 10;
    pts.push(new THREE.Vector3(-half + span * u, topY - Math.sin(u * Math.PI) * 0.14, 0));
  }
  part(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.024, 6, false), MAT.ropeMat, 0, 0, 0);
  /* Only the posts stop anybody - you can duck a rope, and a barrier that
     blocked its whole span would wall off half a room. */
  const c = Math.cos(ry || 0), s2 = Math.sin(ry || 0);
  [-half, half].forEach(o => Nav.circles.push({ x: x + c * o, z: z - s2 * o, r: 0.36 }));
}

/* A boulder on the floor, unplinthed, the way a heavy piece actually
   arrives in a gallery. */
function makeFloorStone(x, z, scale, mat) {
  const s = scale || 1;
  const g = propGroup(x, z, (x + z) % 1.4);
  const m = part(g, new THREE.DodecahedronGeometry(0.42 * s, 0), mat || MAT.limestoneLo, 0, 0.44 * s, 0);
  m.scale.set(1.05, 1.12, 0.92);
  Nav.circles.push({ x, z, r: 0.52 * s + 0.36 });
}

/* The charcoal arch, standing on the floor at knee-to-waist height. */
function makeArchway(x, z, ry, scale) {
  const s = scale || 1;
  const g = propGroup(x, z, ry || 0);
  const leg = new THREE.BoxGeometry(0.22 * s, 0.62 * s, 0.30 * s);
  [-1, 1].forEach(sg => part(g, leg, MAT.charcoalLo, sg * 0.29 * s, 0.31 * s, 0));
  const top = part(g, new THREE.CylinderGeometry(0.40 * s, 0.40 * s, 0.30 * s, 18, 1, false, 0, Math.PI),
    MAT.charcoalLo, 0, 0.62 * s, 0);
  top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI;
  Nav.circles.push({ x, z, r: 0.52 * s + 0.34 });
}
