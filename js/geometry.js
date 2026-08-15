/* ============================================================
   MUSEUM GEOMETRY  --  one source of truth for the 3D build,
   the floorplan hero and the in-museum minimap.
   ============================================================ */
const G = {
  R: 14,            // rotunda circumradius
  SEG: 16,          // rotunda wall segments
  WALL_H: 9,        // rotunda wall height
  WING_LEN: 12,     // how far a wing reaches past the rotunda wall
  WING_HALF: 6,     // half width of a wing
  WING_H: 6,
  DOOR_W: 4.0,
  DOOR_H: 4.3,
  WALL_T: 0.5,
  ART_Y: 1.78,      // centre height of every hung work
  ALCOVE_D: 3.2,
  ALCOVE_HALF: 2.4
};
G.APO = G.R * Math.cos(Math.PI / G.SEG);        // 13.73 - wall inner face
G.CHORD = 2 * G.R * Math.sin(Math.PI / G.SEG);  // 5.46
const DOOR_SEGS = [0, 4, 8, 12];
const WING_DIR = DOOR_SEGS.map(i => {
  const a = i * (Math.PI * 2 / G.SEG);
  return { x: Math.cos(a), z: Math.sin(a), a };
});

/* Side rooms open only once the rotunda is hung. Opposite pairs open
   first so the plan stays balanced. */
const WING_ORDER = [0, 2, 1, 3];
function wingsOpenCount(w) {
  const open = [false, false, false, false];
  for (let i = 0; i < w; i++) open[WING_ORDER[i]] = true;
  return open;
}

/* A "run" is a straight stretch of hangable wall. */
function wallRuns(open) {
  const runs = [];
  const step = Math.PI * 2 / G.SEG;

  for (let i = 0; i < G.SEG; i++) {
    if (DOOR_SEGS.indexOf(i) !== -1) continue;
    const a = i * step;
    const cx = Math.cos(a) * G.APO, cz = Math.sin(a) * G.APO;
    runs.push({
      cx, cz, nx: -Math.cos(a), nz: -Math.sin(a),
      dx: -Math.sin(a), dz: Math.cos(a),
      len: G.CHORD - 0.7, zone: "rotunda"
    });
  }

  WING_DIR.forEach((u, k) => {
    const v = { x: -u.z, z: u.x };
    if (open[k]) {
      const s = G.APO + 1.9, e = G.APO + G.WING_LEN - 1.3;
      const mid = (s + e) / 2, len = e - s;
      [1, -1].forEach(sign => {
        runs.push({
          cx: u.x * mid + v.x * G.WING_HALF * sign,
          cz: u.z * mid + v.z * G.WING_HALF * sign,
          nx: -v.x * sign, nz: -v.z * sign,
          dx: u.x, dz: u.z, len, zone: "wing" + k, dir: k
        });
      });
      const L = G.APO + G.WING_LEN;
      runs.push({
        cx: u.x * L, cz: u.z * L, nx: -u.x, nz: -u.z,
        dx: v.x, dz: v.z, len: (G.WING_HALF - 1.1) * 2, zone: "wing" + k, dir: k
      });
    } else {
      const d = G.APO + G.ALCOVE_D;
      runs.push({
        cx: u.x * d, cz: u.z * d, nx: -u.x, nz: -u.z,
        dx: v.x, dz: v.z, len: G.ALCOVE_HALF * 2 - 0.8, zone: "alcove" + k, dir: k
      });
    }
  });
  return runs;
}

function slotsOnRun(r, k, out) {
  for (let j = 0; j < k; j++) {
    const t = (j + 1) / (k + 1) - 0.5;
    out.push({
      x: r.cx + r.dx * r.len * t,
      z: r.cz + r.dz * r.len * t,
      nx: r.nx, nz: r.nz, zone: r.zone
    });
  }
}

const ROT_CAP = 12;          // one work per wall panel in the rotunda
const ROOM_CAP = 5;          // works per side room before another room opens

/* Decide how many works each part of the museum carries. The rotunda is
   filled first; after that, side rooms open readily rather than any one
   room being stretched, and the load is shared evenly between them. */
function roomPlan(n) {
  const rot = Math.min(n, ROT_CAP);
  const rooms = [0, 0, 0, 0];
  const open = [false, false, false, false];
  let r = n - rot;

  if (r > 0 && r <= 4) {
    /* a small overflow sits in the shallow niches, one each, keeping the
       plan symmetrical rather than opening a whole room for one picture */
    for (let i = 0; i < r; i++) rooms[WING_ORDER[i]] = 1;
  } else if (r > 0) {
    const count = Math.min(4, Math.ceil(r / ROOM_CAP));
    for (let i = 0; i < count; i++) open[WING_ORDER[i]] = true;
    for (let i = 0; i < r; i++) rooms[WING_ORDER[i % count]]++;   // share evenly
  }
  return { rot: rot, rooms: rooms, open: open };
}

function fillRuns(idxs, k, cap, alloc) {
  let left = k, guard = 0;
  while (left > 0 && guard++ < 300) {
    let moved = false;
    for (let q = 0; q < idxs.length && left > 0; q++) {
      const i = idxs[q];
      if (alloc[i] < cap[i]) { alloc[i]++; left--; moved = true; }
    }
    if (!moved) break;
  }
  return left;
}

function computeLayout(n) {
  const spacings = [3.2, 2.8, 2.4, 2.0, 1.7];
  const plan = roomPlan(n);
  const open = plan.open;
  const busiest = Math.max.apply(null, plan.rooms);

  /* loosest hang that still fits the busiest room */
  let runs = wallRuns(open), cap = [], spacing = spacings[0];
  for (let si = 0; si < spacings.length; si++) {
    spacing = spacings[si];
    cap = runs.map(r => Math.max(1, Math.floor(r.len / spacing)));
    let worst = 0;
    for (let k = 0; k < 4; k++) {
      let roomCap = 0;
      runs.forEach((r, i) => { if (r.dir === k) roomCap += cap[i]; });
      worst = Math.max(worst, plan.rooms[k] - roomCap);
    }
    if (worst <= 0) break;
  }

  const rot = [], alloc = runs.map(() => 0);
  runs.forEach((r, i) => { if (r.zone === "rotunda") rot.push(i); });

  /* --- the central room --- */
  if (plan.rot >= rot.length) {
    rot.forEach(i => { alloc[i] = 1; });
  } else {
    /* The hangable facets are not evenly spaced - four doorways interrupt
       them - so choose by angle rather than by index, and try a few
       rotations so the works never bunch to one side. */
    const ang = rot.map(i => Math.atan2(runs[i].cz, runs[i].cx));
    const gapTo = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const pick = phase => {
      const taken = [];
      for (let i = 0; i < plan.rot; i++) {
        const target = -Math.PI / 2 + phase + i * (Math.PI * 2) / plan.rot;
        let best = -1, bestD = Infinity;
        for (let q = 0; q < rot.length; q++) {
          if (taken.indexOf(q) !== -1) continue;
          const d = gapTo(ang[q], target);
          if (d < bestD) { bestD = d; best = q; }
        }
        taken.push(best);
      }
      return taken;
    };
    const evenness = taken => {
      if (taken.length < 2) return 0;
      const a = taken.map(q => (ang[q] + Math.PI * 2) % (Math.PI * 2)).sort((p, r) => p - r);
      const gaps = a.map((v, i) => ((a[(i + 1) % a.length] - v) + Math.PI * 2) % (Math.PI * 2));
      return Math.max.apply(null, gaps) - Math.min.apply(null, gaps);
    };
    let bestSet = null, bestScore = Infinity;
    for (let ph = 0; ph < 8; ph++) {
      const set = pick(ph * (Math.PI / 4) / Math.max(1, plan.rot));
      const score = evenness(set);
      if (score < bestScore - 1e-6) { bestScore = score; bestSet = set; }
    }
    bestSet.forEach(q => { alloc[rot[q]] = 1; });
  }

  /* --- the side rooms, each spread across its own walls --- */
  let spill = 0;
  for (let k = 0; k < 4; k++) {
    const idxs = [];
    runs.forEach((r, i) => { if (r.dir === k) idxs.push(i); });
    spill += fillRuns(idxs, plan.rooms[k], cap, alloc);
  }
  /* anything that still will not fit starts a second row in the rotunda */
  let guard = 0;
  while (spill > 0 && guard++ < 400) {
    for (let q = 0; q < rot.length && spill > 0; q++) { alloc[rot[q]]++; spill--; }
  }

  const slots = [];
  runs.forEach((r, i) => slotsOnRun(r, alloc[i], slots));
  return { open: open, runs: runs, slots: slots, spacing: spacing, plan: plan };
}
