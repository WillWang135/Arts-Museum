# Setting up the Student Art Museum

Two things to do: put the site on the web, then choose where shared museums are stored.

---

## 1. Put the site on GitHub Pages

1. Create a repository on github.com — call it something like `art-museum`.
2. Upload `student-art-museum.html` **and the `css` and `js` folders beside it**, then rename the HTML file to **`index.html`** so it loads automatically. Keep the folders next to it — the page loads them by relative path.
3. Go to **Settings › Pages**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`, and save.
4. After a minute your site is live at `https://YOUR-NAME.github.io/art-museum/`.

> Uploading through the GitHub website: use **Add file › Upload files** and drag the whole folder in — it keeps the `css/` and `js/` structure.

The finished repository looks like this:

```
index.html          the page itself - markup only
css/                five stylesheets, loaded in order
js/                 the app, split by job
  config.js         <- the only file you edit
  ...
```

That URL is what you give students. It works as-is — you can upload artwork and walk the galleries straight away. Join codes need one more step.

---

## 2. Choose where shared museums live

A session is a single JSON file named after its join code (`ABC234.json`) holding every artwork, wall label and room setting. Students fetch that file and their browser rebuilds the same museum.

Open **`js/config.js`** and find the `SHARING` block at the top. That is the only file you need to edit. Pick **one** option.

### Option A — Supabase (recommended)

Free, codes work instantly, nothing to commit.

1. Create a project at [supabase.com](https://supabase.com).
2. **Storage › New bucket** — name it `museums` and tick **Public bucket**.
3. Open the **SQL editor** and run:

   ```sql
   create policy "museum uploads" on storage.objects
     for insert to anon with check (bucket_id = 'museums');

   create policy "museum updates" on storage.objects
     for update to anon using (bucket_id = 'museums');
   ```

4. **Settings › API** — copy the **Project URL** and the **anon** key into `SHARING`:

   ```js
   supabaseUrl: "https://abcdefghijkl.supabase.co",
   supabaseKey: "eyJhbGciOi...",
   bucket: "museums",
   ```

5. Commit the change. Done — **Share museum** now issues codes on the spot.

The free tier gives 1 GB of storage, enough for roughly 200 class museums.

### Option B — Your own endpoint

For anyone who wants full control. Any service answering these two routes works:

| Route | Does |
|---|---|
| `GET /session/CODE` | returns the session JSON, or 404 |
| `PUT /session/CODE` | stores the JSON body |

A complete Cloudflare Worker (free tier, 100k requests/day). Create a Worker, bind a KV namespace called `SESSIONS`, and paste:

```js
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const code = new URL(req.url).pathname.split("/").pop().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return new Response("bad code", { status: 400, headers: cors });

    if (req.method === "PUT") {
      const body = await req.text();
      if (body.length > 20_000_000) return new Response("too large", { status: 413, headers: cors });
      await env.SESSIONS.put(code, body, { expirationTtl: 60 * 60 * 24 * 120 });
      return new Response("ok", { headers: cors });
    }

    const found = await env.SESSIONS.get(code);
    return found
      ? new Response(found, { headers: { ...cors, "Content-Type": "application/json" } })
      : new Response("not found", { status: 404, headers: cors });
  }
};
```

Then set `endpoint: "https://your-worker.workers.dev"` in `SHARING`.

Sessions expire after 120 days here; change `expirationTtl` to suit.

### Option C — This repository (no accounts)

Used automatically when A and B are blank. Student artwork never leaves your own GitHub account, which some schools require.

1. Create a folder called `sessions` in your repository.
2. Build your museum, click **Share museum › Create join code** — a `CODE.json` file downloads.
3. Upload that file into `sessions/` and commit.
4. Wait about a minute for Pages to rebuild, then hand out the code.

The trade-off is one commit per session, and about a minute before a new code works.

---

## Running a session with your class

1. Open your site, add the artwork, fill in the wall labels.
2. **Share museum** → name the exhibition → **Create join code**.
3. Give the class the six-character code, or project the join link.
4. Students open the site, type the code, and they're in. They walk the galleries independently — everyone sees the same artworks, the same room layout and the stickers you awarded.

Changed something? **Share museum › Update with my latest changes** republishes to the same code, so nobody needs a new one.

---

## Things worth knowing

**Codes are a classroom password, not a lock.** Anyone with the link and the code can view that museum. Don't publish work that shouldn't be seen outside school.

**Where the artwork ends up.** Options A and B store images on a third-party service — check that against your school's policy on student work. Option C keeps everything inside your own GitHub repository.

**Deleting a session.** Remove its `CODE.json` — from the Supabase bucket, from KV, or from the `sessions/` folder. The code stops working immediately.

**Student stickers are personal.** Anyone who joins can award stickers while exploring, but those stay on their own device. Only stickers you place before publishing are shared with the class.

**Session size.** The share panel shows it before you publish. Around 25 artworks lands near 3 MB, which loads in a few seconds on school wi-fi. If it warns that a session is large, removing a few pieces is the quickest fix.

**No internet at all?** The museum still runs offline apart from joining — but the 3D library loads from a CDN on first visit, so the site needs a connection at least once per browser. See "blocked networks" below to remove even that.

---

## If something isn't working

### The mouse won't turn the camera

Click the gallery and the browser normally hands the mouse over to the page. Some setups refuse: managed work laptops, pages running inside an embedded preview, and a brief cool-down right after pressing Esc.

You don't need to fix anything — **hold the left mouse button and drag** to look around. That works everywhere. **Q** and **E** turn left and right from the keyboard alone. A message points this out the first time the browser refuses.

### "THREE is not defined" in the console

The gallery needs `three.min.js`, which downloads from a public CDN. School and workplace filters often block those. The page now tries three different mirrors and shows a plain-English message with a **Try again** button if all are blocked.

**To remove the dependency entirely** — worth doing on a filtered network:

1. Download `three.min.js` for version r128 (from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` on any machine that can reach it).
2. Put it in the same folder as `index.html` — next to the page, **not** inside `js/` — and commit both.
3. In `js/config.js`, find `const LOCAL_THREE = "";` and set it to `"three.min.js"`.

The museum then runs with no outside connection at all.

### Opening the file by double-clicking it

Fine for a quick look, but joining is limited — there's no web address, so join links can't be generated (codes still work if you're using Supabase or your own endpoint). Repo-folder sessions need the site to be on GitHub Pages. For anything you'll do with a class, use the Pages URL.

Keep the `css` and `js` folders next to the HTML file when you move or copy it — on its own the page will open blank. If you email it to someone, send a zip of the whole folder.

---

## For anyone editing the code

The app is plain HTML, CSS and JavaScript with no build step: edit a file, refresh the browser. Nothing to install.

`student-art-museum.html` holds only the markup and the list of files to load. The `<script>` tags are deliberately ordinary ones rather than ES modules, because modules refuse to run from a `file://` page and this has to keep working when it is simply double-clicked. They share one scope, so **the order in the HTML matters** — each file may only rely on the ones listed above it.

| Where | What |
|---|---|
| `js/config.js` | sharing settings and the 3D library path — the only file most people touch |
| `js/state.js`, `codes.js`, `sessions.js` | the artwork list, join codes, reading and writing session files |
| `js/geometry.js`, `floorplan.js` | the room shape, shared by the 2D floorplan and the 3D build |
| `js/upload.js`, `join.js`, `publish.js` | the setup screen |
| `js/runtime.js` | the variables the 3D files share, declared in one place |
| `js/textures.js` … `js/renderer.js` | the museum: surfaces, architecture, artwork, people, camera, loop |
| `js/input.js`, `hud.js`, `main.js` | controls, the on-screen chips, and moving between the two screens |
