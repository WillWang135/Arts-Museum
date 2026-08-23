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
function addRoom(name) {
  const rooms = museumRooms();
  const room = { id: State.nextId++, name: (name || "").trim() || defaultRoomName(rooms.length) };
  rooms.push(room);
  return room;
}
function defaultRoomName(i) {
  const names = ["Main Exhibition", "Photography", "Digital Art", "Abstract Art",
                 "Year 10 Projects", "Sculpture", "Printmaking", "Studio Work"];
  return names[i % names.length];
}
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
  /* Anything the host has not filed is the central room. If they have filed
     everything, the rotunda simply hangs the first room's overflow-free
     share, which keeps the middle of the museum from being empty. */
  if (loose.length) {
    sections.push({ name: null, central: true, ids: loose.slice(0, ROT_CAP).map(a => a.id) });
    const spill = loose.slice(ROT_CAP);
    for (let i = 0; i < spill.length; i += ROOM_CAP) {
      sections.push({ name: null, ids: spill.slice(i, i + ROOM_CAP).map(a => a.id) });
    }
  } else {
    sections.push({ name: null, central: true, ids: [] });
  }

  museumRooms().forEach(room => {
    const ids = artInRoom(room.id, list).map(a => a.id);
    if (!ids.length) return;
    sections.push({ name: room.name, ids: ids });
  });
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
