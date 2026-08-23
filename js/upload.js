/* ============================================================
   UPLOAD SCREEN
   Adding artwork, writing the wall labels, and the floorplan
   hero that grows as pieces arrive.
   ============================================================ */
const planCanvas = $("plan-canvas");
const labelsEl = $("labels");

function paintPlan() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = planCanvas.clientWidth, h = planCanvas.clientHeight;
  if (!w || !h) return;
  planCanvas.width = w * dpr; planCanvas.height = h * dpr;
  const ctx = planCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFloorplan(ctx, w, h, { dark: false });

  const n = State.art.length;
  const layout = exhibitionLayout(hangingPlan().wall);
  const count = layout.rooms.length;
  const rooms = count === 0 ? "Rotunda only"
    : "Rotunda + " + count + (count === 1 ? " room" : " rooms");
  const named = (State.session.title || "").trim();
  $("plan-status").textContent = n === 0 ? "Empty floorplan" : (named ? named + " — " + rooms : rooms);
}
window.addEventListener("resize", paintPlan);

/* Which room a work is in, chosen from the rooms that exist. Left alone it
   says Main room, which is the rotunda - and a museum where nobody names a
   room is a museum where every work says Main room, which is exactly the
   automatic behaviour that was there before. */
function roomPicker(a) {
  const rooms = museumRooms();
  if (!rooms.length) return "";
  const here = a.room === undefined ? null : a.room;
  let html = '<select class="room-pick" title="Which room this hangs in">' +
             '<option value="">Main room</option>';
  rooms.forEach(r => {
    html += '<option value="' + r.id + '"' + (r.id === here ? " selected" : "") + '>' +
            escapeText(r.name) + '</option>';
  });
  return html + '</select>';
}
function escapeText(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* The rooms themselves: name them, reorder them by dragging, remove them.
   The order is the order they take directions out of the rotunda. */
/* The rooms, always with the Main Exhibition first. That one is the rotunda
   you arrive in - it cannot be renamed, moved or removed, because it is not
   a section the host made, it is the middle of the building. */
function renderRooms() {
  const list = $("rooms-list");
  if (!list) return;
  const rooms = museumRooms();
  list.innerHTML = "";

  const main = mainRoomLoad();
  const mainChip = document.createElement("div");
  mainChip.className = "room-chip room-main" + (main.over ? " over" : "");
  mainChip.dataset.id = "";
  mainChip.innerHTML =
    '<span class="room-no">1</span>' +
    '<span class="room-title">' + MAIN_ROOM_NAME + '</span>' +
    '<span class="room-count">' + main.works + " / " + main.cap +
      (main.over ? " \u00b7 spills outward" : "") + '</span>';
  list.appendChild(mainChip);

  rooms.forEach((r, i) => {
    const load = roomLoad(r.id);
    const chip = document.createElement("div");
    chip.className = "room-chip" + (load.over ? " over" : "");
    chip.dataset.id = r.id;
    chip.draggable = true;
    chip.innerHTML =
      '<span class="grip">\u2261</span>' +
      '<span class="room-no">' + (i + 2) + '</span>' +
      '<button class="room-title" type="button" title="Rename this room and choose what hangs in it">' +
        escapeText(r.name) + '</button>' +
      '<span class="room-count">' + load.works + " / " + SECTION_CAP +
        (load.physical > 1 ? " \u00b7 " + load.physical + " rooms" : "") + '</span>' +
      '<button class="room-del" type="button" title="Remove this room">\u00d7</button>';
    list.appendChild(chip);
  });

  $("room-add").disabled = rooms.length >= DIR_COUNT;
  const note = $("rooms-note");
  if (note) {
    note.textContent = rooms.length
      ? "Click a room to rename it and choose what hangs there, or drag a work onto it. " +
        "A section of more than " + ROOM_CAP + " opens another room beyond it, under the same name."
      : "Not required — without rooms the museum fills itself: " + mainRoomCapacity() +
        " in the Main Exhibition, then a room for every " + AUTO_GROUP + " after that.";
  }
}

/* ---------- one room, opened up ----------
   Renaming and filling are the same job, so they are the same panel: the
   name at the top, then every work in the museum with a tick beside the
   ones that hang here. */
function openRoomPanel(id) {
  const room = roomById(id);
  if (!room) return;
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML =
    '<div class="sheet roomsheet">' +
      '<button class="chip close" type="button" data-close>Close</button>' +
      '<span class="eyebrow">Exhibition room</span>' +
      '<input class="roomsheet-name" maxlength="40" value="' + escapeText(room.name) + '">' +
      '<p class="roomsheet-note" id="roomsheet-note"></p>' +
      '<div class="roomsheet-list"></div>' +
    '</div>';

  const listEl = veil.querySelector(".roomsheet-list");
  const note = veil.querySelector("#roomsheet-note");
  const paintNote = () => {
    const load = roomLoad(id);
    note.textContent = load.works + " of " + SECTION_CAP + " works" +
      (load.physical > 1 ? " \u2014 " + load.physical + " connected rooms, one name" : "") +
      (load.over ? " \u2014 anything past " + SECTION_CAP + " stays in the Main Exhibition" : "");
    note.classList.toggle("bad", load.over);
  };
  const paint = () => {
    paintNote();
    listEl.innerHTML = "";
    State.art.forEach((a, i) => {
      const here = (a.room === undefined ? null : a.room) === id;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "roompick" + (here ? " on" : "");
      row.dataset.id = a.id;
      row.innerHTML =
        '<span class="roompick-box">' + (here ? "\u2713" : "") + '</span>' +
        '<span class="roompick-thumb"><img alt=""></span>' +
        '<span class="roompick-name"><b></b><i></i></span>';
      row.querySelector("img").src = a.src;
      row.querySelector("b").textContent = a.name || "Untitled";
      row.querySelector("i").textContent = here ? "In this room"
        : (a.room ? "In " + (roomName(a.room) || "another room") : "Main Exhibition");
      listEl.appendChild(row);
    });
  };
  paint();

  /* The row is updated where it is rather than the list being drawn again.
     Repainting detached whatever had just been clicked, so a second tick in
     the same second landed on a row that was no longer in the document -
     and the scroll position went back to the top every time. */
  listEl.addEventListener("click", e => {
    const row = e.target.closest(".roompick");
    if (!row) return;
    const a = State.art.find(x => x.id === +row.dataset.id);
    if (!a) return;
    const here = (a.room === undefined ? null : a.room) === id;
    a.room = here ? null : id;
    const now = !here;
    row.classList.toggle("on", now);
    row.querySelector(".roompick-box").textContent = now ? "\u2713" : "";
    row.querySelector("i").textContent = now ? "In this room"
      : (a.room ? "In " + (roomName(a.room) || "another room") : "Main Exhibition");
    paintNote();
    renderRooms();
    paintPlan();
  });
  const nameEl = veil.querySelector(".roomsheet-name");
  nameEl.addEventListener("input", () => {
    renameRoom(id, nameEl.value);
    renderRooms();
    paintPlan();
  });

  wireVeil(veil);
  veil.addEventListener("click", e => { if (e.target === veil) renderLabels(); });
  veil.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => renderLabels()));
  overlayRoot().appendChild(veil);
  nameEl.focus();
  nameEl.select();
}

function renderLabels() {
  normaliseMediaArt(State.art);
  ensureFeature();
  renderRooms();
  labelsEl.innerHTML = "";
  State.art.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "wall-label";
    row.dataset.id = a.id;
    row.draggable = true;
    row.innerHTML =
      '<span class="grip" title="Drag to reorder">\u2261</span>' +
      '<div class="thumb-wrap"><span class="accession">' + pad3(i + 1) + '</span><img alt="">' +
        (isPlayable(a) ? '<span class="kindtag">' + (artKind(a) === "audio" ? "Audio" : "Video") + '</span>' : '') +
      '</div>' +
      '<div class="label-fields">' +
        '<input class="f-title" data-f="name" placeholder="Artwork name" maxlength="70">' +
        '<input class="f-author" data-f="author" placeholder="Student name" maxlength="60">' +
        '<textarea class="f-desc" data-f="desc" placeholder="What is this piece about? Materials, ideas, the story behind it." maxlength="900"></textarea>' +
      '</div>' +
      '<div class="label-actions">' +
        roomPicker(a) +
        '<button class="feature-toggle" type="button">' + SVG.star + 'Feature</button>' +
        (isPlayable(a)
          ? '<button class="cover-btn" type="button">' +
              (hasCover(a) ? 'Change cover' : 'Add cover') + '</button>' +
            (hasCover(a) ? '<button class="cover-clear" type="button">Use default</button>' : '')
          : '') +
        '<button class="remove-btn" type="button">Remove</button>' +
      '</div>';
    row.querySelector("img").src = a.src;
    row.querySelector('[data-f="name"]').value = a.name;
    row.querySelector('[data-f="author"]').value = a.author;
    row.querySelector('[data-f="desc"]').value = a.desc;
    const ft = row.querySelector(".feature-toggle");
    ft.classList.toggle("on", !!a.featured);
    ft.querySelector("svg").style.width = "15px";
    ft.querySelector("svg").style.height = "15px";
    labelsEl.appendChild(row);
  });
  refreshDock();
  paintPlan();
}

labelsEl.addEventListener("input", e => {
  const row = e.target.closest(".wall-label"); if (!row) return;
  const a = State.art.find(x => x.id === +row.dataset.id); if (!a) return;
  if (e.target.classList.contains("room-pick")) return;
  a[e.target.dataset.f] = e.target.value;
});
labelsEl.addEventListener("change", e => {
  if (!e.target.classList.contains("room-pick")) return;
  const row = e.target.closest(".wall-label"); if (!row) return;
  const a = State.art.find(x => x.id === +row.dataset.id); if (!a) return;
  a.room = e.target.value ? +e.target.value : null;
  renderLabels();
});

/* ---------- putting the exhibition in order ----------
   The order of State.art is the order of the show: the rotunda takes the
   first few, then each room hangs its own in this order. Dragging a card
   moves the work, and nothing else has to be told. */
let dragId = null;
labelsEl.addEventListener("dragstart", e => {
  const row = e.target.closest(".wall-label");
  if (!row) return;
  dragId = +row.dataset.id;
  row.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", String(dragId)); } catch (err) {}
});
labelsEl.addEventListener("dragend", () => {
  dragId = null;
  labelsEl.querySelectorAll(".dragging,.drop-before,.drop-after")
    .forEach(n => n.classList.remove("dragging", "drop-before", "drop-after"));
});
labelsEl.addEventListener("dragover", e => {
  if (dragId === null) return;
  const row = e.target.closest(".wall-label");
  if (!row || +row.dataset.id === dragId) return;
  e.preventDefault();
  const b = row.getBoundingClientRect();
  const after = e.clientY > b.top + b.height / 2;
  labelsEl.querySelectorAll(".drop-before,.drop-after")
    .forEach(n => n.classList.remove("drop-before", "drop-after"));
  row.classList.add(after ? "drop-after" : "drop-before");
});
labelsEl.addEventListener("drop", e => {
  if (dragId === null) return;
  const row = e.target.closest(".wall-label");
  if (!row) return;
  e.preventDefault();
  const overId = +row.dataset.id;
  if (overId === dragId) return;
  const b = row.getBoundingClientRect();
  const after = e.clientY > b.top + b.height / 2;
  const from = State.art.findIndex(a => a.id === dragId);
  if (from < 0) return;
  const moved = State.art.splice(from, 1)[0];
  let to = State.art.findIndex(a => a.id === overId);
  if (to < 0) to = State.art.length - 1;
  State.art.splice(after ? to + 1 : to, 0, moved);
  dragId = null;
  renderLabels();
});
labelsEl.addEventListener("click", e => {
  const row = e.target.closest(".wall-label"); if (!row) return;
  const id = +row.dataset.id;
  if (e.target.closest(".remove-btn")) {
    disposeMedia(id);                     // stop and release any clip it held
    State.art = State.art.filter(x => x.id !== id);
    State.stickers = State.stickers.filter(s => s.artId !== id);
    renderLabels();
  } else if (e.target.closest(".feature-toggle")) {
    /* One work is always on the feature wall, so this chooses rather than
       toggles - turning the only one off would leave the wall bare. */
    setFeature(id);
    renderLabels();
  } else if (e.target.closest(".cover-btn")) {
    coverTargetId = id;
    $("cover-input").click();
  } else if (e.target.closest(".cover-clear")) {
    const a = State.art.find(x => x.id === id);
    if (a) clearArtCover(a);
    renderLabels();
  }
});

/* ---------- the rooms strip ---------- */
$("room-add").addEventListener("click", () => {
  const room = addRoom();
  renderLabels();
  if (room) openRoomPanel(room.id);
});
$("rooms-list").addEventListener("click", e => {
  const chip = e.target.closest(".room-chip"); if (!chip || !chip.dataset.id) return;
  if (e.target.closest(".room-del")) { removeRoom(+chip.dataset.id); renderLabels(); return; }
  if (e.target.closest(".room-title")) openRoomPanel(+chip.dataset.id);
});

/* Dragging a work onto a room puts it in that room; dragging a room
   reorders the sections, which is the same as moving one round the
   rotunda to a different direction. */
let dragRoomId = null;
$("rooms-list").addEventListener("dragstart", e => {
  const chip = e.target.closest(".room-chip"); if (!chip || !chip.dataset.id) return;
  dragRoomId = +chip.dataset.id;
  chip.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
$("rooms-list").addEventListener("dragend", () => {
  dragRoomId = null;
  $("rooms-list").querySelectorAll(".dragging,.over").forEach(n => n.classList.remove("dragging", "over"));
});
$("rooms-list").addEventListener("dragover", e => {
  const chip = e.target.closest(".room-chip");
  if (!chip || (dragId === null && dragRoomId === null)) return;
  e.preventDefault();
  $("rooms-list").querySelectorAll(".over").forEach(n => n.classList.remove("over"));
  if (dragId !== null) chip.classList.add("over");
});
$("rooms-list").addEventListener("drop", e => {
  const chip = e.target.closest(".room-chip"); if (!chip) return;
  e.preventDefault();
  /* the Main Exhibition has no id: dropping onto it means "unfile this" */
  const target = chip.dataset.id ? +chip.dataset.id : null;
  if (dragId !== null) {
    const a = State.art.find(x => x.id === dragId);
    if (a) a.room = target;
    dragId = null;
  } else if (dragRoomId !== null && dragRoomId !== target) {
    const rooms = museumRooms();
    const from = rooms.findIndex(r => r.id === dragRoomId);
    const to = rooms.findIndex(r => r.id === target);
    if (from >= 0 && to >= 0) rooms.splice(to, 0, rooms.splice(from, 1)[0]);
    dragRoomId = null;
  }
  renderLabels();
});

/* ---------- optional cover art for a clip ---------- */
/* Part of the same list rather than a second upload flow: pick the clip's
   row, choose a picture, and it becomes what hangs on the wall. The audio
   or video file itself is never touched. */
let coverTargetId = null;
$("cover-input").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  const art = State.art.find(x => x.id === coverTargetId);
  coverTargetId = null;
  if (!file || !art) return;
  if (fileKind(file) !== "image") {
    alert("A cover needs to be a PNG or JPG.");
    return;
  }
  try {
    const small = shrink(await loadImg(await readAsDataURL(file)));
    setArtCover(art, small.src);
    /* A track has no shape of its own, so it takes the cover's. A video
       keeps its own, or the clip would letterbox oddly on the wall. */
    if (artKind(art) === "audio") { art.aw = small.w; art.ah = small.h; }
    renderLabels();
  } catch (err) {
    alert("That image could not be read. Try a different PNG or JPG.");
  }
});

function refreshDock() {
  const n = State.art.length;
  const artists = new Set(State.art.map(a => (a.author || "").trim().toLowerCase()).filter(Boolean)).size;
  $("count-text").innerHTML = n === 0
    ? "No artwork yet"
    : "<b>" + n + "</b> " + (n === 1 ? "work" : "works") + (artists ? " &middot; <b>" + artists + "</b> " + (artists === 1 ? "artist" : "artists") : "");
  $("enter-btn").disabled = n === 0;
  $("clear-btn").classList.toggle("hidden", n === 0 || State.guest);
  $("share-btn").classList.toggle("hidden", n === 0 || State.guest);
  $("share-btn").textContent = State.session.code ? "Sharing \u00b7 " + prettyCode(State.session.code) : "Share museum";
}

/* ---------- ingesting images ---------- */
const MAX_EDGE = 1200;

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(file);
  });
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode"));
    im.src = src;
  });
}
function shrink(img) {
  const long = Math.max(img.width, img.height);
  const k = long > MAX_EDGE ? MAX_EDGE / long : 1;
  const w = Math.max(2, Math.round(img.width * k)), h = Math.max(2, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, w, h);
  x.drawImage(img, 0, 0, w, h);
  return { src: c.toDataURL("image/jpeg", 0.85), w, h };
}

function titleFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/* One file in, one artwork record out. Pictures are resized as before; a
   clip is kept whole, because re-encoding video in the browser is not
   something a classroom laptop should be asked to do. */
async function buildArtwork(file, kind) {
  const name = titleFromFilename(file.name);

  if (kind === "image") {
    const small = shrink(await loadImg(await readAsDataURL(file)));
    return { id: State.nextId++, kind: "image", name: name, author: "", desc: "",
             src: small.src, aw: small.w, ah: small.h, featured: false };
  }

  const data = await readAsDataURL(file);

  if (kind === "audio") {
    if (!await probeAudio(data)) throw new Error("decode");
    const sleeve = audioCover(name);
    return { id: State.nextId++, kind: "audio", name: name, author: "", desc: "",
             src: sleeve, poster: sleeve, media: data, aw: 1, ah: 1, featured: false };
  }

  /* A .mov can carry a codec this browser will not open. It still becomes
     an artwork - it hangs, it takes stickers - it just shows a placeholder
     instead of a poster frame. */
  const info = await probeVideo(data);
  const usable = info.w > 0 && info.h > 0;
  const poster = info.poster || videoFallbackCover(name);
  return {
    id: State.nextId++, kind: "video", name: name, author: "", desc: "",
    src: poster, poster: poster, media: data,
    aw: usable ? info.w : 16, ah: usable ? info.h : 9, featured: false
  };
}

async function ingest(fileList) {
  const skipped = { type: [], big: [], broken: [] };
  const queue = [];

  /* A PowerPoint dropped here is the obvious thing to try, so it gets an
     answer rather than "not a file the museum can show". */
  if (Array.from(fileList).some(f => /\.pptx?$/i.test(f.name))) deckRejectPptx();

  Array.from(fileList).forEach(f => {
    if (/\.pptx?$/i.test(f.name)) return;
    const kind = fileKind(f);
    if (!kind) { skipped.type.push(f.name); return; }
    if (kind !== "image" && f.size > MAX_MEDIA_MB * 1048576) { skipped.big.push(f.name); return; }
    queue.push({ file: f, kind: kind });
  });

  if (queue.length) setDropzoneBusy(queue.length);
  for (const item of queue) {
    try {
      State.art.push(await buildArtwork(item.file, item.kind));
    } catch (err) { skipped.broken.push(item.file.name); }
  }
  setDropzoneBusy(0);

  if (State.art.length && !State.art.some(a => a.featured)) State.art[0].featured = true;
  renderLabels();
  reportSkipped(skipped);
}

/* Reading a video can take a moment; say so rather than looking frozen. */
function setDropzoneBusy(n) {
  const dz = $("dropzone"), label = dz.querySelector("strong");
  if (!label) return;
  if (!dz.dataset.idle) dz.dataset.idle = label.textContent;
  label.textContent = n ? "Reading " + n + (n === 1 ? " file…" : " files…") : dz.dataset.idle;
}

function reportSkipped(s) {
  const lines = [];
  if (s.type.length) lines.push("Not a file the museum can show: " + s.type.join(", ") +
    "\nIt takes PNG, JPG, MP3, MP4 and MOV.");
  if (s.big.length) lines.push("Larger than " + MAX_MEDIA_MB + " MB: " + s.big.join(", ") +
    "\nA clip travels inside the session file, so a big one slows down every student who joins. Trim it first.");
  if (s.broken.length) lines.push("Could not be read: " + s.broken.join(", ") +
    "\nThe file may be damaged, or use a format this browser cannot open.");
  if (lines.length) alert(lines.join("\n\n"));
}

$("browse-btn").addEventListener("click", () => $("file-input").click());
$("dropzone").addEventListener("click", e => { if (e.target.id === "dropzone") $("file-input").click(); });
$("dropzone").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file-input").click(); } });
$("file-input").addEventListener("change", e => { ingest(e.target.files); e.target.value = ""; });

["dragenter", "dragover"].forEach(t => $("dropzone").addEventListener(t, e => {
  e.preventDefault(); $("dropzone").classList.add("is-over");
}));
["dragleave", "drop"].forEach(t => $("dropzone").addEventListener(t, e => {
  e.preventDefault(); $("dropzone").classList.remove("is-over");
}));
$("dropzone").addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files) ingest(e.dataTransfer.files); });
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => e.preventDefault());

$("clear-btn").addEventListener("click", () => {
  if (!confirm("Remove every artwork and sticker from this museum?")) return;
  disposeAllMedia();
  State.art = []; State.stickers = []; State.deck = null; Deck.at = 0;
  State.rooms = [];
  renderLabels(); renderDeckBox();
});

/* ---------- save / open ---------- */
function saveMuseum() {
  const blob = new Blob([JSON.stringify({
    format: "student-art-museum", version: 2,
    title: State.session.title || "Student Art Museum",
    code: State.session.code || null,
    saved: new Date().toISOString(),
    art: State.art, stickers: State.stickers, deck: State.deck, rooms: State.rooms
  })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "student-art-museum.json";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$("restore-btn").addEventListener("click", () => $("restore-input").click());
$("restore-input").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.format !== "student-art-museum" || !Array.isArray(data.art)) throw new Error("shape");
    disposeAllMedia();
    State.art = data.art;
    State.stickers = Array.isArray(data.stickers) ? data.stickers : [];
    State.deck = (data.deck && Array.isArray(data.deck.slides) && data.deck.slides.length) ? data.deck : null;
    State.rooms = Array.isArray(data.rooms) ? data.rooms : [];
    Deck.at = 0;
    renderDeckBox();
    /* Slides draw their ids from the same counter as artwork, so the counter
       has to clear both or the next slide added would reuse an id that
       already has reactions recorded against it. */
    State.nextId = Math.max(
      State.art.reduce((m, a) => Math.max(m, a.id || 0), 0),
      deckSlides().reduce((m, s) => Math.max(m, (s && s.id) || 0), 0),
      museumRooms().reduce((m, r) => Math.max(m, (r && r.id) || 0), 0)) + 1;
    State.session = { code: data.code || null, title: data.title || "", published: null };
    $("museum-title").value = State.session.title;
    renderLabels();
  } catch (err) {
    alert("That file isn't a saved museum. Choose a student-art-museum.json file saved from this app.");
  }
});


/* ---------- exhibition title ---------- */
$("museum-title").addEventListener("input", e => {
  State.session.title = e.target.value;
  const st = $("plan-status");
  if (st && State.art.length) st.textContent = museumTitle();
});

/* ---------- attribution ---------- */
/* Both lines come from APP_VERSION in js/config.js. The markup carries the
   same text so the credit still reads correctly before this runs. */
(function stampVersion() {
  const home = $("home-credit"), inside = $("museum-credit");
  if (home) home.textContent = "Designed by Mr Wang - " + APP_VERSION;
  if (inside) inside.textContent = APP_VERSION + " - By Mr Wang";
})();

renderLabels();
renderDeckBox();
requestAnimationFrame(paintPlan);
