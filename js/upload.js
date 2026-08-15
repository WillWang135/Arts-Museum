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
  labelsEl.innerHTML = "";
  State.art.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "wall-label";
    row.dataset.id = a.id;
    row.innerHTML =
      '<div class="thumb-wrap"><span class="accession">' + pad3(i + 1) + '</span><img alt=""></div>' +
      '<div class="label-fields">' +
        '<input class="f-title" data-f="name" placeholder="Artwork name" maxlength="70">' +
        '<input class="f-author" data-f="author" placeholder="Student name" maxlength="60">' +
        '<textarea class="f-desc" data-f="desc" placeholder="What is this piece about? Materials, ideas, the story behind it." maxlength="900"></textarea>' +
      '</div>' +
      '<div class="label-actions">' +
        '<button class="feature-toggle" type="button">' + SVG.star + 'Feature</button>' +
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
    State.art = State.art.filter(x => x.id !== id);
    State.stickers = State.stickers.filter(s => s.artId !== id);
    renderLabels();
  } else if (e.target.closest(".feature-toggle")) {
    const a = State.art.find(x => x.id === id);
    const was = a.featured;
    State.art.forEach(x => x.featured = false);
    a.featured = !was;
    renderLabels();
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

async function ingest(fileList) {
  const files = Array.from(fileList).filter(f => /^image\/(png|jpe?g)$/i.test(f.type));
  if (!files.length) { return; }
  for (const f of files) {
    try {
      const raw = await readAsDataURL(f);
      const img = await loadImg(raw);
      const small = shrink(img);
      const base = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      State.art.push({
        id: State.nextId++,
        name: base.charAt(0).toUpperCase() + base.slice(1),
        author: "", desc: "",
        src: small.src, aw: small.w, ah: small.h, featured: false
      });
    } catch (err) { /* skip unreadable file */ }
  }
  if (State.art.length && !State.art.some(a => a.featured)) State.art[0].featured = true;
  renderLabels();
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

renderLabels();
requestAnimationFrame(paintPlan);
