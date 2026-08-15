/* ============================================================
   JOINING A SHARED MUSEUM
   ============================================================ */
function setJoinNote(text, kind) {
  const el = $("join-note");
  el.textContent = text;
  el.className = "joinnote" + (kind ? " " + kind : "");
}

function applyGuestMode() {
  document.body.classList.toggle("is-guest", !!State.guest);
  $("session-card").classList.toggle("hidden", !State.guest);
  if (State.guest) {
    $("mast-eyebrow").textContent = "Shared exhibition";
    $("mast-standfirst").textContent = "Walk the galleries, read the wall labels, and celebrate the work you like best.";
    $("session-title").textContent = State.session.title || "Student Art Museum";
    const n = State.art.length;
    $("session-meta").textContent =
      n + (n === 1 ? " work" : " works") + " \u00b7 join code " + prettyCode(State.session.code);
  }
}

async function joinSession(rawCode) {
  const code = normCode(rawCode);
  $("join-input").value = prettyCode(code);
  if (code.length !== 6) {
    setJoinNote("Join codes are six characters, like ABC-234.", "err");
    $("join-input").focus();
    return;
  }
  $("join-btn").disabled = true;
  setJoinNote("Looking for that museum\u2026", "");
  try {
    const data = await Sessions.load(code, p => {
      setJoinNote("Loading the artwork\u2026 " + Math.round(p * 100) + "%", "");
    });
    if (!data.art.length) throw new Error("not-found");
    State.art = data.art;
    State.stickers = Array.isArray(data.stickers) ? data.stickers : [];
    State.nextId = State.art.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
    State.session = { code: code, title: data.title || "Student Art Museum", published: data.saved || null };
    State.guest = true;
    applyGuestMode();
    renderLabels();
    setJoinNote("Found it. Opening the doors\u2026", "ok");
    enterMuseum();
  } catch (err) {
    setJoinNote(err.message === "not-found"
      ? "No museum with that code. Check each character and try again."
      : "Could not reach the museum. Check the internet connection and try again.", "err");
  } finally {
    $("join-btn").disabled = false;
  }
}

$("join-btn").addEventListener("click", () => joinSession($("join-input").value));
$("join-input").addEventListener("keydown", e => { if (e.key === "Enter") joinSession(e.target.value); });
$("join-input").addEventListener("input", e => {
  const c = normCode(e.target.value);
  e.target.value = prettyCode(c);
  if ($("join-note").classList.contains("err")) setJoinNote("Six characters from your teacher.", "");
});
$("reenter-btn").addEventListener("click", enterMuseum);
$("leave-btn").addEventListener("click", () => {
  if (location.protocol === "about:") {
    State.guest = false;
    State.art = []; State.stickers = [];
    State.session = { code: null, title: "", published: null };
    applyGuestMode(); renderLabels();
    $("join-input").value = "";
    setJoinNote("Six characters from your teacher.", "");
    return;
  }
  location.href = location.pathname;
});
