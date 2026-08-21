/* ============================================================
   WALKING THE GALLERIES  --  collision, movement and camera.
   ============================================================ */

/* ---------- collision ---------- */
function canStand(x, z) {
  let inside = (x * x + z * z) <= Nav.rot * Nav.rot;
  if (!inside) {
    for (let i = 0; i < Nav.zones.length; i++) {
      const zn = Nav.zones[i];
      const s = x * zn.ux + z * zn.uz, t = x * zn.vx + z * zn.vz;
      if (s >= zn.t0 && s <= zn.t1 && Math.abs(t) <= zn.doorHalf) { inside = true; break; }
      if (s >= zn.s0 && s <= zn.s1 && Math.abs(t) <= zn.half) { inside = true; break; }
    }
  }
  if (!inside) return false;
  for (let i = 0; i < Nav.boxes.length; i++) {
    const b = Nav.boxes[i];
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
  }
  for (let i = 0; i < Nav.circles.length; i++) {
    const c = Nav.circles[i];
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return false;
  }
  return true;
}
function clearOfPeople(x, z) {
  for (let i = 0; i < Visitors.length; i++) {
    const v = Visitors[i];
    const dx = x - v.x, dz = z - v.z;
    if (dx * dx + dz * dz < 0.42) return false;
  }
  return true;
}
function walkableForPlayer(x, z) { return canStand(x, z) && clearOfPeople(x, z); }

/* ---------- sliding ----------
   Deciding "can I stand here? no? then don't move" is what made a bench
   catch you: walk into a corner at an angle and both the diagonal and each
   axis on its own are refused, so you simply stop dead, and anything that
   ever ended up inside a prop stayed inside it forever.

   So nothing is refused. The step is taken, and then the position is
   pushed back out of whatever it landed in, along the shortest way out.
   Pushing out perpendicular to a surface leaves the movement along that
   surface untouched, which is what sliding is - you round the end of the
   bench instead of stopping at it. Repeating the pass a few times settles
   the corners, where being pushed off one thing can put you into another. */

const SLIDE_EPS = 0.004;         // sat just clear of a surface, never exactly on it
const SLIDE_PASSES = 4;          // enough to settle a corner between two props

/* Out of the round things: plinths, planters, stools and people. */
function pushOutCircle(p, cx, cz, r) {
  let dx = p.x - cx, dz = p.z - cz;
  let d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {                 /* dead centre: any direction will do */
    dx = 1; dz = 0; d = 1;
  }
  const k = (r + SLIDE_EPS) / d;
  p.x = cx + dx * k;
  p.z = cz + dz * k;
  return true;
}

/* Out of the square things, by whichever face is nearest. */
function pushOutBox(p, b) {
  if (p.x <= b.x0 || p.x >= b.x1 || p.z <= b.z0 || p.z >= b.z1) return false;
  const left = p.x - b.x0, right = b.x1 - p.x;
  const back = p.z - b.z0, front = b.z1 - p.z;
  const m = Math.min(left, right, back, front);
  if (m === left) p.x = b.x0 - SLIDE_EPS;
  else if (m === right) p.x = b.x1 + SLIDE_EPS;
  else if (m === back) p.z = b.z0 - SLIDE_EPS;
  else p.z = b.z1 + SLIDE_EPS;
  return true;
}

/* The building itself is a union of a round room and some rectangles, so
   there is no single normal to push along. Instead every region says where
   its own nearest inside point is, and the closest of those wins - which
   comes out as sliding along a wall, and never as a stop. */
function pullIntoRoom(p) {
  if (canStand(p.x, p.z)) return false;
  let bx = null, bz = null, best = Infinity;
  const offer = (x, z) => {
    const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d < best) { best = d; bx = x; bz = z; }
  };

  const d = Math.hypot(p.x, p.z);
  if (d > 1e-6) {
    const k = (Nav.rot - SLIDE_EPS) / d;
    offer(p.x * k, p.z * k);
  }
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  for (let i = 0; i < Nav.zones.length; i++) {
    const zn = Nav.zones[i];
    const s = p.x * zn.ux + p.z * zn.uz, tt = p.x * zn.vx + p.z * zn.vz;
    /* u and v are perpendicular unit vectors, so this maps straight back */
    const back = (cs, ct) => offer(cs * zn.ux + ct * zn.vx, cs * zn.uz + ct * zn.vz);
    back(clamp(s, zn.s0, zn.s1), clamp(tt, -zn.half + SLIDE_EPS, zn.half - SLIDE_EPS));
    back(clamp(s, zn.t0, zn.t1), clamp(tt, -zn.doorHalf + SLIDE_EPS, zn.doorHalf - SLIDE_EPS));
  }
  if (bx === null) return false;
  p.x = bx; p.z = bz;
  return true;
}

/* One step, taken and then settled. Returned rather than applied, so the
   caller can try a few and keep the one that got furthest. */
function tryStep(fromX, fromZ, dx, dz) {
  const p = { x: fromX + dx, z: fromZ + dz };
  slideClear(p);
  return p;
}

/* One settling pass over everything solid. */
function slideClear(p) {
  for (let pass = 0; pass < SLIDE_PASSES; pass++) {
    let hit = false;
    for (let i = 0; i < Nav.circles.length; i++) {
      const c = Nav.circles[i];
      if (pushOutCircle(p, c.x, c.z, c.r)) hit = true;
    }
    for (let i = 0; i < Nav.boxes.length; i++) {
      if (pushOutBox(p, Nav.boxes[i])) hit = true;
    }
    for (let i = 0; i < Visitors.length; i++) {
      const v = Visitors[i];
      if (pushOutCircle(p, v.x, v.z, 0.65)) hit = true;
    }
    if (pullIntoRoom(p)) hit = true;
    if (!hit) return;
  }
}

function stepPlayer(dt) {
  let ix = 0, iz = 0;
  if (keys["w"] || keys["arrowup"]) iz -= 1;      // forward
  if (keys["s"] || keys["arrowdown"]) iz += 1;    // back
  if (keys["a"] || keys["arrowleft"]) ix -= 1;    // strafe left
  if (keys["d"] || keys["arrowright"]) ix += 1;   // strafe right
  ix += touchState.mx; iz += touchState.mz;

  /* keyboard turning, for anyone whose mouse look is unavailable */
  let turn = 0;
  if (keys["q"]) turn += 1;
  if (keys["e"]) turn -= 1;
  if (turn) Player.yaw += turn * 1.5 * dt;

  const mag = Math.hypot(ix, iz);
  if (mag > 1) { ix /= mag; iz /= mag; }

  const sprint = keys["shift"] ? 2 : 1;      // Shift doubles walking speed
  const speed = 3.5 * sprint;
  /* facing at yaw: forward = (-sin, -cos), right = (cos, -sin) */
  const sin = Math.sin(Player.yaw), cos = Math.cos(Player.yaw);
  const wx = (ix * cos + iz * sin) * speed;
  const wz = (-ix * sin + iz * cos) * speed;

  const k = 1 - Math.pow(0.0015, dt);
  Player.vx += (wx - Player.vx) * k;
  Player.vz += (wz - Player.vz) * k;

  /* sprinting can cover more ground in one frame than a wall is thick, so
     move in short sweeps rather than one jump */
  let mx = Player.vx * dt, mz = Player.vz * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.22));
  mx /= steps; mz /= steps;
  const sub = dt / steps;
  const p = { x: Player.x, z: Player.z };
  for (let i = 0; i < steps; i++) {
    const fromX = p.x, fromZ = p.z;
    const want = Math.hypot(mx, mz);
    let bx = p.x + mx, bz = p.z + mz;
    if (want > 1e-6) {
      const r = tryStep(fromX, fromZ, mx, mz);
      bx = r.x; bz = r.z;
      /* Straight into the middle of a pillar, or dead into a corner, the
         push-out points exactly back the way you came and the two cancel:
         you stop, and no amount of holding the key does anything. So when a
         step gains almost nothing, the same step is offered again leaning to
         each side, and whichever gets furthest is taken. That is what turns
         a corner from something that traps you into something you round. */
      let gain = ((r.x - fromX) * mx + (r.z - fromZ) * mz) / want;
      if (gain < want * 0.30) {
        const px = -mz, pz = mx;                 /* perpendicular to the step */
        for (let s = -1; s <= 1; s += 2) {
          for (let b = 0.6; b <= 1.25; b += 0.65) {
            const c = tryStep(fromX, fromZ, mx + px * s * b, mz + pz * s * b);
            const g = ((c.x - fromX) * mx + (c.z - fromZ) * mz) / want;
            if (g > gain + 1e-6) { gain = g; bx = c.x; bz = c.z; }
          }
        }
      }
    }
    p.x = bx; p.z = bz;
    /* Carry on at the speed that survived the push, not the speed that was
       asked for. Along a wall the two are the same, and into one the wallward
       part is simply gone - so nothing builds up and nothing bounces. */
    const gotX = (p.x - fromX) / sub, gotZ = (p.z - fromZ) / sub;
    Player.vx = gotX; Player.vz = gotZ;
    mx = gotX * sub; mz = gotZ * sub;
  }
  Player.x = p.x; Player.z = p.z;

  const spd = Math.hypot(Player.vx, Player.vz);
  Player.moving += (Math.min(spd / 3.5, 1.35) - Player.moving) * Math.min(1, dt * 8);
  Player.bob += spd * dt * 2.6;
}

/* ---------- camera ---------- */
function updateCamera(dt) {
  const head = 1.66 + (Player.third ? 0 : Math.sin(Player.bob) * 0.035 * Player.moving);
  fov += (fovTarget - fov) * Math.min(1, dt * 8);
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  avatar.position.set(Player.x, 0, Player.z);
  avatar.rotation.y = Player.yaw + Math.PI;        // figure is modelled facing +Z
  avatar.visible = Player.third;
  if (Player.third) {
    const lift = poseFigure(avatarParts, Player.bob * 1.7, Math.min(Player.moving, 1), 0);
    avatar.position.y = lift;
  }

  if (!Player.third) {
    camera.position.set(Player.x, head, Player.z);
  } else {
    const fx = -Math.sin(Player.yaw), fz = -Math.cos(Player.yaw);
    let dist = 4.0;
    for (let d = 0.6; d <= 4.0; d += 0.25) {
      if (!canStand(Player.x - fx * d, Player.z - fz * d)) { dist = Math.max(1.1, d - 0.4); break; }
    }
    const lift = 1.05 - Player.pitch * 1.1;
    camera.position.set(Player.x - fx * dist, head + lift, Player.z - fz * dist);
  }
  camera.rotation.order = "YXZ";
  camera.rotation.y = Player.yaw;
  camera.rotation.x = Player.pitch;
}

/* ---------- starting position ---------- */
function resetPlayer() {
  Player.x = 0; Player.z = 9.6; Player.yaw = 0; Player.pitch = -0.02;
  Player.vx = Player.vz = 0; fov = fovTarget = 62;
}
