/* ============================================================
   THE PRESENTATION

   A slideshow on the back of the feature wall: one picture at a
   time, a way forward and back, and the position in the deck.
   Nothing advances on its own and nothing can be edited from
   inside the gallery.

   Slides are images - PNG or JPG, exported from PowerPoint or
   Google Slides. Reading a .pptx in the browser was tried and
   withdrawn: a one-slide deck came out reasonably, but text
   overlapped, several pictures at once could take the museum
   down with them, and once that happened even decks that had
   worked stopped loading. A picture of a slide is exactly what
   PowerPoint itself shows on a projector, and there is nothing in
   it left to go wrong.

   js/pptx.js is still in the repository, unreferenced, if that is
   ever worth another attempt. Everything below talks to slides
   through addDeckSlides(), so a reader that produces the same
   shape could be dropped back in without touching the museum.

   Each slide carries its own id, so a reaction belongs to the
   page it was left on and to no other.
   ============================================================ */
const Deck = { at: 0 };

const DECK_MAX_SLIDES = 120;
const DECK_MAX_EDGE = MAX_SLIDE_EDGE;   // set in js/config.js

function deckSlides() { return (State.deck && State.deck.slides) || []; }
function deckCount() { return deckSlides().length; }
function deckHas() { return deckCount() > 0; }
function deckClamp() {
  const n = deckCount();
  if (!n) { Deck.at = 0; return; }
  Deck.at = ((Deck.at % n) + n) % n;
}
/* A slide is {id, src, w, h}. Sessions saved by the .pptx version stored
   plain strings, so those are read too rather than being lost. */
function deckSlide(i) {
  const s = deckSlides()[i];
  if (!s) return null;
  return typeof s === "string" ? { id: null, src: s, w: 0, h: 0 } : s;
}
function deckCurrent() { deckClamp(); const s = deckSlide(Deck.at); return s ? s.src : null; }
function deckCurrentId() { deckClamp(); const s = deckSlide(Deck.at); return s ? s.id : null; }
function deckLabel() { return deckHas() ? (Deck.at + 1) + " / " + deckCount() : ""; }

/* Wraps at both ends: a deck read on a wall has no last page to fall off. */
function deckGo(step) {
  if (!deckHas()) return;
  Deck.at += step;
  deckClamp();
  showDeckSlide();
}
function deckSet(i) {
  if (!deckHas()) return;
  Deck.at = i;
  deckClamp();
  showDeckSlide();
}
/* Everything that has to agree about which slide is up. The wall, the
   enlarged view and the reactions are refreshed from one place so they
   cannot drift apart. */
function showDeckSlide() {
  paintDeckScreen();
  syncDeckViewer();
  restoreSlideStickers();
  needsRender = true;
}

/* ---------- the setup screen ---------- */
function deckBusy(on, text) {
  $("deck-busy").classList.toggle("hidden", !on);
  $("deck-empty").classList.toggle("hidden", on || deckHas());
  $("deck-have").classList.toggle("hidden", on || !deckHas());
  if (text) $("deck-busy-text").textContent = text;
}

function renderDeckBox() {
  const have = deckHas();
  $("deck-empty").classList.toggle("hidden", have);
  $("deck-have").classList.toggle("hidden", !have);
  $("deck-busy").classList.add("hidden");
  if (!have) return;
  $("deck-name").textContent = State.deck.name || "Presentation";
  $("deck-count").textContent = deckCount() + (deckCount() === 1 ? " slide" : " slides");
  const first = deckSlide(0);
  if (first) $("deck-thumb-img").src = first.src;
}

/* Said in the page rather than through alert(), which blocks the tab and
   which browsers let a visitor switch off after the first one. */
function deckNote(text, kind) {
  const el = $("deck-note");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
  el.classList.toggle("bad", kind === "bad");
}

/* ---------- adding slides ---------- */
/* Kept in the order they arrive. Not sorted, not rearranged: the order the
   files come in is the order of the talk, and second-guessing that with a
   filename sort is how slide 10 ends up between slide 1 and slide 2. */
function deckShrink(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const long = Math.max(w, h);
  if (!long) return null;
  if (long <= DECK_MAX_EDGE) return null;          /* already a sensible size */
  const k = DECK_MAX_EDGE / long;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const out = { src: c.toDataURL("image/jpeg", 0.92), w: c.width, h: c.height };
  c.width = c.height = 1;
  return out;
}

async function addDeckSlides(list, replace) {
  const files = Array.from(list).filter(f => /\.(png|jpe?g)$/i.test(f.name));
  if (!files.length) {
    deckNote("Those files are not slide images. Export the slides as PNG or JPG first — " +
             "in PowerPoint that is File ‣ Export ‣ PNG.", "bad");
    return;
  }
  deckNote("");
  deckBusy(true, "Reading the slides…");

  const existing = replace ? [] : deckSlides().slice();
  const added = [];
  const failed = [];
  const room = DECK_MAX_SLIDES - existing.length;

  for (let i = 0; i < files.length && added.length < room; i++) {
    deckBusy(true, "Reading slide " + (existing.length + added.length + 1) + "…");
    try {
      const raw = await readAsDataURL(files[i]);
      const img = await loadImg(raw);
      const small = deckShrink(img);
      added.push({
        id: State.nextId++,
        src: small ? small.src : raw,
        w: small ? small.w : img.naturalWidth,
        h: small ? small.h : img.naturalHeight
      });
    } catch (err) {
      /* One picture that will not open is one slide missing, and the deck
         still runs. Named, so it is obvious which one to re-export. */
      failed.push(files[i].name);
    }
  }
  deckBusy(false);

  if (!added.length && !existing.length) {
    deckNote("None of those pictures could be opened." +
             (failed.length ? " Tried: " + failed.slice(0, 4).join(", ") : ""), "bad");
    renderDeckBox();
    return;
  }

  const slides = existing.concat(added);
  const shape = slides[0];
  forgetDeckImages();
  State.deck = {
    name: (replace || !State.deck) ? deckNameFor(files) : State.deck.name,
    w: shape.w || 1600, h: shape.h || 900,
    slides: slides
  };
  Deck.at = 0;
  renderDeckBox();
  refreshDock();
  if (running) buildMuseumSafely();

  const notes = [];
  notes.push(added.length + (added.length === 1 ? " slide added" : " slides added") +
             " — " + slides.length + " in the deck.");
  if (failed.length) notes.push(failed.length + " could not be opened: " + failed.slice(0, 4).join(", ") + ".");
  if (files.length > room) notes.push("The deck is full at " + DECK_MAX_SLIDES + " slides.");
  deckNote(notes.join(" "), failed.length ? "bad" : null);
}

function deckNameFor(files) {
  if (files.length === 1) return files[0].name.replace(/\.[^.]+$/, "");
  /* "Talk-01.png, Talk-02.png" -> "Talk" */
  const stem = files[0].name.replace(/\.[^.]+$/, "").replace(/[-_ ]*\d+$/, "").trim();
  return stem || "Presentation";
}

/* A .pptx dropped anywhere says what to do about it, once. */
function deckRejectPptx() {
  deckNote("PowerPoint files cannot be read here. Open the deck in PowerPoint and use " +
           "File ‣ Export ‣ PNG (or File ‣ Download ‣ PNG in Google Slides), then add " +
           "the slide images. They keep their layout and fonts exactly as you see them.", "bad");
}

function clearDeck() {
  forgetDeckImages();
  /* the reactions left on its pages go with it */
  const ids = deckSlides().map(s => (typeof s === "string" ? null : s.id)).filter(v => v !== null);
  if (ids.length) State.stickers = State.stickers.filter(r => ids.indexOf(r.artId) === -1);
  State.deck = null;
  Deck.at = 0;
  deckNote("");
  renderDeckBox();
  refreshDock();
  if (running) buildMuseumSafely();
}

/* js/hud.js owns onTap and loads much later, so the wiring waits for the
   document rather than running the moment this file is parsed. */
function onTapReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

onTapReady(() => {
  const pick = more => { $("deck-input").dataset.more = more ? "1" : ""; $("deck-input").click(); };
  $("deck-btn").addEventListener("click", () => pick(false));
  $("deck-add").addEventListener("click", () => pick(true));
  $("deck-replace").addEventListener("click", () => pick(false));
  $("deck-remove").addEventListener("click", clearDeck);
  $("deck-input").addEventListener("change", e => {
    const chosen = Array.from(e.target.files || []);
    const more = e.target.dataset.more === "1";
    e.target.value = ""; e.target.dataset.more = "";
    if (!chosen.length) return;
    if (chosen.some(f => /\.pptx?$/i.test(f.name))) { deckRejectPptx(); return; }
    addDeckSlides(chosen, !more);
  });
});
