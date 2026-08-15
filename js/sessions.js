/* ============================================================
   STORAGE ADAPTER
   One session = one JSON file named CODE.json, holding the
   artwork, the wall labels and the room configuration.
   ============================================================ */
function xhrSend(method, url, headers, body, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url, true);
    Object.keys(headers).forEach(k => x.setRequestHeader(k, headers[k]));
    if (x.upload && onProgress) {
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    }
    x.onload = () => (x.status >= 200 && x.status < 300)
      ? resolve(x.responseText)
      : reject(new Error("http-" + x.status));
    x.onerror = () => reject(new Error("network"));
    x.ontimeout = () => reject(new Error("network"));
    x.send(body);
  });
}

async function fetchText(url, onProgress) {
  let res;
  try { res = await fetch(url, { cache: "no-store" }); }
  catch (e) { throw new Error("network"); }
  if (res.status === 404 || res.status === 400) throw new Error("not-found");
  if (!res.ok) throw new Error("http-" + res.status);
  const total = +(res.headers.get("content-length") || 0);
  if (!res.body || !res.body.getReader || !total) return res.text();
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(r.value); got += r.value.length;
    if (onProgress) onProgress(Math.min(1, got / total));
  }
  const buf = new Uint8Array(got); let o = 0;
  chunks.forEach(c => { buf.set(c, o); o += c.length; });
  return new TextDecoder("utf-8").decode(buf);
}

const Sessions = {
  mode() {
    if (SHARING.endpoint) return "endpoint";
    if (SHARING.supabaseUrl && SHARING.supabaseKey) return "supabase";
    return "folder";
  },
  modeLabel() {
    return { endpoint: "your own server", supabase: "Supabase", folder: "this website's repo" }[this.mode()];
  },
  /* folder mode publishes by download + commit rather than over the network */
  publishesOverNetwork() { return this.mode() !== "folder"; },

  readUrl(code) {
    const m = this.mode();
    if (m === "endpoint") return SHARING.endpoint.replace(/\/+$/, "") + "/session/" + code;
    if (m === "supabase") {
      return SHARING.supabaseUrl.replace(/\/+$/, "") +
        "/storage/v1/object/public/" + SHARING.bucket + "/" + code + ".json";
    }
    return SHARING.folder.replace(/^\/+|\/+$/g, "") + "/" + code + ".json";
  },

  async load(code, onProgress) {
    const text = await fetchText(this.readUrl(code) + "?t=" + Date.now(), onProgress);
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error("not-found"); }      // a 404 page, not a session
    if (!data || data.format !== "student-art-museum" || !Array.isArray(data.art)) {
      throw new Error("not-found");
    }
    return data;
  },

  /* true / false / null when we could not tell */
  async exists(code) {
    try { await this.load(code); return true; }
    catch (e) { return e.message === "not-found" ? false : null; }
  },

  async publish(code, payload, onProgress) {
    const body = JSON.stringify(payload);
    const m = this.mode();
    if (m === "supabase") {
      const url = SHARING.supabaseUrl.replace(/\/+$/, "") +
        "/storage/v1/object/" + SHARING.bucket + "/" + code + ".json";
      return xhrSend("POST", url, {
        "apikey": SHARING.supabaseKey,
        "Authorization": "Bearer " + SHARING.supabaseKey,
        "Content-Type": "application/json",
        "x-upsert": "true",
        "cache-control": "3600"
      }, body, onProgress);
    }
    if (m === "endpoint") {
      return xhrSend("PUT", SHARING.endpoint.replace(/\/+$/, "") + "/session/" + code,
        { "Content-Type": "application/json" }, body, onProgress);
    }
    throw new Error("no-backend");
  }
};

async function freshCode() {
  for (let i = 0; i < 6; i++) {
    const code = makeCode();
    const taken = await Sessions.exists(code);
    if (taken !== true) return code;      // free, or we could not check
  }
  return makeCode();
}
