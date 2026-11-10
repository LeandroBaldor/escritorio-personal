import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('guardia, agarre, ataques continuos y restos anatómicos', async ({ page }, testInfo) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  await expect(page.locator('.vamp2')).toHaveAttribute('data-realistic-art', 'ready');
  const result = await page.evaluate(async () => {
    const base = '/escritorio-personal/src/features/games/';
    const art = await import(/* @vite-ignore */ base + 'vampyium2Sprites.ts');
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const chars = await import(/* @vite-ignore */ base + 'vampyium2Chars.ts');
    const render = await import(/* @vite-ignore */ base + 'vampyium2Art.ts');
    await art.waitForRealisticArt();
    const sheet = (w: number, h: number) => {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#121b24'; c.fillRect(0, 0, w, h); return { canvas, c };
    };
    const hero = sheet(1800, 740), game = logic.newGame(1, 1);
    for (let i = 0; i < 3; i++) {
      const p = logic.newPlayer(); p.onGround = true;
      if (i === 2) { p.attackT = .13; p.attackWeapon = 'sword'; }
      hero.c.save(); hero.c.translate(245 + i * 450, 670); hero.c.scale(i === 1 ? -280 : 280, 280);
      chars.drawHunterK(hero.c, p, game, .5); hero.c.restore();
    }
    const attacks = sheet(2400, 2450), distinct = [];
    let row = 0;
    for (const kind of ['walker', 'giant', 'mage', 'hammer', 'warrior', 'wolf', 'dracula']) {
      const at = logic.ATTACK[kind].at, duration = logic.ATTACK[kind].dur, hashes = new Set();
      const times = [0, at * .4, at * .72, at, at + (duration - at) * .4, duration];
      for (let i = 0; i < times.length; i++) {
        const v = logic.makeVamp(game, kind, { state: 'claw', onGround: true, t: times[i], vx: 0, walkT: 0 });
        const pose = sheet(400, 350);
        pose.c.save(); pose.c.translate(145, 330); pose.c.scale(135, 135);
        art.drawRealisticEnemy(pose.c, v, .5); pose.c.restore();
        hashes.add(pose.canvas.toDataURL());
        attacks.c.drawImage(pose.canvas, i * 400, row * 350);
      }
      distinct.push({ kind, count: hashes.size }); row++;
    }
    const bones = sheet(1260, 600), names = ['skull', 'jaw', 'ribs', 'pelvis', 'arm', 'leg', 'spine'];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
      const source = ['walker', 'wolf', 'dragon'][row], x = col * 180 + 90, y = row * 200 + 100;
      render.drawBone(bones.c, { kind: names[col], source, x: 0, y: 0, a: 0, t: 2, s: 1, rest: true },
        { s: 125, ox: x, oy: y, w: 1260, h: 600 });
    }
    const png = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1];
    return { hero: png(hero.canvas), attacks: png(attacks.canvas), bones: png(bones.canvas), distinct };
  });
  for (const v of result.distinct) expect(v.count, v.kind).toBeGreaterThanOrEqual(5);
  if (testInfo.project.name === 'desktop') for (const name of ['hero', 'attacks', 'bones'] as const)
    fs.writeFileSync('docs/vampyium2-refined-' + name + '.png', Buffer.from(result[name], 'base64'));
});
