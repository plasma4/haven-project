type Number3D = [number, number, number];
type Number4D = [number, number, number, number];
interface Shape {
  type: "circle" | "rect" | "obstacle" | "slope";
  lch: Number3D;
  id?: string;
  label?: string;

  xyr?: Number3D;
  opening?: Number4D;
  openings?: Number4D[];
  openingAfter?: string;
  visibleAfter?: string;
  hiddenAfter?: string;

  xywh?: Number4D;
  hitbox?: Number4D;
  rungs?: number;
  // [x1, y1, x2, y2] for slopes.
  line?: Number4D;
  currentP?: number;
  totalP?: number;
}

export const MAP: Shape[] = [
  {
    type: "circle",
    lch: [0.3, 0.25, 300],
    xyr: [0, 0, 50],
    opening: [-10, 32, 20, 32],
    openingAfter: "lower-gate",
  },
  {
    type: "circle",
    lch: [0.6853, 0.1846, 168.76],
    xyr: [0, 205, 62],
    opening: [-10, 139, 20, 26],
    openings: [[-82, 191, 42, 28]],
    visibleAfter: "lower-gate",
  },
  {
    type: "obstacle",
    id: "lower-gate",
    lch: [0.7, 0.25, 100],
    xywh: [-10, 45, 20, 10],
    currentP: 0,
    totalP: 0,
  },
  {
    type: "obstacle",
    id: "lower-gate",
    lch: [0.7, 0.25, 100],
    xywh: [-10, 45, 20, 40],
    currentP: 0,
    totalP: 20,
  },
  {
    type: "rect",
    lch: [0.7, 0.25, 200],
    xywh: [-10, 55, 20, 88],
    hitbox: [-10, 55, 20, 80],
    currentP: 0,
    totalP: 100,
  },
  {
    type: "rect",
    lch: [0.7, 0.25, 200],
    xywh: [-300, 191, 239.6, 28],
    hitbox: [-300, 191, 230, 28],
  },
  {
    type: "obstacle",
    id: "lowerer-gate",
    lch: [0.7, 0.25, 100],
    xywh: [-250, 310, 20, 1000],
    currentP: 0,
    totalP: 123.45,
  },
  {
    type: "rect",
    lch: [0.7, 0.25, 140],
    xywh: [-300, 300, 800, 28],
    hitbox: [-300, 300, 800, 28],
  },
  {
    type: "rect",
    lch: [0.4, 0.1, 20],
    xywh: [-300, 500, 1000, 28],
    hitbox: [-300, 500, 1000, 28],
  },
  {
    // ram from the lower corridor's floor down to the red corridor
    type: "slope",
    id: "gate-slope",
    lch: [0.7, 0.25, 140],
    line: [560, 326, -300, 520],
    hiddenAfter: "lowerer-gate",
  },
  {
    // new spin room; bottom opening is the ladder, gated by its own spin meter
    type: "circle",
    id: "spin-room",
    label: "3",
    lch: [0.45, 0.14, 20],
    xyr: [400, 514, 62],
    opening: [390, 548, 20, 32],
    openings: [[330, 500, 42, 28]],
    openingAfter: "spin-room",
    currentP: 0,
    totalP: 180,
  },
  {
    type: "rect",
    id: "ladder",
    lch: [0.6, 0.12, 60],
    xywh: [390, 576, 20, 274],
    hitbox: [390, 576, 20, 274],
    rungs: 10,
    visibleAfter: "spin-room",
  },
  {
    // basic of area 1 (same size and shaft), entered from the "ladder" above
    type: "circle",
    id: "area-4",
    label: "4",
    lch: [0.32, 0.22, 200],
    xyr: [400, 900, 50],
    opening: [390, 840, 20, 32],
    visibleAfter: "spin-room",
  },
  {
    type: "rect",
    lch: [0.7, 0.25, 300],
    xywh: [-300, 300, 1, 28],
    hitbox: [-300, 300, 1, 28],
  },
  {
    // prevent leave
    type: "rect",
    lch: [0.8, 0.25, 200],
    xywh: [-400, 700, 1, 28],
    hitbox: [400, 700, 1, 28],
  },
];
