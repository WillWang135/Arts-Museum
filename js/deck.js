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

async function loadDeckFile(file) {
  if (!file) return;
  if (!/\.pptx$/i.test(file.name)) {
    alert("That is not a .pptx file.\n\nPowerPoint's older .ppt format and Keynote's .key cannot be " +
          "opened here. Open the file in PowerPoint or Google Slides and save it as .pptx first.");
    return;
  }
  if (!pptxSupported()) {
    alert("This presentation could not be fully displayed. Please try another file or export " +
          "it as PDF/images.\n\nThis browser cannot unpack a .pptx. It needs a current Chrome, " +
          "Edge, Safari 16.4 or Firefox 113.");
    return;
  }
  if (file.size > MAX_MEDIA_MB * 1048576) {
    alert("That deck is larger than " + MAX_MEDIA_MB + " MB. It travels inside the session file, so a " +
          "big one slows down every student who joins.");
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
       the counter reads the new one. Guarded, like every other route into
       the presentation: a rebuild that fails must not take the room. */
    if (running) {
      try { buildMuseum(); }
      catch (err) { if (window.console && console.warn) console.warn("rebuild:", err); }
    }
    reportDeckGaps(deck);
  } catch (err) {
    if (window.console && console.warn) console.warn("presentation:", err);
    renderDeckBox();
    alert("This presentation could not be fully displayed. Please try another file " +
          "or export it as PDF/images.\n\n" + deckWhy(err));
  }
  deckBusy(false);
  renderDeckBox();
}

/* Said plainly, and only where it is actually known. */
function deckWhy(err) {
  const m = String((err && err.message) || "");
  if (m === "unsupported") {
    return "This browser cannot unpack a .pptx. It needs a current Chrome, Edge, " +
           "Safari 16.4 or Firefox 113.";
  }
  if (m === "not a zip" || m === "empty zip") {
    return "The file is not a readable .pptx - it may be damaged, renamed from " +
           "something else, or password protected.";
  }
  if (m === "no slides" || m === "nothing rendered") {
    return "No slides could be found inside it. Re-saving it from PowerPoint as " +
           ".pptx usually fixes that.";
  }
  return "The museum is unaffected - everything else still works.";
}

/* What came through, and what did not. Nothing here stops the deck being
   used; it is the difference between a teacher understanding why a slide
   looks bare and a teacher thinking the whole thing is broken. */
function reportDeckGaps(deck) {
  const notes = [];
  if (deck.charts) {
    notes.push(deck.charts + (deck.charts === 1 ? " chart or diagram was" : " charts or diagrams were") +
      " left out. PowerPoint stores those as instructions for itself rather than as a picture, so " +
      "there is nothing a browser can draw. Paste one in as an image to keep it.");
  }
  if (deck.failed) {
    notes.push(deck.failed + (deck.failed === 1 ? " slide" : " slides") +
      " could not be drawn and appear as a blank page. The rest of the deck is unaffected.");
  }
  if (deck.skipped) {
    notes.push("Only the first " + deck.slides.length + " slides were taken; " + deck.skipped +
      " more were left out to keep the museum quick to load.");
  }
  if (!notes.length) return;
  alert("The deck is in - " + deck.slides.length + " slides.\n\n" + notes.join("\n\n"));
}

onTapReady(() => {
  $("deck-btn").addEventListener("click", () => $("deck-input").click());
  $("deck-replace").addEventListener("click", () => $("deck-input").click());
  $("deck-remove").addEventListener("click", () => {
    forgetDeckImages();
    State.deck = null; Deck.at = 0;
    renderDeckBox(); refreshDock();
  });
  $("deck-input").addEventListener("change", e => {
    const f = e.target.files[0]; e.target.value = "";
    loadDeckFile(f);
  });
});

/* js/hud.js owns onTap and loads much later, so the wiring above waits for
   the document rather than running the moment this file is parsed. */
function onTapReady(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}
