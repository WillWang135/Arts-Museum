/* ============================================================
   LOADING THE 3D LIBRARY
   Nothing in these files touches THREE until the museum opens,
   so a blocked CDN can no longer stop the page from working.
   The sources themselves live in js/config.js.
   ============================================================ */
let threeLoading = null;

function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (threeLoading) return threeLoading;

  const sources = (LOCAL_THREE ? [LOCAL_THREE] : []).concat(THREE_SOURCES);
  threeLoading = new Promise((resolve, reject) => {
    let i = 0;
    const attempt = () => {
      if (window.THREE) return resolve();
      if (i >= sources.length) { threeLoading = null; return reject(new Error("three-unavailable")); }
      const tag = document.createElement("script");
      tag.src = sources[i++];
      tag.async = false;
      tag.onload = () => window.THREE ? resolve() : attempt();
      tag.onerror = attempt;
      document.head.appendChild(tag);
    };
    attempt();
  });
  return threeLoading;
}

function showLoadFailure() {
  const local = LOCAL_THREE || "three.min.js";
  $("loading").innerHTML =
    '<div class="fail">' +
      '<h3>The 3D library could not be downloaded</h3>' +
      '<p>Everything else on this page is working \u2014 the gallery itself needs a file called ' +
        '<code>three.min.js</code>, and this network appears to be blocking it. This is common on ' +
        'school and workplace laptops that filter outside websites.</p>' +
      '<p><b>To fix it permanently:</b> download <code>three.min.js</code> (version r128), put it in the same ' +
        'folder as this page, and set <code>LOCAL_THREE = "' + local + '"</code> in <code>js/config.js</code>. ' +
        'The museum will then run with no outside connection at all.</p>' +
      '<div class="actions">' +
        '<button class="btn btn-primary" id="retry-three" type="button">Try again</button>' +
        '<button class="btn btn-quiet" id="back-three" type="button">Back</button>' +
      '</div>' +
    '</div>';
  $("retry-three").addEventListener("click", () => { threeLoading = null; enterMuseum(); });
  $("back-three").addEventListener("click", exitMuseum);
}
