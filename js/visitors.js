/* ============================================================
   AMBIENT VISITORS  --  the people already in the galleries.
   ============================================================ */
const SKINS = [0xF2CBA4, 0xE3AC80, 0xC98B5E, 0xA06A44];
const VISITOR_LOOKS = [
  { top: 0x35608F, topDark: 0x2B4E75, topStyle: "hoodie", bottom: 0xD8C9A4, shoe: 0x24262A, sole: 0xF2EFE7,
    hair: 0x241B14, hairStyle: "short", hat: "cap", hatColor: 0x2F5480, bag: "backpack", bagColor: 0x2F4A6B,
    skin: 0xF2CBA4, face: 0 },
  { top: 0xEFE7D6, topDark: 0xDFD4BC, topStyle: "tee", bottom: 0xC2A882, shoe: 0xF0EAD9, sole: 0xFFFFFF,
    hair: 0x6B4A2E, hairStyle: "buns", bag: "tote", bagColor: 0xE6DCC6, skin: 0xE3AC80, face: 2 },
  { top: 0x4E6B4A, topDark: 0x415A3E, topStyle: "hoodie", bottom: 0x27292C, shoe: 0x24262A, sole: 0xF2EFE7,
    hair: 0x1A1512, hairStyle: "short", headphones: true, holding: "cup", skin: 0xA06A44, face: 1 },
  { top: 0xF4F0E6, topDark: 0xE2DCCC, topStyle: "tee", bottom: 0x24262A, bottomStyle: "skirt", tights: 0x2B2E33,
    shoe: 0x24262A, sole: 0x3A3D42, hair: 0x14100D, hairStyle: "bob", bag: "crossbody", skin: 0xF2CBA4, face: 3 },
  { top: 0x7A5236, topDark: 0x66442C, topStyle: "jacket", bottom: 0xD8C9A4, shoe: 0xF0EAD9, sole: 0xFFFFFF,
    hair: 0x2A2119, hairStyle: "short", glasses: true, skin: 0xE3AC80, face: 2 },
  { top: 0xF0E9DA, topDark: 0xDED5C2, topStyle: "tee", bottom: 0x4A6484, shoe: 0xF0EAD9, sole: 0xFFFFFF,
    hair: 0x5C4030, hairStyle: "long", bag: "tote", bagColor: 0xE0D6C0, holding: "phone", skin: 0xF2CBA4, face: 0 },
  { top: 0x2A2C30, topDark: 0x212327, topStyle: "tee", bottom: 0xC9AE84, bottomStyle: "shorts",
    shoe: 0xF0EAD9, sole: 0xFFFFFF, hair: 0x231A13, hairStyle: "short", hat: "cap", hatColor: 0xE7DDC6,
    skin: 0xC98B5E, face: 1 },
  { top: 0xE9E3D5, topDark: 0x3E4248, topStyle: "tee", bottom: 0x24262A, bottomStyle: "skirt", tights: 0x2B2E33,
    shoe: 0x24262A, sole: 0xF2EFE7, hair: 0x1C1613, hairStyle: "long", hat: "bucket", hatColor: 0xEFE6D2,
    bag: "tote", bagColor: 0xE6DCC6, skin: 0xE3AC80, face: 2 }
];

function buildVisitors() {
  Visitors.length = 0;
  if (!Frames.length) return;

  const spots = [];
  const consider = (x, z, yaw) => {
    if (!canStand(x, z)) return;
    if ((x * x + (z - 9.6) * (z - 9.6)) < 9) return;        // leave the entrance clear
    for (let i = 0; i < spots.length; i++) {
      const dx = spots[i].x - x, dz = spots[i].z - z;
      if (dx * dx + dz * dz < 7.3) return;                  // keep them apart
    }
    spots.push({ x: x, z: z, yaw: yaw });
  };

  /* standing back from artworks, offset to one side so they never block a view head-on */
  const stride = Math.max(1, Math.floor(Frames.length / 9));
  for (let i = 0; i < Frames.length; i += stride) {
    const f = Frames[i];
    if (f.isFeature) continue;
    const side = (i % 2 ? 1 : -1) * (0.85 + (i % 3) * 0.32);
    const tx = -f.normal.z, tz = f.normal.x;
    consider(f.pos.x + f.normal.x * 2.5 + tx * side,
             f.pos.z + f.normal.z * 2.5 + tz * side,
             Math.atan2(-f.normal.x, -f.normal.z));
  }
  /* a couple admiring the featured wall, a couple crossing the concourse */
  consider(-4.4, 6.1, Math.atan2(4.4, -6.1));
  consider(4.8, 7.0, Math.atan2(-4.8, -7.0));
  consider(-9.9, -2.8, 1.35);
  consider(9.5, -4.2, -1.15);

  const want = quality === "high" ? 8 : 4;
  const step = Math.max(1, Math.floor(spots.length / want));
  const chosen = [];
  for (let i = 0; i < spots.length && chosen.length < want; i += step) chosen.push(spots[i]);

  chosen.forEach((s, i) => {
    const look = VISITOR_LOOKS[(i * 3 + 1) % VISITOR_LOOKS.length];
    const opt = {};
    for (const k in look) opt[k] = look[k];
    opt.shadows = false;
    opt.skin = look.skin || SKINS[i % SKINS.length];
    const f = makeFigure(opt);
    f.group.position.set(s.x, 0, s.z);
    f.group.rotation.y = s.yaw;
    f.group.scale.setScalar(0.94 + ((i * 37) % 11) / 100);
    root.add(f.group);
    Visitors.push({
      g: f.group, parts: f.parts,
      x: s.x, z: s.z, homeX: s.x, homeZ: s.z,
      yaw: s.yaw, targetYaw: s.yaw, baseYaw: s.yaw,
      state: "idle", timer: 1.5 + Math.random() * 7,
      walkT: 0, walkDur: 1, fromX: s.x, fromZ: s.z, toX: s.x, toZ: s.z,
      phase: Math.random() * 6.3, seed: Math.random() * 6.3
    });
  });
}

function updateVisitors(dt, t) {
  for (let i = 0; i < Visitors.length; i++) {
    const v = Visitors[i];

    if (v.state === "walk") {
      v.walkT += dt / v.walkDur;
      if (v.walkT >= 1) { v.walkT = 1; v.state = "idle"; v.timer = 5 + Math.random() * 8; v.baseYaw = v.yaw; }
      v.x = v.fromX + (v.toX - v.fromX) * v.walkT;
      v.z = v.fromZ + (v.toZ - v.fromZ) * v.walkT;
      v.phase += dt * 4.6;
    } else {
      v.timer -= dt;
      if (v.timer <= 0) {
        if (Math.random() < 0.22) {                       // occasional short stroll
          const a = Math.random() * 6.283, d = 0.9 + Math.random() * 1.7;
          const nx = v.homeX + Math.cos(a) * d, nz = v.homeZ + Math.sin(a) * d;
          if (canStand(nx, nz) && Math.hypot(nx - Player.x, nz - Player.z) > 1.4) {
            v.fromX = v.x; v.fromZ = v.z; v.toX = nx; v.toZ = nz;
            v.walkDur = Math.max(1.4, Math.hypot(nx - v.x, nz - v.z) / 0.55);
            v.walkT = 0; v.state = "walk";
            v.targetYaw = Math.atan2(nx - v.x, nz - v.z);
          } else v.timer = 3 + Math.random() * 5;
        } else {                                          // or just glance somewhere new
          v.targetYaw = v.baseYaw + (Math.random() - 0.5) * 1.15;
          v.timer = 5 + Math.random() * 9;
        }
      }
    }

    let d = v.targetYaw - v.yaw;
    while (d > Math.PI) d -= 6.283;
    while (d < -Math.PI) d += 6.283;
    v.yaw += d * Math.min(1, dt * 1.5);

    const walking = v.state === "walk" ? 1 : 0;
    const bob = poseFigure(v.parts, v.phase, walking, t, v.seed);
    const sway = walking ? 0 : Math.sin(t * 0.6 + v.seed) * 0.006;
    v.g.position.set(v.x, bob + sway, v.z);
    v.g.rotation.y = v.yaw;
  }
}
