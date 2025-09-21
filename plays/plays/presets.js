// plays/presets.js
// 0..1 归一化几何预设（半场），用于 Library→Board 一键应用兜底
// 提供：getPreset(id)；若请求 horns_R 且未定义，自动 mirrorX(horns_L)

function p(x, y) { return { x, y }; }

function mirrorXPoint(pt) { return { x: 1 - pt.x, y: pt.y }; }
function mirrorX(geom) {
  if (!geom) return null;
  const m = (arr = []) => arr.map(mirrorXPoint);
  const ms = (shapes = []) => shapes.map(s => ({
    type: s.type,
    pts: (s.pts || []).map(mirrorXPoint)
  }));
  return {
    court: geom.court,
    ballHandler: geom.ballHandler,
    offense: m(geom.offense),
    defense: m(geom.defense),
    shapes:  ms(geom.shapes)
  };
}

// ---- fiveOut（默认退路）----
const fiveOut = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.50, 0.55), // 1 顶弧
    p(0.72, 0.62), // 2 右45
    p(0.28, 0.62), // 3 左45
    p(0.82, 0.78), // 4 右底角
    p(0.18, 0.78)  // 5 左底角
  ],
  defense: [
    p(0.50, 0.49),
    p(0.68, 0.58),
    p(0.32, 0.58),
    p(0.78, 0.72),
    p(0.22, 0.72)
  ],
  shapes: [] // 基线阵无预设线路
};

// ---- Horns Left PnR（5 在右肘设掩护，1 往左用掩）----
const horns_L = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.50, 0.55), // 1 顶弧
    p(0.20, 0.72), // 2 左底角牵制
    p(0.80, 0.72), // 3 右底角牵制
    p(0.38, 0.70), // 4 左肘
    p(0.62, 0.70)  // 5 右肘（设掩）
  ],
  defense: [
    p(0.50, 0.49),
    p(0.26, 0.69),
    p(0.74, 0.69),
    p(0.42, 0.66),
    p(0.58, 0.66)
  ],
  shapes: [
    // 1 运用掩护向左肘方向
    { type: 'run',  pts: [p(0.50,0.55), p(0.46,0.50), p(0.42,0.46), p(0.38,0.44)] },
    // 1 → 5 顺下（示意传球）
    { type: 'pass', pts: [p(0.38,0.44), p(0.52,0.80)] }
  ]
};

// ---- Spain PnR（2 背掩 5，5 顺下；2 外弹）----
const spain = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.52, 0.56), // 1 顶弧偏右
    p(0.36, 0.62), // 2 左45 将去背掩
    p(0.78, 0.70), // 3 右底角
    p(0.22, 0.70), // 4 左底角
    p(0.56, 0.72)  // 5 高位/罚球线附近
  ],
  defense: [
    p(0.50, 0.50),
    p(0.40, 0.58),
    p(0.72, 0.66),
    p(0.28, 0.66),
    p(0.56, 0.66)
  ],
  shapes: [
    // 2 上提背掩 5 → 外弹到右45
    { type: 'run',  pts: [p(0.36,0.62), p(0.50,0.70), p(0.64,0.60)] },
    // 1 → 5 顺下的传球
    { type: 'pass', pts: [p(0.52,0.56), p(0.56,0.82)] }
  ]
};

const PRESETS = { fiveOut, horns_L, spain };

export function getPreset(id) {
  if (!id) return null;
  if (id === 'horns_R') return mirrorX(horns_L);
  return PRESETS[id] || null;
}

export { PRESETS, mirrorX };
