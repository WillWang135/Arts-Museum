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

/* +X is east and +Z is south, which fixes every doorway to a facet:
   east 0, south-east 1, south 2, south-west 3, west 4, north-west 5,
   north 6, north-east 7.

   Rooms are taken in a fixed order - north, south, east, west, and only
   then the corners clockwise from north-east. The square sides come first
   because a museum with two side rooms should have them opposite each
   other rather than tucked into two corners, and north before south
   because that is the way you are already facing when you walk in. */
const DIR_EAST = 0, DIR_SOUTH_EAST = 1, DIR_SOUTH = 2, DIR_SOUTH_WEST = 3,
      DIR_WEST = 4, DIR_NORTH_WEST = 5, DIR_NORTH = 6, DIR_NORTH_EAST = 7;
const WING_ORDER = [DIR_NORTH, DIR_SOUTH, DIR_EAST, DIR_WEST,
                    DIR_NORTH_EAST, DIR_SOUTH_EAST, DIR_SOUTH_WEST, DIR_NORTH_WEST];

const ROT_CAP = 12;          // twelve on the rotunda walls, beside the feature
const ROOM_CAP = 10;         // four a side, two on the end
const SECTION_CAP = 18;      // one full room and one through-room: 10 + 8
const AUTO_GROUP = 5;        // the overflow that first calls a side room into being

/* Eight ways out of the rotunda, so eight sections and no more - Room 1 to
   Room 8. Left to arrange itself the museum uses only the four square
   directions; the diagonals are for a host who has asked for them by naming
   the rooms. A building that sprouts a north-east wing on its own looks
   like an accident, because it is one. */
const MAIN_ROOM_NAME = "Main Exhibition";
const MAX_SECTIONS = 8;
const MAX_SECTIONS_AUTO = 4;

/* Four directions is a preference, not a ceiling. Left alone the museum
   uses the square sides and stops there, because a building that sprouts a
   north-east wing on its own looks like an accident - but once those four
   are genuinely full it would be a worse accident to have nowhere to hang
   the rest. So the diagonals open when, and only when, they are needed.

   Full means ten in each of the four, not eighteen. Waiting for eighteen
   meant north was two rooms deep - the far wall forty metres out - while
   north-east was still a blank facet, which is not how a building grows. */
function autoSectionLimit(overflow) {
  return overflow <= MAX_SECTIONS_AUTO * ROOM_CAP ? MAX_SECTIONS_AUTO : MAX_SECTIONS;
}

/* What the building actually holds. Eighteen in each of the eight sections
   is straightforward; the rotunda is not, because every doorway costs it a
   facet. With no sections open it hangs twelve beside the feature wall, but
   opening all eight takes four more of its sixteen facets for the diagonal
   doorways and leaves eight. So the museum full is eight in the middle, one
   on the feature wall and a hundred and forty-four out in the sections.

   A hundred and fifty-seven would be the number if doorways were free.
   They are not, and a limit that lets four works in with nowhere to hang
   them is worse than one that is four short and true. */
const MUSEUM_CAP = 1 + (G.SEG - DIR_COUNT) + MAX_SECTIONS * SECTION_CAP;   // 153

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
/* A room with another beyond it has a doorway where its end wall would be,
   so it hangs eight rather than ten. Slicing a section into tens regardless
   handed the first room two pictures it had no wall for, and those two
   quietly vanished - which is why a fifty-work museum was showing
   forty-four. */
const THROUGH_CAP = SIDE_WALL_CAP * 2;                 // 8: no end wall
const TERMINAL_CAP = SIDE_WALL_CAP * 2 + END_WALL_CAP; // 10: end wall too

function roomsNeeded(n) {
  if (n <= TERMINAL_CAP) return 1;
  return 1 + Math.ceil((n - TERMINAL_CAP) / THROUGH_CAP);
}
/* which of a section's works belong to room `d` of `need` */
function roomShare(ids, d, need) {
  const from = d * THROUGH_CAP;
  return d === need - 1 ? ids.slice(from) : ids.slice(from, from + THROUGH_CAP);
}

/* The four square sides are always open - to a room if one is there, and
   otherwise to a shallow niche with a piece in it. That is what keeps the
   rotunda balanced when the museum is small, and it is what fixes its
   hanging wall at twelve: sixteen facets, four of them openings.

   The diagonals are the opposite: wall until a section asks for one. */
const PRIMARY_DIRS = [DIR_NORTH, DIR_SOUTH, DIR_EAST, DIR_WEST];
function activeDoors(rooms) {
  const open = {};
  PRIMARY_DIRS.forEach(d => { open[DOOR_SEGS[d]] = true; });
  rooms.forEach(r => { open[DOOR_SEGS[r.dir]] = true; });
  return open;
}
/* the square sides with nothing behind them yet */
function nicheDirections(rooms) {
  const used = {};
  rooms.forEach(r => { used[r.dir] = true; });
  return PRIMARY_DIRS.filter(d => !used[d]);
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
/* Never more than eight sections. Anything past the eighth is folded into
   it, where it becomes another physical room further along that direction
   under the same name - which is exactly what a section outgrowing one room
   already does, so nothing new has to be invented for it. */
function capSections(sections, max) {
  if (sections.length <= max) return sections;
  const kept = sections.slice(0, max);
  const tail = sections.slice(max);
  tail.forEach(s => { kept[max - 1].ids = kept[max - 1].ids.concat(s.ids); });
  return kept;
}

function planRooms(sections) {
  const rooms = [];
  /* How far out each direction has already been built. A ninth section has
     no direction of its own left, so it carries on beyond the eighth rather
     than being built on top of it. */
  const usedDepth = [];
  for (let i = 0; i < DIR_COUNT; i++) usedDepth.push(0);

  sections.forEach((sec, i) => {
    const dir = WING_ORDER[i % DIR_COUNT];
    /* Eighteen to a section, which is two rooms deep and no more. A third
       room in one direction would put its far wall sixty metres from the
       front door, and nobody is walking that to see picture twenty-two. */
    const ids = sec.ids.slice(0, SECTION_CAP);
    const need = roomsNeeded(ids.length);
    const from = usedDepth[dir];
    for (let d = 0; d < need; d++) {
      const span = roomSpan(from + d);
      rooms.push({
        dir: dir, depth: from + d, first: d === 0, last: d === need - 1,
        name: sec.name, section: i, index: 0,
        s0: span.s0, s1: span.s1, half: G.WING_HALF,
        ids: roomShare(ids, d, need)
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
/* How many rooms an overflow of n works calls for.

   A room opens with five in it and is filled to ten before the museum
   reaches for another direction. That is two passes over the square sides
   - north, south, east, west to five each, then the same four to ten each
   - and only when all four are full do the corners start, on the same
   ladder. So:

     N5  S5  E5  W5   N10 S10 E10 W10
     NE5 SE5 SW5 NW5  NE10 SE10 SW10 NW10

   Five is enough to be worth walking to and ten is what a room holds; a
   room that opens with one picture in it is an empty room with a picture
   in it, and four rooms of five beats eight rooms of two and a half. */
function roomsForOverflow(n, max) {
  if (n <= 0) return 0;
  const square = Math.min(max, MAX_SECTIONS_AUTO);
  /* first pass round the square sides: one more room per five works */
  if (n <= square * AUTO_GROUP) return Math.min(square, Math.ceil(n / AUTO_GROUP));
  /* second pass: those same four fill to ten before anything else opens */
  if (n <= square * ROOM_CAP || max <= square) return square;
  /* then the corners, on the same ladder */
  const past = n - square * ROOM_CAP;
  return square + Math.min(max - square, Math.ceil(past / AUTO_GROUP));
}

/* Works shared between rooms in that same order, and it has to be that
   same order or the count above is describing a building nobody built.

   Filling straight to ten in turn was the previous behaviour and it opened
   the fifth room - a corner - while west still had seven in it. The passes
   are kept in tiers for that reason: the four square sides finish both of
   theirs before a corner is offered anything. */
function shareIntoRooms(ids, rooms) {
  const out = [];
  for (let i = 0; i < rooms; i++) out.push([]);
  if (!rooms) return out;
  let k = 0;
  const fill = (from, to, mark) => {
    for (let r = from; r < to && k < ids.length; r++) {
      while (out[r].length < mark && k < ids.length) out[r].push(ids[k++]);
    }
  };
  const square = Math.min(rooms, MAX_SECTIONS_AUTO);
  fill(0, square, AUTO_GROUP);        // N  S  E  W   five each
  fill(0, square, ROOM_CAP);          // N  S  E  W   ten each
  fill(square, rooms, AUTO_GROUP);    // NE SE SW NW  five each
  fill(square, rooms, ROOM_CAP);      // NE SE SW NW  ten each
  /* Only once every direction holds ten does any section grow a second
     room beyond the first - again in the same order, so north reaches
     further out before south does. */
  fill(0, rooms, SECTION_CAP);
  /* past what eight sections two rooms deep can hold, which the museum's
     capacity limit already makes unreachable - spread rather than drop */
  while (k < ids.length) out[k % rooms].push(ids[k++]);
  return out;
}

/* How many works the rotunda will really have walls for, which depends on
   how many doorways end up being cut into it - and that depends on how much
   the rotunda could not hold. Settled by looking, in two or three passes:
   each diagonal a section opens costs the middle one of its facets. */
function rotundaHold(total) {
  let hold = ROT_CAP;
  for (let pass = 0; pass < 4; pass++) {
    const over = Math.max(0, total - hold);
    const secs = roomsForOverflow(over, autoSectionLimit(over));
    const next = ROT_CAP - Math.max(0, secs - MAX_SECTIONS_AUTO);
    if (next === hold) break;
    hold = next;
  }
  return hold;
}

function autoSections(ids) {
  const hold = rotundaHold(ids.length);
  const rot = ids.slice(0, hold);
  const rest = ids.slice(hold);
  const sections = [{ name: MAIN_ROOM_NAME, ids: rot, central: true }];

  const rooms = roomsForOverflow(rest.length, autoSectionLimit(rest.length));
  shareIntoRooms(rest, rooms).forEach((group, i) => {
    if (group.length) sections.push({ name: "Room " + (i + 1), ids: group });
  });
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
  const maxSections = MAX_SECTIONS;
  outer = capSections(outer, maxSections);
  let rooms = planRooms(outer);
  let doors = activeDoors(rooms);
  let rotRuns = rotundaRuns(doors);
  for (let pass = 0; pass < 4 && centralIds.length > rotRuns.length; pass++) {
    const spill = centralIds.slice(rotRuns.length);
    centralIds = centralIds.slice(0, rotRuns.length);
    if (outer.length < maxSections) {
      outer.push({ name: "Room " + (outer.length + 1), ids: spill, curated: outer.length ? outer[0].curated : false });
    } else {
      outer[outer.length - 1].ids = outer[outer.length - 1].ids.concat(spill);
    }
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
      /* A work already given a position keeps it. Two sections listing the
         same id - which a fold or a spill can produce - would otherwise
         overwrite the first mapping and leave two works pointing at one
         wall. */
      if (byArt[ids[placed]] !== undefined) { placed++; si--; continue; }
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
    open: openDirections(rooms), doors: doors, byArt: byArt,
    niches: nicheDirections(rooms)
  };
}

/* The plan the museum was actually built from. The minimap draws this one
   rather than working a layout out again eleven times a second - and, more
   to the point, rather than working out a different one. Map and building
   read the same object or the map is not a map of this building. */
let BUILT_LAYOUT = null;
function setBuiltLayout(l) { BUILT_LAYOUT = l; }
function builtLayout() { return BUILT_LAYOUT; }

/* The old shape, kept for anything that only knows how many works there
   are - the hero plan's status line, mainly. */
function computeLayout(n) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(-1 - i);          // stand-ins, never read
  return layoutSections(autoSections(ids));
}
