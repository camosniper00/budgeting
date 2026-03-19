const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 2556;

app.use(express.static(path.join(__dirname, 'public')));

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 1200;
const H = 600;
const GRAVITY = 0.25;
const WORM_W = 20;
const WORM_H = 24;
const WORM_SPEED = 2.5;
const TURN_SECONDS = 35;
const FIRE_COOLDOWN = 500; // ms before turn ends after firing

const WEAPONS = {
  bazooka:    { name: 'Bazooka',       cost: 0,   damage: 35, radius: 45, speed: 14, type: 'rocket',   color: '#ff6600', ammo: Infinity },
  grenade:    { name: 'Grenade',       cost: 50,  damage: 45, radius: 55, speed: 11, type: 'grenade',  color: '#44cc44', fuseTime: 3000, bouncy: true, ammo: 3 },
  shotgun:    { name: 'Shotgun',       cost: 75,  damage: 18, radius: 18, speed: 16, type: 'shotgun',  color: '#aaaaaa', pellets: 5, spread: 0.15, ammo: 3 },
  cluster:    { name: 'Cluster Bomb',  cost: 150, damage: 28, radius: 38, speed: 11, type: 'cluster',  color: '#ff4444', subCount: 5, ammo: 2 },
  airstrike:  { name: 'Airstrike',    cost: 200, damage: 40, radius: 50, speed: 7,  type: 'airstrike', color: '#4488ff', bombCount: 5, ammo: 2 },
  holy:       { name: 'Holy Grenade', cost: 300, damage: 80, radius: 90, speed: 9,  type: 'grenade',  color: '#ffee00', fuseTime: 3000, bouncy: true, ammo: 1 },
  bat:        { name: 'Baseball Bat', cost: 100, damage: 25, radius: 0,  speed: 0,  type: 'melee',    color: '#8B4513', knockback: 30, ammo: Infinity },
};

// ─── Terrain ──────────────────────────────────────────────────────────────────
function generateTerrain() {
  const heights = new Float32Array(W);
  // Multiple sine waves for natural-looking hills
  for (let x = 0; x < W; x++) {
    const h = 0.55 * H
      + Math.sin(x / 180) * 60
      + Math.sin(x / 80 + 1.2) * 35
      + Math.sin(x / 40 + 0.5) * 18
      + Math.sin(x / 22 + 2.1) * 10;
    heights[x] = h;
  }
  // Smooth
  const sm = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let d = -8; d <= 8; d++) {
      const nx = x + d;
      if (nx >= 0 && nx < W) { s += heights[nx]; n++; }
    }
    sm[x] = s / n;
  }
  return Array.from(sm);
}

function terrainY(terrain, x) {
  const xi = Math.max(0, Math.min(W - 1, Math.floor(x)));
  return terrain[xi];
}

function explodeTerrain(terrain, cx, cy, radius) {
  const r = Math.ceil(radius);
  let changed = false;
  for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
    const dx = x - cx;
    const depth = Math.sqrt(Math.max(0, r * r - dx * dx));
    const newY = cy + depth;
    if (newY > terrain[x]) {
      terrain[x] = Math.min(H, newY);
      changed = true;
    }
  }
  return changed;
}

// ─── Game State ───────────────────────────────────────────────────────────────
let terrain = generateTerrain();
let worms = [];           // { id, name, x, y, vx, vy, health, money, weapons, curWeapon, facing, dead, onGround }
let projectiles = [];     // active projectiles
let explosions = [];      // visual-only explosion events sent to clients
let gamePhase = 'waiting'; // waiting | playing | ended
let turnIndex = 0;
let turnEndsAt = 0;
let turnTimerHandle = null;
let projIdCounter = 0;
let gameLoopHandle = null;
const TICK = 1000 / 60;

function spawnWorm(socketId, name, teamIndex) {
  const x = teamIndex === 0 ? W * 0.2 : W * 0.8;
  const y = terrainY(terrain, x) - WORM_H;
  const weapons = { bazooka: Infinity };
  return {
    id: socketId,
    name,
    x,
    y,
    vx: 0,
    vy: 0,
    health: 100,
    money: 100,
    weapons,
    curWeapon: 'bazooka',
    facing: teamIndex === 0 ? 1 : -1,
    dead: false,
    onGround: false,
    teamIndex,
  };
}

function resetWormPosition(worm) {
  worm.y = terrainY(terrain, worm.x) - WORM_H;
  worm.vy = 0;
  worm.vx = 0;
}

function liveWorms() { return worms.filter(w => !w.dead); }

function currentWorm() { return liveWorms()[turnIndex % liveWorms().length] || null; }

function broadcastState() {
  io.emit('state', buildClientState());
}

function buildClientState() {
  return {
    terrain,
    worms: worms.map(w => ({
      id: w.id, name: w.name, x: w.x, y: w.y,
      health: w.health, money: w.money, weapons: w.weapons,
      curWeapon: w.curWeapon, facing: w.facing, dead: w.dead,
      teamIndex: w.teamIndex,
    })),
    projectiles: projectiles.map(p => ({
      id: p.id, x: p.x, y: p.y, type: p.type, color: p.color,
    })),
    explosions,
    gamePhase,
    turnWormId: currentWorm()?.id || null,
    turnEndsAt,
    turnIndex,
  };
}

// ─── Physics & Game Loop ──────────────────────────────────────────────────────
function tickPhysics() {
  // Move projectiles
  const toExplode = [];
  const toRemove = new Set();

  for (const p of projectiles) {
    if (p.fuse !== undefined) {
      if (Date.now() >= p.fuseAt) {
        toExplode.push(p);
        toRemove.add(p.id);
        continue;
      }
    }

    // Apply gravity (not to airstrike drops which start above)
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Out of bounds
    if (p.x < 0 || p.x > W || p.y > H + 20) {
      toRemove.add(p.id);
      continue;
    }

    // Terrain collision
    const ty = terrainY(terrain, p.x);
    if (p.y >= ty) {
      if (p.bouncy) {
        p.y = ty - 1;
        p.vy *= -0.5;
        p.vx *= 0.7;
        if (Math.abs(p.vy) < 0.5) { p.vy = 0; }
      } else {
        toExplode.push(p);
        toRemove.add(p.id);
        continue;
      }
    }

    // Worm collision (non-melee)
    if (p.type !== 'melee') {
      for (const w of liveWorms()) {
        if (w.id === p.ownerId) continue;
        const dx = p.x - w.x, dy = p.y - w.y;
        if (Math.abs(dx) < WORM_W && Math.abs(dy) < WORM_H) {
          toExplode.push(p);
          toRemove.add(p.id);
          break;
        }
      }
    }
  }

  projectiles = projectiles.filter(p => !toRemove.has(p.id));

  // Handle explosions
  for (const p of toExplode) {
    doExplosion(p.x, p.y, p.weaponKey, p.ownerId, p);
  }

  // Worm physics / gravity
  for (const w of worms) {
    if (w.dead) continue;
    w.vy += GRAVITY;
    w.y += w.vy;
    w.x += w.vx;
    w.vx *= 0.85;

    // Terrain collision
    const ty = terrainY(terrain, w.x);
    if (w.y + WORM_H / 2 >= ty) {
      w.y = ty - WORM_H / 2;
      w.vy = 0;
      w.onGround = true;
    } else {
      w.onGround = false;
    }

    // Boundary
    w.x = Math.max(WORM_W / 2, Math.min(W - WORM_W / 2, w.x));

    // Fell off map
    if (w.y > H + 50) {
      w.health = 0;
      w.dead = true;
    }
  }

  // Clear explosions after broadcasting once
  if (explosions.length > 0) {
    broadcastState();
    explosions = [];
  } else if (toExplode.length > 0 || toRemove.size > 0) {
    broadcastState();
  }

  checkVictory();
}

function doExplosion(cx, cy, weaponKey, ownerId, proj) {
  const def = WEAPONS[weaponKey];
  if (!def) return;

  if (def.type === 'shotgun') {
    // Shotgun damage is per-pellet, already handled individually
  }

  const radius = def.radius;
  explosions.push({ x: cx, y: cy, radius, color: def.color, weaponKey });

  // Damage worms
  for (const w of worms) {
    if (w.dead) continue;
    const dx = cx - w.x, dy = cy - w.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius + WORM_W) {
      const falloff = 1 - Math.min(1, dist / (radius + WORM_W));
      const dmg = Math.round(def.damage * falloff);
      if (dmg > 0) {
        w.health = Math.max(0, w.health - dmg);
        // Knockback
        const kbForce = (radius / 30) * falloff * 8;
        if (dist > 1) {
          w.vx += (w.x - cx) / dist * kbForce;
          w.vy += (w.y - cy) / dist * kbForce - 2;
        }
        // Award money to owner
        const owner = worms.find(ww => ww.id === ownerId);
        if (owner && owner.id !== w.id) {
          owner.money += dmg;
          if (w.health <= 0 && !w.dead) {
            owner.money += 50; // kill bonus
          }
        }
        if (w.health <= 0) w.dead = true;
      }
    }
  }

  // Cluster sub-bombs
  if (def.type === 'cluster' && !proj.isSub) {
    const subDef = { ...WEAPONS.grenade, damage: def.damage * 0.6, radius: def.radius * 0.6 };
    for (let i = 0; i < def.subCount; i++) {
      const angle = (Math.PI * 2 / def.subCount) * i - Math.PI / 2;
      const spd = 5 + Math.random() * 3;
      projectiles.push({
        id: ++projIdCounter, ownerId, weaponKey: 'grenade',
        x: cx, y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        type: 'grenade', color: '#ff8888',
        bouncy: true, fuse: true,
        fuseAt: Date.now() + 2000,
        isSub: true,
      });
    }
  }

  // Terrain damage
  if (radius > 0) {
    explodeTerrain(terrain, cx, cy, radius);
  }
}

function startGameLoop() {
  if (gameLoopHandle) clearInterval(gameLoopHandle);
  gameLoopHandle = setInterval(tickPhysics, TICK);
}

function checkVictory() {
  const alive = liveWorms();
  if (alive.length <= 1 && gamePhase === 'playing') {
    gamePhase = 'ended';
    clearTimeout(turnTimerHandle);
    if (gameLoopHandle) clearInterval(gameLoopHandle);
    const winner = alive[0];
    io.emit('gameOver', { winnerId: winner?.id, winnerName: winner?.name || 'Nobody' });
    broadcastState();
  }
}

function startTurn() {
  const live = liveWorms();
  if (live.length === 0) return;

  // Make sure turnIndex is valid
  turnIndex = turnIndex % live.length;

  clearTimeout(turnTimerHandle);
  turnEndsAt = Date.now() + TURN_SECONDS * 1000;

  broadcastState();

  turnTimerHandle = setTimeout(() => {
    advanceTurn();
  }, TURN_SECONDS * 1000);
}

function advanceTurn() {
  const live = liveWorms();
  if (live.length === 0) return;
  turnIndex = (turnIndex + 1) % live.length;
  startTurn();
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', ({ name }) => {
    const live = liveWorms();
    const teamIndex = worms.filter(w => !w.dead).length % 2;

    if (worms.length >= 4) {
      socket.emit('joinError', 'Game is full (max 4 players)');
      return;
    }

    // Check if already in game
    if (worms.find(w => w.id === socket.id)) return;

    const worm = spawnWorm(socket.id, name || `Player ${worms.length + 1}`, teamIndex);
    worms.push(worm);
    resetWormPosition(worm);

    io.emit('playerJoined', { id: socket.id, name: worm.name });
    broadcastState();

    if (worms.length >= 2 && gamePhase === 'waiting') {
      gamePhase = 'playing';
      terrain = generateTerrain();
      // Reposition worms
      worms.forEach((w, i) => {
        w.x = (W / (worms.length + 1)) * (i + 1);
        resetWormPosition(w);
      });
      startGameLoop();
      startTurn();
    }
  });

  socket.on('move', ({ dir }) => {
    if (gamePhase !== 'playing') return;
    const cw = currentWorm();
    if (!cw || cw.id !== socket.id) return;
    if (!cw.onGround) return;

    const dx = dir * WORM_SPEED;
    cw.x += dx;
    cw.x = Math.max(WORM_W / 2, Math.min(W - WORM_W / 2, cw.x));
    cw.facing = dir > 0 ? 1 : -1;

    // Walk up slope
    const ty = terrainY(terrain, cw.x);
    if (cw.y + WORM_H / 2 > ty) {
      cw.y = ty - WORM_H / 2;
    }

    broadcastState();
  });

  socket.on('jump', () => {
    if (gamePhase !== 'playing') return;
    const cw = currentWorm();
    if (!cw || cw.id !== socket.id) return;
    if (!cw.onGround) return;
    cw.vy = -7;
    cw.onGround = false;
    broadcastState();
  });

  socket.on('fire', ({ angle, power, weaponKey }) => {
    if (gamePhase !== 'playing') return;
    const cw = currentWorm();
    if (!cw || cw.id !== socket.id) return;

    const wk = weaponKey || cw.curWeapon;
    const def = WEAPONS[wk];
    if (!def) return;

    // Check ammo
    const ammo = cw.weapons[wk];
    if (!ammo || ammo <= 0) return;

    // Deduct ammo
    if (ammo !== Infinity && ammo < Infinity) {
      cw.weapons[wk] = ammo - 1;
      if (cw.weapons[wk] <= 0) {
        delete cw.weapons[wk];
        cw.curWeapon = 'bazooka';
      }
    }

    const spd = def.speed * Math.min(1, Math.max(0.1, power));
    const vx = Math.cos(angle) * spd;
    const vy = Math.sin(angle) * spd;
    const startX = cw.x + Math.cos(angle) * (WORM_W / 2 + 5);
    const startY = cw.y + Math.sin(angle) * 5;

    if (def.type === 'melee') {
      // Instant melee
      for (const w of liveWorms()) {
        if (w.id === cw.id) continue;
        const dx = w.x - cw.x;
        if (Math.abs(dx) < 50 && Math.abs(w.y - cw.y) < WORM_H * 2) {
          const dmg = def.damage;
          w.health = Math.max(0, w.health - dmg);
          cw.money += dmg;
          w.vx += cw.facing * def.knockback;
          w.vy -= 5;
          if (w.health <= 0) { w.dead = true; cw.money += 50; }
          explosions.push({ x: w.x, y: w.y, radius: 20, color: def.color, weaponKey: wk });
        }
      }
    } else if (def.type === 'airstrike') {
      // Drop bombs from sky at target X
      const targetX = cw.x + cw.facing * 80;
      for (let i = 0; i < def.bombCount; i++) {
        projectiles.push({
          id: ++projIdCounter, ownerId: cw.id, weaponKey: wk,
          x: targetX + (i - 2) * 40,
          y: -20,
          vx: 0, vy: def.speed,
          type: 'airstrike', color: def.color,
          bouncy: false,
        });
      }
    } else if (def.type === 'shotgun') {
      for (let i = 0; i < def.pellets; i++) {
        const spread = (Math.random() - 0.5) * def.spread;
        const a = angle + spread;
        projectiles.push({
          id: ++projIdCounter, ownerId: cw.id, weaponKey: wk,
          x: startX, y: startY,
          vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed,
          type: 'shotgun', color: def.color,
          bouncy: false,
        });
      }
    } else {
      // Standard projectile
      const proj = {
        id: ++projIdCounter, ownerId: cw.id, weaponKey: wk,
        x: startX, y: startY,
        vx, vy,
        type: def.type, color: def.color,
        bouncy: def.bouncy || false,
      };
      if (def.fuseTime) {
        proj.fuse = true;
        proj.fuseAt = Date.now() + def.fuseTime;
      }
      projectiles.push(proj);
    }

    // End turn shortly after firing
    clearTimeout(turnTimerHandle);
    turnTimerHandle = setTimeout(() => advanceTurn(), FIRE_COOLDOWN + 3000);
    turnEndsAt = Date.now() + FIRE_COOLDOWN + 3000;

    broadcastState();
  });

  socket.on('selectWeapon', ({ weaponKey }) => {
    const worm = worms.find(w => w.id === socket.id);
    if (!worm) return;
    if (worm.weapons[weaponKey] > 0 || worm.weapons[weaponKey] === Infinity) {
      worm.curWeapon = weaponKey;
      broadcastState();
    }
  });

  socket.on('buyWeapon', ({ weaponKey }) => {
    const cw = currentWorm();
    if (!cw || cw.id !== socket.id) return;
    const def = WEAPONS[weaponKey];
    if (!def || def.cost === 0) return;
    if (cw.money < def.cost) { socket.emit('shopError', 'Not enough money!'); return; }
    cw.money -= def.cost;
    cw.weapons[weaponKey] = (cw.weapons[weaponKey] || 0) + (def.ammo === Infinity ? Infinity : def.ammo);
    broadcastState();
  });

  socket.on('endTurn', () => {
    const cw = currentWorm();
    if (!cw || cw.id !== socket.id) return;
    clearTimeout(turnTimerHandle);
    advanceTurn();
  });

  socket.on('restartGame', () => {
    terrain = generateTerrain();
    explosions = [];
    projectiles = [];
    turnIndex = 0;
    gamePhase = worms.length >= 2 ? 'playing' : 'waiting';
    worms.forEach((w, i) => {
      w.dead = false;
      w.health = 100;
      w.money = 100;
      w.weapons = { bazooka: Infinity };
      w.curWeapon = 'bazooka';
      w.x = (W / (worms.length + 1)) * (i + 1);
      w.vx = 0; w.vy = 0;
      resetWormPosition(w);
    });
    if (gameLoopHandle) clearInterval(gameLoopHandle);
    startGameLoop();
    if (gamePhase === 'playing') startTurn();
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const idx = worms.findIndex(w => w.id === socket.id);
    if (idx !== -1) {
      worms.splice(idx, 1);
      if (worms.length < 2 && gamePhase === 'playing') {
        gamePhase = 'waiting';
        clearTimeout(turnTimerHandle);
        if (gameLoopHandle) clearInterval(gameLoopHandle);
      }
    }
    io.emit('playerLeft', { id: socket.id });
    broadcastState();
  });
});

server.listen(PORT, () => {
  console.log(`\n🪱 Worms game running at http://localhost:${PORT}`);
  console.log(`   Port-forward port 2556 to play online!\n`);
});
