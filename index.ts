/// <reference types="vite/client" />
import { Input } from "./keys.ts";
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
  ctx.scale(min / 200, min / 200);
  if (h > w) ctx.translate(100, 100 * (max / min));
  else ctx.translate(100 * (max / min), 100);
}

function circle(centerX: number, centerY: number, radius: number) {
  ctx.moveTo(centerX + radius, centerY);
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
}

function startCircle() {
  ctx.beginPath();
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

type Number2D = [number, number];
type Number3D = [number, number, number];
interface Shape {
  type: "circle" | "rect";
  lch: Number3D;

  xyr?: Number3D;
}
const MAP: Shape[] = [
  {
    type: "circle",
    lch: [0.7, 0.25, 300],
    xyr: [0, 0, 50],
  },
];

const logicFPS = 60;
const playerShape: Number3D = [0, 0, 10];
const bounceMult = 0.9,
  gravity = 0.2;
let lastTime = 0,
  accum = 0;
let speed = 0,
  accelX = 0,
  accelY = 0,
  velX = 0,
  velY = 0,
  cameraX = 0,
  cameraY = 0;
function update() {
  speed = 20 / logicFPS;
  accelX = 10 * speed * Input.getHorizontal();
  // accelY = speed * Input.getVertical();
  accelY = -gravity;
  const friction = 1.0 - 0.3 ** (1 / logicFPS);
  velX = accelX + velX * friction;
  velY = accelY + velY * (1.0 - friction);
  cameraX += velX;
  cameraY += velY;
}

function isPartiallyInsideDist(big: Number3D, small: Number3D) {
  const distSq =
    (big[0] - small[0]) * (big[0] - small[0]) +
    (big[1] - small[1]) * (big[1] - small[1]);
  return Math.sqrt(distSq) + small[2] * 2 - big[2];
}

function uninscribedContactAngle(big: Number3D, small: Number3D) {
  const distSq =
    (big[0] - small[0]) * (big[0] - small[0]) +
    (big[1] - small[1]) * (big[1] - small[1]);
  if (Math.sqrt(distSq) + small[2] > big[2]) {
    return Math.atan2(small[1] - big[1], small[0] - big[0]);
  }
  return null;
}

function draw(delta: number) {
  ctx.save();
  ctx.resetTransform();
  ctx.clearRect(0, 0, w, h);
  ctx.restore();

  const diff = delta - lastTime;
  lastTime = delta;

  accum += Math.min(diff, 100);
  const sub = 1000 / logicFPS;
  while (accum > 0) {
    accum -= sub;
    update();
  }

  ctx.save();

  // locate closest background item
  // TODO

  // test grid
  ctx.translate(cameraX + (velX * accum) / sub, cameraY + (velY * accum) / sub);
  setColor(0.8, 0, 0, 0.2);
  for (let i = -100.5; i < 100; i += 10) {
    ctx.fillRect(-100, i, 200, 1);
    ctx.fillRect(i, -100, 1, 200);
  }

  const player: Number3D = [
    playerShape[0] - cameraX,
    playerShape[1] - cameraY,
    playerShape[2],
  ];

  // DRAW MAP
  MAP.forEach(function (item) {
    if (item.type === "circle") {
      const xyr = item.xyr!;
      startCircle();
      circle(...xyr!);
      fill(...item.lch, 0.3);
      const d = isPartiallyInsideDist(xyr!, player);
      if (d > 0) {
        const contact = uninscribedContactAngle(xyr!, player);

        if (contact !== null) {
          // set the circle to be exactly on the edge + small dist away
          // player is -camera
          cameraX = -xyr[0] - Math.cos(contact) * (xyr[2] - player[2] - 0.0001);
          cameraY = -xyr[1] - Math.sin(contact) * (xyr[2] - player[2] - 0.0001);
          velX *= -bounceMult;
          velY *= -bounceMult;
          // accelX *= -bounceMult;
          // accelY *= -bounceMult;
        }
      }
    }
  });

  ctx.restore();

  startCircle();
  circle(0, 0, 10);

  fill(0.7, 0.25, delta * 0.03);

  requestAnimationFrame(draw);
}

draw(0);
