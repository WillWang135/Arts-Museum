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
  if (rooms.length >= DIR_COUNT) return null;
  const room = { id: State.nextId++, name: (name || "").trim() || nextRoomName() };
  rooms.push(room);
  return room;
}
function nextRoomName(alsoTaken) {
  const taken = museumRooms().map(r => r.name).concat(alsoTaken || []);
  for (let i = 1; i <= DIR_COUNT + 4; i++) {
    const n = "Room " + i;
    if (taken.indexOf(n) === -1) return n;
  }
  return "Room " + (museumRooms().length + 1);
}

/* The central room is not one of them. It is the rotunda you arrive in, it
   is always called the Main Exhibition, and its name is not the host's to
   change - every other name in the building is. */
const MAIN_ROOM_NAME = "Main Exhibition";
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
  sections.push({ name: MAIN_ROOM_NAME, central: true, ids: loose.slice(0, ROT_CAP).map(a => a.id) });

  /* The host's own rooms take their directions first - they are the
     deliberate ones, and they should be the first doors a visitor sees. */
  museumRooms().forEach(room => {
    const ids = artInRoom(room.id, list).map(a => a.id).slice(0, SECTION_CAP);
    if (!ids.length) return;
    sections.push({ name: room.name, ids: ids });
  });

  /* Then whatever the middle could not hold. Named in the same sequence as
     the automatic rooms, carrying on from the host's - "Overflow 2" on a
     brass sign over a doorway is not a room anybody meant to build. */
  const spill = loose.slice(ROT_CAP);
  const extra = Math.ceil(spill.length / AUTO_GROUP);
  for (let i = 0; i < extra; i++) {
    const from = Math.round(i * spill.length / extra);
    const to = Math.round((i + 1) * spill.length / extra);
    sections.push({ name: nextRoomName(sections.map(s => s.name)),
                    ids: spill.slice(from, to).map(a => a.id) });
  }
  return sections;
}

/* The whole plan, for the 3D build and for both floorplans. */
function exhibitionLayout(wallArt) {
  return layoutSections(exhibitionSections(wallArt));
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
