/* ============================================================
   THE PRESENTATION

   One deck per museum, hung on the back of the feature wall. It
   is a viewer and nothing more: a slide at a time, a way forward
   and back, and the position in the deck. Nothing advances on its
   own and nothing can be edited from inside the gallery.

   Which slide is showing lives here rather than on the screen
   object, so the wall and the enlarged view are always looking at
   the same number.
   ============================================================ */
const Deck = { at: 0 };

function deckSlides() { return (State.deck && State.deck.slides) || []; }
function deckCount() { return deckSlides().length; }
function deckHas() { return deckCount() > 0; }
function deckClamp() {
  const n = deckCount();
  if (!n) { Deck.at = 0; return; }
  Deck.at = ((Deck.at % n) + n) % n;
}
function deckCurrent() { deckClamp(); return deckSlides()[Deck.at] || null; }
function deckLabel() { return deckHas() ? (Deck.at + 1) + " / " + deckCount() : ""; }

/* Wraps at both ends: a deck read on a wall has no last page to fall off. */
function deckGo(step) {
  if (!deckHas()) return;
  Deck.at += step;
  deckClamp();
  paintDeckScreen();
  syncDeckViewer();
  needsRender = true;
}
function deckSet(i) {
  if (!deckHas()) return;
  Deck.at = i;
  deckClamp();
  paintDeckScreen();
  syncDeckViewer();
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
  $("deck-thumb-img").src = State.deck.slides[0];
}

/* Everything the deck box has to say, said in the page. alert() blocks the
   whole tab, some browsers let a visitor switch further ones off after the
   first, and a suppressed alert leaves a teacher watching a screen where
   nothing at all appears to have happened. A line under the box cannot be
   suppressed, cannot block, and is still there to re-read a minute later. */
function deckNote(text, kind) {
  const el = $("deck-note");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
  el.classList.toggle("bad", kind === "bad");
}

/* ---------- slides as pictures ----------
   The escape hatch, and the one thing that cannot go wrong. PowerPoint will
   export a deck as PNGs from File > Export, Google Slides from File >
   Download; drop those in and they hang exactly as a read deck would. When
   a .pptx has something in it this cannot draw - a chart, a diagram, a font
   nobody has - this is the answer, and it is worth saying so plainly rather
   than leaving a teacher to discover it. */
function naturalOrder(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

async function loadDeckImages(list) {
  const files = Array.from(list).filter(f => /\.(png|jpe?g)$/i.test(f.name)).sort(naturalOrder);
  if (!files.length) return;
  deckBusy(true, "Reading the slides\u2026");
  const slides = [];
  let w = 0, h = 0;
  for (let i = 0; i < files.length && i < PPTX_MAX_SLIDES; i++) {
    try {
      const url = await readAsDataURL(files[i]);
      const img = await loadImg(url);
      if (!w) { w = img.naturalWidth; h = img.naturalHeight; }
      slides.push(url);
      deckBusy(true, "Reading slide " + (i + 1) + " of " + files.length + "\u2026");
    } catch (err) { /* one picture that will not open is one slide missing */ }
  }
  deckBusy(false);
  if (!slides.length) {
    deckNote("None of those pictures could be opened.", "bad");
    renderDeckBox();
    return;
  }
  forgetDeckImages();
  State.deck = { name: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : "Slides",
                 w: w || 1600, h: h || 900, slides: slides, charts: 0, failed: 0, skipped: 0 };
  Deck.at = 0;
  renderDeckBox();
  refreshDock();
  if (running) buildMuseumSafely();
  deckNote(slides.length + (slides.length === 1 ? " slide" : " slides") + " added.");
}

async function loadDeckFile(file) {
  if (!file) return;
  deckNote("");
  if (/\.(png|jpe?g)$/i.test(file.name)) { await loadDeckImages([file]); return; }
  if (!/\.pptx$/i.test(file.name)) {
    deckNote("That is not a .pptx file. PowerPoint's older .ppt and Keynote's .key cannot be opened " +
             "here. Save it as .pptx, or export the slides as PNG images and add those instead.", "bad");
    return;
  }
  if (!pptxSupported()) {
    deckNote("This presentation could not be fully displayed. Please try another file or export it as " +
             "PDF/images. This browser cannot unpack a .pptx; it needs a current Chrome, Edge, " +
             "Safari 16.4 or Firefox 113. In PowerPoint, File \u2023 Export \u2023 PNG gives you slide " +
             "images that will always work here.", "bad");
    return;
  }
  if (file.size > MAX_DECK_MB * 1048576) {
    deckNote("That deck is " + Math.round(file.size / 1048576) + " MB, and the limit is " + MAX_DECK_MB +
             " MB. A deck this large can exhaust the browser while it is being unpacked. In PowerPoint, " +
             "File \u2023 Compress Pictures usually brings it well under.", "bad");
    return;
  }

  deckBusy(true, "Opening the deck\u2026");
  /* The deck the museum already has is left alone until a new one has been
     read all the way through. A file that turns out to be unreadable must
     not also take away the one that was working. */
  try {
    const deck = await readPptx(file, (done, total) =>
      deckBusy(true, "Drawing slide " + done + " of " + total + "\u2026"));
    forgetDeckImages();
    State.deck = deck;
    Deck.at = 0;
    renderDeckBox();
    refreshDock();
    /* A deck is normally added before anyone goes in, but if the museum is
       already standing the wall has to be rebuilt around the new slide size
       - otherwise the screen keeps the old deck's shape and picture while
       the counter reads the new one. */
    if (running) buildMuseumSafely();
    reportDeckGaps(deck);
  } catch (err) {
    if (window.console && console.warn) console.warn("presentation:", err);
    renderDeckBox();
    deckNote("This presentation could not be fully displayed. Please try another file or export it as " +
             "PDF/images. " + deckWhy(err) + " In PowerPoint, File \u2023 Export \u2023 PNG gives you " +
             "slide images that can be added here instead.", "bad");
  }
  deckBusy(false);
  renderDeckBox();
}

/* Said plainly, and only where it is actually known. */
function deckWhy(err) {
  const m = String((err && err.message) || "");
  if (m === "unsupported") {
    return "This browser cannot unpack a .pptx.";
  }
  if (m === "not a zip" || m === "empty zip" || m === "no markup") {
    return "The file is not a readable .pptx - it may be damaged, renamed from something else, " +
           "or password protected.";
  }
  if (m === "no slides" || m === "nothing rendered") {
    return "No slides could be found inside it. Re-saving it from PowerPoint as .pptx usually helps.";
  }
  return "The museum is unaffected; everything else still works.";
}

/* What came through, and what did not. Nothing here stops the deck being
   used; it is the difference between a teacher understanding why a slide
   looks bare and a teacher thinking the whole thing is broken. */
function reportDeckGaps(deck) {
  const notes = [];
  if (deck.charts) {
    notes.push(deck.charts + (deck.charts === 1 ? " chart or diagram was" : " charts or diagrams were") +
      " left out - PowerPoint stores those as instructions for itself rather than as a picture. " +
      "Paste one in as an image to keep it.");
  }
  if (deck.failed) {
    notes.push(deck.failed + (deck.failed === 1 ? " slide" : " slides") + " could not be drawn.");
  }
  if (deck.skipped) {
    notes.push("Only the first " + deck.slides.length + " slides were taken.");
  }
  deckNote(notes.length ? notes.join(" ") : "", notes.length ? "bad" : null);
}

onTapReady(() => {
  $("deck-btn").addEventListener("click", () => $("deck-input").click());
  $("deck-replace").addEventListener("click", () => $("deck-input").click());
  $("deck-remove").addEventListener("click", () => {
    forgetDeckImages();
    State.deck = null; Deck.at = 0;
    deckNote("");
    renderDeckBox(); refreshDock();
    if (running) buildMuseumSafely();
  });
  $("deck-input").addEventListener("change", e => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = "";
    if (!chosen.length) return;
    const pptx = chosen.find(f => /\.pptx$/i.test(f.name));
    if (pptx) loadDeckFile(pptx);
    else loadDeckImages(chosen);
  });
});

/* js/hud.js owns onTap and loads much later, so the wiring above waits for
   the document rather than running the moment this file is parsed. */
function onTapReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}
