// plays/presets.js
// 0..1 归一化几何预设（半场），用于 Library→Board 一键应用兜底
// 提供：getPreset(id)；若请求 horns_R / horns_flare_R 且未定义，自动 mirrorX(对应 _L)

function p(x, y) { return { x, y }; }

// —— 镜像工具（沿竖直中线镜像 X 坐标）——
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

/** =========================
 * fiveOut（默认兜底）
 * 顶弧 + 两侧45 + 两底角；不预设线路，留给教练自由画
 * ========================= */
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
  shapes: []
};

/** =========================
 * Horns Left PnR（标准 5 设置右肘位掩护，1 往左用掩护，5 顺下）
 * - 4 左肘，5 右肘
 * - 1 用 5 的掩护向左肘方向推进
 * - 5 顺下，1 传 5
 * ========================= */
const horns_L = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.50, 0.55), // 1 顶弧
    p(0.20, 0.78), // 2 左底角牵制（稍更深以拉开）
    p(0.80, 0.78), // 3 右底角牵制
    p(0.38, 0.70), // 4 左肘
    p(0.62, 0.70)  // 5 右肘（设掩）
  ],
  defense: [
    p(0.50, 0.49),
    p(0.26, 0.72),
    p(0.74, 0.72),
    p(0.42, 0.66),
    p(0.58, 0.66)
  ],
  shapes: [
    // 1 运用 5 的掩护向左推进
    { type: 'run',  pts: [p(0.50,0.55), p(0.46,0.52), p(0.42,0.48), p(0.38,0.46)] },
    // 5 顺下（务必给 5 的 RUN，使回放引擎关联到 5）
    { type: 'run',  pts: [p(0.62,0.70), p(0.58,0.78), p(0.54,0.84), p(0.52,0.88)] },
    // 1 → 5 传球（顺下到篮筐附近）
    { type: 'pass', pts: [p(0.38,0.46), p(0.52,0.88)] }
  ]
};

/** =========================
 * Spain PnR（2 背掩 5，5 顺下；2 外弹）
 * - 5 高位设掩护；2 从背后给 5 背掩 → 外弹到右45
 * - 1 传 5（顺下）
 * ========================= */
const spain = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.52, 0.56), // 1 顶弧偏右
    p(0.36, 0.62), // 2 左45 将去背掩
    p(0.78, 0.78), // 3 右底角
    p(0.22, 0.78), // 4 左底角
    p(0.56, 0.72)  // 5 高位/罚球线附近
  ],
  defense: [
    p(0.50, 0.50),
    p(0.40, 0.60),
    p(0.72, 0.72),
    p(0.28, 0.72),
    p(0.56, 0.66)
  ],
  shapes: [
    // 2 上提背掩 5 → 外弹到右45
    { type: 'run',  pts: [p(0.36,0.62), p(0.50,0.70), p(0.64,0.58)] },
    // 5 顺下
    { type: 'run',  pts: [p(0.56,0.72), p(0.54,0.82), p(0.52,0.90)] },
    // 1 → 5 的顺下传球
    { type: 'pass', pts: [p(0.52,0.56), p(0.52,0.90)] }
  ]
};

/** =========================
 * Pistol（侧翼手递手 + Step-up）
 * - 1 把球运到右侧45；2 从右底角上提接手递手
 * - 5 上提做 step-up 掩护给 2，5 再短顺（或深顺）
 * - 示例包含：1→2 的 DHO（用 pass 表达），2→5 的顺下传球
 * ========================= */
const pistol = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.50, 0.55), // 1 顶弧
    p(0.84, 0.80), // 2 右底角
    p(0.18, 0.78), // 3 左底角牵制
    p(0.30, 0.72), // 4 左肘牵制/弱侧
    p(0.56, 0.72)  // 5 高位
  ],
  defense: [
    p(0.50, 0.49),
    p(0.78, 0.76),
    p(0.22, 0.72),
    p(0.34, 0.68),
    p(0.56, 0.66)
  ],
  shapes: [
    // 1 运到右45
    { type: 'run',  pts: [p(0.50,0.55), p(0.66,0.60)] },
    // 2 上提接手递手点
    { type: 'run',  pts: [p(0.84,0.80), p(0.70,0.63), p(0.66,0.60)] },
    // 1 → 2（手递手用 pass 表示）
    { type: 'pass', pts: [p(0.66,0.60), p(0.66,0.60)] },
    // 5 上提 step-up → 顺下
    { type: 'run',  pts: [p(0.56,0.72), p(0.62,0.66), p(0.60,0.82)] },
    // 2 → 5 顺下传球
    { type: 'pass', pts: [p(0.66,0.60), p(0.60,0.82)] }
  ]
};

/** =========================
 * Chicago（Pin-down → 接球 → 可接 DHO）
 * - 3 从左底角经 pin-down（用线路表示）上提到左45/顶弧
 * - 1 传 3，形成快速投篮或二次手递手
 * ========================= */
const chicago = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.52, 0.56), // 1 顶弧偏右
    p(0.82, 0.78), // 2 右底角牵制
    p(0.18, 0.80), // 3 左底角（受 pin-down 的人）
    p(0.34, 0.72), // 4 左侧挡人/掩护者（示意位置）
    p(0.60, 0.72)  // 5 高位/中轴
  ],
  defense: [
    p(0.50, 0.50),
    p(0.78, 0.74),
    p(0.22, 0.76),
    p(0.38, 0.68),
    p(0.60, 0.66)
  ],
  shapes: [
    // 3 经 pin-down 上提到左45 - 顶弧
    { type: 'run',  pts: [p(0.18,0.80), p(0.28,0.68), p(0.36,0.60), p(0.44,0.54)] },
    // 1 → 3 传球（形成快速出手/二次进攻）
    { type: 'pass', pts: [p(0.52,0.56), p(0.44,0.54)] }
  ]
};

/** =========================
 * Horns Flare Left（Horns 变体：4 给 2 做 Flare，1 可先用 5 掩护）
 * - 2 从左底角外弹到左翼/左45；4 提前到左肘做 flare 角度
 * - 1 也可先轻用 5 的掩护进入中路，再转移给 2
 * ========================= */
const horns_flare_L = {
  court: 'half',
  ballHandler: '1',
  offense: [
    p(0.50, 0.55), // 1 顶弧
    p(0.18, 0.80), // 2 左底角
    p(0.82, 0.78), // 3 右底角
    p(0.38, 0.70), // 4 左肘（flare 角度）
    p(0.62, 0.70)  // 5 右肘
  ],
  defense: [
    p(0.50, 0.49),
    p(0.24, 0.76),
    p(0.78, 0.74),
    p(0.42, 0.66),
    p(0.58, 0.66)
  ],
  shapes: [
    // 2 外弹到左翼/左45
    { type: 'run',  pts: [p(0.18,0.80), p(0.24,0.70), p(0.34,0.62)] },
    // 1 轻用 5 的掩护靠中路（可选，给回放更自然）
    { type: 'run',  pts: [p(0.50,0.55), p(0.56,0.52), p(0.50,0.50)] },
    // 1 → 2 转移
    { type: 'pass', pts: [p(0.50,0.50), p(0.34,0.62)] }
  ]
};

// —— 预设集合 ——
// （命名用 id 字符串，与你的 pages / 库对齐）
const PRESETS = {
  fiveOut,
  horns_L,
  spain,
  pistol,
  chicago,
  horns_flare_L
};

// —— 取预设（含镜像兜底）——
export function getPreset(id) {
  if (!id) return null;
  if (id === 'horns_R')           return mirrorX(horns_L);
  if (id === 'horns_flare_R')     return mirrorX(horns_flare_L);
  return PRESETS[id] || null;
}

export { PRESETS, mirrorX };
