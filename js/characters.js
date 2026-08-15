/* ============================================================
   CHARACTERS
   Chunky voxel people: a large head with sculpted hair, a jacket
   or hoodie over a visible tee, cuffed trousers and thick soled
   trainers. Built from shared boxes so a roomful of them stays
   cheap to draw.
   ============================================================ */
/* every figure reuses the same geometry and materials */
const GeoBox = {}, FigMat = {};
function bx(w, h, d) {
  const k = w.toFixed(3) + "|" + h.toFixed(3) + "|" + d.toFixed(3);
  if (!GeoBox[k]) { GeoBox[k] = new THREE.BoxGeometry(w, h, d); KeepGeo.add(GeoBox[k]); }
  return GeoBox[k];
}
function fm(color, rough) {
  const r = rough === undefined ? 0.66 : rough;
  const k = color + "|" + r;
  if (!FigMat[k]) {
    FigMat[k] = new THREE.MeshStandardMaterial({ color: color, roughness: r, metalness: 0.02 });
    KeepMat.add(FigMat[k]);
  }
  return FigMat[k];
}
function piece(parent, w, h, d, mat, x, y, z, shadows) {
  const m = new THREE.Mesh(bx(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadows) { m.castShadow = true; }
  parent.add(m);
  return m;
}

/* body proportions, in metres, measured off the reference sheet */
const B = {
  shoe: 0.11, leg: 0.62, hip: 0.14, tor: 0.46, neck: 0.05, head: 0.30,
  torW: 0.46, torD: 0.26, hipW: 0.40, hipD: 0.24,
  legW: 0.175, legD: 0.20, legX: 0.101,
  headW: 0.32, headD: 0.28, armW: 0.13, armD: 0.16, armX: 0.293
};
B.legTop = B.shoe + B.leg;                 // 0.73 - hip joint, and the body origin
B.torC = B.hip + B.tor / 2;                // within the body group
B.torTop = B.hip + B.tor;
B.shoulder = B.torTop - 0.05;
B.headY = B.torTop + B.neck;

/* ---------- faces ---------- */
const faceCache = {};
function faceTexture(variant) {
  if (faceCache[variant]) return faceCache[variant];
  const W = 256, H = 224, c = cvs(W, H), x = c.getContext("2d");
  const cx = W / 2, eyeY = 104, eyeDX = 44;
  x.clearRect(0, 0, W, H);

  x.fillStyle = "#241B15";
  if (variant === 3) {                                   // closed, content
    x.lineWidth = 9; x.strokeStyle = "#241B15"; x.lineCap = "round";
    [-1, 1].forEach(s => {
      x.beginPath(); x.arc(cx + s * eyeDX, eyeY + 4, 15, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
    });
  } else {
    [-1, 1].forEach(s => {
      x.beginPath();
      x.ellipse(cx + s * eyeDX, eyeY, 12, 15, 0, 0, 6.3);
      x.fill();
    });
    x.fillStyle = "rgba(255,255,255,.9)";
    [-1, 1].forEach(s => { x.beginPath(); x.arc(cx + s * eyeDX - 4, eyeY - 5, 3.6, 0, 6.3); x.fill(); });
  }

  /* brows */
  x.strokeStyle = "rgba(58,42,30,.75)"; x.lineWidth = 7; x.lineCap = "round";
  [-1, 1].forEach(s => {
    x.beginPath();
    x.moveTo(cx + s * eyeDX - 15, eyeY - 30 + (variant === 2 ? 3 : 0));
    x.lineTo(cx + s * eyeDX + 15, eyeY - 33);
    x.stroke();
  });

  /* mouth */
  x.strokeStyle = "#3A2A1E"; x.lineWidth = 7.5;
  x.beginPath();
  if (variant === 2) x.arc(cx, 140, 20, 0.28, Math.PI - 0.28);          // small smile
  else if (variant === 1) x.arc(cx, 134, 27, 0.34, Math.PI - 0.34);     // wider smile
  else { x.moveTo(cx - 15, 156); x.lineTo(cx + 15, 156); }              // neutral
  x.stroke();

  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = maxAniso;
  faceCache[variant] = t;
  KeepTex.add(t);
  return t;
}
const faceMats = {};
function faceMaterial(variant) {
  if (!faceMats[variant]) {
    faceMats[variant] = new THREE.MeshStandardMaterial({
      map: faceTexture(variant), transparent: true, roughness: 0.7, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    KeepMat.add(faceMats[variant]);
  }
  return faceMats[variant];
}

/* ---------- the figure ---------- */
function makeFigure(o) {
  o = o || {};
  const skin = fm(o.skin || 0xF0C6A0, 0.62);
  const top = fm(o.top || 0xD8CBB0);
  const topDark = fm(o.topDark || o.top || 0xD8CBB0, 0.72);
  const bottom = fm(o.bottom || 0x4A4E33);
  const shoe = fm(o.shoe || 0xF0EAD9, 0.55);
  const sole = fm(o.sole || 0xFFFFFF, 0.45);
  const hair = fm(o.hair || 0x2E2119, 0.78);
  const shirt = fm(o.shirt || 0xF6F2E8);
  const kit = fm(o.kit || 0x2C3036, 0.6);       // bags and straps
  const sh = o.shadows !== false;

  const g = new THREE.Group();
  const parts = { legs: [], arms: [], head: null, body: null };
  const topStyle = o.topStyle || "jacket";
  const bottomStyle = o.bottomStyle || "trousers";

  /* --- legs, each swinging from the hip --- */
  [-1, 1].forEach(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * B.legX, B.legTop, 0);
    const legLen = bottomStyle === "shorts" ? B.leg * 0.42 : B.leg;
    const bare = B.leg - legLen;

    if (bottomStyle !== "skirt") {
      piece(pivot, B.legW, legLen, B.legD, bottom, 0, -legLen / 2, 0, sh);
      if (bare > 0.01) piece(pivot, B.legW * 0.92, bare, B.legD * 0.92, skin, 0, -legLen - bare / 2, 0, sh);
      else piece(pivot, B.legW * 1.03, 0.07, B.legD * 1.03, topDark, 0, -B.leg + 0.09, 0, false);  // rolled cuff
    } else {
      piece(pivot, B.legW * 0.9, B.leg * 0.5, B.legD * 0.9, fm(o.tights || 0x2B2E33), 0, -B.leg + B.leg * 0.25, 0, sh);
    }
    /* thick soled trainer */
    piece(pivot, 0.205, 0.065, 0.30, shoe, 0, -B.leg - 0.035, 0.045, sh);
    piece(pivot, 0.215, 0.045, 0.31, sole, 0, -B.leg - 0.088, 0.045, false);
    g.add(pivot);
    parts.legs.push({ pivot: pivot, sign: side });
  });

  /* --- everything above the hips, so it can lean and twist --- */
  const body = new THREE.Group();
  body.position.y = B.legTop;
  g.add(body);
  parts.body = body;

  if (bottomStyle === "skirt") {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.36, 0.46, 8), bottom);
    sk.position.y = B.hip / 2 - 0.14; sk.castShadow = sh; body.add(sk);
  } else {
    piece(body, B.hipW, B.hip, B.hipD, bottom, 0, B.hip / 2, 0, sh);
  }

  /* torso, with the tee showing at the neckline */
  piece(body, B.torW, B.tor, B.torD, top, 0, B.torC, 0, sh);
  piece(body, 0.15, 0.17, 0.04, shirt, 0, B.torTop - 0.10, B.torD / 2 - 0.005, false);
  if (topStyle === "jacket") {
    [-1, 1].forEach(s => {
      const lap = piece(body, 0.10, 0.20, 0.035, topDark, s * 0.10, B.torTop - 0.10, B.torD / 2 + 0.004, false);
      lap.rotation.z = s * 0.30;
    });
    piece(body, 0.03, 0.03, 0.02, fm(0xBFAF8E), 0, B.torC - 0.02, B.torD / 2 + 0.005, false);   // button
  } else if (topStyle === "hoodie") {
    piece(body, 0.34, 0.14, 0.15, topDark, 0, B.torTop - 0.02, -B.torD / 2 - 0.03, sh);         // hood
    piece(body, 0.26, 0.11, 0.03, topDark, 0, B.torC - 0.13, B.torD / 2 + 0.004, false);        // pocket
  }

  /* arms swinging from the shoulder */
  [-1, 1].forEach(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * B.armX, B.shoulder, 0);
    const sleeve = topStyle === "tee" ? 0.17 : 0.40;
    piece(pivot, B.armW, sleeve, B.armD, top, 0, -sleeve / 2, 0, sh);
    if (sleeve < 0.40) piece(pivot, B.armW * 0.86, 0.40 - sleeve, B.armD * 0.86, skin, 0, -sleeve - (0.40 - sleeve) / 2, 0, sh);
    piece(pivot, 0.125, 0.115, 0.15, skin, 0, -0.455, 0.005, sh);
    body.add(pivot);
    parts.arms.push({ pivot: pivot, sign: side });
  });

  /* --- head --- */
  const head = new THREE.Group();
  head.position.y = B.headY;
  body.add(head);
  parts.head = head;

  piece(head, 0.13, B.neck + 0.03, 0.13, skin, 0, -0.02, 0, false);
  piece(head, B.headW, B.head, B.headD, skin, 0, B.head / 2, 0, sh);
  /* Kept below the fringe and 12 mm proud of the skull, with a polygon
     offset as well, so the decal can never trade places with the surface
     underneath as the camera moves. */
  const face = new THREE.Mesh(new THREE.PlaneGeometry(B.headW * 0.94, 0.20), faceMaterial(o.face || 0));
  face.position.set(0, B.head * 0.44, B.headD / 2 + 0.012);
  face.renderOrder = 1;
  head.add(face);

  /* hair, built from a few chunky slabs */
  const hs = o.hairStyle || "short";
  const hatted = o.hat === "cap" || o.hat === "bucket";
  if (hs !== "bald") {
    /* Under a hat the crown and side tabs are hidden anyway, and they shared
       their outline with the hat shell exactly, so they are left off. */
    if (!hatted) {
      piece(head, B.headW + 0.05, 0.13, B.headD + 0.05, hair, 0, B.head + 0.045, -0.005, sh);    // crown
      [-1, 1].forEach(s => piece(head, 0.045, 0.12, B.headD * 0.8, hair, s * (B.headW / 2 + 0.012), B.head - 0.05, -0.01, false));
    }
    piece(head, B.headW + 0.04, 0.15, 0.07, hair, 0, B.head - 0.06, -B.headD / 2 - 0.012, sh);   // back
    piece(head, B.headW * 0.92, 0.075, 0.05, hair, 0, B.head - 0.035, B.headD / 2 - 0.020, false); // fringe
    if (hs === "bob" || hs === "long") {
      const drop = hs === "long" ? 0.34 : 0.20;
      piece(head, B.headW + 0.05, drop, 0.09, hair, 0, B.head - 0.09 - drop / 2, -B.headD / 2 - 0.005, sh);
      [-1, 1].forEach(s => piece(head, 0.06, drop * 0.8, B.headD * 0.55, hair,
        s * (B.headW / 2 + 0.015), B.head - 0.09 - drop * 0.4, -0.03, false));
    } else if (hs === "buns") {
      [-1, 1].forEach(s => {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hair);
        bun.position.set(s * 0.15, B.head + 0.10, -0.05); bun.castShadow = sh; head.add(bun);
      });
    } else if (hs === "ponytail") {
      piece(head, 0.11, 0.30, 0.11, hair, 0, B.head - 0.10, -B.headD / 2 - 0.07, sh);
    }
  }

  /* hats */
  if (o.hat === "cap") {
    const capMat = fm(o.hatColor || 0x2F5480);
    piece(head, B.headW + 0.075, 0.13, B.headD + 0.07, capMat, 0, B.head + 0.035, -0.008, sh);
    piece(head, B.headW - 0.03, 0.04, 0.18, capMat, 0, B.head + 0.005, B.headD / 2 + 0.085, false);
  } else if (o.hat === "bucket") {
    const hatMat = fm(o.hatColor || 0xEFE6D2);
    piece(head, B.headW + 0.075, 0.16, B.headD + 0.07, hatMat, 0, B.head + 0.05, -0.008, sh);
    piece(head, B.headW + 0.23, 0.04, B.headD + 0.23, hatMat, 0, B.head - 0.015, -0.008, sh);
  }
  if (o.glasses) {
    const gm = fm(0x2A2622, 0.4);
    [-1, 1].forEach(s => piece(head, 0.095, 0.075, 0.02, gm, s * 0.055, B.head * 0.60, B.headD / 2 + 0.032, false));
    piece(head, 0.03, 0.018, 0.02, gm, 0, B.head * 0.60, B.headD / 2 + 0.032, false);
  }

  /* bags and other carried things */
  if (o.bag === "crossbody") {
    const strap = piece(body, 0.045, 0.52, 0.028, kit, 0.02, B.torC + 0.06, B.torD / 2 + 0.006, false);
    strap.rotation.z = 0.52;
    const strapB = piece(body, 0.045, 0.52, 0.028, kit, -0.02, B.torC + 0.06, -B.torD / 2 - 0.006, false);
    strapB.rotation.z = -0.52;
    piece(body, 0.17, 0.15, 0.075, kit, -0.24, B.torC - 0.20, 0.02, sh);
  } else if (o.bag === "tote") {
    const tm = fm(o.bagColor || 0xE6DCC6, 0.8);
    piece(body, 0.055, 0.42, 0.03, tm, 0.24, B.torC + 0.05, 0.01, false);
    piece(body, 0.24, 0.28, 0.10, tm, 0.30, B.torC - 0.22, 0.01, sh);
  } else if (o.bag === "backpack") {
    const pm = fm(o.bagColor || 0x2F4A6B, 0.75);
    piece(body, 0.30, 0.36, 0.14, pm, 0, B.torC + 0.03, -B.torD / 2 - 0.08, sh);
    [-1, 1].forEach(s => piece(body, 0.05, 0.34, 0.03, pm, s * 0.13, B.torC + 0.05, B.torD / 2 + 0.005, false));
  }
  if (o.headphones) {
    const hm = fm(0x33383E, 0.5);
    [-1, 1].forEach(s => piece(head, 0.06, 0.10, 0.09, hm, s * 0.168, 0.02, -0.02, false));
    piece(head, B.headW + 0.055, 0.05, 0.08, hm, 0, 0.055, -B.headD / 2 - 0.025, false);
  }
  if (o.holding === "cup") {
    piece(parts.arms[1].pivot, 0.075, 0.10, 0.075, fm(0xE8DFCC, 0.8), 0, -0.53, 0.02, false);
    piece(parts.arms[1].pivot, 0.08, 0.02, 0.08, fm(0x6B4A32, 0.7), 0, -0.475, 0.02, false);
  } else if (o.holding === "phone") {
    piece(parts.arms[1].pivot, 0.055, 0.10, 0.015, fm(0x22252A, 0.35), 0.01, -0.50, 0.09, false);
  }

  /* contact shadow so figures sit on the floor rather than float */
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), MAT.blob);
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.018; blob.renderOrder = 2;
  g.add(blob);

  return { group: g, parts: parts };
}

/* Reference walk: contact, down, passing, up, twice per cycle. The body
   rides highest as the legs pass and dips at each contact. */
function poseFigure(parts, phase, amount, t, seed) {
  const sw = Math.sin(phase) * 0.60 * amount;
  parts.legs[0].pivot.rotation.x = sw;
  parts.legs[1].pivot.rotation.x = -sw;
  parts.arms[0].pivot.rotation.x = -sw * 0.78;
  parts.arms[1].pivot.rotation.x = sw * 0.78;
  parts.arms[0].pivot.rotation.z = 0.04;
  parts.arms[1].pivot.rotation.z = -0.04;
  parts.body.rotation.y = Math.sin(phase) * 0.07 * amount;
  parts.body.rotation.x = 0.045 * amount;
  parts.head.rotation.y = (seed === undefined ? 0 : Math.sin(t * 0.26 + seed) * 0.30) - Math.sin(phase) * 0.05 * amount;
  parts.head.rotation.z = Math.sin(phase * 2) * 0.02 * amount;
  return (1 - Math.abs(Math.sin(phase))) * 0.035 * amount;
}

/* ---------- the visitor you play ---------- */
function buildAvatar() {
  const f = makeFigure({
    skin: 0xF0C6A0, hair: 0x2E2119, hairStyle: "short",
    top: 0xD8CBB0, topDark: 0xC9BB9C, shirt: 0xF6F2E8,
    bottom: 0x4A4E33, shoe: 0xF0EAD9, sole: 0xFFFFFF,
    topStyle: "jacket", bottomStyle: "trousers", bag: "crossbody", face: 1
  });
  avatarParts = f.parts;
  f.group.visible = false;
  scene.add(f.group);
  return f.group;
}
