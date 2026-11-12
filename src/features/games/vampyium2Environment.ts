import { atlasReady, drawAsset, drawRealisticFire, assetAspect } from './vampyium2Sprites';
import { SAW_R, ROLL_R, GAPS, LV, type Trap, type TrapGeo, type Fx, type Weapon } from './vampyium2';
import type { View } from './vampyium2Art';

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const X = (v: View, x: number) => v.ox + x * v.s;
const Y = (v: View, y: number) => v.oy - y * v.s;
export function texturedStrip(ctx: CanvasRenderingContext2D, index: number, x: number, y: number, w: number, h: number) {
  if (!atlasReady('props')) return false;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 1, w, h + 2); ctx.clip();
  const tileW = Math.max(h * assetAspect('props', index), h * 2);
  for (let dx = 0; dx < w; dx += tileW) drawAsset(ctx, 'props', index, x + dx, y, tileW + 1, h);
  ctx.restore(); return true;
}
export function realisticChain(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, width: number) {
  if (!atlasReady('props')) return false;
  ctx.save(); ctx.beginPath(); ctx.rect(x - width, top, width * 2, Math.max(0, bottom - top)); ctx.clip();
  const height = width / assetAspect('props', 7);
  for (let y = top; y < bottom; y += height * .96) drawAsset(ctx, 'props', 7, x - width / 2, y, width, height);
  ctx.restore(); return true;
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
export function fireLight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number) {
  if (!atlasReady('effects') || w <= 0 || h <= 0) return false;
  glow(ctx, x, y - h * .3, Math.max(w * 1.8, h * .7), `rgba(230,108,33,${.14 + .025 * Math.sin(t * 11 + seed)})`);
  drawRealisticFire(ctx, x, y, w, h, t, seed);
  // Small round embers rise continuously while the photographed flame steps at 14 fps. Their size follows the
  // flame (never a fixed pixel minimum: inside a scaled character that turned into big orange squares).
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const k = ((t * (.37 + i * .04) + i * .21 + seed) % 1 + 1) % 1, r = w * (.014 + (i % 3) * .005) * (1 - k * .6);
    const ex = x + Math.sin(t * 2 + i * 4) * w * .3 * k, ey = y - h * (.25 + k);
    const ember = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 2.2);
    ember.addColorStop(0, `rgba(255,214,140,${(1 - k) * .8})`); ember.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = ember; ctx.beginPath(); ctx.arc(ex, ey, r * 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore(); return true;
}

export function drawRealisticTrap(ctx: CanvasRenderingContext2D, tr: Trap, st: TrapGeo, v: View, t: number) {
  if (!atlasReady('props') || !atlasReady('traps') || !atlasReady('effects')) return false;
  const s = v.s, x = X(v, tr.x), y = Y(v, tr.y), style = tr.style;
  if (st.warn) {
    const width = Math.max(.8, tr.x2 - tr.x) * s;
    ctx.save(); ctx.globalAlpha *= .26 + Math.sin(t * 12) * .08;
    ctx.fillStyle = '#b8834f'; ctx.fillRect(x - (tr.kind === 'crusher' ? tr.len * s : 0), y - 2, width, 3); ctx.restore();
  }
  switch (tr.kind) {
    case 'spikes': {
      const width = (tr.x2 - tr.x) * s, h = .9 * s;
      ctx.fillStyle = '#18191a'; ctx.fillRect(x, y - 1, width, s * .1);
      const name = style === 'iron' || !style ? 'props' : 'traps';
      const index = name === 'props' ? 4 : style === 'bone' ? 6 : style === 'thorn' ? 7 : 8;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y - h, width, h + s * .12); ctx.clip();
      const tileW = h * assetAspect(name, index);
      for (let dx = 0; dx < width; dx += tileW) drawAsset(ctx, name, index, x + dx, y - h * st.on, tileW, h);
      ctx.restore(); return true;
    }
    case 'pendulum': {
      const tx = X(v, st.tipX), ty = Y(v, st.tipY), length = Math.hypot(tx - x, ty - y);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ty - y, tx - x) - Math.PI / 2);
      realisticChain(ctx, 0, 0, length, s * .12); ctx.restore();
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(-st.a);
      const name = style === 'mace' ? 'traps' : 'props', index = style === 'mace' ? 1 : style === 'cage' ? 10 : 5;
      drawAsset(ctx, name, index, -s * .9, -s * .78, s * 1.8, s * 1.55); ctx.restore(); return true;
    }
    case 'saw': case 'roller': {
      const r = (tr.kind === 'saw' ? SAW_R : ROLL_R) * s;
      ctx.save(); ctx.translate(X(v, st.cx), Y(v, st.cy)); ctx.rotate(st.a);
      drawAsset(ctx, 'traps', tr.kind === 'saw' ? 0 : 1, -r, -r, r * 2, r * 2); ctx.restore(); return true;
    }
    case 'crusher': {
      const bottom = Y(v, st.bottom), hw = tr.len * s;
      realisticChain(ctx, x - hw * .65, 0, bottom - s, s * .11);
      realisticChain(ctx, x + hw * .65, 0, bottom - s, s * .11);
      const name = style === 'cage' ? 'props' : 'traps';
      const index = style === 'cage' ? 10 : style === 'chandelier' ? 4 : style === 'tomb' ? 3 : style === 'skullblock' ? 5 : 2;
      drawAsset(ctx, name, index, x - hw, bottom - s * 1.6, hw * 2, s * 1.6); return true;
    }
    case 'fire': {
      if (style === 'brazier' || !style) drawAsset(ctx, 'props', 6, x - s * .52, y - s * .85, s * 1.04, s * .85);
      else drawAsset(ctx, 'traps', 11, x - s * .6, y - s * .12, s * 1.2, s * .25);
      const base = y - (style === 'brazier' || !style ? s * .72 : 0);
      if ((style === 'acid' || style === 'blood') && st.on > 0) {
        const h = tr.len * s * st.on, width = s * .35;
        const liquid = ctx.createLinearGradient(x - width, 0, x + width, 0);
        liquid.addColorStop(0, style === 'acid' ? '#39582b' : '#391019');
        liquid.addColorStop(.38, style === 'acid' ? '#b3c889' : '#a2484b');
        liquid.addColorStop(1, style === 'acid' ? '#597743' : '#651e2c');
        ctx.save(); ctx.globalAlpha *= .86; ctx.fillStyle = liquid;
        ctx.beginPath(); ctx.moveTo(x - width, base);
        for (let j = 1; j <= 10; j++) ctx.lineTo(x - width * (1 - j * .07) + Math.sin(t * 9 + j) * width * .2, base - h * j / 10);
        for (let j = 10; j >= 0; j--) ctx.lineTo(x + width * (1 - j * .07) + Math.sin(t * 9 + j + 1) * width * .2, base - h * j / 10);
        ctx.closePath(); ctx.fill(); ctx.restore();
        drawAsset(ctx, 'details', style === 'acid' ? 13 : 14, x - s * .5, base - s * .2, s, s * .5);
      }
      else if (st.on > 0) fireLight(ctx, x, base, s * .95, Math.max(.1, tr.len * st.on - (base < y ? .72 : 0)) * s, t, tr.offset);
      else if (style === 'brazier' || !style) fireLight(ctx, x, base, s * .38, s * .68, t, tr.offset);
      return true;
    }
    case 'jet': {
      const py = Y(v, tr.y + .9), d = tr.amp >= 0 ? 1 : -1;
      ctx.save(); ctx.translate(x, py); ctx.scale(d, 1);
      drawAsset(ctx, 'traps', style === 'gargoyle' ? 9 : 10, -s * .45, -s * .42, s * .9, s * .84);
      if (st.on > 0) { ctx.translate(s * .25, 0); ctx.rotate(Math.PI / 2); fireLight(ctx, 0, 0, s * .7, st.reach * s, t, tr.offset); }
      ctx.restore(); return true;
    }
    case 'drip': {
      const top = Y(v, tr.top ?? 16), cy = Y(v, st.cy);
      drawAsset(ctx, 'traps', 11, x - s * .3, top - s * .12, s * .6, s * .24);
      if (st.on) {
        if (style === 'fireball') fireLight(ctx, x, cy + s * .2, s * .6, s * .85, t, tr.offset);
        else drawAsset(ctx, 'traps', style === 'skull' ? 13 : 12, x - s * .26, cy - s * .32, s * .52, s * .64);
      }
      return true;
    }
  }
}

// The garlic bomb: a burst and then a big cloud of garlic gas — pale yellow-green puffs that billow out past the blast
// radius, roll upwards and thin out slowly (only a look: the damage radius is GARLIC_R, as before).
// The garlic bomb blowing up: a white flash, a ball of fire that boils up and burns out, flying embers and a
// shock ring, and a thick gray smoke cloud that keeps growing, rolls upwards and darkens until it thins away.
function drawGarlicGas(ctx: CanvasRenderingContext2D, fx: Fx, v: View) {
  const k = Math.min(1, fx.t / fx.life), x = X(v, fx.x), y = Y(v, fx.y), R = fx.r * v.s, T = Math.PI * 2;
  const puff = (px: number, py: number, pr: number, c: string, a0: number, a1: number) => {
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, `rgba(${c},${a0})`); g.addColorStop(.55, `rgba(${c},${a1})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, pr, 0, T); ctx.fill();
  };
  ctx.save();
  // 1. the smoke, behind the fire: gray puffs that grow and rise, lit orange from below while the fire burns
  const smokeIn = Math.min(1, k / .12), smokeOut = k < .6 ? 1 : 1 - (k - .6) / .4, fire = Math.max(0, 1 - k / .42);
  for (let i = 0; i < 40; i++) {
    const h1 = hash(fx.seed * 31 + i), h2 = hash(fx.seed * 17 + i * 3.1), h3 = hash(fx.seed * 7 + i * 5.3);
    const a = h1 * T, spread = (.25 + .85 * Math.sqrt(h2)) * R * (.45 + .75 * Math.min(1, k * 2.2));
    const rise = fx.t * R * (.35 + .45 * h3) + k * k * R * .5;
    const px = x + Math.cos(a) * spread * 1.15 + Math.sin(fx.t * 1.1 + i) * R * .06, py = y + Math.sin(a) * spread * .55 - rise - R * .15;
    const pr = R * (.26 + .26 * h3) * (.6 + 1.1 * Math.min(1, k * 1.6));
    const gray = Math.round(58 + 62 * h1 - 25 * k), al = (.6 + .3 * h2) * smokeIn * smokeOut;
    puff(px, py, pr, `${gray},${gray - 2},${gray - 4}`, al, al * .75);
    puff(px - pr * .25, py - pr * .3, pr * .45, `${gray + 35},${gray + 33},${gray + 30}`, al * .45, al * .2); // (the lit top of each billow)
    if (fire > 0 && h3 < .6) { ctx.globalCompositeOperation = 'lighter'; puff(px, py + pr * .3, pr * .8, '255,110,30', .22 * fire, .08 * fire); ctx.globalCompositeOperation = 'source-over'; }
  }
  // 2. the fireball: hot puffs that boil outwards and upwards, white-yellow in the core, orange and red outside
  if (fire > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const grow = 1 - (1 - Math.min(1, k / .2)) ** 3;
    for (let i = 0; i < 34; i++) {
      const h1 = hash(fx.seed * 13 + i * 1.7), h2 = hash(fx.seed * 29 + i * 2.3), h3 = hash(fx.seed * 3 + i * 4.1);
      const a = h1 * T, d = Math.sqrt(h2) * R * .85 * grow;
      const px = x + Math.cos(a) * d * 1.1, py = y + Math.sin(a) * d * .7 - fx.t * R * (.6 + .5 * h3) - R * .1;
      const pr = R * (.2 + .25 * h3) * (.5 + .8 * grow) * (.6 + .4 * fire);
      const hot = (1 - Math.min(1, d / (R * .85 + 1))) * (.4 + .6 * fire);
      if (hot > .55) { ctx.globalCompositeOperation = 'lighter'; puff(px, py, pr * .8, '255,190,80', .5 * fire, .2 * fire); }
      else { ctx.globalCompositeOperation = 'source-over'; puff(px, py, pr, hot > .3 ? '255,120,25' : '190,45,12', .85 * fire, .55 * fire); }
    }
    ctx.globalCompositeOperation = 'lighter'; puff(x, y - R * .15 - fx.t * R * .5, R * .55 * (.5 + .5 * Math.min(1, k / .1)), '255,215,120', .7 * fire * fire, .25 * fire * fire); // (the hot core)
    ctx.globalCompositeOperation = 'source-over';
  }
  // 3. the flash and the shock ring
  if (k < .14) { ctx.globalCompositeOperation = 'lighter'; const f = 1 - k / .14; puff(x, y - R * .1, R * (.35 + .6 * (k / .14)), '255,240,200', .8 * f, .3 * f); ctx.globalCompositeOperation = 'source-over'; }
  if (k < .3) { const q = k / .3; ctx.strokeStyle = `rgba(255,220,170,${.45 * (1 - q)})`; ctx.lineWidth = Math.max(1, R * .07 * (1 - q)); ctx.beginPath(); ctx.ellipse(x, y, R * (.3 + 1.6 * q), R * (.12 + .5 * q), 0, 0, T); ctx.stroke(); }
  // 4. embers and burning bits of garlic flung out, falling, fading
  for (let i = 0; i < 22; i++) {
    const h1 = hash(fx.seed * 5 + i * 7.7), h2 = hash(fx.seed * 11 + i * 2.9), life = .35 + .35 * h2; if (k > life) continue;
    const q = k / life, a = -Math.PI * (.08 + .84 * h1), sp = R * (1.4 + 1.4 * h2);
    const px = x + Math.cos(a) * sp * q, py = y + Math.sin(a) * sp * q * .9 + q * q * R * 1.2;
    ctx.globalCompositeOperation = 'lighter'; puff(px, py, v.s * (.12 + .08 * h2) * (1 - q * .5), i % 3 ? '255,170,60' : '255,240,200', .95 * (1 - q), .5 * (1 - q)); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore(); return true;
}

export function drawRealisticImpact(ctx: CanvasRenderingContext2D, fx: Fx, v: View) {
  if (fx.kind === 'blast' && fx.t >= 0) return drawGarlicGas(ctx, fx, v);
  if (!atlasReady('effects') || fx.t < 0) return false;
  const rows: Partial<Record<Fx['kind'], number>> = { burst: 1, nova: 2, splat: 2, frost: 3, blood: 2 };
  const row = rows[fx.kind]; if (row === undefined) return false;
  const k = Math.min(.999, fx.t / fx.life), index = row * 8 + Math.floor(k * 8), size = Math.max(.6, fx.r * 2) * v.s;
  const x = X(v, fx.x), y = Y(v, fx.y);
  ctx.save(); ctx.globalAlpha *= k > .8 ? (1 - k) * 5 : 1;
  drawAsset(ctx, 'effects', index, x - size / 2, y - size / 2, size, size); ctx.restore(); return true;
}

export function drawRealisticPits(ctx: CanvasRenderingContext2D, v: View, t: number) {
  const type = LV.def.pit;
  const colors: Record<string, [string, string, string]> = { acid: ['#6d8453', '#263d24', '#09180e'], blood: ['#784448', '#36171d', '#120b11'], lava: ['#d7a254', '#8b3c1e', '#251510'], fire: ['#bd7c3b', '#592b1b', '#181112'] };
  if (!colors[type]) return false;
  const c = colors[type];
  for (const [a, b] of GAPS) {
    const x = X(v, a), width = (b - a) * v.s, top = Y(v, 1.4);
    const liquid = ctx.createLinearGradient(0, top, 0, v.h); liquid.addColorStop(0, c[0]); liquid.addColorStop(.08, c[1]); liquid.addColorStop(1, c[2]);
    ctx.save(); ctx.beginPath(); ctx.rect(x, top - v.s * .1, width, v.h - top + v.s * .2); ctx.clip();
    ctx.fillStyle = liquid; ctx.fillRect(x, top, width, v.h - top);
    for (let i = 0; i < 16; i++) {
      const py = top + i * v.s * .06, wave = Math.sin(t * 1.8 + i * 1.7 + a) * v.s * .025;
      ctx.strokeStyle = i % 3 ? `${c[0]}33` : `${c[0]}77`; ctx.lineWidth = Math.max(.65, v.s * .014);
      ctx.beginPath(); ctx.moveTo(x - 4, py);
      for (let k = 0; k <= 12; k++) ctx.lineTo(x + width * k / 12, py + Math.sin(k * 2 + t * 2 + i) * wave);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const k = (t * .2 + i * .31) % 1, px = x + width * (.2 + i * .3);
      ctx.globalAlpha = Math.sin(k * Math.PI) * .2;
      drawAsset(ctx, 'traps', 14, px - v.s * .5, top - v.s * (.2 + k * .9), v.s, v.s * .7);
    }
    ctx.globalAlpha = 1;
    if (type === 'fire') for (let i = 0; i < 4; i++) fireLight(ctx, x + width * (i + .5) / 4, top, v.s * .5, v.s * .9, t, i + a);
    ctx.restore();
  }
  return true;
}

export const WEAPON_SPRITE: Record<Weapon, number> = { sword: 0, crossbow: 1, garlic: 2, cross: 3, firesword: 4, pistol: 5, ice: 6, holy: 7, venom: 8, violet: 9, guard: 10, bone: 11 };
export function realisticWeaponIcon(ctx: CanvasRenderingContext2D, weapon: Weapon, size: number) {
  if (!atlasReady('weapons')) return false;
  const id = WEAPON_SPRITE[weapon], aspect = assetAspect('weapons', id);
  const diagonal = ['sword', 'firesword', 'violet', 'bone'].includes(weapon);
  const w = Math.min(size * (diagonal ? 1.03 : .88), size * .88 * aspect), h = w / aspect;
  ctx.save(); if (diagonal) ctx.rotate(-.65);
  const drawn = drawAsset(ctx, 'weapons', id, -w / 2, -h / 2, w, h); ctx.restore(); return drawn;
}

export function realisticHeldWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, hand: [number, number], angle: number, attackT = -1, t = 0) {
  if (weapon === 'sword' && atlasReady('hunter')) {
    const w = 1.16, h = w / assetAspect('hunter', 18);
    ctx.save(); ctx.translate(...hand); ctx.rotate(Math.PI / 2 - angle);
    drawAsset(ctx, 'hunter', 18, -w * .18, -h / 2, w, h); ctx.restore(); return true;
  }
  if (!atlasReady('weapons')) return false;
  if ((weapon === 'garlic' || weapon === 'venom') && attackT > .1 && attackT < .3) return true;
  const index = WEAPON_SPRITE[weapon], aspect = assetAspect('weapons', index);
  const sword = ['sword', 'firesword', 'violet', 'bone'].includes(weapon);
  const w = sword ? weapon === 'bone' ? 1.55 : weapon === 'violet' ? 1.12 : 1.05 : weapon === 'crossbow' ? .9 : weapon === 'pistol' ? .6 : .38;
  const h = w / aspect;
  ctx.save(); ctx.translate(hand[0], hand[1]);
  if (sword || weapon === 'crossbow' || weapon === 'pistol') ctx.rotate(Math.PI / 2 - angle);
  const gripAt = weapon === 'bone' ? .23 : sword ? .135 : .25;
  drawAsset(ctx, 'weapons', index, -w * gripAt, -h * .5, w, h);
  if (weapon === 'firesword') {
    ctx.save(); ctx.translate(w * .5, 0); ctx.rotate(-Math.PI / 2);
    fireLight(ctx, 0, 0, .16, .66, t, .3); ctx.restore();
  }
  ctx.restore(); return true;
}
