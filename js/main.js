/* ============================================================
   ENTER / EXIT  --  the door between the two screens.
   ============================================================ */
function enterMuseum() {
  if (!State.art.length) return;
  /* Whatever was open on the setup screen stays there. #overlay-root lives
     inside the museum screen, so a room panel left open followed the host
     through the door and greeted them as a picker over the gallery. */
  closeOverlay();
  /* Every room opens silent. Nothing plays until a visitor asks it to. */
  stopAllMedia();
  document.body.classList.add("in-museum");
  $("screen-upload").classList.add("hidden");
  $("screen-museum").classList.remove("hidden");
  $("loading").classList.remove("hidden");
  $("loading").innerHTML =
    '<div style="text-align:center"><div class="bar"><i></i></div><p>Hanging the exhibition</p></div>';

  loadThree().then(() => {
    try {
      if (!renderer) { initThree(); setupTouch(); }
      if (isTouchOnly() && quality === "high") { quality = "low"; applyQuality(); }
      else if (!buildMuseumSafely()) throw new Error("build");
      resetPlayer();
      $("view-btn").innerHTML = "View: <b>First person</b>";   /* resetPlayer chose it */
      $("loading").classList.add("hidden");
      $("map-btn").classList.add("on");
      running = true;
      refreshCodeChip();
      clock.getDelta();
      frameLoop();
      toast(State.guest
        ? "Welcome to " + (State.session.title || "the museum")
        : (isTouchOnly() ? "Drag left circle to walk" : "Click the gallery to look around"));
    } catch (err) {
      $("loading").innerHTML =
        '<div class="fail"><h3>The gallery could not start</h3>' +
        '<p>This device could not open a 3D view. Trying a different browser, or turning on ' +
        'hardware acceleration in the browser settings, usually fixes it.</p>' +
        '<div class="actions"><button class="btn btn-quiet" id="back-three" type="button">Back</button></div></div>';
      $("back-three").addEventListener("click", exitMuseum);
    }
  }, showLoadFailure);
}

function exitMuseum() {
  exitSelfie();
  running = false;
  stopAllMedia();                 // nothing carries on playing into the setup screen
  if (document.pointerLockElement) document.exitPointerLock();
  closeOverlay();
  document.body.classList.remove("in-museum");
  $("screen-museum").classList.add("hidden");
  $("screen-upload").classList.remove("hidden");
  renderLabels();
}

$("enter-btn").addEventListener("click", enterMuseum);
