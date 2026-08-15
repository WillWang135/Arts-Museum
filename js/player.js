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
  for (let i = 0; i < steps; i++) {
    const nx = Player.x + mx, nz = Player.z + mz;
    if (walkableForPlayer(nx, nz)) { Player.x = nx; Player.z = nz; }
    else if (walkableForPlayer(nx, Player.z)) { Player.x = nx; Player.vz *= 0.3; mz = 0; }
    else if (walkableForPlayer(Player.x, nz)) { Player.z = nz; Player.vx *= 0.3; mx = 0; }
    else { Player.vx *= 0.2; Player.vz *= 0.2; break; }
  }

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
