/* ============================================================
   ROOMS  --  how the host arranges the exhibition.

   Two modes, and the museum does not care which is in use.

   Automatic, which is what happens if nobody does anything: the
   works hang in the order they were uploaded, the rotunda fills
   first, and side rooms open as they are needed.

   Curated: the host names rooms - Photography, Year 10 Projects -
   and puts works in them. A room with more than ten works gets a
   second room further along the same direction, under the same
   name, so it reads as one continuous section.

   An artwork remembers which room it belongs to and nothing else;
   its place in the room is its place in State.art, which is the
   order the host dragged the cards into. One list, one order, no
   second copy to fall out of step.
   ============================================================ */

/* {id, name} - the order of this list is the order sections take
   directions, so dragging a room up moves its whole section round. */
function museumRooms() { return State.rooms || (State.rooms = []); }

function roomById(id) {
  return museumRooms().find(r => r.id === id) || null;
}
function roomName(id) {
  const r = roomById(id);
  return r ? r.name : null;
}
/* Rooms are added in sequence and named for where they are, not for what a
   list of examples guessed they might hold. A host who wants Photography
   types Photography; a host who does not gets Room 3, which is at least
   true. */
function addRoom(name) {
  const rooms = museumRooms();
  if (rooms.length >= MAX_SECTIONS) return null;
  const room = { id: State.nextId++, name: (name || "").trim() || nextRoomName() };
  rooms.push(room);
  return room;
}
function nextRoomName(alsoTaken) {
  const taken = museumRooms().map(r => r.name).concat(alsoTaken || []);
  for (let i = 1; i <= MAX_SECTIONS; i++) {
    const n = "Room " + i;
    if (taken.indexOf(n) === -1) return n;
  }
  return "Room " + Math.min(MAX_SECTIONS, museumRooms().length + 1);
}

/* MAIN_ROOM_NAME lives in js/geometry.js, which loads first and needs it. */
function mainRoomCapacity() { return ROT_CAP + 1; }        // and the feature wall
function removeRoom(id) {
  State.rooms = museumRooms().filter(r => r.id !== id);
  /* its works come back to the unassigned pile rather than disappearing */
  State.art.forEach(a => { if (a.room === id) a.room = null; });
}
function renameRoom(id, name) {
  const r = roomById(id);
  if (r) r.name = (name || "").trim() || r.name;
}

/* Works belonging to a room, in the host's order. Unassigned works answer
   to room id null, which is what the central rotunda shows. */
function artInRoom(id, list) {
  return (list || State.art).filter(a => (a.room === undefined ? null : a.room) === id);
}
function curated() {
  return museumRooms().length > 0;
}

/* ---------- the feature wall ---------- */
/* There is always something on it. A museum whose front wall is bare is not
   a museum anybody wants to walk into, and the host should not have to
   remember to choose - so the first work uploaded stands in until one is
   picked deliberately. */
function ensureFeature() {
  if (!State.art.length) return null;
  let f = State.art.find(a => a.featured);
  if (!f) { f = State.art[0]; f.featured = true; }
  /* exactly one, whatever a saved file or a stray click left behind */
  State.art.forEach(a => { if (a !== f) a.featured = false; });
  return f;
}
function setFeature(artId) {
  State.art.forEach(a => { a.featured = a.id === artId; });
  ensureFeature();
}

/* ---------- what actually gets built ---------- */
/* Sections, in the order they take directions. The first is the central
   room; the rest each get a direction of their own.

   `wall` is the list of works that need a hanging position - the feature
   work is not among them, because it has a wall of its own, and neither is
   a track that hangs above somebody else's picture. */
function exhibitionSections(wallArt) {
  const list = wallArt || State.art;
  if (!curated()) {
    /* automatic: upload order, rotunda first, ten to a room after that */
    return autoSections(list.map(a => a.id));
  }

  const sections = [];
  const loose = artInRoom(null, list);
  const named = museumRooms().filter(r => artInRoom(r.id, list).length).length;

  /* The host's own rooms take their directions first - they are the
     deliberate ones, and they should be the first doors a visitor sees.

     A room holds eighteen. Anything the host puts past that is not thrown
     away - it goes back into the pool and hangs somewhere else, which is
     the only honest thing to do with a picture somebody uploaded. */
  const turnedAway = [];
  const curatedRooms = [];
  museumRooms().forEach(room => {
    const all = artInRoom(room.id, list).map(a => a.id);
    if (!all.length) return;
    curatedRooms.push({ name: room.name, ids: all.slice(0, SECTION_CAP), curated: true });
    turnedAway.push.apply(turnedAway, all.slice(SECTION_CAP));
  });
  /* room the host's own sections have going spare, which the overflow fills
     before it opens anything new */
  const spare = curatedRooms.reduce((n, s) => n + (SECTION_CAP - s.ids.length), 0);

  /* What the middle will really have walls for. Every doorway costs it a
     facet, and how many doorways there are depends on how many sections
     there turn out to be - so it is settled by looking, the same way the
     automatic plan settles it. Guessing high left works with nowhere to
     hang: the rotunda had been promised twelve walls and got eight.

     The count has to include what the host's own rooms turned away, not
     just the unassigned pile. A host who drops everything into one room
     sends a hundred works looking for somewhere to go, and those open
     doors of their own. */
  let hold = ROT_CAP;
  for (let pass = 0; pass < 6; pass++) {
    const idle = Math.max(0, hold - loose.length);     /* middle walls going spare */
    const spillNow = Math.max(0,
      Math.max(0, loose.length - hold) + turnedAway.length - spare - idle);
    const extra = roomsForOverflow(spillNow, Math.max(0, MAX_SECTIONS - named));
    const next = ROT_CAP - Math.max(0, (named + extra) - MAX_SECTIONS_AUTO);
    if (next === hold) break;
    hold = next;
  }
  sections.push({ name: MAIN_ROOM_NAME, central: true, ids: loose.slice(0, hold).map(a => a.id) });
  curatedRooms.forEach(s => sections.push(s));

  /* Then whatever the middle could not hold. Rooms the host already made
     take it first, up to what a section holds - a work has to hang
     somewhere, and a half-empty Photography beats a work that is in the
     museum's list and on none of its walls. Only what is left opens
     rooms of its own. */
  let spill = loose.slice(hold).map(a => a.id).concat(turnedAway);
  for (let i = 1; i < sections.length && spill.length; i++) {
    const room = SECTION_CAP - sections[i].ids.length;
    if (room <= 0) continue;
    sections[i].ids = sections[i].ids.concat(spill.slice(0, room));
    spill = spill.slice(room);
  }
  /* and the middle takes what is still homeless before any new room opens.
     A host who drops every work into Photography has left the rotunda bare
     while works queue for a wall; hanging them in the Main Exhibition is
     better than hanging them nowhere. */
  const middle = hold - sections[0].ids.length;
  if (middle > 0 && spill.length) {
    sections[0].ids = sections[0].ids.concat(spill.slice(0, middle));
    spill = spill.slice(middle);
  }

  const extra = roomsForOverflow(spill.length, Math.max(0, MAX_SECTIONS - named));
  shareIntoRooms(spill, extra).forEach(group => {
    if (!group.length) return;
    sections.push({ name: nextRoomName(sections.map(s => s.name)), ids: group, curated: true });
  });
  return sections;
}

/* The whole plan, for the 3D build and for both floorplans.

   `wallArt` is the list of works that need a wall of their own. Asked
   without one it works that list out itself rather than falling back to
   every artwork there is - which is what the hero plan and the minimap
   were doing, and why the map drew a dot for the piece already hanging on
   the feature wall, and a dot for a track hanging above somebody else's
   picture. Thirteen works drew fourteen dots and opened a side room the
   museum did not have.

   One list in, one position per work out, and the map and the building
   are reading the same page. */
function exhibitionLayout(wallArt) {
  return layoutSections(exhibitionSections(wallArt || hangingPlan().wall));
}

/* How many physical rooms the current arrangement needs, for the line under
   the hero plan. */
function physicalRoomCount() {
  return exhibitionLayout().rooms.length;
}


/* How full a section is, and how many physical rooms that comes to. Shown
   on the home screen so the host can see a section outgrow one room. */
function roomLoad(id) {
  const n = artInRoom(id).length;
  return { works: n, cap: SECTION_CAP, physical: roomsNeeded(Math.min(n, SECTION_CAP)),
           over: n > SECTION_CAP };
}
function mainRoomLoad() {
  const n = artInRoom(null).length;
  return { works: n, cap: mainRoomCapacity(), over: n > ROT_CAP };
}


/* ---------- what the home screen shows ----------
   Every room the museum will actually build, whether the host made it or
   the overflow did. A host who uploads twenty works and names nothing
   should still see "Room 1 - 7 works" before going in, because that is
   what they are about to walk into. */
function shownRooms() {
  const loose = artInRoom(null).length;
  const out = [{ id: null, name: MAIN_ROOM_NAME, fixed: true,
                 works: Math.min(loose, mainRoomCapacity()), cap: mainRoomCapacity(),
                 spills: loose > mainRoomCapacity() }];
  museumRooms().forEach(r => {
    out.push({ id: r.id, name: r.name, works: artInRoom(r.id).length, cap: SECTION_CAP });
  });

  /* the rooms the overflow is going to open, listed before they are asked
     for - the plan already knows about them, so the host should too */
  const wall = hangingPlan().wall;
  const spill = artInRoom(null, wall).length - ROT_CAP;
  const auto = roomsForOverflow(Math.max(0, spill),
    Math.max(0, (curated() ? MAX_SECTIONS : autoSectionLimit(Math.max(0, spill))) - museumRooms().length));
  if (auto > 0) {
    const groups = shareIntoRooms(new Array(Math.max(0, spill)).fill(0), auto);
    const taken = out.map(r => r.name);
    for (let i = 0; i < auto; i++) {
      const name = nextRoomName(taken);
      taken.push(name);
      out.push({ id: null, name: name, auto: true, works: groups[i].length, cap: ROOM_CAP });
    }
  }
  return out;
}
