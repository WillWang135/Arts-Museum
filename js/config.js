/* ============================================================
   SHARING SETUP  --  fill ONE of these in, then save the file.

   This is the only file you need to edit. Everything else in
   js/ is the app itself.

   Full instructions are in SETUP.md, and in the app under
   "Share museum" -> "How sharing works".
   ============================================================ */
/* Shown on the home screen and in the bottom-left of the museum. Set it
   here and both follow - they used to be two literals that could drift. */
const APP_VERSION = "V1.1";

/* Audio and video travel inside the session file like everything else, as
   one long data URL, so a single large clip can outweigh a whole class of
   drawings. Past this a file is refused with an explanation rather than
   locking the browser up while it encodes. */
const MAX_MEDIA_MB = 40;

const SHARING = {

  /* ---- Option A: Supabase (recommended) --------------------
     Free account at supabase.com. Create a PUBLIC storage
     bucket, then paste your project URL and your public
     "anon" key below. Codes are issued instantly.            */
  supabaseUrl: "",     // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: "",     // the anon / publishable key
  bucket: "museums",   // the bucket name you created

  /* ---- Option B: your own endpoint -------------------------
     Anything answering GET/PUT /session/CODE with JSON.
     A ready-made Cloudflare Worker is in SETUP.md.           */
  endpoint: "",        // e.g. "https://museum.yourname.workers.dev"

  /* ---- Option C: this repo (no account needed) -------------
     Used automatically when A and B are blank. You download a
     CODE.json file and commit it to this folder in your
     GitHub Pages repo.                                        */
  folder: "sessions"
};

/* ============================================================
   THE 3D LIBRARY
   Schools that block public CDNs: download three.min.js (r128),
   put it beside student-art-museum.html, and set the name here.
   It is tried first, so the gallery then works with no outside
   connection at all.

   The path is relative to the HTML page, not to this file, so
   "three.min.js" means the one next to the page - not one
   inside js/.
   ============================================================ */
const LOCAL_THREE = "";      // e.g. "three.min.js"

const THREE_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://unpkg.com/three@0.128.0/build/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
];
