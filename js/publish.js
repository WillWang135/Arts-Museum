/* ============================================================
   PUBLISHING A SESSION
   ============================================================ */
function sessionPayload(code) {
  return {
    format: "student-art-museum", version: 2,
    code: code,
    title: museumTitle(),
    saved: new Date().toISOString(),
    art: State.art,
    stickers: State.stickers
  };
}
function payloadSize(code) {
  try { return new Blob([JSON.stringify(sessionPayload(code || "AAA222"))]).size; }
  catch (e) { return 0; }
}
function niceBytes(n) {
  if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
  if (n > 1024) return Math.round(n / 1024) + " KB";
  return n + " bytes";
}
function joinLink(code) {
  const origin = location.origin;
  if (!origin || origin === "null" || location.protocol === "about:") {
    return "(publish this page to a web address, then add ?code=" + code + ")";
  }
  return origin + location.pathname + "?code=" + code;
}
function joinLinkUsable(code) { return joinLink(code).indexOf("http") === 0; }
function downloadBlob(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const shareRoot = () => $("share-root");
function closeShare() { shareRoot().innerHTML = ""; }

function shareShell(inner) {
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.innerHTML = '<div class="share" style="position:relative">' +
    '<button class="chip close" type="button" data-close>Close</button>' + inner + '</div>';
  veil.addEventListener("click", e => {
    if (e.target === veil || e.target.hasAttribute("data-close")) closeShare();
  });
  shareRoot().innerHTML = "";
  shareRoot().appendChild(veil);
  return veil;
}

function copyField(veil) {
  const btn = veil.querySelector("[data-copy]");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const input = veil.querySelector(".copyrow input");
    input.select();
    const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy link", 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, () => { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });
}

function openShare() {
  const size = payloadSize(State.session.code);
  const mode = Sessions.mode();
  const n = State.art.length;
  const heavy = size > 9 * 1048576;

  const facts =
    '<div class="factline"><span>Artworks in this museum</span><b>' + n + '</b></div>' +
    '<div class="factline"><span>Session size</span><b>' + niceBytes(size) + (heavy ? " \u2014 large" : "") + '</b></div>' +
    '<div class="factline"><span>Sessions are stored in</span><b>' + Sessions.modeLabel() + '</b></div>';

  const titleField =
    '<label for="share-title">Name this exhibition</label>' +
    '<input id="share-title" class="titlefield" maxlength="70" placeholder="Year 8 Design Showcase">';

  if (State.session.code) {
    showPublished(State.session.code, true);
    return;
  }

  let action, lead;
  if (mode === "folder") {
    lead = "Sharing runs from this website\u2019s own repository, so student work never leaves your GitHub account. " +
           "You will download one small file and commit it \u2014 after that, the code works on any device.";
    action = '<button class="btn btn-primary" id="do-publish" type="button">Create join code</button>';
  } else {
    lead = "Publish this museum and hand the code to your class. Anyone with the website link and the code " +
           "can walk the same galleries from their own device.";
    action = '<button class="btn btn-primary" id="do-publish" type="button">Create join code</button>';
  }

  const veil = shareShell(
    '<h2>Share this museum</h2>' +
    '<p class="lead">' + lead + '</p>' +
    titleField +
    '<div style="margin-top:18px">' + facts + '</div>' +
    (heavy ? '<p class="lead" style="margin:16px 0 0;color:var(--rose)">This session is large. It will still work, but students on slow wi\u2011fi may wait a while. Removing a few pieces will speed it up.</p>' : '') +
    '<div class="meterbar" id="share-meter"><i></i></div>' +
    '<div class="actions">' + action +
      '<button class="btn btn-quiet" id="how-btn" type="button">How sharing works</button>' +
    '</div>'
  );
  veil.querySelector("#share-title").value = (State.session.title || "").trim();
  veil.querySelector("#how-btn").addEventListener("click", openSetupHelp);
  veil.querySelector("#do-publish").addEventListener("click", () => {
    State.session.title = veil.querySelector("#share-title").value.trim();
    $("museum-title").value = State.session.title;
    paintPlan();
    publishSession(false);
  });
}

function setMeter(p) {
  const bar = document.querySelector("#share-meter i");
  if (bar) bar.style.width = Math.round(Math.max(0.02, p) * 100) + "%";
}

async function publishSession(update) {
  const btn = document.querySelector("#do-publish") || document.querySelector("#do-update");
  if (btn) { btn.disabled = true; btn.textContent = "Publishing\u2026"; }
  try {
    const code = update && State.session.code ? State.session.code : await freshCode();
    const payload = sessionPayload(code);

    if (!Sessions.publishesOverNetwork()) {
      downloadBlob(code + ".json", JSON.stringify(payload));
      State.session.code = code;
      State.session.published = payload.saved;
      refreshDock();
      showFolderSteps(code);
      return;
    }

    await Sessions.publish(code, payload, setMeter);
    setMeter(1);
    State.session.code = code;
    State.session.published = payload.saved;
    refreshDock();
    showPublished(code, false);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Try again"; }
    const lead = document.querySelector(".share .lead");
    if (lead) {
      lead.style.color = "var(--rose)";
      lead.textContent = err.message === "http-400" || err.message === "http-403" || err.message === "http-401"
        ? "The storage service refused the upload. Check the bucket name and that uploads are allowed \u2014 see \u201cHow sharing works\u201d."
        : "Could not reach the storage service. Check your internet connection, then try again.";
    }
  }
}

function showPublished(code, existing) {
  const link = joinLink(code);
  const when = State.session.published
    ? new Date(State.session.published).toLocaleString()
    : "not published yet";
  const veil = shareShell(
    '<h2>' + (existing ? "This museum is shared" : "Your museum is live") + '</h2>' +
    '<p class="lead">Give your class the code below, or send them the link \u2014 it opens the museum straight away.</p>' +
    '<div class="bigcode">' + prettyCode(code) + '</div>' +
    (joinLinkUsable(code)
      ? '<div class="copyrow"><input readonly value="' + link + '"><button class="btn" type="button" data-copy>Copy link</button></div>'
      : '<p class="joinnote" style="text-align:left;margin-top:12px">Students join by typing the code above. Once this page is on a web address, a one-click join link appears here too.</p>') +
    '<div style="margin-top:20px">' +
      '<div class="factline"><span>Artworks shared</span><b>' + State.art.length + '</b></div>' +
      '<div class="factline"><span>Last published</span><b>' + when + '</b></div>' +
    '</div>' +
    '<div class="meterbar" id="share-meter"><i></i></div>' +
    '<div class="actions">' +
      '<button class="btn btn-primary" id="do-update" type="button">' +
        (Sessions.publishesOverNetwork() ? "Update with my latest changes" : "Download updated file") + '</button>' +
      '<button class="btn btn-quiet" id="new-code" type="button">New code</button>' +
      '<button class="btn btn-quiet" id="how-btn" type="button">How sharing works</button>' +
    '</div>'
  );
  copyField(veil);
  veil.querySelector("#how-btn").addEventListener("click", openSetupHelp);
  veil.querySelector("#do-update").addEventListener("click", () => publishSession(true));
  veil.querySelector("#new-code").addEventListener("click", () => {
    State.session.code = null; State.session.published = null;
    refreshDock(); openShare();
  });
}

function showFolderSteps(code) {
  const veil = shareShell(
    '<h2>One commit and the code is live</h2>' +
    '<p class="lead"><b>' + code + '.json</b> has been saved to your downloads. Add it to your GitHub Pages repository ' +
    'and the code works on every device.</p>' +
    '<div class="bigcode">' + prettyCode(code) + '</div>' +
    '<div class="setup" style="margin-top:20px"><ol>' +
      '<li>Open your repository on github.com.</li>' +
      '<li>Go into the <code>' + SHARING.folder + '</code> folder, or create it with <b>Add file \u203a Create new file</b> and type <code>' + SHARING.folder + '/README.md</code>.</li>' +
      '<li>Choose <b>Add file \u203a Upload files</b>, drop in <code>' + code + '.json</code>, and commit.</li>' +
      '<li>Wait about a minute for GitHub Pages to rebuild, then hand out the code.</li>' +
    '</ol>' +
    '<p>Want codes to work instantly without committing? Connect a free Supabase project \u2014 see \u201cHow sharing works\u201d.</p></div>' +
    (joinLinkUsable(code)
      ? '<div class="copyrow"><input readonly value="' + joinLink(code) + '"><button class="btn" type="button" data-copy>Copy link</button></div>'
      : '') +
    '<div class="actions">' +
      '<button class="btn" id="do-update" type="button">Download again</button>' +
      '<button class="btn btn-quiet" id="how-btn" type="button">How sharing works</button>' +
    '</div>'
  );
  copyField(veil);
  veil.querySelector("#how-btn").addEventListener("click", openSetupHelp);
  veil.querySelector("#do-update").addEventListener("click", () => publishSession(true));
}

function openSetupHelp() {
  const active = Sessions.mode();
  const badge = m => m === active ? ' <b style="color:var(--viridian)">\u2014 in use</b>' : "";
  const veil = shareShell(
    '<h2>How sharing works</h2>' +
    '<p class="lead">A session is one JSON file named after its join code, holding every artwork, wall label and room setting. ' +
    'Students fetch that file and their browser rebuilds the same museum. Pick whichever home suits your school.</p>' +
    '<div class="setup">' +
      '<p><b>A \u00b7 Supabase' + badge("supabase") + '</b><br>Free, instant codes, nothing to commit.</p><ol>' +
        '<li>Create a project at <code>supabase.com</code>.</li>' +
        '<li>Storage \u203a New bucket, name it <code>museums</code>, tick <b>Public bucket</b>.</li>' +
        '<li>Run this in the SQL editor so the site may upload:<br>' +
          '<code>create policy "museum uploads" on storage.objects for insert to anon with check (bucket_id = \'museums\');</code><br>' +
          '<code>create policy "museum updates" on storage.objects for update to anon using (bucket_id = \'museums\');</code></li>' +
        '<li>Settings \u203a API: copy the <b>Project URL</b> and the <b>anon</b> key into the <code>SHARING</code> block in <code>js/config.js</code>.</li>' +
      '</ol>' +
      '<p><b>B \u00b7 Your own endpoint' + badge("endpoint") + '</b><br>Any service answering ' +
        '<code>GET /session/CODE</code> and <code>PUT /session/CODE</code> with JSON. Set <code>endpoint</code> in the ' +
        '<code>SHARING</code> block in <code>js/config.js</code>. A ready-made Cloudflare Worker is in SETUP.md.</p>' +
      '<p><b>C \u00b7 This repository' + badge("folder") + '</b><br>No accounts at all, and student work stays in your own ' +
        'GitHub repo. Leave A and B blank, then commit each <code>CODE.json</code> into the ' +
        '<code>' + SHARING.folder + '</code> folder.</p>' +
      '<p style="border-top:1px solid var(--hairline);padding-top:14px;margin-top:16px">' +
        '<b>Worth knowing.</b> Anyone with the code can view that museum, so treat codes like a classroom password rather ' +
        'than a lock. With options A and B the artwork is stored on a third\u2011party service \u2014 check that against your ' +
        'school\u2019s policy on student work, and use option C if everything must stay in\u2011house. Delete a session by ' +
        'removing its <code>CODE.json</code>.</p>' +
    '</div>' +
    '<div class="actions"><button class="btn btn-quiet" type="button" data-close>Back</button></div>'
  );
  return veil;
}

$("share-btn").addEventListener("click", openShare);

/* ---------- arriving with ?code=ABC234 ---------- */
(function autoJoin() {
  const q = new URLSearchParams(location.search);
  const code = normCode(q.get("code") || q.get("c") || location.hash.replace("#", ""));
  if (code.length !== 6) return;
  $("join-input").value = prettyCode(code);
  setJoinNote("Opening that museum\u2026", "");
  setTimeout(() => joinSession(code), 60);
})();
