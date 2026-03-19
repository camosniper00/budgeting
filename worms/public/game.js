'use strict';

// ─── Constants (mirror server) ────────────────────────────────────────────────
const W = 1200, H = 600;
const WORM_W = 20, WORM_H = 24;

const WEAPON_DEFS = {
  bazooka:   { name: 'Bazooka',       cost: 0,   desc: 'Reliable rocket. Unlimited.',        ammo: '∞', key: '1' },
  grenade:   { name: 'Grenade',       cost: 50,  desc: 'Bounces, 3-second fuse. ×3.',        ammo: 3,   key: '2' },
  shotgun:   { name: 'Shotgun',       cost: 75,  desc: '5 pellets in a spread. ×3.',         ammo: 3,   key: '3' },
  cluster:   { name: 'Cluster Bomb',  cost: 150, desc: 'Splits into 5 sub-grenades. ×2.',    ammo: 2,   key: '4' },
  airstrike: { name: 'Airstrike',     cost: 200, desc: '5 bombs from the sky. ×2.',          ammo: 2,   key: '5' },
  holy:      { name: 'Holy Grenade',  cost: 300, desc: 'MASSIVE explosion. ×1.',             ammo: 1,   key: '6' },
  bat:       { name: 'Baseball Bat',  cost: 100, desc: 'Melee – huge knockback. ∞.',         ammo: '∞', key: '7' },
};
const WEAPON_KEYS = Object.keys(WEAPON_DEFS);

const TEAM_COLORS = ['#7cfc00', '#ff6b6b', '#4ecdc4', '#ffd700'];
const WORM_BODY_COLORS = ['#5cb85c', '#d9534f', '#31b0d5', '#f0ad4e'];

// ─── State ────────────────────────────────────────────────────────────────────
const socket = io();
let myId = null;
let gameState = null;
let isMyTurn = false;

// Input
const keys = {};
let mousePos = { x: 0, y: 0 };
let charging = false;
let chargeStart = 0;
let MAX_CHARGE = 1800; // ms

// Rendering
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let offscreenTerrain = null; // pre-rendered terrain canvas

// Particle effects
let particles = [];

// Turn timer animation
let timerInterval = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const joinScreen   = document.getElementById('joinScreen');
const gameScreen   = document.getElementById('gameScreen');
const nameInput    = document.getElementById('nameInput');
const joinBtn      = document.getElementById('joinBtn');
const hudLeft      = document.getElementById('hudLeft');
const hudRight     = document.getElementById('hudRight');
const turnLabel    = document.getElementById('turnLabel');
const timerFill    = document.getElementById('timerFill');
const shopBtn      = document.getElementById('shopBtn');
const shopOverlay  = document.getElementById('shopOverlay');
const shopClose    = document.getElementById('shopClose');
const shopGrid     = document.getElementById('shopGrid');
const shopBalance  = document.getElementById('shopBalance');
const gameOver     = document.getElementById('gameOver');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverSub  = document.getElementById('gameOverSub');
const restartBtn   = document.getElementById('restartBtn');
const powerBar     = document.getElementById('powerBar');
const powerFill    = document.getElementById('powerFill');
const powerPct     = document.getElementById('powerPct');
const notif        = document.getElementById('notif');
const waitMsg      = document.getElementById('waitMsg');

// ─── Join ──────────────────────────────────────────────────────────────────────
joinBtn.addEventListener('click', joinGame);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinGame(); });

function joinGame() {
  const name = nameInput.value.trim() || 'Worm';
  socket.emit('join', { name });
  myId = socket.id;
  joinScreen.style.display = 'none';
  gameScreen.style.display = 'flex';
}

socket.on('connect', () => { myId = socket.id; });

socket.on('joinError', msg => {
  alert(msg);
  joinScreen.style.display = 'flex';
  gameScreen.style.display = 'none';
});

// ─── Game state updates ────────────────────────────────────────────────────────
socket.on('state', (state) => {
  const prevPhase = gameState?.gamePhase;
  gameState = state;
  isMyTurn = state.turnWormId === myId;

  if (state.terrain) {
    buildTerrainCanvas(state.terrain);
  }

  // Spawn particles for new explosions
  if (state.explosions && state.explosions.length > 0) {
    for (const ex of state.explosions) {
      spawnExplosionParticles(ex.x, ex.y, ex.radius, ex.color);
    }
  }

  updateHUD();
  updateWaitMsg();
  updateShopBtn();
  updateTimerBar();
});

socket.on('gameOver', ({ winnerName, winnerId }) => {
  gameOver.classList.add('show');
  if (winnerId === myId) {
    gameOverTitle.textContent = '🏆 You Win!';
    gameOverSub.textContent = `Congratulations, ${winnerName}!`;
  } else {
    gameOverTitle.textContent = '💀 You Lose';
    gameOverSub.textContent = `${winnerName} is the last worm standing.`;
  }
});

socket.on('shopError', msg => showNotif(msg, '#ff4444'));
socket.on('playerJoined', ({ name }) => showNotif(`${name} joined the game!`, '#7cfc00'));
socket.on('playerLeft',   ({ id }) => {
  const w = gameState?.worms?.find(ww => ww.id === id);
  if (w) showNotif(`${w.name} left the game`, '#ff8888');
});

restartBtn.addEventListener('click', () => {
  socket.emit('restartGame');
  gameOver.classList.remove('show');
});

// ─── Terrain rendering ─────────────────────────────────────────────────────────
function buildTerrainCanvas(terrain) {
  if (!offscreenTerrain) {
    offscreenTerrain = document.createElement('canvas');
    offscreenTerrain.width = W;
    offscreenTerrain.height = H;
  }
  const tc = offscreenTerrain.getContext('2d');
  tc.clearRect(0, 0, W, H);

  // Sky gradient is drawn on main canvas; terrain fills below heightmap
  tc.beginPath();
  tc.moveTo(0, terrain[0]);
  for (let x = 1; x < W; x++) tc.lineTo(x, terrain[x]);
  tc.lineTo(W, H);
  tc.lineTo(0, H);
  tc.closePath();

  // Terrain gradient (grass top, dirt body)
  const grad = tc.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   '#4a7c3f');
  grad.addColorStop(0.08,'#5d8a45');
  grad.addColorStop(0.1, '#8B6914');
  grad.addColorStop(1,   '#5a3e1b');
  tc.fillStyle = grad;
  tc.fill();

  // Grass line
  tc.beginPath();
  tc.moveTo(0, terrain[0]);
  for (let x = 1; x < W; x++) tc.lineTo(x, terrain[x]);
  tc.strokeStyle = '#7cfc00';
  tc.lineWidth = 2.5;
  tc.stroke();
}

// ─── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!gameState) return;
  const { worms, turnWormId, gamePhase, turnEndsAt } = gameState;

  const myWorm    = worms.find(w => w.id === myId);
  const otherWorms = worms.filter(w => w.id !== myId);

  function wormPanel(w, side) {
    if (!w) return '';
    const hp = Math.max(0, w.health);
    const color = TEAM_COLORS[w.teamIndex] || '#7cfc00';
    const isActive = w.id === turnWormId;
    const wList = Object.entries(w.weapons)
      .map(([k, amt]) => {
        const def = WEAPON_DEFS[k];
        const amtStr = amt === Infinity || amt === 'Infinity' ? '∞' : amt;
        const sel = w.curWeapon === k ? ' selected' : '';
        const myW = w.id === myId;
        const click = myW ? `onclick="selectWeapon('${k}')"` : '';
        return `<div class="weapon-item${sel}" ${click} title="${def?.name}">[${def?.key}] ${def?.name} ×${amtStr}</div>`;
      }).join('');
    const moveLeft = (isActive && w.id === myId) ? gameState.turnMoveLeft : null;
    const moveBar = moveLeft !== null
      ? `<div style="font-size:0.7rem;color:#aaa;margin-top:2px">Move: <span style="color:${moveLeft > 50 ? '#7cfc00' : moveLeft > 0 ? '#ffd700' : '#ff4444'}">${Math.ceil(moveLeft)}px</span></div>`
      : '';
    return `
      <div class="hud-name" style="color:${color}">${isActive ? '► ' : ''}${w.name}${w.dead ? ' 💀' : ''}</div>
      <div class="health-bar"><div class="health-fill" style="width:${hp}%"></div></div>
      <div style="font-size:0.75rem; color:#aaa">${hp} HP</div>
      <div class="money">💰 $${w.money}</div>
      ${moveBar}
      <div class="weapons-list">${wList}</div>`;
  }

  hudLeft.innerHTML  = wormPanel(myWorm, 'left');
  hudRight.innerHTML = wormPanel(otherWorms[0], 'right');

  // Turn label
  if (gamePhase === 'waiting') {
    turnLabel.textContent = 'Waiting for players…';
  } else if (gamePhase === 'ended') {
    turnLabel.textContent = 'Game Over!';
  } else {
    const tw = worms.find(w => w.id === turnWormId);
    if (tw) {
      turnLabel.textContent = tw.id === myId ? '🎯 Your Turn!' : `${tw.name}'s Turn`;
      turnLabel.style.color = TEAM_COLORS[tw.teamIndex] || '#7cfc00';
    }
  }
}

function selectWeapon(key) {
  if (!isMyTurn) return;
  socket.emit('selectWeapon', { weaponKey: key });
}
window.selectWeapon = selectWeapon;

function updateTimerBar() {
  if (!gameState) return;
  const { turnEndsAt, gamePhase } = gameState;
  if (gamePhase !== 'playing') { timerFill.style.width = '0%'; return; }
  const now = Date.now();
  const total = 35000;
  const remaining = Math.max(0, turnEndsAt - now);
  const pct = (remaining / total) * 100;
  timerFill.style.width = pct + '%';
  timerFill.style.background = pct > 40 ? '#7cfc00' : pct > 20 ? '#ffd700' : '#ff4444';
}

function updateWaitMsg() {
  if (!gameState) return;
  waitMsg.style.display = gameState.gamePhase === 'waiting' ? 'block' : 'none';
}

function updateShopBtn() {
  if (!gameState) return;
  shopBtn.style.display = isMyTurn && gameState.gamePhase === 'playing' ? 'block' : 'none';
}

// ─── Shop ──────────────────────────────────────────────────────────────────────
shopBtn.addEventListener('click', openShop);
shopClose.addEventListener('click', () => { shopOverlay.classList.remove('open'); });

function openShop() {
  if (!gameState) return;
  const myWorm = gameState.worms.find(w => w.id === myId);
  if (!myWorm) return;
  shopBalance.textContent = `Balance: 💰 $${myWorm.money}`;
  shopGrid.innerHTML = '';
  for (const [key, def] of Object.entries(WEAPON_DEFS)) {
    if (def.cost === 0) continue;
    const canAfford = myWorm.money >= def.cost;
    const item = document.createElement('div');
    item.className = 'shop-item' + (canAfford ? '' : ' cant-afford');
    item.innerHTML = `
      <div class="w-name">${def.name}</div>
      <div class="w-desc">${def.desc}</div>
      <div class="w-price">💰 $${def.cost}</div>`;
    if (canAfford) {
      item.addEventListener('click', () => {
        socket.emit('buyWeapon', { weaponKey: key });
        shopOverlay.classList.remove('open');
        showNotif(`Bought ${def.name}!`, '#ffd700');
      });
    }
    shopGrid.appendChild(item);
  }
  shopOverlay.classList.add('open');
}

// ─── Notifications ─────────────────────────────────────────────────────────────
let notifTimer = null;
function showNotif(msg, color = '#eee') {
  notif.textContent = msg;
  notif.style.color = color;
  notif.style.borderColor = color;
  notif.style.border = `1px solid ${color}`;
  notif.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => notif.classList.remove('show'), 2500);
}

// ─── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (shopOverlay.classList.contains('open')) return;
  keys[e.code] = true;

  if (!isMyTurn || !gameState || gameState.gamePhase !== 'playing') return;

  // Weapon select
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.replace('Digit', ''));
    const wk = WEAPON_KEYS[n - 1];
    if (wk) selectWeapon(wk);
  }

  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    socket.emit('jump');
  }

  if (e.code === 'KeyE') {
    socket.emit('endTurn');
  }

  if (e.code === 'KeyS' || e.code === 'Dollar') {
    openShop();
  }
});

document.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  mousePos.x = (e.clientX - rect.left) * scaleX;
  mousePos.y = (e.clientY - rect.top)  * scaleY;
});

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (!isMyTurn || !gameState || gameState.gamePhase !== 'playing') return;
  if (shopOverlay.classList.contains('open')) return;
  charging = true;
  chargeStart = Date.now();
  powerBar.style.display = 'flex';
});

canvas.addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  if (!charging) return;
  charging = false;
  powerBar.style.display = 'none';
  if (!isMyTurn || !gameState || gameState.gamePhase !== 'playing') return;

  const chargeDuration = Date.now() - chargeStart;
  const power = Math.min(1, chargeDuration / MAX_CHARGE);

  const myWorm = gameState.worms.find(w => w.id === myId);
  if (!myWorm) return;

  const dx = mousePos.x - myWorm.x;
  const dy = mousePos.y - myWorm.y;
  const angle = Math.atan2(dy, dx);

  socket.emit('fire', { angle, power, weaponKey: myWorm.curWeapon });
});

// Movement loop
let moveInterval = setInterval(() => {
  if (!isMyTurn || !gameState || gameState.gamePhase !== 'playing') return;
  if (shopOverlay.classList.contains('open')) return;
  if (keys['ArrowLeft']  || keys['KeyA']) socket.emit('move', { dir: -1 });
  if (keys['ArrowRight'] || keys['KeyD']) socket.emit('move', { dir:  1 });
}, 1000 / 30);

// ─── Particles ─────────────────────────────────────────────────────────────────
function spawnExplosionParticles(cx, cy, radius, color) {
  const count = Math.min(60, Math.round(radius * 1.2));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 3) * (radius / 35);
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 2,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      size: 2 + Math.random() * 4,
      color,
    });
  }
  // Shockwave ring
  particles.push({ type: 'ring', x: cx, y: cy, r: 5, maxR: radius * 1.4, life: 1, decay: 0.06, color });
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.life -= p.decay;
    if (p.type === 'ring') { p.r += (p.maxR - p.r) * 0.18; continue; }
    p.vy += 0.15;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
  }
}

// ─── Main Render Loop ──────────────────────────────────────────────────────────
function getAimAngle(worm) {
  const dx = mousePos.x - worm.x;
  const dy = mousePos.y - worm.y;
  return Math.atan2(dy, dx);
}

function render() {
  ctx.clearRect(0, 0, W, H);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d1b2a');
  sky.addColorStop(1, '#1a3a5c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars (static seed)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 137 + 50) % W);
    const sy = ((i * 89  + 30) % (H * 0.5));
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  if (!gameState) { requestAnimationFrame(render); return; }

  // Terrain
  if (offscreenTerrain) ctx.drawImage(offscreenTerrain, 0, 0);

  // Projectiles
  for (const p of (gameState.projectiles || [])) {
    drawProjectile(p);
  }

  // Worms
  for (const w of (gameState.worms || [])) {
    if (!w.dead) drawWorm(w);
  }

  // Aim line (my worm, my turn)
  if (isMyTurn && gameState.gamePhase === 'playing') {
    const myWorm = gameState.worms.find(ww => ww.id === myId);
    if (myWorm) drawAimLine(myWorm);
  }

  // Particles
  updateParticles();
  drawParticles();

  // Charging power bar animation
  if (charging) {
    const pct = Math.min(100, ((Date.now() - chargeStart) / MAX_CHARGE) * 100);
    powerFill.style.width = pct + '%';
    powerPct.textContent = Math.round(pct) + '%';
  }

  // Update timer bar every frame
  updateTimerBar();

  requestAnimationFrame(render);
}

function drawWorm(w) {
  const { x, y, facing, health, name, id, teamIndex, curWeapon } = w;
  const color = WORM_BODY_COLORS[teamIndex] || '#5cb85c';
  const isActive = gameState.turnWormId === id;

  ctx.save();
  ctx.translate(x, y);

  // Active glow
  if (isActive) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = TEAM_COLORS[teamIndex] || '#7cfc00';
  }

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, WORM_W / 2, WORM_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(facing * 5, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(facing * 5 + facing * 1, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Helmet / hat
  ctx.fillStyle = TEAM_COLORS[teamIndex] || '#7cfc00';
  ctx.fillRect(-WORM_W / 2 + 2, -WORM_H / 2 - 4, WORM_W - 4, 6);

  ctx.restore();

  // Name tag
  ctx.save();
  ctx.font = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 28, y - WORM_H / 2 - 22, 56, 14);
  ctx.fillStyle = isActive ? (TEAM_COLORS[teamIndex] || '#7cfc00') : '#ddd';
  ctx.fillText(name, x, y - WORM_H / 2 - 11);
  ctx.restore();

  // Health bar above worm
  const barW = 40, barH = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - barW / 2, y - WORM_H / 2 - 28, barW, barH);
  ctx.fillStyle = health > 50 ? '#7cfc00' : health > 25 ? '#ffd700' : '#ff4444';
  ctx.fillRect(x - barW / 2, y - WORM_H / 2 - 28, barW * (health / 100), barH);
}

function drawProjectile(p) {
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = p.color;
  ctx.fillStyle = p.color;

  if (p.type === 'rocket') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,100,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
    ctx.stroke();
  } else if (p.type === 'grenade') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'shotgun') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'airstrike') {
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(p.x - 4, p.y - 8, 8, 14);
    ctx.fillStyle = '#aaaaff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 6);
    ctx.lineTo(p.x - 8, p.y + 12);
    ctx.lineTo(p.x + 8, p.y + 12);
    ctx.fill();
  } else if (p.type === 'cluster') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawAimLine(worm) {
  const angle = getAimAngle(worm);
  const lineLen = 60;
  const ex = worm.x + Math.cos(angle) * lineLen;
  const ey = worm.y + Math.sin(angle) * lineLen;

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(worm.x, worm.y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(ex, ey, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.type === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Resize canvas to fit screen ──────────────────────────────────────────────
function resizeCanvas() {
  const wrap = document.getElementById('canvasWrap');
  const scaleX = window.innerWidth / W;
  const scaleY = window.innerHeight / H;
  const scale = Math.min(scaleX, scaleY, 1);
  wrap.style.transform = `scale(${scale})`;
  wrap.style.transformOrigin = 'top center';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── Timer interval ────────────────────────────────────────────────────────────
setInterval(updateTimerBar, 250);

// ─── Start render loop ─────────────────────────────────────────────────────────
requestAnimationFrame(render);
