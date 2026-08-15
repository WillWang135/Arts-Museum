/* ============================================================
   MESH HELPERS AND FURNITURE
   Plinths, vases, benches, planters and the drifting
   daylight patches on the floor.
   ============================================================ */
function box(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  return m;
}
function plain(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  root.add(m);
  return m;
}

/* slab on a rotunda segment: local +X follows the wall, +Z faces outward */
function segSlab(segIndex, w, h, d, radius, y, mat, offsetAlong, flat) {
  const step = Math.PI * 2 / G.SEG, a = segIndex * step;
  const along = { x: -Math.sin(a), z: Math.cos(a) };
  const cx = Math.cos(a) * radius + along.x * (offsetAlong || 0);
  const cz = Math.sin(a) * radius + along.z * (offsetAlong || 0);
  return (flat ? plain : box)(w, h, d, mat, cx, y, cz, Math.PI / 2 - a);
}

function makePlinth(x, z, h, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 26), mat || MAT.stone);
  m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.14, 0.05, 26), MAT.brass);
  cap.position.set(x, h + 0.025, z); cap.castShadow = true; root.add(cap);
  Nav.circles.push({ x, z, r: r * 1.25 + 0.35 });
  return h + 0.05;
}

function makeVase(x, z, top, mat) {
  const prof = [[0.02, 0], [0.30, 0], [0.31, 0.05], [0.21, 0.15], [0.30, 0.32],
                [0.42, 0.54], [0.41, 0.76], [0.27, 0.94], [0.19, 1.03], [0.235, 1.10], [0.215, 1.15]];
  const pts = prof.map(p => new THREE.Vector2(p[0], p[1]));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), mat);
  m.position.set(x, top, z); m.castShadow = true; m.receiveShadow = true;
  root.add(m);
}

function makeSculpture(x, z, top) {
  const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.36, 0.115, 128, 20), MAT.bronze);
  m.position.set(x, top + 0.5, z);
  m.rotation.set(0.5, 0.8, 0.2);
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
}

function makeBench(x, z, ry) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.13, 0.62), MAT.wood);
  seat.position.y = 0.46; seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
  [-0.8, 0.8].forEach(dx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.46), MAT.bronzeDark);
    leg.position.set(dx, 0.22, 0); leg.castShadow = true; g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.52), MAT.brass);
    foot.position.set(dx, 0.015, 0); g.add(foot);
  });
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  root.add(g);
  const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0));
  const hw = 1.05 * c + 0.35 * s, hd = 1.05 * s + 0.35 * c;
  Nav.boxes.push({ x0: x - hw - 0.3, z0: z - hd - 0.3, x1: x + hw + 0.3, z1: z + hd + 0.3 });
}

function makePlanter(x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.58, 22), MAT.darkStone);
  pot.position.set(x, 0.29, z); pot.castShadow = true; pot.receiveShadow = true; root.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.022, 8, 24), MAT.brass);
  rim.position.set(x, 0.57, z); rim.rotation.x = Math.PI / 2; root.add(rim);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.24 + Math.random() * 0.16, 10, 8), MAT.leaf);
    b.position.set(x + (Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.5);
    b.castShadow = true; root.add(b);
  }
  Nav.circles.push({ x, z, r: 0.85 });
}

/* a drifting daylight patch on the floor */
function sunPool(x, z, sx, sz, phase) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, opacity: 0.42
  }));
  m.scale.set(sx, sz, 1);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.016, z);
  root.add(m);
  Anim.pools.push({ mesh: m, x0: x, z0: z, phase: phase || Math.random() * 6.3 });
}
