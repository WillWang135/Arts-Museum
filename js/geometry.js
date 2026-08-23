/* ============================================================
   MUSEUM GEOMETRY  --  one source of truth for the 3D build,
   the floorplan hero and the in-museum minimap.

   A rotunda with eight doorways, and behind each doorway a
   section that grows outward: one room, then another beyond it,
   then another, joined end to end. A section never widens and
   never borrows a neighbour's direction - it simply reaches
   further out, which is how a real building grows a wing.

   Ten works to a room. That is not an arbitrary number: it is
   about what two side walls and an end wall can hold at a
   spacing anyone would call generous.
   ============================================================ */
const G = {
  R: 14,            // rotunda circumradius
  SEG: 16,          // rotunda wall segments
  WALL_H: 9,        // rotunda wall height
  /* A room sized for what it has to hold: four works down each side wall
     and two on the end, with room to stand back from any of them. A framed
     work is up to 2.6 m across, so four along a wall need fifteen metres of
     it - shrinking the room to fit the pictures is what had them touching. */
  WING_LEN: 18,     // how far one room reaches
  WING_HALF: 4.8,   // half width of a room
  WING_H: 6,
  DOOR_W: 3.4,
  DOOR_H: 4.3,
  WALL_T: 0.5,
  ART_Y: 1.78,      // centre height of every hung work
  ALCOVE_D: 3.2,
  ALCOVE_HALF: 2.4
};
G.APO = G.R * Math.cos(Math.PI / G.SEG);        // 13.73 - wall inner face
G.CHORD = 2 * G.R * Math.sin(Math.PI / G.SEG);  // 5.46

/* Eight ways out, at forty-five degrees to each other. Every other facet of
   the sixteen could be a doorway - but only the ones that lead somewhere
   actually are. A facet with no room behind it stays a wall and hangs work,
   which is what keeps twelve pictures in the rotunda when the museum is
   small and only opens it up as sections are added. */
const DOOR_SEGS = [0, 2, 4, 6, 8, 10, 12, 14];
const WING_DIR = DOOR_SEGS.map(i => {
  const a = i * (Math.PI * 2 / G.SEG);
  return { x: Math.cos(a), z: Math.sin(a), a };
});
const DIR_COUNT = WING_DIR.length;

/* +X is east and +Z is south, so the four square directions come first -
   north, south, west, east - and the diagonals only after them, clockwise
   from north-east. A museum with two side rooms should have them opposite
   each other, not tucked into two corners. */
const DIR_NORTH = 6, DIR_SOUTH = 2, DIR_WEST = 4, DIR_EAST = 0;
const WING_ORDER = [DIR_NORTH, DIR_SOUTH, DIR_WEST, DIR_EAST, 7, 1, 3, 5];

const ROT_CAP = 12;          // twelve on the rotunda walls, beside the feature
const ROOM_CAP = 10;         // four a side, two on the end
const SECTION_CAP = 18;      // as much as one named section will take
const AUTO_GROUP = 5;        // every five works past the middle opens a room

/* How many works each wall of a room takes. Fixed rather than worked out
   from the length, because the length was chosen for these numbers - and
   because a wall that quietly accepts a fifth picture is a wall with five
   pictures touching. */
const SIDE_WALL_CAP = 4;
const END_WALL_CAP = 2;

/* Where room number `depth` of a section starts and ends, measured out from
   the middle of the museum. Rooms are joined by a short throat rather than
   sharing a wall, so each still reads as a room you walk into. */
const ROOM_GAP = 1.6;
function roomSpan(depth) {
  const s0 = G.APO + depth * (G.WING_LEN + ROOM_GAP);
  return { s0: s0, s1: s0 + G.WING_LEN };
}
function roomsNeeded(n) { return Math.max(1, Math.ceil(n / ROOM_CAP)); }

/* Which facets are actually openings. Everything else is wall. */
function activeDoors(rooms) {
  const open = {};
  rooms.forEach(r => { open[DOOR_SEGS[r.dir]] = true; });
  return open;
}

/* ---------- a run is a straight stretch of hangable wall ---------- */
function rotundaRuns(doors) {
  const runs = [], step = Math.PI * 2 / G.SEG;
  for (let i = 0; i < G.SEG; i++) {
    if (doors[i]) continue;
    const a = i * step;
    runs.push({
      cx: Math.cos(a) * G.APO, cz: Math.sin(a) * G.APO,
      nx: -Math.cos(a), nz: -Math.sin(a),
      dx: -Math.sin(a), dz: Math.cos(a),
      len: G.CHORD - 0.7, cap: 1, zone: "rotunda"
    });
  }
  return runs;
}

/* The walls of one room: both sides, and the end wall when nothing follows
   it. A room with another beyond it has a doorway there instead. */
function roomRuns(room, index) {
  const u = WING_DIR[room.dir], v = { x: -u.z, z: u.x };
  const runs = [];
  /* Held well off both ends: nothing hangs beside a doorway, and nothing
     hangs in a corner where you cannot stand back from it. */
  const s = room.s0 + 2.4, e = room.s1 - 1.6;
  const mid = (s + e) / 2, len = e - s;
  [1, -1].forEach(sign => {
    runs.push({
      cx: u.x * mid + v.x * G.WING_HALF * sign,
      cz: u.z * mid + v.z * G.WING_HALF * sign,
      nx: -v.x * sign, nz: -v.z * sign,
      dx: u.x, dz: u.z, len: len, cap: SIDE_WALL_CAP,
      zone: "room" + index, room: index, dir: room.dir
    });
  });
  if (room.last) {
    runs.push({
      cx: u.x * room.s1, cz: u.z * room.s1, nx: -u.x, nz: -u.z,
      dx: v.x, dz: v.z, len: (G.WING_HALF - 0.8) * 2, cap: END_WALL_CAP,
      zone: "room" + index, room: index, dir: room.dir
    });
  }
  return runs;
}

function slotsOnRun(r, k, out) {
  for (let j = 0; j < k; j++) {
    const t = (j + 1) / (k + 1) - 0.5;
    out.push({
      x: r.cx + r.dx * r.len * t,
      z: r.cz + r.dz * r.len * t,
      nx: r.nx, nz: r.nz, zone: r.zone,
      room: r.room === undefined ? -1 : r.room
    });
  }
}

/* ============================================================
   THE PLAN
   Sections in, physical rooms out. A section is a name and a
   list of works; if it holds more than a room can, it gets
   another room further along the same direction, under the same
   name, so it reads as one continuous exhibition.
   ============================================================ */
function planRooms(sections) {
  const rooms = [];
  /* How far out each direction has already been built. A ninth section has
     no direction of its own left, so it carries on beyond the eighth rather
     than being built on top of it. */
  const usedDepth = [];
  for (let i = 0; i < DIR_COUNT; i++) usedDepth.push(0);

  sections.forEach((sec, i) => {
    const dir = WING_ORDER[i % DIR_COUNT];
    const need = roomsNeeded(sec.ids.length);
    const from = usedDepth[dir];
    for (let d = 0; d < need; d++) {
      const span = roomSpan(from + d);
      rooms.push({
        dir: dir, depth: from + d, first: d === 0, last: d === need - 1,
        name: sec.name, section: i, index: 0,
        s0: span.s0, s1: span.s1, half: G.WING_HALF,
        ids: sec.ids.slice(d * ROOM_CAP, (d + 1) * ROOM_CAP)
      });
    }
    usedDepth[dir] = from + need;
  });
  /* the numbers on the signs, in the order the host laid the sections out */
  let n = 0;
  rooms.forEach(r => { if (r.first) n++; r.index = n; });
  return rooms;
}

/* Which directions carry anything, for the parts of the drawing that only
   need to know whether a doorway leads somewhere. */
function openDirections(rooms) {
  const open = [];
  for (let i = 0; i < DIR_COUNT; i++) open.push(false);
  rooms.forEach(r => { open[r.dir] = true; });
  return open;
}

/* ---------- automatic: no rooms named, so the museum arranges itself ----- */
/* The rotunda first, then as many side rooms as the overflow needs, ten to
   a room, opposite pairs first. Exactly what the museum did before rooms
   could be named - a host who just wants to walk in still can. */
function autoSections(ids) {
  const rot = ids.slice(0, ROT_CAP);
  const rest = ids.slice(ROT_CAP);
  const sections = [{ name: "Main Exhibition", ids: rot, central: true }];

  /* Every five works past the middle opens a room, so the museum grows a
     room at a time rather than waiting until one is full. The works are then
     shared evenly between the rooms that opened, which is why five works
     make one room of five rather than one of five and one empty. */
  const count = Math.ceil(rest.length / AUTO_GROUP);
  for (let i = 0; i < count; i++) {
    const from = Math.round(i * rest.length / count);
    const to = Math.round((i + 1) * rest.length / count);
    sections.push({ name: "Room " + (i + 1), ids: rest.slice(from, to) });
  }
  return sections;
}

/* ============================================================
   LAYOUT
   Rooms and works in, a hanging position for every work out.
   ============================================================ */
/* A wall takes what it was built to take, and no more. Working the number
   out from a spacing meant a wall quietly accepting a fifth picture when
   the museum ran short of room - and five pictures on a wall built for four
   is five pictures touching. */
function fitRuns(runs) {
  return { cap: runs.map(r => r.cap || 1), spacing: 3.0 };
}

/* Shares works out across a set of runs, filling each in turn so the wall
   fills evenly rather than one run taking everything. */
function shareOut(runs, count) {
  const fit = fitRuns(runs);
  const alloc = runs.map(() => 0);
  let left = count, guard = 0;
  while (left > 0 && guard++ < 500) {
    let moved = false;
    for (let i = 0; i < runs.length && left > 0; i++) {
      if (alloc[i] < fit.cap[i]) { alloc[i]++; left--; moved = true; }
    }
    if (!moved) break;
  }
  return { alloc: alloc, spacing: fit.spacing, spill: left };
}

/* The one function the museum, the hero plan and the minimap all read.
   `sections` is [{name, ids, central}]; the first central section hangs in
   the rotunda and everything else takes a direction of its own. */
function layoutSections(sections) {
  const central = sections.filter(s => s.central);
  let outer = sections.filter(s => !s.central && s.ids.length);
  let centralIds = central.length ? central[0].ids.slice() : [];

  /* Every doorway costs the rotunda a facet, so a museum with eight
     sections has eight walls in the middle rather than twelve. Whatever no
     longer fits goes outward as a section of its own rather than being
     doubled up on a facet, where two pictures on a wall built for one is
     two pictures touching. Settled by looking, because opening one more
     doorway can take away the very facet that made room for it. */
  let rooms = planRooms(outer);
  let doors = activeDoors(rooms);
  let rotRuns = rotundaRuns(doors);
  for (let pass = 0; pass < 4 && centralIds.length > rotRuns.length; pass++) {
    const spill = centralIds.slice(rotRuns.length);
    centralIds = centralIds.slice(0, rotRuns.length);
    const extra = [];
    for (let i = 0; i < spill.length; i += ROOM_CAP) {
      extra.push({ name: "Room " + (outer.length + extra.length + 1), ids: spill.slice(i, i + ROOM_CAP) });
    }
    outer = outer.concat(extra);
    rooms = planRooms(outer);
    doors = activeDoors(rooms);
    rotRuns = rotundaRuns(doors);
  }

  const runs = [];
  runs.push.apply(runs, rotRuns);
  const roomRunIndex = [];
  rooms.forEach((room, i) => {
    const rr = roomRuns(room, i);
    roomRunIndex.push({ from: runs.length, count: rr.length, room: room });
    runs.push.apply(runs, rr);
  });

  const alloc = runs.map(() => 0);
  let spacing = 4.0;
  const slots = [];
  const order = [];

  /* the rotunda */
  const rotIds = centralIds;
  if (rotIds.length) {
    const share = shareOut(rotRuns, rotIds.length);
    spacing = Math.min(spacing, share.spacing);
    share.alloc.forEach((v, i) => { alloc[i] = v; });
  }

  /* each room, its own works, its own walls */
  roomRunIndex.forEach(entry => {
    const rr = runs.slice(entry.from, entry.from + entry.count);
    const share = shareOut(rr, entry.room.ids.length);
    spacing = Math.min(spacing, share.spacing);
    share.alloc.forEach((v, i) => { alloc[entry.from + i] = v; });
  });

  runs.forEach((r, i) => {
    const before = slots.length;
    slotsOnRun(r, alloc[i], slots);
    for (let s = before; s < slots.length; s++) order.push(i);
  });

  /* Which work goes in which position: the rotunda's first, then each room
     in turn, in the order the host put them. */
  const byArt = {};
  let cursor = 0;
  const takeFrom = (runFrom, runTo, ids) => {
    let placed = 0;
    for (let si = 0; si < slots.length && placed < ids.length; si++) {
      if (order[si] < runFrom || order[si] >= runTo) continue;
      if (slots[si].artId !== undefined) continue;
      slots[si].artId = ids[placed];
      byArt[ids[placed]] = si;
      placed++;
    }
    return placed;
  };
  takeFrom(0, rotRuns.length, rotIds);
  roomRunIndex.forEach(entry => {
    takeFrom(entry.from, entry.from + entry.count, entry.room.ids);
  });

  return {
    rooms: rooms, runs: runs, slots: slots, spacing: spacing,
    open: openDirections(rooms), doors: doors, byArt: byArt
  };
}

/* The old shape, kept for anything that only knows how many works there
   are - the hero plan's status line, mainly. */
function computeLayout(n) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(-1 - i);          // stand-ins, never read
  return layoutSections(autoSections(ids));
}
