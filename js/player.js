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
const SLIDE_PASSES = 6;          // enough to settle a corner between two props

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

/* How far a settling pass may move you when you were not moving anyway.
   Standing inside something - an object rebuilt around you, or a visitor
   who walked into your back - used to be resolved in one go, and at sixty
   frames a second a 0.6 m shove reads as being fired across the room.
   Eased out four centimetres at a time it is barely noticeable. */
const SLIDE_MAX_FIX = 0.04;

/* One step, taken and then settled. Returned rather than applied, so the
   caller can try a few and keep the one that got furthest.

   The correction is allowed to undo the step that was just taken, and after
   that only to nudge. Those two cases really are different: a step that ends
   inside a bench has to be pushed all the way back out or you walk through
   the bench, while an overlap you were already in is not urgent and is far
   better eased. Clamping both to a nudge is how the first version let a
   sprint tunnel straight through a plinth. */
function tryStep(fromX, fromZ, dx, dz) {
  const aimX = fromX + dx, aimZ = fromZ + dz;
  const p = { x: aimX, z: aimZ };
  slideClear(p);
  /* Enough to undo this step and a nudge more. Exactly one step was not
     enough: a corner needs a shade over the step to clear, so a hair of
     overlap survived each frame, the next frame added its own, and the
     player quietly creeped through the middle of a plinth. */
  const room = Math.hypot(dx, dz) + SLIDE_MAX_FIX;
  const fx = p.x - aimX, fz = p.z - aimZ;
  const f = Math.hypot(fx, fz);
  /* Whatever the clamp had to leave behind. A step that ends still buried in
     something is not a step anybody should be given: reported here so the
     caller can prefer one that came out clean. */
  p.left = 0;
  if (f > room) {
    const k = room / f;
    p.x = aimX + fx * k;
    p.z = aimZ + fz * k;
    p.left = f - room;
  }
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
      if (pushOutCircle(p, v.x, v.z, 0.58)) hit = true;
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
    if (want <= 1e-6) {
      /* Standing still is not the same as being nowhere. Something can be
         rebuilt around you, or a visitor can walk into your back; without a
         settling pass here you simply stayed inside it, and no key would get
         you out because the whole resolution hung off having pressed one. */
      const r = tryStep(fromX, fromZ, 0, 0);
      bx = r.x; bz = r.z;
    } else {
      const r = tryStep(fromX, fromZ, mx, mz);
      bx = r.x; bz = r.z;
      let bestLeft = r.left;
      /* Straight into the middle of a pillar, or dead into a corner, the
         push-out points exactly back the way you came and the two cancel:
         you stop, and no amount of holding the key does anything. So when a
         step gains almost nothing, the same step is offered again leaning to
         each side, and whichever gets furthest is taken. That is what turns
         a corner from something that traps you into something you round. */
      let gain = ((r.x - fromX) * mx + (r.z - fromZ) * mz) / want;
      if (gain < want * 0.30) {
        /* Leaned to each side, but never lengthened: the first version added
           a sideways component on top of the step, so a rounded corner could
           hand back a longer move than the one asked for - and that surplus,
           fed into the next frame as speed, is what threw the player across
           the room. Every candidate is the same length as the step it
           replaces. */
        const px = -mz / want, pz = mx / want;
        const ux = mx / want, uz = mz / want;
        for (let s = -1; s <= 1; s += 2) {
          for (let b = 0.5; b <= 0.9; b += 0.4) {
            const dx = ux + px * s * b, dz = uz + pz * s * b;
            const d = Math.hypot(dx, dz) || 1;
            const c = tryStep(fromX, fromZ, dx / d * want, dz / d * want);
            const g = ((c.x - fromX) * mx + (c.z - fromZ) * mz) / want;
            /* Coming out clean beats getting further. Without this, a step
               leaning round an obstacle could be preferred precisely because
               it ended up inside one - the clamp hid the overlap and the
               gain looked good - and a few frames of that walked the player
               straight through the middle of a plinth. */
            const cleaner = c.left < bestLeft - 1e-6;
            const asClean = c.left <= bestLeft + 1e-6;
            if (cleaner || (asClean && g > gain + 1e-6)) {
              if (cleaner || g > gain) gain = g;
              bestLeft = c.left; bx = c.x; bz = c.z;
            }
          }
        }
      }
      /* The last word, and the one that makes tunnelling impossible. Where
         two round obstacles overlap each other they leave a lens between
         them that no single push can get out of: shoved clear of one, you
         are inside the other, and back again. Rather than trust the settling
         to converge there, a step that ends inside something when you did
         not start inside anything is simply not taken. You stop at the
         surface, which is the whole point of a surface. */
      if (bestLeft > 1e-3 && tryStep(fromX, fromZ, 0, 0).left <= 1e-3) {
        bx = fromX; bz = fromZ;
      }

      /* Whatever came back, the move is capped at the longer of the step
         asked for and one easing nudge - never their sum. Adding them let a
         collision hand back nearly twice a walking pace for a frame, and it
         is that surplus, fed forward as speed, that reads as being thrown. */
      const dx = bx - fromX, dz = bz - fromZ;
      const d = Math.hypot(dx, dz);
      const cap = Math.max(want, SLIDE_MAX_FIX);
      if (d > cap) { bx = fromX + dx / d * cap; bz = fromZ + dz / d * cap; }
    }
    p.x = bx; p.z = bz;
    /* Carry on at the speed that survived the push, not the speed that was
       asked for. Along a wall the two are the same, and into one the wallward
       part is simply gone - so nothing builds up and nothing bounces. */
    let gotX = (p.x - fromX) / sub, gotZ = (p.z - fromZ) / sub;
    const gotSpeed = Math.hypot(gotX, gotZ), wantSpeed = Math.hypot(mx, mz) / sub;
    if (gotSpeed > wantSpeed && gotSpeed > 1e-6) {
      /* An easing nudge moves you; it does not set you going. Carrying it
         forward as velocity is what let a correction compound frame after
         frame until the player shot off across the floor. */
      const k = wantSpeed / gotSpeed;
      gotX *= k; gotZ *= k;
    }
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
