/// <reference types="vite/client" />
import { Input } from "./keys.ts";
import { MAP } from "./map.ts";
const canvas = document.getElementsByTagName("canvas")[0];
const ctx = canvas.getContext("2d")!;
let w: number, h: number;
function resize() {
  w = innerWidth * devicePixelRatio;
  h = innerHeight * devicePixelRatio;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  const s = 250;
  ctx.scale(min / s, min / s);
  if (h > w) ctx.translate(s / 2, (s / 2) * (max / min));
  else ctx.translate((s / 2) * (max / min), s / 2);
}

function circle(centerX: number, centerY: number, radius: number) {
  ctx.moveTo(centerX + radius, centerY);
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
}

function startCircle() {
  ctx.beginPath();
}

function setShadow(
  size: number,
  l?: string | number,
  c?: number,
  h?: number,
  a?: number,
) {
  ctx.shadowBlur = size;
  if (l !== undefined) {
    if (typeof l === "string") {
      ctx.shadowColor = l;
    } else {
      if (a !== undefined) {
        ctx.shadowColor = `oklch(${l} ${c} ${h} / ${a})`;
      } else {
        ctx.shadowColor = `oklch(${l} ${c} ${h})`;
      }
    }
  }
}

function setColor(l: string | number, c: number, h: number, a?: number) {
  if (typeof l === "string") {
    ctx.fillStyle = l;
  } else {
    if (a !== undefined) {
      ctx.fillStyle = `oklch(${l} ${c} ${h} / ${a})`;
    } else {
      ctx.fillStyle = `oklch(${l} ${c} ${h})`;
    }
  }
}

function fill(l?: string | number, c?: number, h?: number, a?: number) {
  if (l !== undefined) {
    setColor(l, c!, h!, a!);
  }
  ctx.closePath();
  ctx.fill();
}

window.addEventListener("resize", resize);
Input.init();
resize();

// type Number2D = [number, number];
type Number3D = [number, number, number];
const logicFPS = 60;
const fixedStep = 1000 / logicFPS;
const playerR = 6;
const circleRimThickness = 3;
const baseBounce = 0.45;
const shaftVerticalBoost = 2.4;
interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  velX: number;
  velY: number;
  velRotation: number;
  frames: number;
  age: number;
  hueOffset: number;
}
const particles: Particle[] = [];
interface OrbitParticle {
  x: number;
  y: number;
  angle: number;
  radius: number;
  speed: number;
  size: number;
  age: number;
  frames: number;
  hue: number;
}
const orbitParticles: OrbitParticle[] = [];
const rewardedCircleContacts = new WeakSet<object>();
const rewardedObstacleContacts = new WeakSet<object>();
const passedCircles = new WeakSet<object>();
interface ParticleSpawn {
  x: number;
  y: number;
  rotating: boolean;
}
const pendingParticleSpawns: ParticleSpawn[] = [];
const rewardImage = document.getElementById("reward-image") as HTMLImageElement;
function openingIsOpen(item: (typeof MAP)[number]) {
  if (!item.openingAfter) return true;
  const gate = MAP.find((candidate) => candidate.id === item.openingAfter);
  return !!gate && gate.currentP! >= gate.totalP!;
}
function gateIsDestroyed(id: string) {
  const gate = MAP.find((candidate) => candidate.id === id);
  return !!gate && gate.currentP! >= gate.totalP!;
}
function itemIsVisible(item: (typeof MAP)[number]) {
  if (item.hiddenAfter && gateIsDestroyed(item.hiddenAfter)) return false;
  return !item.visibleAfter || gateIsDestroyed(item.visibleAfter);
}
function circleCollisionEnabled(item: (typeof MAP)[number], playerY: number) {
  if (!item.visibleAfter) return true;
  // The lower room must not pull the player across the map when the gate opens.
  // Start its boundary collision at the room's inner rim, after the shaft ends.
  return (
    gateIsDestroyed(item.visibleAfter) &&
    playerY >= item.xyr![1] - item.xyr![2] + playerR - 4
  );
}
// An obstacle is solid until it is destroyed. Destroyed obstacles (currentP >= totalP) are passable.
function obstacleIsSolid(item: (typeof MAP)[number]) {
  return item.type === "obstacle" && item.currentP! < item.totalP!;
}
// Obstacles are boxes, so test the player's center against the closest point on the box.
// This works from every side and at corners, unlike the circle rim logic.
function resolveObstacleCollisions() {
  MAP.forEach((obstacle) => {
    if (!obstacleIsSolid(obstacle)) return;
    const [x, y, width, height] = obstacle.xywh!;
    const playerX = -cameraX;
    const playerY = -cameraY;
    const closestX = Math.max(x, Math.min(playerX, x + width));
    const closestY = Math.max(y, Math.min(playerY, y + height));
    const dx = playerX - closestX;
    const dy = playerY - closestY;
    const distance = Math.hypot(dx, dy);
    if (distance > playerR + 0.05) rewardedObstacleContacts.delete(obstacle);
    if (distance >= playerR) return;

    let nx = 0;
    let ny = 0;
    let contactX = closestX;
    let contactY = closestY;
    if (distance > 0) {
      nx = dx / distance;
      ny = dy / distance;
    } else {
      // The center is inside the box, so leave through the nearest face.
      const faces = [
        { nx: -1, ny: 0, depth: playerX - x, x: x, y: playerY },
        { nx: 1, ny: 0, depth: x + width - playerX, x: x + width, y: playerY },
        { nx: 0, ny: -1, depth: playerY - y, x: playerX, y: y },
        {
          nx: 0,
          ny: 1,
          depth: y + height - playerY,
          x: playerX,
          y: y + height,
        },
      ];
      const face = faces.reduce((a, b) => (b.depth < a.depth ? b : a));
      nx = face.nx;
      ny = face.ny;
      contactX = face.x;
      contactY = face.y;
    }

    const beforeX = cameraX;
    const beforeY = cameraY;
    cameraX = -(contactX + nx * playerR);
    cameraY = -(contactY + ny * playerR);
    lastCorrection = Math.hypot(cameraX - beforeX, cameraY - beforeY);
    lastPhysicsEvent = `obstacle ${obstacle.id ?? ""} bounce`;
    circleCollisionState = `touching obstacle ${obstacle.id ?? ""}`;

    // velX/velY are camera-space (the negative of player motion), so a positive
    // dot product with the outward normal means the player is moving into the box.
    // Moving away is left alone.
    const normalSpeed = velX * nx + velY * ny;
    if (normalSpeed <= 0) return;
    let impact = normalSpeed;
    const bounce = baseBounce + upgrades.spring * 0.08;
    velX -= (1 + bounce) * normalSpeed * nx;
    velY -= (1 + bounce) * normalSpeed * ny;
    // Reward and damage once per contact, mirroring circle rim impacts.
    if (impact >= 1.5 && !rewardedObstacleContacts.has(obstacle)) {
      rewardedObstacleContacts.add(obstacle);
      pendingParticleSpawns.push({ x: contactX, y: contactY, rotating: false });
      impact = Math.round(impact * impact);
      currency += Math.round(impact * 2 ** upgrades.payout);
      obstacle.currentP = Math.min(
        obstacle.totalP!,
        obstacle.currentP! + impact,
      );
      if (obstacle.currentP >= obstacle.totalP!) {
        spawnOrbitBurst(x, y, width, height);
      }
    }
    if (Math.hypot(velX, velY) < 0.01) velX = velY = 0;
  });
}
// Slopes are solid line segments that the player slides along. They absorb the
// velocity pushing into them, so the player rolls down instead of bouncing.
// True while the player rests on a slope this tick. The corridor floor clamps are
// skipped then, so the ramp can carry the player below the corridor's floor line.
let onSlope = false;
function resolveSlopeCollisions() {
  onSlope = false;
  MAP.forEach((slope) => {
    if (slope.type !== "slope" || !itemIsVisible(slope)) return;
    const [ax, ay, bx, by] = slope.line!;
    const playerX = -cameraX;
    const playerY = -cameraY;
    const dxs = bx - ax;
    const dys = by - ay;
    const lengthSquared = dxs * dxs + dys * dys;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((playerX - ax) * dxs + (playerY - ay) * dys) / lengthSquared,
      ),
    );
    const contactX = ax + dxs * t;
    const contactY = ay + dys * t;
    const dx = playerX - contactX;
    const dy = playerY - contactY;
    const distance = Math.hypot(dx, dy);
    if (distance >= playerR) return;

    let nx: number;
    let ny: number;
    if (distance > 0) {
      nx = dx / distance;
      ny = dy / distance;
    } else {
      // Exactly on the line: take the upper side.
      const length = Math.sqrt(lengthSquared);
      nx = -dys / length;
      ny = dxs / length;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
    }

    onSlope = true;
    const beforeX = cameraX;
    const beforeY = cameraY;
    cameraX = -(contactX + nx * playerR);
    cameraY = -(contactY + ny * playerR);
    lastCorrection = Math.hypot(cameraX - beforeX, cameraY - beforeY);
    lastPhysicsEvent = `slope ${slope.id ?? ""} contact`;
    circleCollisionState = `on slope ${slope.id ?? ""}`;

    // Camera-space dot product above zero means moving into the slope.
    const normalSpeed = velX * nx + velY * ny;
    if (normalSpeed > 0) {
      velX -= normalSpeed * nx;
      velY -= normalSpeed * ny;
    }
  });
}

// Spin room (area 3): while inside and above the target spin rate, hold a
// direction to push tangentially around the room's center. The spin meter
// (currentP) fills while spinning fast enough and drains otherwise.
// Each spin level adds 50% to the push. Level 0 never keeps up with the target,
// level 1 only sometimes does, and level 2 keeps up, so the ladder needs two purchases.
const spinPushBase = 0.06;
const spinTargetRadPerSec = 2.2;
const spinFillPerTick = 1;
const spinDecayPerTick = 0.5;
// Returns true while the player is inside an unfinished spin room.
function updateSpinRoom() {
  const room = MAP.find((item) => item.id === "spin-room");
  if (!room || room.currentP! >= room.totalP!) return false;
  const [cx, cy, radius] = room.xyr!;
  const rx = -cameraX - cx;
  const ry = -cameraY - cy;
  const distance = Math.hypot(rx, ry);
  if (distance === 0 || distance >= radius) {
    room.currentP = Math.max(0, room.currentP! - spinDecayPerTick);
    return false;
  }
  const push = spinPushBase * (1 + upgrades.spin * 0.5) * Input.getHorizontal();
  // Tangent to the radius. Camera-space velocity is the negative of player velocity.
  velX += (push * ry) / distance;
  velY -= (push * rx) / distance;
  // Angular speed about the room center, in radians per second.
  const radPerSec =
    (Math.abs(ry * velX - rx * velY) / (distance * distance)) * logicFPS;
  if (radPerSec >= spinTargetRadPerSec) {
    room.currentP = Math.min(room.totalP!, room.currentP! + spinFillPerTick);
  } else {
    room.currentP = Math.max(0, room.currentP! - spinDecayPerTick);
  }
  lastPhysicsEvent = `spinning ${radPerSec.toFixed(2)} rad/s`;
  return true;
}
// Entering area 4 reveals the oooo image, once.
let area4Reached = false;
function updateAreaFour() {
  if (area4Reached) return;
  const area4 = MAP.find((item) => item.id === "area-4");
  if (!area4 || !itemIsVisible(area4)) return;
  const [ax, ay, ar] = area4.xyr!;
  if (Math.hypot(-cameraX - ax, -cameraY - ay) < ar) {
    area4Reached = true;
    rewardImage.hidden = false;
  }
}
function segmentCircleHitTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const sx = startX - centerX;
  const sy = startY - centerY;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (sx * dx + sy * dy);
  const c = sx * sx + sy * sy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (first >= 0 && first <= 1) return first;
  if (second >= 0 && second <= 1) return second;
  return null;
}
function segmentPointDistance(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pointX: number,
  pointY: number,
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(startX + dx * t - pointX, startY + dy * t - pointY);
}
function spawnParticles(x: number, y: number, rotating = false) {
  for (let i = 0; i < (rotating ? 5 : 12); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.5;
    const opacity = 0.35 + Math.random() * 0.65;
    particles.push({
      x: x + (Math.random() - 0.5) * 2,
      y: y + (Math.random() - 0.5) * 2,
      size: rotating ? 0.35 + Math.random() * 0.65 : 1 + Math.random() * 2.5,
      opacity,
      rotation: Math.random() * Math.PI * 2,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed,
      velRotation: (Math.random() - 0.5) * 0.5,
      frames: Math.round(12 + opacity * 28),
      age: 0,
      hueOffset: rotating ? 180 : 0,
    });
  }
}
function spawnOrbitBurst(x: number, y: number, width: number, height: number) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  for (let i = 0; i < 28; i++) {
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.12;
    orbitParticles.push({
      x: cx,
      y: cy,
      angle,
      radius: 5 + Math.random() * 13,
      speed: (0.025 + Math.random() * 0.025) * (i % 2 === 0 ? 1 : -1),
      size: 0.8 + Math.random() * 1.8,
      age: 0,
      frames: 90 + Math.round(Math.random() * 45),
      hue: 175 + Math.random() * 45,
    });
  }
}
const backgroundAudio = new Audio("/AsgardianCircles.mp3");
backgroundAudio.loop = true;
window.setTimeout(() => {
  void backgroundAudio.play().catch((error: unknown) => {
    console.warn("bruh:", error);
  });
}, 3000);
let lastTime = 0,
  accum = 0;
const spawnCircle = MAP.find((item) => item.type === "circle")!;
let velX = 0,
  velY = 0,
  cameraX = -spawnCircle.xyr![0],
  cameraY = -spawnCircle.xyr![1],
  lastPhysicsEvent = "none",
  lastCorrection = 0,
  wasJumpHeld = false,
  circleCollisionState = "idle";
function update() {
  lastPhysicsEvent = "free movement";
  lastCorrection = 0;
  circleCollisionState = "inside rooms";
  const oldPlayerX = -cameraX;
  const oldPlayerY = -cameraY;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.velX;
    p.y += p.velY;
    p.rotation += p.velRotation;
    p.age++;
    if (p.age >= p.frames) particles.splice(i, 1);
  }
  for (let i = orbitParticles.length - 1; i >= 0; i--) {
    const p = orbitParticles[i];
    p.angle += p.speed;
    p.radius += Math.sin((p.age / p.frames) * Math.PI) * 0.035;
    p.age++;
    if (p.age >= p.frames) orbitParticles.splice(i, 1);
  }
  const inSpinRoom = updateSpinRoom();
  const speed = (8 / logicFPS) * (1 + upgrades.drive * 0.2);
  // Inside the spin room, horizontal input is the spin push instead of a straight push.
  const accelX = inSpinRoom ? 0 : speed * Input.getHorizontal();
  const accelY = -0.1;
  const verticalInput = Input.getVertical();
  const jumpPressed = verticalInput === 1 && !wasJumpHeld;
  wasJumpHeld = verticalInput === 1;
  const horizontalCorridor = MAP.find((item) => {
    if (item.type !== "rect") return false;
    const bounds = item.hitbox ?? item.xywh!;
    return bounds[2] > bounds[3];
  });
  if (jumpPressed && horizontalCorridor) {
    const playerX = -cameraX;
    const playerY = -cameraY;
    const shopOpening = MAP.find(
      (item) => item.type === "circle" && item.openings?.length,
    )?.openings?.[0];
    const isAtHorizontalChamber =
      shopOpening &&
      playerX >= shopOpening[0] + playerR &&
      playerX <= shopOpening[0] + shopOpening[2] - playerR &&
      playerY >= shopOpening[1] - playerR &&
      playerY <= shopOpening[1] + shopOpening[3] + playerR;
    if (isAtHorizontalChamber) {
      velY = Math.max(velY, 2.8);
    }
  }
  const drag = 0.3 ** (1 / logicFPS);
  velX = (velX + accelX) * drag;
  velY = (velY + accelY) * drag;
  cameraX += velX;
  cameraY += velY;

  MAP.forEach((item) => {
    if (item.type !== "circle" || !item.openingAfter) return;
    if (passedCircles.has(item) && -cameraY < item.opening![1] + playerR) {
      passedCircles.delete(item);
    }
  });

  MAP.forEach(function (item) {
    if (item.type === "circle") {
      if (!circleCollisionEnabled(item, -cameraY)) {
        if (item.visibleAfter) circleCollisionState = "area 2 approach";
        return;
      }
      if (passedCircles.has(item)) {
        circleCollisionState = "area 1 corridor cleared";
        return;
      }
      const xyr = item.xyr!;
      // Read the live position: resolving one circle can move the camera before the next circle is checked in this same physics step.
      const playerX = -cameraX;
      const playerY = -cameraY;
      const dx = playerX - xyr[0];
      const dy = playerY - xyr[1];
      const distance = Math.hypot(dx, dy);
      const openings = [item.opening, ...(item.openings ?? [])].filter(
        (opening): opening is [number, number, number, number] => !!opening,
      );
      if (
        item.openingAfter &&
        openingIsOpen(item) &&
        playerY >= xyr[1] + xyr[2] + playerR &&
        openings.some(
          (opening) =>
            playerX >= opening[0] + playerR &&
            playerX <= opening[0] + opening[2] - playerR,
        )
      ) {
        passedCircles.add(item);
        lastPhysicsEvent = "cleared area 1 into corridor";
        return;
      }
      const inPassage = openings.some((opening, index) => {
        // Only the bottom opening (index 0) waits on openingAfter. Side openings stay open.
        if (index === 0 && !openingIsOpen(item)) return false;
        const [x, y, width, height] = opening;
        if (index === 0) {
          if (!item.opening) return false;
          const inShaft =
            playerX >= x + playerR && playerX <= x + width - playerR;
          if (!inShaft) return false;
          // Both rooms connect to the same vertical shaft. Keep its center open
          // on either side of the doorway so the player can traverse it both ways.
          return item.visibleAfter
            ? playerY <= y + height - playerR
            : playerY >= y + playerR;
        }
        const corridorItem = MAP.find((candidate) => {
          if (candidate.type !== "rect") return false;
          const bounds = candidate.hitbox ?? candidate.xywh!;
          // The horizontal corridor this side opening sits in.
          return (
            bounds[2] > bounds[3] &&
            bounds[1] < y + height &&
            bounds[1] + bounds[3] > y
          );
        });
        const corridor = corridorItem?.hitbox ?? corridorItem?.xywh;
        const [cx, cy, radius] = item.xyr!;
        const clearedCircle =
          Math.hypot(playerX - cx, playerY - cy) >= radius - playerR;
        return (
          !!corridor &&
          clearedCircle &&
          playerX <= x + width - playerR &&
          playerY >= corridor[1] - playerR &&
          playerY <= corridor[1] + corridor[3] + playerR
        );
      });
      if (
        inPassage ||
        openings.some(
          (opening, index) =>
            (index !== 0 || openingIsOpen(item)) &&
            playerX >= opening[0] + playerR &&
            playerX <= opening[0] + opening[2] - playerR &&
            playerY >= opening[1] + playerR &&
            playerY <= opening[1] + opening[3] - playerR,
        )
      ) {
        circleCollisionState = `passage open in area ${item.visibleAfter ? "2" : "1"}`;
        return;
      }
      // A circle is a solid rim: a player on its inside touches at R-r, while a
      // player approaching from outside touches at R+r. Preserve the approach
      // side so a bad frame cannot pull the player through the rim.
      const oldDx = oldPlayerX - xyr[0];
      const oldDy = oldPlayerY - xyr[1];
      const oldDistance = Math.hypot(oldDx, oldDy);
      const onOutside = oldDistance > xyr[2];
      const allowedDistance = onOutside
        ? xyr[2] + playerR
        : xyr[2] - circleRimThickness - playerR;
      const sweptDistance = onOutside
        ? segmentPointDistance(
            oldPlayerX,
            oldPlayerY,
            playerX,
            playerY,
            xyr[0],
            xyr[1],
          )
        : distance;
      const penetrated = onOutside
        ? distance < allowedDistance || sweptDistance < allowedDistance
        : distance > allowedDistance;
      const safelySeparated = onOutside
        ? distance > allowedDistance + 0.05
        : distance < allowedDistance - 0.05;
      if (safelySeparated) rewardedCircleContacts.delete(item);
      if (penetrated && allowedDistance > 0) {
        const startedValid = onOutside
          ? oldDistance >= allowedDistance
          : oldDistance <= allowedDistance;
        const hitTime = startedValid
          ? segmentCircleHitTime(
              oldPlayerX,
              oldPlayerY,
              playerX,
              playerY,
              xyr[0],
              xyr[1],
              allowedDistance,
            )
          : null;
        let contactX = playerX;
        let contactY = playerY;
        if (hitTime !== null) {
          contactX = oldPlayerX + (playerX - oldPlayerX) * hitTime;
          contactY = oldPlayerY + (playerY - oldPlayerY) * hitTime;
        }
        const contactDx = contactX - xyr[0];
        const contactDy = contactY - xyr[1];
        const contactDistance = Math.hypot(contactDx, contactDy);
        const nx = contactDistance > 0 ? contactDx / contactDistance : 1;
        const ny = contactDistance > 0 ? contactDy / contactDistance : 0;
        let resolvedX = xyr[0] + nx * allowedDistance;
        let resolvedY = xyr[1] + ny * allowedDistance;
        if (hitTime !== null) {
          let slideX = playerX - contactX;
          let slideY = playerY - contactY;
          const slideNormal = slideX * nx + slideY * ny;
          const slidesIntoWall = onOutside ? slideNormal < 0 : slideNormal > 0;
          if (slidesIntoWall) {
            slideX -= slideNormal * nx;
            slideY -= slideNormal * ny;
          }
          resolvedX = contactX + slideX;
          resolvedY = contactY + slideY;
          const resolvedDx = resolvedX - xyr[0];
          const resolvedDy = resolvedY - xyr[1];
          const resolvedDistance = Math.hypot(resolvedDx, resolvedDy);
          const remainsPenetrated = onOutside
            ? resolvedDistance < allowedDistance
            : resolvedDistance > allowedDistance;
          if (remainsPenetrated && resolvedDistance > 0) {
            resolvedX =
              xyr[0] + (resolvedDx / resolvedDistance) * allowedDistance;
            resolvedY =
              xyr[1] + (resolvedDy / resolvedDistance) * allowedDistance;
          }
        }
        const beforeX = cameraX;
        const beforeY = cameraY;
        cameraX = -resolvedX;
        cameraY = -resolvedY;
        lastCorrection = Math.hypot(cameraX - beforeX, cameraY - beforeY);
        lastPhysicsEvent = `circle ${onOutside ? "outside" : "inside"} bounce (${item.visibleAfter ? "area 2" : "area 1"})`;
        circleCollisionState = `${onOutside ? "outside" : "inside"} radius ${distance.toFixed(1)}/${allowedDistance}`;

        // reflect only velocity directed into THIS side of the rim!
        const normalSpeed = velX * nx + velY * ny;
        const movingIntoWall = onOutside ? normalSpeed > 0 : normalSpeed < 0;
        if (movingIntoWall) {
          let impact = -normalSpeed;
          const tangentSpeed = Math.abs(-velX * ny + velY * nx);
          const rotating = tangentSpeed > 0.6 && tangentSpeed > impact;
          const vInput = Input.getVertical();
          const b = baseBounce * (vInput + 1) + upgrades.spring * 0.08;
          velX -= (1 + b) * normalSpeed * nx;
          velY -= (1 + b) * normalSpeed * ny - (vInput === 1 ? 1 : 0);
          if (vInput === 1) velY = Math.max(velY, 2);
          if (rotating) {
            rewardedCircleContacts.add(item);
            pendingParticleSpawns.push({
              x: xyr[0] + nx * xyr[2],
              y: xyr[1] + ny * xyr[2],
              rotating: true,
            });
          } else if (impact >= 1.5 && !rewardedCircleContacts.has(item)) {
            rewardedCircleContacts.add(item);
            pendingParticleSpawns.push({
              x: xyr[0] + nx * xyr[2],
              y: xyr[1] + ny * xyr[2],
              rotating: false,
            });
            impact = Math.round(impact * impact);
            currency += Math.round(impact * 2 ** upgrades.payout);

            // break obstacle
            MAP.forEach((obstacle) => {
              if (obstacle.type !== "obstacle") return;
              const [x, y, width, height] = obstacle.xywh!;
              const edgeX = xyr[0] + nx * xyr[2];
              const edgeY = xyr[1] + ny * xyr[2];
              if (
                edgeX >= x &&
                edgeX <= x + width &&
                edgeY >= y &&
                edgeY <= y + height
              ) {
                const wasDestroyed = obstacle.currentP! >= obstacle.totalP!;
                obstacle.currentP = Math.min(
                  obstacle.totalP!,
                  obstacle.currentP! + impact,
                );
                if (!wasDestroyed && obstacle.currentP >= obstacle.totalP!) {
                  spawnOrbitBurst(x, y, width, height);
                }
              }
            });
          }
          // remove remaining residual motion so resting contact cannot jitter forever
          if (Math.hypot(velX, velY) < 0.01) velX = velY = 0;
        }
      }
    }
  });

  resolveObstacleCollisions();
  resolveSlopeCollisions();
  updateAreaFour();

  // rectangle marks corridor walls
  const playerY = -cameraY;
  MAP.forEach((item) => {
    if (item.type !== "rect" || !itemIsVisible(item)) return;
    const [x, y, width, height] = item.hitbox ?? item.xywh!;
    if (onSlope && width > height) return;
    const playerX = -cameraX;
    const insideCircle = MAP.some((circleItem) => {
      if (circleItem.type !== "circle" || !itemIsVisible(circleItem))
        return false;
      const [cx, cy, radius] = circleItem.xyr!;
      return Math.hypot(playerX - cx, playerY - cy) < radius + playerR;
    });
    if (insideCircle) return;
    if (width > height) {
      if (
        Math.max(playerX, oldPlayerX) + playerR <= x ||
        Math.min(playerX, oldPlayerX) - playerR >= x + width
      )
        return;
      const minY = y + playerR;
      const maxY = y + height - playerR;
      if (playerY < minY && oldPlayerY >= minY) {
        const before = cameraY;
        cameraY = -minY;
        lastCorrection = Math.abs(cameraY - before);
        velY = -Math.abs(velY) * baseBounce;
        lastPhysicsEvent = "corridor ceiling bounce";
      } else if (playerY > maxY && oldPlayerY <= maxY) {
        const before = cameraY;
        cameraY = -maxY;
        lastCorrection = Math.abs(cameraY - before);
        velY = Math.abs(velY) * baseBounce;
        lastPhysicsEvent = "corridor floor bounce";
      }
    } else {
      if (
        Math.max(playerY, oldPlayerY) + playerR <= y ||
        Math.min(playerY, oldPlayerY) - playerR >= y + height
      )
        return;
      const minX = x + playerR;
      const maxX = x + width - playerR;
      if (playerX < minX && oldPlayerX >= minX) {
        const before = cameraX;
        cameraX = -minX;
        lastCorrection = Math.abs(cameraX - before);
        velX = -Math.abs(velX) * 0.6;
        velY = Math.max(velY, shaftVerticalBoost);
        lastPhysicsEvent = "corridor left wall bounce";
      } else if (playerX > maxX && oldPlayerX <= maxX) {
        const before = cameraX;
        cameraX = -maxX;
        lastCorrection = Math.abs(cameraX - before);
        velX = Math.abs(velX) * 0.6;
        velY = Math.max(velY, shaftVerticalBoost);
        lastPhysicsEvent = "corridor right wall bounce";
      }
    }
  });

  // if the player is really far reset
  if (cameraX * cameraX + cameraY * cameraY >= 2000000) cameraY = cameraX = 0;
}

const images = [
  new Image(),
  new Image(),
  new Image(),
  new Image(),
  new Image(),
  new Image(),
  new Image(),
];
images[0].src = "0.png";
images[1].src = "1.png";
images[2].src = "2.png";
images[3].src = "3.png";
images[4].src = "4.png";
images[5].src = "5.png";
images[6].src = "6.png";

let currency = 0;
let currentColor: Number3D = [0, 0, 0];
const upgrades = { drive: 0, spring: 0, payout: 0, spin: 0 };
const currencyValue = document.getElementById("currency-value")!;
const shopPanel = document.getElementById("shop")!;
const progressPanel = document.getElementById("progress")!;
const showHitboxes = document.getElementById(
  "show-hitboxes",
) as HTMLInputElement;
const upgradeCosts = { drive: 20, spring: 30, payout: 40, spin: 25 };

function upgradeCost(name: keyof typeof upgrades) {
  if (name === "payout") return Math.ceil(upgradeCosts.payout * 2.4 ** upgrades.payout);
  return upgradeCosts[name] * (upgrades[name] + 1);
}

function refreshShop() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-upgrade]")
    .forEach((button) => {
      const name = button.dataset.upgrade as keyof typeof upgrades;
      const cost = upgradeCost(name);
      button.disabled = currency < cost;
      const label = button.dataset.label;
      button.textContent = `${label} (Lv ${upgrades[name]}) — ${cost}`;
    });
  currencyValue.textContent = String(currency);
}

document
  .querySelectorAll<HTMLButtonElement>("[data-upgrade]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.upgrade as keyof typeof upgrades;
      const cost = upgradeCost(name);
      if (currency < cost) return;
      currency -= cost;
      upgrades[name]++;
      refreshShop();
    });
  });

function updateShopVisibility(playerX: number, playerY: number) {
  const shop = MAP.find((item) => item.openings?.length);
  const opening = shop?.openings?.[0];
  if (!opening) {
    shopPanel.hidden = true;
    return;
  }
  const [x, y, width] = opening;
  shopPanel.hidden = !(
    playerX >= x + playerR &&
    playerX <= x + width - playerR &&
    playerY >= y + playerR
    // this condition is unneeded, so the player can upgrade even when super low (intentional "bug")
    // playerY <= y + height - playerR
  );
}

function draw(delta: number) {
  while (pendingParticleSpawns.length > 0) {
    const spawn = pendingParticleSpawns.shift()!;
    spawnParticles(spawn.x, spawn.y, spawn.rotating);
  }
  ctx.save();
  ctx.resetTransform();
  setColor(
    (currentColor[0] * (2000000 - cameraX * cameraX + cameraY * cameraY)) /
      2000000,
    currentColor[1],
    currentColor[2],
  );
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const diff = delta - lastTime;
  lastTime = delta;

  accum += Math.min(Math.max(diff, 0), 100);
  while (accum >= fixedStep) {
    accum -= fixedStep;
    update();
  }

  ctx.save();

  ctx.translate(cameraX, cameraY);
  particles.forEach((p) => {
    const fade = p.opacity * (1 - p.age / p.frames);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    setColor(
      1.0,
      currentColor[1] || 0.2,
      currentColor[2] + p.hueOffset + 40 * Math.sin(delta * 0.004),
      fade,
    );
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });
  orbitParticles.forEach((p) => {
    const fade = 1 - p.age / p.frames;
    const x = p.x + Math.cos(p.angle) * p.radius;
    const y = p.y + Math.sin(p.angle) * p.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle + Math.PI / 4);
    setColor(0.82, 0.22, p.hue, fade);
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });

  // test grid
  // setColor(0.8, 0, 0, 0.2);
  // for (let i = -100.5; i < 100; i += 10) {
  //   ctx.fillRect(-100, i, 200, 1);
  //   ctx.fillRect(i, -100, 1, 200);
  // }

  // render
  let text = "<hr><b>Progress values:</b><br>";
  MAP.forEach(function (item) {
    if (item.type === "obstacle") {
      setShadow(50, ...item.lch);
      setColor(...item.lch, 1 - item.currentP! / item.totalP!);
      ctx.fillRect(...item.xywh!);
      setShadow(0);
      // sum += item.forceHad!;
      text += item.currentP! + "/" + item.totalP + "<br>";
    } else if (item.type === "slope") {
      if (!itemIsVisible(item)) return;
      const [x1, y1, x2, y2] = item.line!;
      ctx.save();
      setShadow(14, ...item.lch);
      ctx.strokeStyle = `oklch(${item.lch[0]} ${item.lch[1]} ${item.lch[2]} / 0.9)`;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    } else if (item.type === "rect") {
      if (!itemIsVisible(item)) return;
      const [x, y, width, height] = item.xywh!;
      setShadow(14, ...item.lch);
      setColor(...item.lch, 0.82);
      if (width > height) {
        ctx.fillRect(x, y, width, 3.6);
        ctx.fillRect(x, y + height - 3.6, width, 3.6);
      } else {
        ctx.fillRect(x, y, 3.6, height);
        ctx.fillRect(x + width - 3.6, y, 3.6, height);
      }
      // Ladder rungs, evenly spaced along the shaft.
      for (let i = 1; i <= (item.rungs ?? 0); i++) {
        const t = i / (item.rungs! + 1);
        if (width > height) ctx.fillRect(x + width * t - 1, y, 2, height);
        else ctx.fillRect(x, y + height * t - 1, width, 2);
      }
      setShadow(0);
      if (showHitboxes.checked) {
        const [hitX, hitY, hitWidth, hitHeight] = item.hitbox ?? item.xywh!;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 80, 220, 0.95)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        if (hitWidth > hitHeight) {
          ctx.moveTo(hitX, hitY);
          ctx.lineTo(hitX + hitWidth, hitY);
          ctx.moveTo(hitX, hitY + hitHeight);
          ctx.lineTo(hitX + hitWidth, hitY + hitHeight);
        } else {
          ctx.moveTo(hitX, hitY);
          ctx.lineTo(hitX, hitY + hitHeight);
          ctx.moveTo(hitX + hitWidth, hitY);
          ctx.lineTo(hitX + hitWidth, hitY + hitHeight);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  });
  let color: Number3D | null = null;
  const player: Number3D = [-cameraX, -cameraY, playerR];
  MAP.forEach(function (item) {
    if (item.type === "circle") {
      if (!itemIsVisible(item)) return;
      const xyr = item.xyr!;
      const [cx, cy, radius] = xyr;
      startCircle();
      circle(cx, cy, radius);
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.3,
        radius * 0.05,
        cx,
        cy,
        radius * 1.05,
      );
      gradient.addColorStop(
        0,
        `oklch(${Math.min(0.48, item.lch[0] + 0.08)} ${item.lch[1] * 0.72} ${item.lch[2] + 20 + 40 * Math.sin(accum * 0.001)} / 0.96)`,
      );
      gradient.addColorStop(
        1,
        `oklch(${Math.max(0.16, item.lch[0] - 0.08)} ${item.lch[1]} ${item.lch[2]} / 0.98)`,
      );
      ctx.fillStyle = gradient;
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < 6; i++) {
        const imageIndex = 5 - i;
        if (item.visibleAfter && (imageIndex === 2 || imageIndex === 4)) {
          continue;
        }
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.translate(cx, cy);
        ctx.rotate(
          ((i % 2 === 0 ? 1 : -1.2) * (Math.pow(i + 0.3, 0.7) * lastTime)) /
            1000,
        );
        ctx.drawImage(
          images[imageIndex],
          -radius,
          -radius,
          2 * radius,
          2 * radius,
        );
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius - circleRimThickness / 2, 0, Math.PI * 2);
      ctx.strokeStyle = `oklch(${Math.min(0.8, item.lch[0] + 0.22)} ${item.lch[1] * 0.55} ${item.lch[2]} / 0.28)`;
      ctx.lineWidth = circleRimThickness;
      ctx.stroke();
      ctx.restore();

      if (showHitboxes.checked) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - circleRimThickness - playerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, radius + playerR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 80, 220, 0.95)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        ctx.stroke();

        // The upgrade trigger uses this side opening and stays active below it.
        // Show its full, tall activation area in orange alongside the regular hitboxes.
        if (item.openings?.length) {
          const [openingX, openingY, openingWidth] = item.openings[0];
          const triggerTop = openingY + playerR;
          const triggerHeight = 2000;
          ctx.strokeStyle = "rgba(255, 145, 0, 0.98)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            openingX + playerR,
            triggerTop,
            openingWidth - playerR * 2,
            triggerHeight,
          );
        }
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `bold ${radius * 0.32}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label ?? (item.visibleAfter ? "2" : "1"), cx, cy);
      ctx.restore();
      // does guy touch this shape?
      if (color === null) {
        const xyr = item.xyr!;
        const dx = player[0] - xyr[0];
        const dy = player[1] - xyr[1];
        const distance = Math.hypot(dx, dy);
        const maxDistance = xyr[2] - player[2];
        if (distance < maxDistance) {
          color = [item.lch[0] * 0.4, item.lch[1] * 0.7, item.lch[2]];
        }
      }
    }
  });

  if (color !== null)
    currentColor = currentColor.map(
      (t, i) => t * 0.98 + color![i] * 0.02,
    ) as Number3D;
  const spinRoom = MAP.find((item) => item.id === "spin-room");
  if (spinRoom && spinRoom.currentP! < spinRoom.totalP!) {
    text += `spin ${Math.round((100 * spinRoom.currentP!) / spinRoom.totalP!)}%<br>`;
  }
  progressPanel.innerHTML = text;
  updateShopVisibility(-cameraX, -cameraY);
  refreshShop();

  ctx.restore();

  startCircle();
  circle(0, 0, playerR);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, playerR);
  gradient.addColorStop(
    0,
    `oklch(0.7 0.2 ${currentColor[2] + Math.sin(delta * 0.003) * 20}`,
  );
  gradient.addColorStop(
    1,
    `oklch(0.5 0.2 ${currentColor[2] + Math.sin(delta * 0.003) * 20}`,
  );
  ctx.fillStyle = gradient;
  ctx.closePath();
  ctx.fill();

  requestAnimationFrame(draw);
}

draw(0);
