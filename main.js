// AI 战术板 · Step 1 MVP
// 功能：半场/全场绘制；攻防棋子拖拽；跑位虚线、传球箭头；撤销/重做；导出PNG（水印）

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const applied = { id: null, name: null };

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
$('export').onclick=()=>exportPNG();

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

setMode('drag');

// Init
function init(){
  resizeForDPI();
  seedPlayers();
  layoutPlayers();
  bindPointerEvents();
  draw();
-  try {
-    const raw = localStorage.getItem('boardState_v1');
-    if (raw) {
-      const data = JSON.parse(raw);
-      state.court  = data.court  ?? state.court;
-      state.players= data.players ?? state.players;
-      state.shapes  = data.shapes  ?? [];
-      draw();
-    }
-  } catch(_) {}
// +  // —— 自动恢复（带过期/不兼容处理）
// +  try {
// +    const raw = localStorage.getItem(SAVE_KEY);
// +    if (raw) {
// +      const data = JSON.parse(raw);
// +      const expired = !data.ts || Date.now() - data.ts > SAVE_TTL;
// +      const incompatible = data.schema !== SAVE_SCHEMA;
// +      if (expired || incompatible) {
// +        localStorage.removeItem(SAVE_KEY); // 过期或不兼容就直接清
// +      } else {
// +        state.court   = data.court   ?? state.court;
// +        state.players = data.players ?? state.players;
// +        state.shapes  = data.shapes  ?? [];
// +        draw();
// +      }
// +    }
// +  } catch(_) {}
// +
+  // 长按“清空”= 同时清除保存（隐性手势，不加按钮）
+  bindLongPressClearSave();
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
  } else {
    // Full court simplified
    ctx.strokeRect(W*0.05, H*0.05, W*0.90, H*0.90);
    // Mid court line
    ctx.beginPath(); ctx.moveTo(W*0.05, H*0.50); ctx.lineTo(W*0.95, H*0.50); ctx.stroke();
    // Two paints
    const laneW = W*0.24, laneH = H*0.18, cx=W/2;
    ctx.strokeRect(cx - laneW/2, H*0.05, laneW, laneH);
    ctx.strokeRect(cx - laneW/2, H*0.95 - laneH, laneW, laneH);
    // Hoops
    ctx.beginPath(); ctx.arc(cx, H*0.05 + 18, 9, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, H*0.95 - 18, 9, 0, Math.PI*2); ctx.stroke();
  }

  ctx.restore();
}

function drawPlayers(){
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const R = Math.max(16, Math.min(W,H)*0.028);
  state.players.forEach(p=>{
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

function draw(){
  drawCourt();
  drawShapes();
  drawPlayers();
}

function getPointerPos(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left);
  const y = (e.clientY - rect.top);
  return {x,y};
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
    if (hit){ state.dragTarget = hit; }
  } else {
    state.drawing = true;
    state.currentLine = { type: state.mode==='run'?'run':'pass', pts: [pt] };
  }
}

function onMove(e){
  if (!e.pressure && e.pointerType==='mouse' && e.buttons===0) return;
  const pt = getPointerPos(e);
  if (state.mode==='drag'){
    if (state.dragTarget){
      state.dragTarget.x = pt.x; state.dragTarget.y = pt.y;
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
function exportPNG(){
  // 确保画面是最新
  draw();

  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.save();

  // ===== 标题信息块（左上角）=====
  const title = applied.name ? `战术：${applied.name}` : '战术：未命名';
  const meta  = `${state.court==='half'?'半场':'全场'} · ${new Date().toLocaleString()}`;

  ctx.font = 'bold 14px system-ui';
  const tW = ctx.measureText(title).width;
  ctx.font = '12px system-ui';
  const mW = ctx.measureText(meta).width;
  const boxW = Math.max(tW, mW) + 24;
  const boxH = 46, pad = 12;

  // 背板 + 描边
  roundRect(ctx, pad, pad, boxW, boxH, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FF7A1A';
  ctx.stroke();

  // 文本
  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px system-ui';
  ctx.fillText(title, pad + 12, pad + 18);
  ctx.font = '12px system-ui';
  ctx.fillText(meta,  pad + 12, pad + 36);

  // ===== 右下角水印 =====
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = 'bold 14px system-ui';
  const stamp = new Date().toLocaleString();
  const mark = `AI 战术板 • ${stamp}`;
  ctx.fillText(mark, W - 220, H - 12);

  ctx.restore();

  // 导出当前画布
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL; a.download = (applied.name || 'play') + '.png';
  a.click();

  draw(); // 复原到无标题块的普通画面
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


init();

readAppliedPlay().then(()=> toastAppliedIfAny());

async function readAppliedPlay(){
  const id = localStorage.getItem('applyPlayId');
  if (!id) return;
  try {
    const res = await fetch('./plays/plays.json');
    const list = await res.json();
    const p = list.find(x=>x.id===id);
    applied.id = id;
    applied.name = p ? p.name : id;
  } catch(e){
    applied.id = id; applied.name = id;
  }
  localStorage.removeItem('applyPlayId'); // 用一次就清
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
