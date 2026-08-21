/* ============================================================
   PPTX -> PICTURES

   A .pptx is a zip of XML, and a browser cannot show one. There
   is also nowhere to send it: this has to keep working from a
   GitHub Pages URL, or from a file:// page with no server at all.

   So the deck is opened here, in the page, and every slide is
   drawn onto a canvas: background, shapes, pictures, tables and
   text, in the order PowerPoint stacked them. What comes out is
   an ordinary image per slide, which the museum can hang on a
   wall like anything else.

   What is read: slide size, backgrounds, solid and gradient
   fills, outlines, rectangles, rounded rectangles, ellipses and
   lines, pictures, groups, tables, and text with its font, size,
   weight, colour, alignment and bullets - including the parts
   inherited from the layout and the master.

   What is not: animations, transitions, embedded media, and
   charts and SmartArt, which PowerPoint stores as instructions
   rather than as anything drawable. A slide built only from a
   chart comes out as its background. That is the honest limit of
   doing this without a server, and it is called out on screen
   rather than left to be discovered.
   ============================================================ */

const PPTX_MAX_SLIDES = 120;
const PPTX_W = 1600;                 // rendered width; height follows the deck
const EMU_IN = 914400;

function pptxSupported() {
  return typeof DecompressionStream === "function" && typeof DOMParser === "function";
}

/* ---------- zip ---------- */
/* Only the two storage methods a .pptx actually uses: stored, and deflate.
   The central directory is read rather than the local headers, because only
   it is guaranteed to carry the compressed size. */
async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function unzip(buffer) {
  const dv = new DataView(buffer), u8 = new Uint8Array(buffer);
  let end = -1;
  for (let i = dv.byteLength - 22; i >= 0 && i > dv.byteLength - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("not a zip");
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);

  const files = {};
  const jobs = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    /* the local header repeats the name and extra field, at its own lengths */
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = u8.subarray(start, start + csize);
    if (method === 0) files[name] = raw.slice();
    else jobs.push(inflateRaw(raw).then(out => { files[name] = out; }));
  }
  await Promise.all(jobs);
  return files;
}

/* ---------- small helpers ---------- */
const pptxText = b => new TextDecoder().decode(b);
function pptxXml(files, path) {
  const b = files[path];
  if (!b) return null;
  const doc = new DOMParser().parseFromString(pptxText(b), "application/xml");
  return doc.querySelector("parsererror") ? null : doc;
}
/* Namespace prefixes vary between producers, so everything is matched on the
   local name. getElementsByTagNameNS with a wildcard is the only lookup that
   is reliable across Keynote, Google Slides and PowerPoint itself. */
function kids(el, name) {
  const out = [];
  if (!el) return out;
  for (let i = 0; i < el.children.length; i++) {
    if (el.children[i].localName === name) out.push(el.children[i]);
  }
  return out;
}
function kid(el, name) { return kids(el, name)[0] || null; }
function deep(el, name) {
  if (!el) return null;
  const all = el.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) if (all[i].localName === name) return all[i];
  return null;
}
function attr(el, name, dflt) {
  if (!el) return dflt;
  const v = el.getAttribute(name);
  return v === null ? dflt : v;
}
function num(el, name, dflt) {
  const v = attr(el, name, null);
  return v === null ? dflt : parseFloat(v);
}
function relTarget(relsDoc, id) {
  if (!relsDoc || !id) return null;
  const all = relsDoc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === "Relationship" && all[i].getAttribute("Id") === id) {
      return all[i].getAttribute("Target");
    }
  }
  return null;
}
function relsFor(files, path) {
  const i = path.lastIndexOf("/");
  return pptxXml(files, path.slice(0, i) + "/_rels" + path.slice(i) + ".rels");
}
/* "../media/image1.png" from "ppt/slides/slide1.xml" -> "ppt/media/image1.png" */
function resolvePath(base, target) {
  if (!target) return null;
  if (target.charAt(0) === "/") return target.slice(1);
  const parts = base.split("/"); parts.pop();
  target.split("/").forEach(seg => {
    if (seg === "." || seg === "") return;
    if (seg === "..") parts.pop(); else parts.push(seg);
  });
  return parts.join("/");
}

/* ---------- colour ---------- */
const PPTX_SCHEME = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3",
                     "accent4", "accent5", "accent6", "hlink", "folHlink"];

function themeColours(themeDoc) {
  const map = {};
  const scheme = themeDoc ? deep(themeDoc.documentElement, "clrScheme") : null;
  if (!scheme) return map;
  PPTX_SCHEME.forEach(name => {
    const node = kid(scheme, name);
    if (!node) return;
    const srgb = kid(node, "srgbClr");
    if (srgb) { map[name] = attr(srgb, "val", "000000"); return; }
    const sys = kid(node, "sysClr");
    if (sys) map[name] = attr(sys, "lastClr", "000000");
  });
  /* bg1/tx1 are the mapped names; the map itself lives on the master */
  return map;
}

function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : Math.round(v)); }
function hexToRgb(h) {
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToCss(rgb, alpha) {
  return "rgba(" + clamp255(rgb[0]) + "," + clamp255(rgb[1]) + "," + clamp255(rgb[2]) + "," +
         (alpha === undefined ? 1 : alpha) + ")";
}

/* One colour node, with the modifiers PowerPoint applies on top of it. */
function readColour(node, ctx) {
  if (!node) return null;
  let hex = null, alpha = 1;
  const srgb = kid(node, "srgbClr");
  const sch = kid(node, "schemeClr");
  const sys = kid(node, "sysClr");
  const prst = kid(node, "prstClr");
  let holder = null;
  if (srgb) { hex = attr(srgb, "val", "000000"); holder = srgb; }
  else if (sch) {
    let name = attr(sch, "val", "tx1");
    if (ctx.clrMap && ctx.clrMap[name]) name = ctx.clrMap[name];
    if (name === "phClr" && ctx.phClr) hex = ctx.phClr;
    else hex = ctx.theme[name] || ctx.theme[{ tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }[name]] || "000000";
    holder = sch;
  } else if (sys) { hex = attr(sys, "lastClr", "000000"); holder = sys; }
  else if (prst) { hex = "808080"; holder = prst; }
  if (hex === null) return null;

  let rgb = hexToRgb(hex);
  if (holder) {
    const a = kid(holder, "alpha");
    if (a) alpha = num(a, "val", 100000) / 100000;
    const shade = kid(holder, "shade");
    if (shade) { const k = num(shade, "val", 100000) / 100000; rgb = rgb.map(c => c * k); }
    const tint = kid(holder, "tint");
    if (tint) { const k = num(tint, "val", 100000) / 100000; rgb = rgb.map(c => c * k + 255 * (1 - k)); }
    const lumMod = kid(holder, "lumMod");
    if (lumMod) { const k = num(lumMod, "val", 100000) / 100000; rgb = rgb.map(c => c * k); }
    const lumOff = kid(holder, "lumOff");
    if (lumOff) { const k = num(lumOff, "val", 0) / 100000; rgb = rgb.map(c => c + 255 * k); }
    const satMod = kid(holder, "satMod");
    if (satMod) {
      const k = num(satMod, "val", 100000) / 100000;
      const g = (rgb[0] + rgb[1] + rgb[2]) / 3;
      rgb = rgb.map(c => g + (c - g) * k);
    }
  }
  return { css: rgbToCss(rgb, alpha), rgb: rgb, alpha: alpha };
}

/* fill on any spPr / bgPr: solid, or the first stop of a gradient */
function readFill(pr, ctx) {
  if (!pr) return null;
  if (kid(pr, "noFill")) return null;
  const solid = kid(pr, "solidFill");
  if (solid) return readColour(solid, ctx);
  const grad = kid(pr, "gradFill");
  if (grad) {
    const list = kid(grad, "gsLst");
    const stops = kids(list, "gs").map(g => ({ pos: num(g, "pos", 0), c: readColour(g, ctx) }))
      .filter(s => s.c);
    if (stops.length) {
      stops.sort((a, b) => a.pos - b.pos);
      return { css: stops[0].c.css, gradient: stops, alpha: stops[0].alpha };
    }
  }
  return null;
}

/* ============================================================
   READING A DECK
   ============================================================ */
async function readPptx(file, onProgress) {
  if (!pptxSupported()) throw new Error("unsupported");
  const files = await unzip(await file.arrayBuffer());

  const pres = pptxXml(files, "ppt/presentation.xml");
  if (!pres) throw new Error("not a presentation");
  const sz = deep(pres.documentElement, "sldSz");
  const cx = num(sz, "cx", 9144000), cy = num(sz, "cy", 6858000);

  const presRels = pptxXml(files, "ppt/_rels/presentation.xml.rels");
  const idList = deep(pres.documentElement, "sldIdLst");
  const order = [];
  kids(idList, "sldId").forEach(s => {
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
             || s.getAttribute("r:id");
    const t = relTarget(presRels, rid);
    if (t) order.push(resolvePath("ppt/presentation.xml", t));
  });
  if (!order.length) throw new Error("no slides");

  const W = PPTX_W, H = Math.round(PPTX_W * cy / cx);
  const slides = [];
  let charts = 0;

  for (let i = 0; i < order.length && i < PPTX_MAX_SLIDES; i++) {
    const r = await renderSlide(files, order[i], cx, cy, W, H);
    slides.push(r.url);
    charts += r.charts;
    if (onProgress) onProgress(i + 1, Math.min(order.length, PPTX_MAX_SLIDES));
  }
  return {
    name: file.name.replace(/\.pptx$/i, ""),
    w: W, h: H, slides: slides,
    skipped: Math.max(0, order.length - slides.length),
    charts: charts
  };
}

/* One slide, drawn master first, then layout, then the slide itself - the
   order PowerPoint composites them in. */
async function renderSlide(files, path, cx, cy, W, H) {
  const doc = pptxXml(files, path);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
  if (!doc) return { url: c.toDataURL("image/jpeg", 0.9), charts: 0 };

  const rels = relsFor(files, path);
  const layoutPath = resolvePath(path, findRelByType(rels, "slideLayout"));
  const layoutDoc = layoutPath ? pptxXml(files, layoutPath) : null;
  const layoutRels = layoutPath ? relsFor(files, layoutPath) : null;
  const masterPath = layoutPath ? resolvePath(layoutPath, findRelByType(layoutRels, "slideMaster")) : null;
  const masterDoc = masterPath ? pptxXml(files, masterPath) : null;
  const masterRels = masterPath ? relsFor(files, masterPath) : null;
  const themePath = masterPath ? resolvePath(masterPath, findRelByType(masterRels, "theme")) : null;
  const themeDoc = themePath ? pptxXml(files, themePath) : null;

  /* the master's colour map: which scheme slot bg1 and tx1 actually mean */
  const clrMap = {};
  const cm = masterDoc ? deep(masterDoc.documentElement, "clrMap") : null;
  if (cm) ["bg1", "tx1", "bg2", "tx2"].forEach(k => {
    const v = attr(cm, k, null); if (v) clrMap[k] = v;
  });

  const ctx = {
    x: x, W: W, H: H, cx: cx, cy: cy,
    sx: W / cx, sy: H / cy,
    ptScale: W / (cx / EMU_IN * 72),          // points -> device pixels
    theme: themeColours(themeDoc),
    clrMap: clrMap,
    files: files,
    charts: 0
  };

  /* background: the slide's own, or the layout's, or the master's */
  const bg = kid(doc.documentElement, "cSld") ? kid(kid(doc.documentElement, "cSld"), "bg") : null;
  const lbg = layoutDoc ? deep(layoutDoc.documentElement, "bg") : null;
  const mbg = masterDoc ? deep(masterDoc.documentElement, "bg") : null;
  paintBackground(ctx, bg || lbg || mbg);

  /* the master's own furniture, then the layout's, then the slide's. Only
     non-placeholder shapes are taken from the master and layout: an empty
     "Click to add title" box must not be drawn under the real one. */
  const styles = readTextStyles(masterDoc, ctx);
  if (masterDoc) await paintTree(ctx, deep(masterDoc.documentElement, "spTree"), masterRels, masterPath, styles, true);
  if (layoutDoc) await paintTree(ctx, deep(layoutDoc.documentElement, "spTree"), layoutRels, layoutPath, styles, true);
  await paintTree(ctx, deep(doc.documentElement, "spTree"), rels, path, styles, false,
                  placeholderMap(layoutDoc, masterDoc));

  return { url: c.toDataURL("image/jpeg", 0.9), charts: ctx.charts };
}

function findRelByType(relsDoc, kind) {
  if (!relsDoc) return null;
  const all = relsDoc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const t = all[i].getAttribute && all[i].getAttribute("Type");
    if (t && t.indexOf("/" + kind) !== -1) return all[i].getAttribute("Target");
  }
  return null;
}

/* Where the layout says each placeholder sits, so a slide shape that only
   says "I am the title" still lands in the right place. */
function placeholderMap(layoutDoc, masterDoc) {
  const map = {};
  [masterDoc, layoutDoc].forEach(d => {
    if (!d) return;
    const tree = deep(d.documentElement, "spTree");
    if (!tree) return;
    kids(tree, "sp").forEach(sp => {
      const ph = deep(sp, "ph");
      if (!ph) return;
      const type = attr(ph, "type", "body");
      const idx = attr(ph, "idx", "");
      const xf = deep(kid(sp, "spPr"), "xfrm");
      if (!xf) return;
      const rec = { xfrm: xf, type: type };
      map["t:" + type] = rec;
      if (idx !== "") map["i:" + idx] = rec;
    });
  });
  return map;
}

/* Default text sizes and colours, per outline level, from the master. */
function readTextStyles(masterDoc, ctx) {
  const out = { title: [], body: [], other: [] };
  if (!masterDoc) return out;
  const ts = deep(masterDoc.documentElement, "txStyles");
  if (!ts) return out;
  [["titleStyle", "title"], ["bodyStyle", "body"], ["otherStyle", "other"]].forEach(pair => {
    const node = kid(ts, pair[0]);
    if (!node) return;
    for (let lvl = 1; lvl <= 9; lvl++) {
      const p = kid(node, "lvl" + lvl + "pPr");
      if (!p) continue;
      const d = kid(p, "defRPr");
      out[pair[1]][lvl - 1] = {
        sz: d ? num(d, "sz", null) : null,
        b: d ? attr(d, "b", null) === "1" : null,
        i: d ? attr(d, "i", null) === "1" : null,
        colour: d ? readColour(kid(d, "solidFill"), ctx) : null,
        font: d && kid(d, "latin") ? attr(kid(d, "latin"), "typeface", null) : null,
        algn: attr(p, "algn", null),
        marL: num(p, "marL", null),
        indent: num(p, "indent", null),
        /* Bullets almost always live on the master rather than on the
           paragraph, so a deck read without this comes out as flat lines. */
        bullet: !!(kid(p, "buChar") || kid(p, "buAutoNum")),
        buChar: kid(p, "buChar") ? attr(kid(p, "buChar"), "char", "\u2022") : null
      };
    }
  });
  return out;
}

function paintBackground(ctx, bg) {
  if (!bg) return;
  const pr = kid(bg, "bgPr");
  const ref = kid(bg, "bgRef");
  let fill = pr ? readFill(pr, ctx) : null;
  if (!fill && ref) fill = readColour(ref, ctx);
  if (!fill) return;
  paintRectFill(ctx, fill, 0, 0, ctx.W, ctx.H);
}

function paintRectFill(ctx, fill, x0, y0, w, h) {
  const x = ctx.x;
  if (fill.gradient && fill.gradient.length > 1) {
    const g = x.createLinearGradient(x0, y0, x0, y0 + h);
    fill.gradient.forEach(s => {
      const p = Math.max(0, Math.min(1, s.pos / 100000));
      g.addColorStop(p, s.c.css);
    });
    x.fillStyle = g;
  } else {
    x.fillStyle = fill.css;
  }
  x.fillRect(x0, y0, w, h);
}

/* ---------- the shape tree ---------- */
async function paintTree(ctx, tree, rels, basePath, styles, skipPlaceholders, phMap, offset) {
  if (!tree) return;
  for (let i = 0; i < tree.children.length; i++) {
    const el = tree.children[i];
    const n = el.localName;
    if (n === "sp") await paintShape(ctx, el, styles, skipPlaceholders, phMap, offset);
    else if (n === "pic") await paintPicture(ctx, el, rels, basePath, offset);
    else if (n === "grpSp") await paintGroup(ctx, el, rels, basePath, styles, skipPlaceholders, phMap, offset);
    else if (n === "graphicFrame") await paintFrame(ctx, el, styles, offset);
  }
}

/* A group re-bases its children: the child coordinate space is mapped onto
   the box the group occupies. */
async function paintGroup(ctx, el, rels, basePath, styles, skipPlaceholders, phMap, offset) {
  const xf = deep(kid(el, "grpSpPr"), "xfrm");
  const off = kid(xf, "off"), ext = kid(xf, "ext");
  const chOff = kid(xf, "chOff"), chExt = kid(xf, "chExt");
  let next = offset;
  if (off && ext && chOff && chExt) {
    const kx = num(chExt, "cx", 1) ? num(ext, "cx", 1) / num(chExt, "cx", 1) : 1;
    const ky = num(chExt, "cy", 1) ? num(ext, "cy", 1) / num(chExt, "cy", 1) : 1;
    const base = offset || { ox: 0, oy: 0, kx: 1, ky: 1 };
    next = {
      ox: base.ox + (num(off, "x", 0) - num(chOff, "x", 0) * kx) * base.kx,
      oy: base.oy + (num(off, "y", 0) - num(chOff, "y", 0) * ky) * base.ky,
      kx: base.kx * kx, ky: base.ky * ky
    };
  }
  await paintTree(ctx, kid(el, "spTree") || el, rels, basePath, styles, skipPlaceholders, phMap, next);
}

/* off/ext in EMU, through any group transform, into device pixels */
function boxOf(ctx, xf, offset) {
  const off = kid(xf, "off"), ext = kid(xf, "ext");
  if (!off || !ext) return null;
  const o = offset || { ox: 0, oy: 0, kx: 1, ky: 1 };
  const ex = num(off, "x", 0) * o.kx + o.ox;
  const ey = num(off, "y", 0) * o.ky + o.oy;
  const ew = num(ext, "cx", 0) * o.kx;
  const eh = num(ext, "cy", 0) * o.ky;
  return {
    x: ex * ctx.sx, y: ey * ctx.sy, w: ew * ctx.sx, h: eh * ctx.sy,
    rot: num(xf, "rot", 0) / 60000 * Math.PI / 180,
    flipH: attr(xf, "flipH", "0") === "1",
    flipV: attr(xf, "flipV", "0") === "1"
  };
}

function withBox(ctx, b, draw) {
  const x = ctx.x;
  if (!b.rot && !b.flipH && !b.flipV) { draw(b.x, b.y, b.w, b.h); return; }
  x.save();
  x.translate(b.x + b.w / 2, b.y + b.h / 2);
  if (b.rot) x.rotate(b.rot);
  if (b.flipH || b.flipV) x.scale(b.flipH ? -1 : 1, b.flipV ? -1 : 1);
  draw(-b.w / 2, -b.h / 2, b.w, b.h);
  x.restore();
}

async function paintShape(ctx, sp, styles, skipPlaceholders, phMap, offset) {
  const ph = deep(sp, "ph");
  const body = kid(sp, "txBody");
  const hasText = body && (body.textContent || "").trim().length > 0;
  /* An empty placeholder on the master or layout is a prompt, not content */
  if (skipPlaceholders && ph && !hasText) return;

  const spPr = kid(sp, "spPr");
  let xf = deep(spPr, "xfrm");
  if (!xf && ph && phMap) {
    const idx = attr(ph, "idx", "");
    const type = attr(ph, "type", "body");
    const rec = (idx !== "" && phMap["i:" + idx]) || phMap["t:" + type] ||
                (type === "ctrTitle" ? phMap["t:title"] : null) ||
                (type === "subTitle" ? phMap["t:body"] : null);
    if (rec) xf = rec.xfrm;
  }
  if (!xf) return;
  const b = boxOf(ctx, xf, offset);
  if (!b || b.w <= 0 || b.h <= 0) return;

  const fill = readFill(spPr, ctx);
  const geom = kid(spPr, "prstGeom");
  const prst = attr(geom, "prst", "rect");
  const ln = kid(spPr, "ln");
  const stroke = ln ? readFill(ln, ctx) : null;
  const lw = ln ? Math.max(1, num(ln, "w", 9525) * ctx.sx) : 0;

  if (fill || stroke) {
    withBox(ctx, b, (x0, y0, w, h) => {
      const x = ctx.x;
      x.beginPath();
      if (prst === "ellipse") {
        x.ellipse(x0 + w / 2, y0 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 6.2832);
      } else if (prst === "roundRect") {
        const r = Math.min(Math.abs(w), Math.abs(h)) * 0.16;
        x.moveTo(x0 + r, y0);
        x.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
        x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
        x.arcTo(x0, y0 + h, x0, y0, r);
        x.arcTo(x0, y0, x0 + w, y0, r);
        x.closePath();
      } else if (prst === "line" || prst === "straightConnector1") {
        x.moveTo(x0, y0); x.lineTo(x0 + w, y0 + h);
      } else if (prst === "triangle") {
        x.moveTo(x0 + w / 2, y0); x.lineTo(x0 + w, y0 + h); x.lineTo(x0, y0 + h); x.closePath();
      } else {
        x.rect(x0, y0, w, h);
      }
      if (fill && prst !== "line" && prst !== "straightConnector1") {
        if (fill.gradient && fill.gradient.length > 1) {
          const g = x.createLinearGradient(x0, y0, x0, y0 + h);
          fill.gradient.forEach(s => g.addColorStop(Math.max(0, Math.min(1, s.pos / 100000)), s.c.css));
          x.fillStyle = g;
        } else x.fillStyle = fill.css;
        x.fill();
      }
      if (stroke) { x.strokeStyle = stroke.css; x.lineWidth = lw; x.stroke(); }
    });
  }

  if (hasText) {
    const kind = ph ? (/title/i.test(attr(ph, "type", "")) ? "title" : "body") : "other";
    withBox(ctx, b, (x0, y0, w, h) => drawTextBody(ctx, body, x0, y0, w, h, styles, kind));
  }
}

async function paintPicture(ctx, pic, rels, basePath, offset) {
  const blip = deep(pic, "blip");
  if (!blip) return;
  const rid = blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed")
           || blip.getAttribute("r:embed");
  const target = relTarget(rels, rid);
  const path = resolvePath(basePath, target);
  const bytes = path ? ctx.files[path] : null;
  if (!bytes) return;
  const xf = deep(kid(pic, "spPr"), "xfrm");
  const b = boxOf(ctx, xf, offset);
  if (!b || b.w <= 0 || b.h <= 0) return;

  const type = /\.png$/i.test(path) ? "image/png"
            : /\.gif$/i.test(path) ? "image/gif"
            : /\.svg$/i.test(path) ? "image/svg+xml"
            : /\.bmp$/i.test(path) ? "image/bmp" : "image/jpeg";
  const url = URL.createObjectURL(new Blob([bytes], { type: type }));
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    withBox(ctx, b, (x0, y0, w, h) => ctx.x.drawImage(img, x0, y0, w, h));
  } catch (err) {
    /* an unsupported format - EMF and WMF mostly - simply does not appear */
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Tables come through; charts and SmartArt are only instructions, so they
   are counted and reported rather than faked. */
async function paintFrame(ctx, gf, styles, offset) {
  const xf = deep(gf, "xfrm");
  const b = boxOf(ctx, xf, offset);
  if (!b) return;
  const tbl = deep(gf, "tbl");
  if (!tbl) {
    if (deep(gf, "chart") || deep(gf, "graphicData")) ctx.charts++;
    return;
  }
  const grid = kid(tbl, "tblGrid");
  const cols = kids(grid, "gridCol").map(g => num(g, "w", 0));
  const total = cols.reduce((a, v) => a + v, 0) || 1;
  const rows = kids(tbl, "tr");
  const x = ctx.x;
  let y = b.y;
  rows.forEach(tr => {
    const rh = num(tr, "h", 0) * ctx.sy;
    let cx0 = b.x;
    kids(tr, "tc").forEach((tc, ci) => {
      const cw = (cols[ci] || 0) / total * b.w;
      const fill = readFill(kid(tc, "tcPr"), ctx);
      if (fill) { x.fillStyle = fill.css; x.fillRect(cx0, y, cw, rh); }
      x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = 1;
      x.strokeRect(cx0, y, cw, rh);
      const body = kid(tc, "txBody");
      if (body) drawTextBody(ctx, body, cx0 + 6, y + 3, cw - 12, rh - 6, styles, "other");
      cx0 += cw;
    });
    y += rh;
  });
}

/* ---------- text ---------- */
function pptxFont(name) {
  if (!name || /^\+/.test(name)) return 'Helvetica, Arial, sans-serif';
  return '"' + name.replace(/"/g, "") + '", Helvetica, Arial, sans-serif';
}

function drawTextBody(ctx, body, bx, by, bw, bh, styles, kind) {
  const x = ctx.x;
  const bodyPr = kid(body, "bodyPr");
  const anchor = attr(bodyPr, "anchor", "t");
  const insL = num(bodyPr, "lIns", 91440) * ctx.sx;
  const insR = num(bodyPr, "rIns", 91440) * ctx.sx;
  const insT = num(bodyPr, "tIns", 45720) * ctx.sy;
  const insB = num(bodyPr, "tIns", 45720) * ctx.sy;
  const left = bx + insL, width = Math.max(8, bw - insL - insR);
  const lstDef = kid(body, "lstStyle");

  const lines = [];
  kids(body, "p").forEach(p => {
    const pPr = kid(p, "pPr");
    const lvl = parseInt(attr(pPr, "lvl", "0"), 10) || 0;
    const dflt = (styles[kind] && styles[kind][lvl]) || (styles.other && styles.other[lvl]) || {};
    const lvlDef = lstDef ? kid(lstDef, "lvl" + (lvl + 1) + "pPr") : null;
    const lvlRPr = lvlDef ? kid(lvlDef, "defRPr") : null;

    const algn = attr(pPr, "algn", null) || attr(lvlDef, "algn", null) || dflt.algn || "l";
    const marL = (num(pPr, "marL", null) !== null ? num(pPr, "marL", 0)
                 : (dflt.marL !== null && dflt.marL !== undefined ? dflt.marL : lvl * 342900)) * ctx.sx;
    const noBullet = !!kid(pPr, "buNone") || !!(lvlDef && kid(lvlDef, "buNone"));
    const ownBullet = kid(pPr, "buChar") || kid(pPr, "buAutoNum") ||
                      (lvlDef && (kid(lvlDef, "buChar") || kid(lvlDef, "buAutoNum")));
    const bullet = !noBullet && !!(ownBullet || dflt.bullet);
    const buChar = (kid(pPr, "buChar") && attr(kid(pPr, "buChar"), "char", null)) ||
                   (lvlDef && kid(lvlDef, "buChar") && attr(kid(lvlDef, "buChar"), "char", null)) ||
                   dflt.buChar || "\u2022";
    const spc = kid(pPr, "lnSpc");
    const spcPct = spc && kid(spc, "spcPct") ? num(kid(spc, "spcPct"), "val", 100000) / 100000 : 1;
    const before = kid(pPr, "spcBef") && kid(kid(pPr, "spcBef"), "spcPts")
      ? num(kid(kid(pPr, "spcBef"), "spcPts"), "val", 0) / 100 * ctx.ptScale : 0;

    const runs = [];
    for (let i = 0; i < p.children.length; i++) {
      const r = p.children[i];
      if (r.localName === "br") { runs.push({ br: true }); continue; }
      if (r.localName !== "r") continue;
      const rPr = kid(r, "rPr");
      const szPt = (num(rPr, "sz", null) || (lvlRPr && num(lvlRPr, "sz", null)) || dflt.sz ||
                    (kind === "title" ? 4400 : 1800)) / 100;
      const latin = kid(rPr, "latin");
      runs.push({
        text: (kid(r, "t") ? kid(r, "t").textContent : "") || "",
        size: szPt * ctx.ptScale,
        bold: attr(rPr, "b", null) === "1" || (attr(rPr, "b", null) === null && !!dflt.b),
        ital: attr(rPr, "i", null) === "1" || (attr(rPr, "i", null) === null && !!dflt.i),
        font: pptxFont(latin ? attr(latin, "typeface", null) : dflt.font),
        colour: (readColour(kid(rPr, "solidFill"), ctx) ||
                 (lvlRPr ? readColour(kid(lvlRPr, "solidFill"), ctx) : null) ||
                 dflt.colour || { css: "#1A1A1A" }).css,
        under: attr(rPr, "u", "none") !== "none"
      });
    }
    if (!runs.length) { lines.push({ blank: true, height: (dflt.sz || 1800) / 100 * ctx.ptScale * 0.6 }); return; }

    /* wrap, keeping each run's own font */
    const indent = marL;
    const avail = Math.max(12, width - indent);
    let cur = [], curW = 0, first = true;
    const flush = () => {
      lines.push({ runs: cur, algn: algn, indent: indent, spc: spcPct,
                   bullet: first && bullet, buChar: buChar, before: first ? before : 0 });
      first = false; cur = []; curW = 0;
    };
    runs.forEach(run => {
      if (run.br) { flush(); return; }
      const words = run.text.split(/(\s+)/);
      words.forEach(w => {
        if (!w) return;
        x.font = (run.ital ? "italic " : "") + (run.bold ? "700 " : "400 ") +
                 run.size.toFixed(1) + "px " + run.font;
        const ww = x.measureText(w).width;
        if (curW + ww > avail && curW > 0 && /\S/.test(w)) flush();
        cur.push({ w: w, run: run, width: ww });
        curW += ww;
      });
    });
    if (cur.length) flush();
  });

  /* height, then the vertical anchor */
  let total = 0;
  lines.forEach(l => {
    l.height = l.blank ? l.height
      : Math.max.apply(null, l.runs.map(r => r.run.size)) * 1.22 * (l.spc || 1);
    total += l.height + (l.before || 0);
  });
  let y = by + insT;
  if (anchor === "ctr") y = by + (bh - total) / 2;
  else if (anchor === "b") y = by + bh - insB - total;
  if (y < by) y = by;

  x.textBaseline = "alphabetic";
  lines.forEach(l => {
    y += l.before || 0;
    if (l.blank) { y += l.height; return; }
    const lineW = l.runs.reduce((a, r) => a + r.width, 0);
    let cx0 = left + l.indent;
    if (l.algn === "ctr") cx0 = left + l.indent + (width - l.indent - lineW) / 2;
    else if (l.algn === "r") cx0 = left + width - lineW;
    const base = y + l.height * 0.78;
    if (l.bullet) {
      const r0 = l.runs[0].run;
      x.fillStyle = r0.colour;
      x.font = "400 " + (r0.size * 0.95).toFixed(1) + "px " + r0.font;
      x.textAlign = "left";
      x.fillText(l.buChar || "\u2022", Math.max(left, cx0 - r0.size * 0.72), base);
    }
    l.runs.forEach(r => {
      x.font = (r.run.ital ? "italic " : "") + (r.run.bold ? "700 " : "400 ") +
               r.run.size.toFixed(1) + "px " + r.run.font;
      x.fillStyle = r.run.colour;
      x.fillText(r.w, cx0, base);
      if (r.run.under) {
        x.fillRect(cx0, base + r.run.size * 0.12, r.width, Math.max(1, r.run.size * 0.055));
      }
      cx0 += r.width;
    });
    y += l.height;
  });
}
