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
    alert("This browser cannot unpack a .pptx.\n\nIt needs a current Chrome, Edge, Safari 16.4 or " +
          "Firefox 113. Everything else in the museum still works.");
    return;
  }
  if (file.size > MAX_MEDIA_MB * 1048576) {
    alert("That deck is larger than " + MAX_MEDIA_MB + " MB. It travels inside the session file, so a " +
          "big one slows down every student who joins.");
    return;
  }
  deckBusy(true, "Opening the deck…");
  try {
    const deck = await readPptx(file, (done, total) =>
      deckBusy(true, "Drawing slide " + done + " of " + total + "…"));
    State.deck = deck;
    Deck.at = 0;
    renderDeckBox();
    refreshDock();
    if (deck.charts) {
      alert("The deck is in.\n\n" + deck.charts + (deck.charts === 1 ? " chart or diagram" : " charts or diagrams") +
            " could not be drawn: PowerPoint stores those as instructions for itself rather than as a " +
            "picture, and there is no way to run those in a browser. Everything else - text, images, " +
            "shapes, tables, colours and layout - is on the slides.\n\nTo keep a chart, paste it into " +
            "PowerPoint as a picture and add the file again.");
    }
  } catch (err) {
    State.deck = null;
    renderDeckBox();
    alert("That presentation could not be opened.\n\nIt may be damaged, or password protected. " +
          "Re-saving it from PowerPoint as .pptx usually fixes it.");
  }
  deckBusy(false);
  renderDeckBox();
}

onTapReady(() => {
  $("deck-btn").addEventListener("click", () => $("deck-input").click());
  $("deck-replace").addEventListener("click", () => $("deck-input").click());
  $("deck-remove").addEventListener("click", () => {
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
