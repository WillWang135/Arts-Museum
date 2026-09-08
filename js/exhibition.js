/* ============================================================
   THE BUILT-IN EXHIBITION

   A museum published beside the page, in exhibition/ - so a
   visitor arriving at the address sees the show without being
   asked to find a file first.

       exhibition/museum.json     what is in the show
       exhibition/images/         the pictures
       exhibition/audio/          the tracks

   museum.json is the app's own save file. Export the museum
   from the home screen, drop the file in as museum.json, push,
   and the address serves that exhibition. Nothing about the
   format is new: it is read by the same adoptSession() that
   opens a saved file and joins a shared code.

   The one addition is that a src or a media field may be a path
   instead of a data URL. A file exported from the browser has
   its pictures inlined, which is fine but heavy - thirty of them
   is a JSON nobody wants in a repository - so a path relative to
   exhibition/ is read as a file sitting next to museum.json:

       "src": "images/still-life.jpg"
       "media": "audio/theme.mp3"

   For a hand-written file there is a shorter way still. Listing
   bare filenames is enough, and the rest is worked out on load:

       { "images": ["one.jpg", "two.jpg"], "audio": ["song.mp3"] }

   Whatever the shape, what is loaded is a starting point, not a
   save file. Anything the visitor adds afterwards lives in the
   browser for as long as the tab does; nothing is ever written
   back, and a refresh brings the published show back exactly as
   it is on GitHub.
   ============================================================ */

const EXHIBITION_DIR = "exhibition/";
const EXHIBITION_FILE = "museum.json";

/* Where this file was loaded from, caught while the page is still parsing it,
   because document.currentScript is only itself during that moment. It is a
   surer footing than the page address: js/exhibition.js is always one folder
   below the site root, whereas the address in the bar might be the root with
   no trailing slash - and "exhibition/" resolved against
   ".../Arts-Museum" lands on ".../exhibition", one folder too high.
   The single-file build has no src to read, and falls back to the page. */
const EXHIBITION_SCRIPT = (document.currentScript && document.currentScript.src) || "";

/* The published show, exactly as it was read, kept aside and never handed
   out. State gets a copy, so anything the visitor does to the museum in
   front of them cannot reach back and alter what was published. */
const Builtin = { data: null, loaded: false, started: false };

/* Where exhibition/ is, worked out from the page rather than written down.
   On GitHub Pages the site sits under /Arts-Museum/, opened from a folder
   it sits beside index.html, and both come out right because the browser
   resolves it against the document. */
function exhibitionBase() {
  try {
    if (EXHIBITION_SCRIPT) return new URL("../" + EXHIBITION_DIR, EXHIBITION_SCRIPT).href;
  } catch (e) { /* fall through to the page address */ }
  try { return new URL(EXHIBITION_DIR, location.href).href; }
  catch (e) { return EXHIBITION_DIR; }
}

/* A data URL, an http address and a path already inside exhibition/ are all
   left exactly as they are. Anything else is a file published beside
   museum.json, and `folder` is where to look if the path does not say. */
function exhibitionUrl(ref, folder) {
  let s = String(ref || "").trim();
  if (!s) return "";
  if (/^(data:|blob:|https?:|\/\/)/i.test(s)) return s;
  s = s.replace(/^\.?\//, "");
  /* Written from the repository root - "exhibition/images/one.jpg" - rather
     than from inside the folder. Both are the obvious thing to write, so both
     mean the same file. */
  s = s.replace(/^exhibition\//i, "");
  const rel = s.indexOf("/") === -1 ? (folder || "") + s : s;
  /* The URL constructor percent-encodes what has to be encoded, which matters
     here: these filenames have spaces and brackets in them. */
  try { return new URL(rel, exhibitionBase()).href; }
  catch (e) { return exhibitionBase() + rel; }
}

/* ---------- the short form ---------- */
/* Filenames and nothing else. A picture is measured once it has loaded,
   because the wall needs its shape; a track is given the same generated
   sleeve an uploaded one gets, so it hangs like everything else. */
async function artFromBuiltinImage(ref) {
  const url = exhibitionUrl(ref, "images/");
  const img = await loadImg(url);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  return { id: State.nextId++, kind: "image", name: titleFromFilename(basename(ref)),
           author: "", desc: "", src: url, aw: w || 1, ah: h || 1, featured: false };
}
function artFromBuiltinAudio(ref) {
  const url = exhibitionUrl(ref, "audio/");
  const name = titleFromFilename(basename(ref));
  const sleeve = audioCover(name);
  return { id: State.nextId++, kind: "audio", name: name, author: "", desc: "",
           src: sleeve, poster: sleeve, media: url, aw: 1, ah: 1, featured: false };
}
function basename(ref) {
  const s = String(ref || "");
  return s.slice(s.lastIndexOf("/") + 1) || s;
}

/* An entry may be a bare filename or an object carrying the wall label with
   it, so a hand-written file can say more than the filename does. */
/* A list entry is a filename, or an object carrying the wall label with it.
   The file itself may be under `src` or `file`: `src` is what the museum's
   own save format calls it, so it is the one to reach for first. */
function builtinRef(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return { file: entry };
  const file = entry.src || entry.file;
  if (!file) return null;
  return Object.assign({}, entry, { file: file });
}
function applyBuiltinFields(art, ref) {
  if (ref.name) art.name = ref.name;
  if (ref.author) art.author = ref.author;
  if (ref.desc) art.desc = ref.desc;
  if (ref.room !== undefined) art.room = ref.room;
  if (ref.featured) art.featured = true;
  return art;
}

async function sessionFromManifest(data) {
  const art = [];
  for (const entry of (Array.isArray(data.images) ? data.images : [])) {
    const ref = builtinRef(entry);
    if (!ref || !ref.file) continue;
    try { art.push(applyBuiltinFields(await artFromBuiltinImage(ref.file), ref)); }
    catch (e) { warnExhibition("image did not load: " + exhibitionUrl(ref.file, "images/")); }
  }
  (Array.isArray(data.audio) ? data.audio : []).forEach(entry => {
    const ref = builtinRef(entry);
    if (!ref || !ref.file) return;
    art.push(applyBuiltinFields(artFromBuiltinAudio(ref.file), ref));
  });
  return { format: "student-art-museum", version: 2, code: null,
           title: data.title || "", art: art,
           stickers: [], deck: null, rooms: Array.isArray(data.rooms) ? data.rooms : [] };
}

/* ---------- the app's own save file ---------- */
/* Every picture, sleeve and clip in it is pointed at exhibition/ unless it
   already carries its own. A file exported straight from the browser has
   data URLs throughout and comes through this untouched. */
function resolveSessionPaths(data) {
  (data.art || []).forEach(a => {
    if (!a) return;
    const folder = artKind(a) === "image" ? "images/" : "audio/";
    if (a.src) a.src = exhibitionUrl(a.src, folder);
    if (a.poster) a.poster = exhibitionUrl(a.poster, "images/");
    if (a.cover) a.cover = exhibitionUrl(a.cover, "images/");
    if (a.media) a.media = exhibitionUrl(a.media, "audio/");
  });
  if (data.deck && Array.isArray(data.deck.slides)) {
    data.deck.slides = data.deck.slides.map(s => {
      if (typeof s === "string") return exhibitionUrl(s, "images/");
      if (s && s.src) s.src = exhibitionUrl(s.src, "images/");
      return s;
    });
  }
  return data;
}

/* The other direction: a file inside exhibition/ written back as the path it
   came from, so a saved museum can be dropped in as museum.json and does not
   carry this address around with it. Everything else - an uploaded picture
   held whole, a link to somewhere off-site - is left exactly as it is. */
function relativiseToExhibition(payload) {
  const base = exhibitionBase();
  const back = ref => {
    const s = String(ref || "");
    return s.indexOf(base) === 0 ? s.slice(base.length) : ref;
  };
  const out = JSON.parse(JSON.stringify(payload));
  (out.art || []).forEach(a => {
    if (!a) return;
    delete a.builtin;                 // a save file has no use for the flag
    if (a.src) a.src = back(a.src);
    if (a.poster) a.poster = back(a.poster);
    if (a.cover) a.cover = back(a.cover);
    if (a.media) a.media = back(a.media);
  });
  if (out.deck && Array.isArray(out.deck.slides)) {
    out.deck.slides = out.deck.slides.map(sl => {
      if (typeof sl === "string") return back(sl);
      if (sl && sl.src) sl.src = back(sl.src);
      return sl;
    });
  }
  return out;
}

function warnExhibition(what, err) {
  if (window.console && console.warn) console.warn("exhibition: " + what, err || "");
}

/* ---------- loading it ---------- */
async function readBuiltinExhibition() {
  const url = new URL(EXHIBITION_FILE, exhibitionBase()).href;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("http " + res.status);
  const text = (await res.text()).trim();
  if (!text) throw new Error("empty");
  const data = JSON.parse(text);                 // a 404 page throws here, which is the point
  if (!data || typeof data !== "object") throw new Error("shape");

  if (sessionShapeOk(data)) return resolveSessionPaths(data);
  if (Array.isArray(data.images) || Array.isArray(data.audio)) return await sessionFromManifest(data);
  throw new Error("shape");
}

/* Marked as published, which is the whole of the difference between the two
   kinds of content: everything else about a built-in work behaves exactly
   like an uploaded one, and everything the visitor adds is simply not
   marked. Nothing is written back either way. */
function markBuiltin(data) {
  (data.art || []).forEach(a => { if (a) a.builtin = true; });
  return data;
}
function builtinArt() { return State.art.filter(a => a && a.builtin); }
function addedArt() { return State.art.filter(a => a && !a.builtin); }

async function loadBuiltinExhibition() {
  /* Once. Called again - a second render, a stray second call - it answers
     with what it already did rather than hanging the show twice. */
  if (Builtin.started) return Builtin.loaded;
  Builtin.started = true;

  /* A code in the address is somebody being sent a particular museum, and
     that is the one they should get. */
  const q = new URLSearchParams(location.search);
  if (normCode(q.get("code") || q.get("c") || location.hash.replace("#", "")).length === 6) return false;

  let data;
  try {
    data = await readBuiltinExhibition();
  } catch (err) {
    /* Missing, empty, half-written or not JSON at all: the museum opens
       empty, exactly as it does with no exhibition/ folder there. */
    warnExhibition("no published exhibition loaded (" + (err && err.message) + ")");
    return false;
  }
  if (!data.art.length) {
    warnExhibition("museum.json lists no works - opening empty");
    return false;
  }
  /* Somebody got in first: a file opened by hand, or a code that arrived
     while this was still downloading. Their museum stands. */
  if (State.art.length || State.guest) return false;

  Builtin.data = data;
  Builtin.loaded = true;
  adoptSession(markBuiltin(JSON.parse(JSON.stringify(data))));
  const pics = data.art.filter(a => artKind(a) === "image").length;
  if (window.console && console.log) {
    console.log("exhibition: hung " + data.art.length + " works (" +
                pics + " image" + (pics === 1 ? "" : "s") + ", " +
                (data.art.length - pics) + " track" + (data.art.length - pics === 1 ? "" : "s") +
                ") from " + exhibitionBase() + EXHIBITION_FILE);
  }
  return true;
}

onTapReady(() => { loadBuiltinExhibition(); });
