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
  const open = computeLayout(Math.max(n, 1)).open.filter(Boolean).length;
  const rooms = open === 0 ? "Rotunda only" : "Rotunda + " + open + (open === 1 ? " wing" : " wings");
  const named = (State.session.title || "").trim();
  $("plan-status").textContent = n === 0 ? "Empty floorplan" : (named || rooms);
}
window.addEventListener("resize", paintPlan);

function renderLabels() {
  normaliseMediaArt(State.art);
  labelsEl.innerHTML = "";
  State.art.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "wall-label";
    row.dataset.id = a.id;
    row.innerHTML =
      '<div class="thumb-wrap"><span class="accession">' + pad3(i + 1) + '</span><img alt="">' +
        (isPlayable(a) ? '<span class="kindtag">' + (artKind(a) === "audio" ? "Audio" : "Video") + '</span>' : '') +
      '</div>' +
      '<div class="label-fields">' +
        '<input class="f-title" data-f="name" placeholder="Artwork name" maxlength="70">' +
        '<input class="f-author" data-f="author" placeholder="Student name" maxlength="60">' +
        '<textarea class="f-desc" data-f="desc" placeholder="What is this piece about? Materials, ideas, the story behind it." maxlength="900"></textarea>' +
      '</div>' +
      '<div class="label-actions">' +
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
  a[e.target.dataset.f] = e.target.value;
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
    const a = State.art.find(x => x.id === id);
    const was = a.featured;
    State.art.forEach(x => x.featured = false);
    a.featured = !was;
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

  Array.from(fileList).forEach(f => {
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
  State.art = []; State.stickers = []; renderLabels();
});

/* ---------- save / open ---------- */
function saveMuseum() {
  const blob = new Blob([JSON.stringify({
    format: "student-art-museum", version: 2,
    title: State.session.title || "Student Art Museum",
    code: State.session.code || null,
    saved: new Date().toISOString(),
    art: State.art, stickers: State.stickers
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
    State.nextId = State.art.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
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
requestAnimationFrame(paintPlan);
