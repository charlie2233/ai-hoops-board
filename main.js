// AI 战术板 · Step 1 MVP
// 功能：半场/全场绘制；攻防棋子拖拽；跑位虚线、传球箭头；撤销/重做；导出PNG（水印）
import { getPreset } from './plays/presets.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const applied = { id: null, name: null };

// 长按切换持球人
let longPressTimer = null;
let downPt = null;
const LONG_PRESS_MS = 600;   // 0.6s 触发


// —— 本地保存策略
const SAVE_KEY = 'boardState_v1';          // 保持原键名即可
const SAVE_SCHEMA = 1;                     // 数据结构版本号（升级结构就 +1）
const SAVE_TTL = 14 * 24 * 3600 * 1000;    // 保存有效期：14 天

const state = {
  court: 'half', // 'half' | 'full'
  mode: 'drag',  // 'drag' | 'run' | 'pass'
  players: [],   // {id, team:'O'|'D', x, y, ball?}
  shapes: [],    // {type:'run'|'pass', pts:[{x,y},...], color, dashed?}
  undoStack: [],
  redoStack: [],
  dragTarget: null,
  drawing: false,
  currentLine: null,
  dpi: window.devicePixelRatio || 1,
};

// 放在 state 定义后
const EXPORT_OPTS_KEY = 'exportOpts_v1';
state.exportOpts = (() => {
  try { return Object.assign({ hideDefense:false, bg:'court' }, JSON.parse(localStorage.getItem(EXPORT_OPTS_KEY) || '{}')); }
  catch(_) { return { hideDefense:false, bg:'court' }; }
})();
function saveExportOpts(){ localStorage.setItem(EXPORT_OPTS_KEY, JSON.stringify(state.exportOpts)); }


// UI
const $ = (id)=>document.getElementById(id);
const modeButtons = {
  drag: $('mode-drag'),
  run: $('mode-run'),
  pass: $('mode-pass'),
};
function setMode(m){
  state.mode = m;
  for (const k in modeButtons) modeButtons[k].classList.toggle('active', k===m);
}
modeButtons.drag.onclick=()=>setMode('drag');
modeButtons.run.onclick=()=>setMode('run');
modeButtons.pass.onclick=()=>setMode('pass');
$('undo').onclick=()=>undo();
$('redo').onclick=()=>redo();
$('clear').onclick=()=>{ pushUndo(); state.shapes=[]; draw(); };
$('toggle-court').onclick=()=>{ state.court = (state.court==='half'?'full':'half'); layoutPlayers(); draw(); };

$('export').onclick = async () => {
  const opts = await promptExportOptions();   // { bg:'court'|'white', hideDefense:boolean } | null
  if (!opts) return;                          // 取消
  exportPNG(opts);
};


// —— 橡皮擦：删除最近一条线
$('erase').onclick = () => {
  if (!state.shapes.length) return;
  pushUndo();
  state.shapes.pop();
  draw();
  toast('已删除最近一条线');
};


$('save').onclick = () => {
  const payload = {
    court: state.court,
    players: state.players,
    shapes: state.shapes,
    ts: Date.now(),
    schema: SAVE_SCHEMA
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  toast('已保存到本地');
};



$('load').onclick = () => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { toast('没有可载入的本地保存'); return; }
  try {
    const data = JSON.parse(raw);
    pushUndo();
    state.court  = data.court  ?? state.court;
    state.players= data.players ?? state.players;
    state.shapes = data.shapes  ?? [];
    //layoutPlayers(); // 兼容旧结构
    draw();
    toast('载入完成');
  } catch(e){
    toast('载入失败：数据损坏');
  }
};

// $('play').onclick = () => {//btnPlay.onclick = ()=>{
//   // 1) 未播放：可能是初始或“已结束待重播”
//   if(!state.replay.playing){
//     const ended = (state.replay.timeMs >= state.replay.durationMs) && state.replay.durationMs > 0;
//     if (ended) {               // 已结束 → 重播
//       setReplayTime(0);
//       startReplay();
//       btnPlay.textContent = '⏸ 暂停';
//       return;
//     }
//     // 初始播放
//     startReplay();
//     btnPlay.textContent = '⏸ 暂停';
//     return;
//   }

//   // 2) 播放中：切换 暂停/继续
//   if(state.replay.paused){
//     resumeReplay();
//     btnPlay.textContent = '⏸ 暂停';
//   }else{
//     pauseReplay();
//     btnPlay.textContent = '▶ 继续';
//   }
// };

$('play').onclick = () => {
  // 统一用回放控制条的按钮逻辑，避免重复状态机和未定义变量
  const bp = document.getElementById('btn-playpause');
  if (bp) bp.click();
};

setMode('drag');

// Init
function init(){
  resizeForDPI();
  seedPlayers();
  layoutPlayers();
  bindPointerEvents();
  draw();

  // —— 自动恢复（带过期/不兼容处理）
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const expired = !data.ts || Date.now() - data.ts > SAVE_TTL;
      const incompatible = data.schema !== SAVE_SCHEMA;
      if (expired || incompatible) {
        localStorage.removeItem(SAVE_KEY); // 过期或不兼容就直接清
      } else {
        state.court   = data.court   ?? state.court;
        state.players = data.players ?? state.players;
        state.shapes  = data.shapes  ?? [];
        draw();
      }
    }
  } catch(_) {}

  // 长按“清空”= 同时清除保存（隐性手势，不加按钮）
  bindLongPressClearSave();
}


function bindLongPressClearSave(){
  const el = $('clear');
  if (!el) return;
  let timer = null;
  const start = () => {
    timer = setTimeout(() => {
      localStorage.removeItem(SAVE_KEY);
      toast('已清除本地保存');
    }, 800); // 长按 0.8s 触发
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerdown', start);
  ['pointerup','pointercancel','pointerleave'].forEach(ev => el.addEventListener(ev, cancel));
}

function setBallHandler(p){
  state.players.forEach(x=>{ if (x.team==='O') x.ball = false; });
  p.ball = true;
  draw();
  toast('持球人：' + p.id);
}

function resizeForDPI(){
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const ratio = state.dpi;
  canvas.width = Math.round(cssW*ratio);
  canvas.height = Math.round(cssH*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
}

window.addEventListener('resize', ()=>{
  resizeForDPI();
  draw();
});

function seedPlayers(){
  state.players = [];
  // Offense 1-5 (blue solid)
  for (let i=1;i<=5;i++){
    state.players.push({id:String(i), team:'O', x:0, y:0, ball: i===1});
  }
  // Defense X1-X5 (red hollow)
  for (let i=1;i<=5;i++){
    state.players.push({id:'X'+i, team:'D', x:0, y:0});
  }
}

function layoutPlayers(){
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (state.court==='half'){
    // Place offense top half, defense near paint
    const ox = W*0.18, gap = W*0.13, y1 = H*0.65;
    for (let i=0;i<5;i++){
      state.players[i].x = ox + i*gap;
      state.players[i].y = y1 - (i%2)*H*0.08;
    }
    const dx = W*0.18, dgap = W*0.13, y2 = H*0.35;
    for (let i=0;i<5;i++){
      state.players[5+i].x = dx + i*dgap;
      state.players[5+i].y = y2 + (i%2)*H*0.08;
    }
  } else {
    // Full court distributed
    const cols = 5;
    const rowY = [H*0.28, H*0.72];
    for (let i=0;i<5;i++){
      state.players[i].x = (i+1)*(W/(cols+1));
      state.players[i].y = rowY[1];
      state.players[5+i].x = (i+1)*(W/(cols+1));
      state.players[5+i].y = rowY[0];
    }
  }
}

function drawCourt(){
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E5E7EB';

  if (state.court==='half'){
    // Half court: baseline at bottom, hoop at bottom center
    const centerX = W/2;
    // Outer boundary
    ctx.strokeRect(W*0.05, H*0.05, W*0.90, H*0.90);
    // Midline (top arc only for half)
    ctx.beginPath();
    ctx.arc(centerX, H*0.95, W*0.45, Math.PI, 0);
    ctx.stroke();
    // Three-point arc approx
    ctx.beginPath();
    ctx.arc(centerX, H*0.85, W*0.38, Math.PI*0.9, Math.PI*0.1);
    ctx.stroke();
    // Paint
    ctx.strokeRect(centerX - W*0.12, H*0.72, W*0.24, H*0.18);
    // Hoop
    ctx.beginPath(); ctx.arc(centerX, H*0.92, 9, 0, Math.PI*2); ctx.stroke();
    // Free throw circle
    ctx.beginPath(); ctx.arc(centerX, H*0.72, W*0.12, 0, Math.PI*2); ctx.stroke();
  }else {
    // ------- Full court：左右方向 -------
    const m = Math.min(W, H) * 0.05;
    const left   = m, right  = W - m;
    const top    = m, bottom = H - m;
    const cx = W / 2, cy = H / 2;

    // 外框
    ctx.strokeRect(left, top, right - left, bottom - top);

    // 中线 + 中圈
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.07, 0, Math.PI * 2); ctx.stroke();

    // 罚球区（左右各一个）
    const laneLen = (right - left) * 0.19;     // 由边线向内的长度
    const laneW   = (bottom - top) * 0.24;     // 罚球区宽度（竖向）
    ctx.strokeRect(left,            cy - laneW/2, laneLen,           laneW);  // 左
    ctx.strokeRect(right - laneLen, cy - laneW/2, laneLen,           laneW);  // 右
    // 罚球圈（完整圆，简化处理）
    ctx.beginPath(); ctx.arc(left  + laneLen,  cy, laneW/2, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(right - laneLen,  cy, laneW/2, 0, Math.PI*2); ctx.stroke();

    // 篮圈
    const rimR = 9;
    const hoopLx = left  + 18, hoopRx = right - 18;
    ctx.beginPath(); ctx.arc(hoopLx, cy, rimR, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(hoopRx, cy, rimR, 0, Math.PI*2); ctx.stroke();

    // 三分线（近角直线 + 弧线）
    const cornerXLeft  = left  + (right - left) * 0.13; // 可在 0.13~0.14 微调
    const cornerXRight = right - (right - left) * 0.13;
    
    // 近角直线（上下两段）
    ctx.beginPath(); ctx.moveTo(cornerXLeft, top);          ctx.lineTo(cornerXLeft, cy - laneW/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cornerXLeft, cy + laneW/2); ctx.lineTo(cornerXLeft, bottom);       ctx.stroke();
    
    ctx.beginPath(); ctx.moveTo(cornerXRight, top);          ctx.lineTo(cornerXRight, cy - laneW/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cornerXRight, cy + laneW/2); ctx.lineTo(cornerXRight, bottom);       ctx.stroke();
    
    // 弧线：用 acos(dx/r3) 计算夹角，避免 NaN
    const r3 = (right - left) * 0.39; // 三分弧半径（可在 0.37~0.41 微调）
    function arcByCorner(hoopX, hoopY, cornerX, side /* 'L' | 'R' */){
      const dx = Math.abs(cornerX - hoopX);
      const R  = Math.max(r3, dx + 1);  // 防止 dx>R
      const theta = Math.acos(dx / R);  // 0~π/2
      ctx.beginPath();
      if (side === 'L'){
        // 以左筐为圆心，朝右开口：-θ → +θ
        ctx.arc(hoopX, hoopY, R, -theta, theta);
      } else {
        // 以右筐为圆心，朝左开口：π-θ → π+θ
        ctx.arc(hoopX, hoopY, R, Math.PI - theta, Math.PI + theta);
      }
      ctx.stroke();
    }
    arcByCorner(hoopLx, cy, cornerXLeft,  'L');
    arcByCorner(hoopRx, cy, cornerXRight, 'R');

  }

  ctx.restore();
}

function drawPlayers(opts = {}){
  const hideDefense = !!opts.hideDefense;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const R = Math.max(16, Math.min(W,H)*0.028);
  state.players.forEach(p=>{
    if (hideDefense && p.team === 'D') return;
    ctx.save();
    if (p.team==='O'){
      ctx.fillStyle = '#2563EB'; // blue solid
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI*2); ctx.fill();
      if (p.ball){
        ctx.fillStyle = '#FF7A1A';
        ctx.beginPath(); ctx.arc(p.x+R*0.6, p.y-R*0.6, R*0.35, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(R)}px system-ui`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.id, p.x, p.y);
    } else {
      ctx.strokeStyle = '#DC2626'; // red hollow
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#DC2626';
      ctx.font = `bold ${Math.floor(R)}px system-ui`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.id, p.x, p.y+1);
    }
    ctx.restore();
  });
}

function drawShapes(){
  state.shapes.forEach(s=>{
    if (s.type==='run'){
      drawPolyline(s.pts, '#F59E0B', true); // dashed orange
    } else if (s.type==='pass'){
      drawArrow(s.pts[0], s.pts[s.pts.length-1], '#FF7A1A'); // solid orange
    }
  });
  // current drawing
  if (state.currentLine){
    if (state.currentLine.type==='run'){
      drawPolyline(state.currentLine.pts, '#F59E0B', true);
    } else {
      drawArrow(state.currentLine.pts[0], state.currentLine.pts[state.currentLine.pts.length-1], '#FF7A1A');
    }
  }
}
function spacingThresholdPx(){
  // 阈值≈短边的 9%，可微调
  return Math.min(canvas.clientWidth, canvas.clientHeight) * 0.09;
}

function drawSpacingAlerts(){
  const thr = spacingThresholdPx();
  const O = state.players.filter(p=>p.team==='O');
  for (let i=0;i<O.length;i++){
    for (let j=i+1;j<O.length;j++){
      const a = O[i], b = O[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < thr){
        const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
        const midx = (a.x+b.x)/2, midy = (a.y+b.y)/2;
        [a,b].forEach(p=>{
          ctx.save();
          ctx.strokeStyle = '#F87171';
          ctx.setLineDash([6,6]);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, R+8, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        });
        ctx.save();
        ctx.fillStyle = '#B91C1C';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('拉开', midx, midy);
        ctx.restore();
      }
    }
  }
}

function drawPolyline(pts, color, dashed=false){
  if (pts.length<2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  if (dashed) ctx.setLineDash([10,10]); else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function applyPlay(play){
  if (!play) return;
  pushUndo();

  // 1) 切换场地（不再调用 layoutPlayers，因为我们要用战术里的坐标）
  if (play.court === 'half' || play.court === 'full') {
    state.court = play.court;
  }

  // 2) 进攻 O1~O5（你的 O 是 1..5）
  if (Array.isArray(play.offense)){
    for (let i = 0; i < Math.min(5, play.offense.length); i++){
      const p = state.players[i];                 // 1..5
      const n = play.offense[i];                  // {x:0..1, y:0..1}
      if (p && n) {
        const px = normToPx(n);
        p.x = px.x; p.y = px.y;
      }
    }
  }

  // 3) 防守 X1~X5（你的 D 是 5..9 索引）
  if (Array.isArray(play.defense)){
    for (let i = 0; i < Math.min(5, play.defense.length); i++){
      const p = state.players[5 + i];             // X1..X5
      const n = play.defense[i];
      if (p && n) {
        const px = normToPx(n);
        p.x = px.x; p.y = px.y;
      }
    }
  }

  // 4) 线路（跑位/传球）
  if (Array.isArray(play.shapes)){
    state.shapes = play.shapes.map(s => {
      const pts = (s.pts || []).map(normToPx);
      return { type: s.type === 'pass' ? 'pass' : 'run', pts };
    });
  }

  // 5) 持球人（可选字段：ballHandler，取值 '1'..'5'）
  if (play.ballHandler){
    const id = String(play.ballHandler);
    state.players.forEach(x => { if (x.team==='O') x.ball = false; });
    const target = state.players.find(x => x.team==='O' && x.id === id);
    if (target) target.ball = true;
  }

  draw();
}


function drawArrow(p0, p1, color){
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
  // arrow head
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const len = 16;
  const a1 = {x: p1.x - len*Math.cos(ang - Math.PI/6), y: p1.y - len*Math.sin(ang - Math.PI/6)};
  const a2 = {x: p1.x - len*Math.cos(ang + Math.PI/6), y: p1.y - len*Math.sin(ang + Math.PI/6)};
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(a1.x, a1.y);
  ctx.lineTo(a2.x, a2.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw(opts = {}){
  const bg = opts.bg || 'court';
  const hideDefense = !!opts.hideDefense;

  if (bg === 'white'){
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H); ctx.restore();
  }else{
    drawCourt();
  }
  drawShapes();
  drawPlayers({ hideDefense });
  drawSpacingAlerts();
}



function getPointerPos(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left);
  const y = (e.clientY - rect.top);
  return {x,y};
}

function getCourtRect(){
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const m = Math.min(W, H) * 0.05; // 和 drawCourt 外框一致
  return { left: m, top: m, right: W - m, bottom: H - m, width: W - 2*m, height: H - 2*m };
}

function normToPx(pt){
  const r = getCourtRect();
  return {
    x: r.left + pt.x * r.width,
    y: r.top  + pt.y * r.height
  };
}


function nearestPlayer(pt){
  let hit=null, min=1e9;
  const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
  state.players.forEach(p=>{
    const d = Math.hypot(p.x-pt.x, p.y-pt.y);
    if (d< R*1.2 && d<min){ min=d; hit=p; }
  });
  return hit;
}

function bindPointerEvents(){
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);
}

function onDown(e){
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const pt = getPointerPos(e);
  if (state.mode==='drag'){
    const hit = nearestPlayer(pt);
    if (hit){ 
      state.dragTarget = hit;
      downPt = pt;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (hit.team === 'O') setBallHandler(hit);
      }, LONG_PRESS_MS);
    }
  } else {
    state.drawing = true;
    state.currentLine = { type: state.mode==='run'?'run':'pass', pts: [pt] };
  }
}

function onMove(e){
  // 鼠标松开不处理（但要先拿到pt用于长按判断也行）
  // 如果想保留这条，建议放到下面；先取 pt
  const pt = getPointerPos(e);

  // 拖动距离超过阈值则取消长按
  if (longPressTimer && downPt){
    const dx = pt.x - downPt.x, dy = pt.y - downPt.y;
    if (dx*dx + dy*dy > 16) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  if (!e.pressure && e.pointerType==='mouse' && e.buttons===0) return;

  if (state.mode==='drag'){
    if (state.dragTarget){
      state.dragTarget.x = pt.x; 
      state.dragTarget.y = pt.y;
      draw();
    }
  } else if (state.drawing){
    const last = state.currentLine.pts[state.currentLine.pts.length-1];
    const dx = pt.x - last.x, dy = pt.y - last.y;
    if (dx*dx + dy*dy > 16) { // reduce noisy points
      state.currentLine.pts.push(pt);
      draw();
    }
  }
}


function onUp(e){
  clearTimeout(longPressTimer); longPressTimer = null; downPt = null;
  if (state.mode==='drag'){
    state.dragTarget = null;
  } else if (state.drawing){
    state.drawing = false;
    if (state.currentLine && state.currentLine.pts.length>1){
      pushUndo();
      state.shapes.push(state.currentLine);
    }
    state.currentLine = null;
    draw();
  }
}

function pushUndo(){
  state.undoStack.push({
    shapes: JSON.parse(JSON.stringify(state.shapes))
  });
  if (state.undoStack.length>50) state.undoStack.shift();
  state.redoStack.length = 0;
}
function undo(){
  if (!state.undoStack.length) return;
  const last = state.undoStack.pop();
  state.redoStack.push({ shapes: JSON.parse(JSON.stringify(state.shapes)) });
  state.shapes = last.shapes;
  draw();
}
function redo(){
  if (!state.redoStack.length) return;
  const next = state.redoStack.pop();
  state.undoStack.push({ shapes: JSON.parse(JSON.stringify(state.shapes)) });
  state.shapes = next.shapes;
  draw();
}
//导出png
function exportPNG(opts = { bg:'court', hideDefense:false }){

  // 显式打开平滑（尤其白底导出）
  if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
  // 用本次选择渲染一帧
  draw({ bg: opts.bg, hideDefense: opts.hideDefense });

  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.save();

  // ===== 左上角标题块 & 右下水印（保留你现有的样式）=====
  const title = applied.name ? `战术：${applied.name}` : '战术：未命名';
  const meta  = `${state.court==='half'?'半场':'全场'} · ${new Date().toLocaleString()}`;

  ctx.font = 'bold 14px system-ui';
  const tW = ctx.measureText(title).width;
  ctx.font = '12px system-ui';
  const mW = ctx.measureText(meta).width;
  const boxW = Math.max(tW, mW) + 24;
  const boxH = 46, pad = 12;

  roundRect(ctx, pad, pad, boxW, boxH, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#FF7A1A'; ctx.stroke();

  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px system-ui'; ctx.fillText(title, pad + 12, pad + 18);
  ctx.font = '12px system-ui';      ctx.fillText(meta,  pad + 12, pad + 36);

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = 'bold 14px system-ui';
  ctx.fillText(`AI 战术板 • ${new Date().toLocaleString()}`, W - 220, H - 12);

  ctx.restore();

  // 下载
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL; a.download = (applied.name || 'play') + '.png';
  a.click();

  // 恢复到正常预览
  draw();
}


// 小工具：圆角矩形
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function promptExportOptions(){
  return new Promise((resolve)=>{
    // 遮罩
    const ov = document.createElement('div');
    ov.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:2000;
      display:flex;align-items:center;justify-content:center;padding:16px;`;

    // 弹窗
    const box = document.createElement('div');
    box.style.cssText = `
      width: min(92vw, 420px); background:#fff; border:1px solid #E5E7EB; border-radius:14px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18); font:14px/1.5 system-ui; color:#0F172A;`;
    box.innerHTML = `
      <div style="padding:14px 16px; border-bottom:1px solid #E5E7EB; font-weight:700;">导出选项</div>
      <div style="padding:16px;">
        <div style="margin-bottom:12px; font-weight:600;">背景</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <input type="radio" name="bg" value="court" checked>
          <span>球场背景（默认）</span>
        </label>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
          <input type="radio" name="bg" value="white">
          <span>白底（适合讲解/打印）</span>
        </label>

        <div style="margin-bottom:12px; font-weight:600;">显示内容</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <input type="radio" name="vis" value="all" checked>
          <span>进攻 + 防守（默认）</span>
        </label>
        <label style="display:flex;gap:8px;align-items:center;">
          <input type="radio" name="vis" value="atk">
          <span>仅进攻（隐藏 X1–X5）</span>
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #E5E7EB;">
        <button data-act="cancel" style="height:40px;padding:0 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;">取消</button>
        <button data-act="ok"     style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#FF7A1A;color:#fff;font-weight:700;">导出</button>
      </div>
    `;
    ov.appendChild(box);
    document.body.appendChild(ov);

    const close = () => ov.remove();
    box.querySelector('[data-act="cancel"]').onclick = () => { close(); resolve(null); };
    box.querySelector('[data-act="ok"]').onclick = () => {
      const bg  = box.querySelector('input[name="bg"]:checked').value;
      const vis = box.querySelector('input[name="vis"]:checked').value;
      close();
      resolve({ bg, hideDefense: vis === 'atk' });
    };
    // 点击遮罩关闭
    ov.addEventListener('pointerdown', (e)=>{ if (e.target === ov){ close(); resolve(null); } }, true);
  });
}


init();
readAppliedPlay();   // 启动时尝试接收 Library 的“应用”指令


async function readAppliedPlay(){
  // 1) 读取来源：URL ?apply=XXX 优先，其次 localStorage
  const urlId = new URLSearchParams(location.search).get('apply');
  const lsId  = localStorage.getItem('applyPlayId');
  const idRaw = (urlId || lsId || '').trim();
  if (!idRaw) return;

  // 可选：大小写/空白规整（保持原样匹配 + 降级匹配）
  const norm = s => (s || '').toString().trim();
  const same = (a,b) => norm(a) === norm(b);

  const applyFromGeometry = (geom, label) => {
    if (geom) {
      applyPlay(geom);
      toast(`已应用：${applied.name}（${label}）`);
    } else {
      toast('未找到战术几何，已保持当前布置');
    }
  };

  try {
    const url = './plays/plays.json?t=' + Date.now(); // 防缓存
    const res = await fetch(url, { cache: 'no-store' });
    const list = await res.json();

    // 2) 精确找 + 宽松找（id 完整匹配，找不到再尝试忽略大小写）
    let p = list.find(x => same(x.id, idRaw));
    if (!p) {
      const idLower = idRaw.toLowerCase();
      p = list.find(x => (x.id || '').toString().toLowerCase() === idLower);
    }

    applied.id = idRaw;
    applied.name = (p && (p.name || p.id)) || idRaw;

    // 3) 选择几何来源优先级：
    //    JSON.geometry > JSON.(offense/shapes) > JSON.(preset|presetId|alias) > 预设(getPreset(id)) > fiveOut
    let geom = null;

    if (p) {
      if (p.geometry) {
        geom = p.geometry;
      } else if (p.offense || p.shapes) {
        geom = p; // 直接用条目本身当几何
      } else if (p.preset || p.presetId || p.alias) {
        const pid = p.preset || p.presetId || p.alias;
        geom = getPreset(pid) || null;
      }
    }

    if (!geom) geom = getPreset(idRaw) || null;        // 与 presets 名称直接对齐
    if (!geom) geom = getPreset('fiveOut');            // 兜底

    // 4) 应用 + 提示来源
    const label = p
      ? ( (geom === p) ? 'JSON几何' :
          (p.geometry ? 'JSON.geometry' :
           (p.offense||p.shapes) ? 'JSON(简化)' : '预设(preset)') )
      : (geom === getPreset('fiveOut') ? '预设兜底' : '预设');

    applyFromGeometry(geom, label);

  } catch(e){
    // 网络/离线：预设兜底
    applied.id   = idRaw;
    applied.name = idRaw;
    const geom = getPreset(idRaw) || getPreset('fiveOut');
    applyFromGeometry(geom, '离线预设');
  } finally {
    localStorage.removeItem('applyPlayId'); // 用一次即清，避免误复用
  }
}




function toastAppliedIfAny(){
  if(!applied.id) return;
  const bar = document.createElement('div');
  bar.textContent = `已选择战术：${applied.name}（预览占位）`;
  bar.style.cssText = 'position:fixed;top:56px;left:0;right:0;z-index:999;background:#FFEDD5;color:#9A3412;padding:8px 12px;text-align:center;border-bottom:1px solid #FED7AA';
  document.body.appendChild(bar);
  setTimeout(()=>bar.remove(), 4000);
}

function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);'
    + 'background:#111;color:#fff;padding:8px 12px;border-radius:10px;z-index:999;opacity:.92';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1600);
}

// ===== 回放引擎 · Phase B =====
state.replay = { playing:false, paused:false, speed:1, startStamp:0, lastStamp:0,
  timeMs:0, durationMs:0, runs:[], passes:[], snapshot:null, flightBall:null };

const MOVE_SPEED = 320, PASS_SPEED = 900, BASE_DELAY = 600;

// Catmull-Rom 样条 & 折线工具
function catmullRom(a,b,c,d,t){const t2=t*t,t3=t2*t;return{
  x:0.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3),
  y:0.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3)};}
function sampleSpline(pts,n=64){ if(!pts||pts.length<3) return pts?.slice()||[];
  const r=[],L=pts.length; for(let i=0;i<L-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(L-1,i+2)];
    for(let k=0;k<(i<L-2?n:1?n:1);k++){const t=k/n; r.push(catmullRom(p0,p1,p2,p3,t));}} r.push(pts[L-1]); return r;}
function polyLength(pts){let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); return L;}
function polyLerp(pts,u){if(!pts||!pts.length)return{x:0,y:0}; if(pts.length===1)return pts[0];
  const tot=polyLength(pts); if(!tot) return pts[0]; let d=u*tot;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],seg=Math.hypot(b.x-a.x,b.y-a.y);
    if(d<=seg){const t=seg?d/seg:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}} d-=seg;} return pts.at(-1);}

// ===== 路径避障 v0：对 RUN 轨迹做轻微侧移，减少“穿人” =====
const PATHING_AVOIDANCE_KEY = 'pathingAvoidance';
state.pathingAvoidance = (() => {
  try { return JSON.parse(localStorage.getItem(PATHING_AVOIDANCE_KEY) || 'true'); }
  catch(_) { return true; }
})();
function setPathingAvoidance(on){
  state.pathingAvoidance = !!on;
  try { localStorage.setItem(PATHING_AVOIDANCE_KEY, JSON.stringify(state.pathingAvoidance)); } catch(_){}
}
function adjustPathForTeammates(pts, player, teammates, minGapPx){
  if (!state.pathingAvoidance) return pts;
  if (!pts || pts.length < 2) return pts;
  const out = pts.map(p => ({x:p.x, y:p.y}));
  const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
  const thr = Math.max(minGapPx || spacingThresholdPx()*0.65, R*1.2);

  // 最多两轮轻量侧移，保证性能
  for (let iter=0; iter<2; iter++){
    for (let i=0; i<out.length; i++){
      const p = out[i];
      for (const tm of teammates){
        if (tm.id === player.id) continue;
        const d = Math.hypot(p.x - tm.x, p.y - tm.y);
        if (d < thr){
          const nx = (p.x - tm.x) / (d || 1), ny = (p.y - tm.y) / (d || 1);
          const push = (thr - d) * 0.55;
          p.x += nx * push;
          p.y += ny * push;
        }
      }
    }
  }
  return out;
}


// 编译时间线（从 shapes 推出 runs/passes）
function compileTimeline(){
  const runs=[],passes=[],O=state.players.filter(p=>p.team==='O');

  // 最近进攻球员匹配器（沿用你现有逻辑）
  const nearest=pt=>O.reduce((m,p)=>{
    const d=Math.hypot(pt.x-p.x,pt.y-p.y);
    return(!m||d<m.d)?{p,d}:m
  },null)?.p;

  // RUN：样条平滑 → 可选避障 → 时长
  state.shapes.filter(s=>s.type==='run'&&s.pts?.length>=2).forEach(s=>{
    const player=nearest(s.pts[0]); if(!player) return;
    const smooth=sampleSpline(s.pts,64);
    // 基于当前帧队友位置做轻度避障
    const teammates = O; // 以 O 队友为参照
    const adjusted = adjustPathForTeammates(smooth, player, teammates);
    const dur=Math.max(0.2,polyLength(adjusted)/MOVE_SPEED);
    runs.push({player,pts:adjusted,t0:0,t1:dur*1000});
  });

  // PASS：按你的启发式生成
  let idx=0;
  state.shapes.filter(s=>s.type==='pass'&&s.pts?.length>=2).forEach(s=>{
    const a=s.pts[0],b=s.pts.at(-1),from=nearest(a),to=nearest(b); if(!from||!to) return;
    const dist=Math.hypot(b.x-a.x,b.y-a.y);
    const dur=Math.max(0.2,dist/PASS_SPEED);
    const t0=BASE_DELAY+idx*300;
    const arc=Math.max(28,Math.min(84,dist*0.18));
    passes.push({from,to,p0:a,p1:b,t0,dur:dur*1000,arc});
    idx++;
  });

  const durationMs=Math.max(
    runs.reduce((m,r)=>Math.max(m,r.t1),0),
    passes.reduce((m,p)=>Math.max(m,p.t0+p.dur),0)
  )||0;

  return {runs,passes,durationMs};
}


// 控制与定位
function startReplay(){
  state.replay.snapshot = {
    players: JSON.parse(JSON.stringify(state.players)),
    ballOwnerId: state.players.find(p=>p.team==='O'&&p.ball)?.id || null
  };
  canvas.style.pointerEvents='none';

  const tl = compileTimeline();
  state.replay.runs = tl.runs;
  state.replay.passes = tl.passes;
  state.replay.durationMs = Math.max(100, tl.durationMs);
  state.replay.timeMs = 0;
  state.replay.playing = true;
  state.replay.paused  = false;

  // 关键：默认 0.75×
  const sel = document.getElementById('speed');
  state.replay.speed = parseFloat((sel && sel.value) ? sel.value : '0.75');

  state.replay.startStamp = performance.now();
  state.replay.lastStamp  = state.replay.startStamp;

  const btn = document.getElementById('btn-playpause');
  if (btn) btn.textContent = '⏸ 暂停';

  requestAnimationFrame(tickReplay);
}

function stopReplay(restore = true){
  state.replay.playing = false;
  state.replay.paused  = false;
  canvas.style.pointerEvents = 'auto';

  if (restore && state.replay.snapshot){
    // 恢复到回放前的站位
    state.players = JSON.parse(JSON.stringify(state.replay.snapshot.players));
    state.players.forEach(p => p.ball = (p.team==='O' && p.id===state.replay.snapshot.ballOwnerId));
  }
  state.replay.flightBall = null;

  draw();

  const btn = document.getElementById('btn-playpause');
  if (btn) btn.textContent = '▶ 回放';         // 重置为“回放”
  const seek = document.getElementById('seek');
  if (seek) seek.value = 0;                     // 归零
  state.replay.timeMs = 0;                      // 内部时间也归零
}


function pauseReplay(){ state.replay.paused=true; }
function resumeReplay(){ state.replay.paused=false; state.replay.lastStamp=performance.now(); }
function setSpeed(k){ state.replay.speed=Math.max(0.25,Math.min(3,k||1)); }
function setReplayTime(ms){
  const t=Math.max(0,Math.min(state.replay.durationMs,ms|0)); state.replay.timeMs=t;
  state.replay.runs.forEach(r=>{const u=(t<r.t0)?0:(t>r.t1?1:(t-r.t0)/(r.t1-r.t0)); const pos=polyLerp(r.pts,Math.max(0,Math.min(1,u))); r.player.x=pos.x; r.player.y=pos.y;});
  state.players.forEach(p=>{if(p.team==='O') p.ball=false;}); state.replay.flightBall=null;
  let inFlight=null,lastDone=null; state.replay.passes.forEach(p=>{ if(t>=p.t0+p.dur) lastDone=p; else if(t>=p.t0&&t<p.t0+p.dur) inFlight=p;});
  if(inFlight){ const u=(t-inFlight.t0)/inFlight.dur,base=polyLerp([inFlight.p0,inFlight.p1],Math.max(0,Math.min(1,u))),arcY=-4*inFlight.arc*u*(1-u);
    state.replay.flightBall={x:base.x,y:base.y+arcY}; } else { const targetId=lastDone?lastDone.to.id:state.replay.snapshot.ballOwnerId;
    const holder=state.players.find(p=>p.team==='O'&&p.id===targetId); if(holder) holder.ball=true; }
  draw(); const s=document.getElementById('seek'); if(s) s.value=(t/state.replay.durationMs)*100;
}
function tickReplay(now){ if(!state.replay.playing) return;
  if(!state.replay.paused){ const dt=Math.min(50,now-state.replay.lastStamp); const next=state.replay.timeMs+dt*state.replay.speed;
    setReplayTime(next); state.replay.lastStamp=now; if(next>=state.replay.durationMs){ stopReplay(true); return; } }
  requestAnimationFrame(tickReplay);
}
// 包装 draw：回放时绘制飞行球
const _draw_replay_wrap = draw;
draw = function(opts={}){ _draw_replay_wrap(opts);
  if(state.replay&&state.replay.flightBall){ const b=state.replay.flightBall; ctx.save(); ctx.fillStyle='#FF7A1A';
    ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill(); ctx.restore(); } };
// 绑定 UI
(function(){ const $=id=>document.getElementById(id);
  const bp=$('btn-playpause'), bs=$('btn-stop'), seek=$('seek'), spd=$('speed');
  if(bp){ bp.onclick=()=>{ if(!state.replay.playing){ startReplay(); bp.textContent='⏸ 暂停'; return; }
    if(state.replay.paused){ resumeReplay(); bp.textContent='⏸ 暂停'; } else { pauseReplay(); bp.textContent='▶ 继续'; }};}
  if(bs){ bs.onclick=()=>stopReplay(); }
  if(seek){ seek.oninput=e=>{ if(!state.replay.playing){ const tl=compileTimeline(); state.replay.runs=tl.runs; state.replay.passes=tl.passes; state.replay.durationMs=Math.max(100,tl.durationMs); }
    setReplayTime((parseFloat(e.target.value||'0')/100)*state.replay.durationMs); }; }
  if(spd){ spd.onchange=e=>setSpeed(parseFloat(e.target.value||'1')); }
})();
