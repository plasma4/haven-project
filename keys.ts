export const Input = { init, getHorizontal, getVertical };
let left = 0,
  right = 0;
let up = 0,
  down = 0;
let iHorizontal = 0;
let iVertical = 0;
function init() {
  document.addEventListener("keydown", (e) => {
    if (!e.repeat) {
      if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") {
        left = ++iHorizontal;
      } else if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") {
        right = ++iHorizontal;
      } else if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") {
        up = ++iVertical;
      } else if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") {
        down = ++iVertical;
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!e.repeat) {
      if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") {
        left = 0;
      } else if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") {
        right = 0;
      } else if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") {
        up = 0;
      } else if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") {
        down = 0;
      }
    }
  });
}

function getHorizontal() {
  return left == right ? 0 : left < right ? -1 : 1;
}

function getVertical() {
  return up == down ? 0 : up < down ? -1 : 1;
}
