/* ============================================================
   THE GALLERY ITSELF
   The featured wall, hanging a work, the lighting rig, and
   the assembly step that puts the whole museum together.
   ============================================================ */
/* ---------- the featured wall ---------- */
function buildFeatureWall(featured) {
  const panelW = 9, panelH = 5.2, panelT = 0.8;

  const plat = box(panelW + 2.2, 0.2, 4.6, MAT.stone, 0, 0.1, 0.6);
  plat.receiveShadow = true;
  [[panelW + 2.2, 0.02, 0, 2.88], [panelW + 2.2, 0.02, 0, -1.68],
   [0.02, 4.6, 5.58, 0.6], [0.02, 4.6, -5.58, 0.6]].forEach(s => {
    plain(s[0], 0.012, s[1], MAT.brass, s[2], 0.205, s[3]);
  });

  box(panelW, panelH, panelT, MAT.darkStone, 0, panelH / 2 + 0.2, 0);
  box(panelW + 0.5, 0.2, panelT + 0.34, MAT.brass, 0, panelH + 0.3, 0);
  plain(panelW + 0.12, 0.03, panelT + 0.06, MAT.brass, 0, 0.42, 0);

  /* back face: fluted bronze battens with brass accents, no lettering */
  const rods = quality === "high" ? 27 : 15;
  const zBack = -panelT / 2 - 0.045;
  for (let i = 0; i < rods; i++) {
    const rx = -panelW / 2 + 0.25 + ((i + 0.5) / rods) * (panelW - 0.5);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.3, 8),
      i % 5 === 2 ? MAT.brass : MAT.bronzeDark);
    m.position.set(rx, 2.65, zBack);
    m.castShadow = true; root.add(m);
  }
  [0.44, 4.86].forEach(y => plain(panelW - 0.3, 0.022, 0.055, MAT.brass, 0, y, zBack - 0.03));
  plain(panelW - 0.3, 0.012, 0.05, MAT.brass, 0, 2.65, zBack - 0.045);

  /* barrier: brass stanchions carrying a soft catenary rope */
  const posts = [-3.6, -1.2, 1.2, 3.6], zRope = 2.95, topY = 0.9;
  posts.forEach(px => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 26), MAT.brass);
    base.position.y = 0.025; base.castShadow = true; g.add(base);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), MAT.brass);
    foot.position.y = 0.07; foot.scale.set(1, 0.6, 1); g.add(foot);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, topY - 0.06, 16), MAT.brass);
    post.position.y = (topY - 0.06) / 2 + 0.07; post.castShadow = true; g.add(post);
    [0.3, 0.66].forEach(y => {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.011, 8, 20), MAT.brass);
      c.position.y = y; c.rotation.x = Math.PI / 2; g.add(c);
    });
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 22), MAT.brass);
    eye.position.y = topY; eye.rotation.y = Math.PI / 2; g.add(eye);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), MAT.brass);
    cap.position.y = topY + 0.09; cap.castShadow = true; g.add(cap);
    g.position.set(px, 0, zRope);
    root.add(g);
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const pts = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      pts.push(new THREE.Vector3(a + (b - a) * t, topY - Math.sin(t * Math.PI) * 0.15, zRope));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.027, 8, false), MAT.ropeMat);
    rope.castShadow = true; root.add(rope);
  }

  Nav.boxes.push({ x0: -6.0, z0: -1.9, x1: 6.0, z1: 3.5 });

  buildTitleRing(State.session.title);

  if (featured) hangArtwork(featured, new THREE.Vector3(0, 2.45, panelT / 2 + 0.02), new THREE.Vector3(0, 0, 1), 1.55, true);
}

/* ---------- hanging a work ---------- */
function hangArtwork(art, pos, normal, scale, isFeature) {
  scale = scale || 1;
  const ar = (art.aw || 1) / (art.ah || 1);
  const LONG = 1.75 * scale, MIN = 0.62 * scale;
  let W, H;
  if (ar >= 1) { W = LONG; H = LONG / ar; if (H < MIN) { H = MIN; W = MIN * ar; } }
  else { H = LONG; W = LONG * ar; if (W < MIN) { W = MIN; H = MIN / ar; } }
  W = Math.min(W, 2.7 * scale); H = Math.min(H, 2.5 * scale);

  const m = 0.13 * scale, fw = 0.08 * scale, fd = 0.09 * scale;
  const OW = W + 2 * m + 2 * fw, OH = H + 2 * m + 2 * fw;
  const g = new THREE.Group();

  const backing = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * m, H + 2 * m, 0.05), MAT.mat);
  backing.position.z = 0.025; backing.receiveShadow = true; g.add(backing);

  /* A video hangs as the clip itself - one decoded frame while paused, live
     while playing. Everything else, including the sleeve for a track, is an
     ordinary picture. A video given its own cover keeps both, and swaps
     between them the first time somebody presses play. */
  const stillTexture = () => {
    const t = new THREE.TextureLoader().load(art.src, () => { needsRender = true; });
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = maxAniso;
    return t;
  };
  let tex = null, coverTex = null, videoTex = null;
  if (artKind(art) === "video") {
    videoTex = videoTextureFor(art);
    if (hasCover(art) && videoTex) {
      coverTex = stillTexture();
      const e = MediaEls[art.id];
      tex = (e && e.started) ? videoTex : coverTex;
    } else {
      tex = videoTex;
    }
  }
  if (!tex) tex = stillTexture();
  const img = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.72, metalness: 0.0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
  img.position.z = 0.062; g.add(img);            // clear of the mount board at 0.05

  const bars = [
    [OW, fw, fd, 0, (H / 2 + m + fw / 2)],
    [OW, fw, fd, 0, -(H / 2 + m + fw / 2)],
    [fw, H + 2 * m, fd, -(W / 2 + m + fw / 2), 0],
    [fw, H + 2 * m, fd, (W / 2 + m + fw / 2), 0]
  ];
  bars.forEach(b => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), MAT.gold);
    bar.position.set(b[3], b[4], 0.045); bar.castShadow = true; g.add(bar);
  });

  const num = State.art.indexOf(art) + 1;
  const pw = 0.5 * Math.max(1, scale * 0.9), ph = pw * 0.28;
  const plaqueBack = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.015), MAT.mat);
  plaqueBack.position.set(0, -(OH / 2) - ph / 2 - 0.13, 0.012); g.add(plaqueBack);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({
      map: plaqueTexture(art, num),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
  plaque.position.set(0, -(OH / 2) - ph / 2 - 0.13, 0.030); g.add(plaque);   // backing ends at 0.0195

  const hit = new THREE.Mesh(new THREE.PlaneGeometry(OW + 1.15, OH + 1.0), MAT.hit);
  hit.position.z = 0.008; g.add(hit);

  g.position.copy(pos).addScaledVector(normal, 0.09);
  g.lookAt(pos.clone().add(normal));
  root.add(g);

  const rows = 4, gap = Math.min(0.42 * scale, OH / rows);
  const slots = [];
  [1, -1].forEach(side => {
    for (let i = 0; i < rows; i++) {
      slots.push({ x: side * (OW / 2 + 0.27 * scale), y: OH / 2 - gap / 2 - i * gap, z: 0.13, taken: null });
    }
  });

  const rec = { group: g, art, pos: g.position.clone(), normal: normal.clone(), slots, scale, isFeature, OW, OH };

  /* Play, and for video a sound toggle, sitting along the bottom of the
     work like the controls on a player. They are ordinary meshes, so the
     same reticle that reads a wall label operates them. */
  if (isPlayable(art)) {
    /* Small, and tucked into the bottom corner of a video the way a player
       puts them, so they sit lightly over the work rather than competing
       with it. A track has nothing to obscure - its sleeve is decoration -
       so its single button goes in the middle, where it reads as the
       obvious thing to press. */
    const size = Math.min(0.16 * scale, H * 0.20, W * 0.15);
    const wantsMute = artKind(art) === "video";
    const gap = size * 1.22;
    const xs = wantsMute
      ? [W / 2 - size * 0.68 - gap, W / 2 - size * 0.68]
      : [0];
    const y = wantsMute ? -H / 2 + size * 0.72 : 0;
    const mk = (name, x) => {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: mediaIconTexture(name), transparent: true, depthWrite: false,
          opacity: 0,                       // faded in on hover; see updateMediaControlFade
          polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
        }));
      b.position.set(x, y, 0.075);        // in front of the picture at 0.062
      b.renderOrder = 3;
      g.add(b);
      Pickables.push(b);
      return b;
    };
    rec.mediaSurface = img;
    rec.coverTex = coverTex;
    rec.videoTex = videoTex;
    rec.controls = {
      play: mk(mediaPlaying(art) ? "pause" : "play", xs[0]),
      mute: wantsMute ? mk(mediaMuted(art) ? "muted" : "unmuted", xs[1]) : null,
      opacity: 0
    };
    rec.controls.play.userData.control = "play";
    rec.controls.play.userData.frame = rec;
    if (rec.controls.mute) {
      rec.controls.mute.userData.control = "mute";
      rec.controls.mute.userData.frame = rec;
    }
  }

  g.userData.frame = rec;
  Frames.push(rec);
  Pickables.push(g);
  return rec;
}

/* ---------- lights ---------- */
function buildLights() {
  const hi = quality === "high";
  root.add(new THREE.HemisphereLight(0xFFF4E4, 0xBCA184, 0.62));

  dirLight = new THREE.DirectionalLight(0xFFEFD6, 0.52);
  dirLight.position.set(9, 26, 7);
  dirLight.castShadow = hi;
  dirLight.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  const sc = dirLight.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 4; sc.far = 60;
  dirLight.shadow.bias = -0.0006;
  root.add(dirLight); root.add(dirLight.target);

  featureSpots = [];
  [-2.9, 2.9].forEach(dx => {
    const s = new THREE.SpotLight(0xFFF3DE, 2.9, 24, 0.46, 0.62, 1.2);
    s.position.set(dx, 7.8, 6.0);
    s.target.position.set(dx * 0.28, 2.45, 0);
    root.add(s); root.add(s.target);
    featureSpots.push(s);
  });

  spotPool = [];
  const count = hi ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const s = new THREE.SpotLight(0xFFF0D6, 0, 14, 0.36, 0.7, 1.3);
    s.position.set(0, 6, 0);
    root.add(s); root.add(s.target);
    spotPool.push({ light: s, frame: null });
  }
}

/* ---------- assemble ---------- */

function disposeRoot() {
  if (!root) return;
  const shared = new Set(MAT ? Object.values(MAT) : []);
  const cached = new Set(Object.values(stickerCache).concat([glowTex, poolTex, blobTex, skyBase].filter(Boolean)));
  root.traverse(o => {
    if (o.isSprite) return;                    // sprite geometry is shared by three.js
    if (o.geometry && !KeepGeo.has(o.geometry)) o.geometry.dispose();
    if (!o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    list.forEach(mm => {
      if (shared.has(mm) || KeepMat.has(mm)) return;   // reused every build
      if (mm.map && !cached.has(mm.map) && !KeepTex.has(mm.map)) mm.map.dispose();
      mm.dispose();
    });
  });
  scene.remove(root);
  root = null;
}

function buildMuseum() {
  Frames.length = 0; Pickables.length = 0; StickerObjs.length = 0;
  Nav.zones.length = 0; Nav.boxes.length = 0; Nav.circles.length = 0;
  Anim.skies.length = 0; Anim.pools.length = 0; Anim.shafts.length = 0; Anim.ticker = null;
  disposeRoot();
  root = new THREE.Group();
  scene.add(root);

  const featured = State.art.find(a => a.featured) || State.art[0] || null;
  const wall = State.art.filter(a => a !== featured);
  const layout = computeLayout(Math.max(wall.length, 1));

  buildShell(layout.open);
  buildFeatureWall(featured);
  buildLights();

  wall.forEach((art, i) => {
    const s = layout.slots[i % layout.slots.length];
    hangArtwork(art, new THREE.Vector3(s.x, G.ART_Y, s.z), new THREE.Vector3(s.nx, 0, s.nz).normalize(), 1, false);
  });

  restoreStickers();
  buildVisitors();
  needsRender = true;
}
