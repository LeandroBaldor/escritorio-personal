import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('arte realista: todos los atlas, estados de enemigos y diez escenarios', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/MiniJuegos/#/juegos/vampyium2');
  const result = await page.evaluate(async () => {
    const base = '/MiniJuegos/src/features/games/';
    const sprites = await import(/* @vite-ignore */ base + 'vampyium2Sprites.ts');
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const art = await import(/* @vite-ignore */ base + 'vampyium2Art.ts');
    const chars = await import(/* @vite-ignore */ base + 'vampyium2Chars.ts');
    await sprites.waitForRealisticArt();
    const sheet = document.createElement('canvas'); sheet.width = 1400; sheet.height = 800;
    const ctx = sheet.getContext('2d')!;
    ctx.fillStyle = '#111923'; ctx.fillRect(0, 0, 1400, 800);
    const game = logic.newGame(19, 10);
    for (const [kind, attack] of Object.entries(logic.ATTACK) as [string, { at: number }][]) {
      const v = logic.makeVamp(game, kind, { state: 'claw', t: attack.at - .001 });
      if (sprites.enemyFrame(v, 0) !== 4 || sprites.enemyFrame({ ...v, t: attack.at + .001 }, 0) !== 5) throw Error('Attack pose timing: ' + kind);
    }
    for (const [state, at] of [['cast', .55], ['breath', .35], ['zap', .4]] as const) {
      const v = logic.makeVamp(game, state === 'breath' ? 'dragon' : 'mage', { state, t: at - .001 });
      if (sprites.enemyFrame(v, 0) !== 4 || sprites.enemyFrame({ ...v, t: at + .001 }, 0) !== 5) throw Error('Spell pose timing: ' + state);
    }
    ['hunter', ...logic.VAMP_KINDS].forEach((kind, i) => {
      const x = (i % 5) * 280, y = Math.floor(i / 5) * 400;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, 280, 400); ctx.clip();
      art.drawPortrait(ctx, kind, game, x + 140, y + (kind === 'dragon' ? 255 : 320), kind === 'dragon' ? 39 : kind === 'giant' ? 105 : kind === 'wolf' ? 120 : kind === 'dracula' ? 90 : 132, .4);
      ctx.fillStyle = '#c7b798'; ctx.font = '18px Georgia'; ctx.textAlign = 'center'; ctx.fillText(kind, x + 140, y + 370); ctx.restore();
    });
    const gallery = sheet.toDataURL('image/png').split(',')[1];
    let states = 0;
    const scratch = document.createElement('canvas'); scratch.width = 1000; scratch.height = 600;
    const sc = scratch.getContext('2d')!;
    for (const kind of logic.VAMP_KINDS) for (const state of ['walk', 'claw', 'hover', 'dive', 'rise', 'cast', 'leap', 'mist', 'breath', 'land', 'zap']) {
      for (const t of [0, .15, .4, .8]) {
        const v = logic.makeVamp(game, kind, { x: 10, y: logic.GROUND_Y, state, t, vx: state === 'walk' ? 2 : 0, walkT: t - .2 });
        sc.save(); sc.translate(500, 380); sc.scale(85, 85);
        if (!sprites.drawRealisticEnemy(sc, v, t)) throw Error('Missing realistic sprite ' + kind);
        sc.restore(); states++;
      }
    }
    // The same skeleton must support all original weapons and action combinations.
    for (const weapon of logic.WEAPONS) for (const action of ['idle', 'walk', 'jump', 'fall', 'attack', 'hurt', 'land', 'spin', 'dash', 'whirl', 'throw']) {
      game.weapon = weapon;
      const p = logic.newPlayer(); p.onGround = !['jump', 'fall', 'spin'].includes(action);
      p.vx = action === 'walk' ? 7 : 0; p.vy = action === 'jump' ? 9 : action === 'fall' ? -9 : 0;
      p.walkT = .3; p.attackWeapon = weapon; p.attackT = action === 'attack' ? .12 : -1;
      p.hurtT = action === 'hurt' ? .2 : 0; p.landT = action === 'land' ? .15 : 0;
      p.spinT = action === 'spin' ? .2 : 0;
      if (['spin', 'dash', 'whirl', 'throw'].includes(action)) p.special = { kind: action, t: .1, dir: 1, hits: new Set() };
      sc.save(); sc.translate(500, 380); sc.scale(85, 85); chars.drawHunterK(sc, p, game, .4); sc.restore(); states++;
    }
    const levels = document.createElement('canvas'); levels.width = 1280; levels.height = 1900;
    let aimed = 0;
    for (const weapon of logic.AIMED) for (const aim of [-1, 0, 1]) {
      game.weapon = weapon;
      const p = logic.newPlayer(); p.aim = aim; p.attackT = .08; p.attackWeapon = weapon;
      sc.save(); sc.translate(500, 380); sc.scale(85, 85); chars.drawHunterK(sc, p, game, .4); sc.restore(); aimed++;
    }
    const lc = levels.getContext('2d')!;
    for (let level = 1; level <= 10; level++) {
      const g = logic.newGame(20, level); g.time = 4.3;
      g.player.x = 3; g.player.y = logic.GROUND_Y; g.player.onGround = true; g.weapon = logic.WEAPONS[Math.min(11, level)];
      const roster = level === 10 ? ['dracula', 'dragon'] : logic.rosterOf(level);
      g.vamps = roster.map((kind: string, i: number) => logic.makeVamp(g, kind, { x: 9 + i * 2.1, y: kind === 'dragon' || kind === 'flyer' ? 6 : logic.GROUND_Y, onGround: !['flyer', 'dragon'].includes(kind), state: kind === 'flyer' ? 'hover' : 'walk', walkT: .3, vx: 1 }));
      const bg = new Image(); bg.src = base + 'assets/vampyrium/' + logic.LEVELS[level - 1].bg + '.webp'; await bg.decode();
      await new Promise<void>(resolve => art.setBackdrop(bg.src, resolve));
      logic.loadLevel(level);
      art.drawGame(sc, g, 1000, 600, 4.3);
      const x = ((level - 1) % 2) * 640, y = Math.floor((level - 1) / 2) * 380;
      lc.drawImage(scratch, x, y, 640, 360); lc.fillStyle = '#10161d'; lc.fillRect(x, y + 360, 640, 20);
      lc.fillStyle = '#d1bf9e'; lc.font = '13px Georgia'; lc.fillText(level + ' · ' + logic.LEVELS[level - 1].name, x + 12, y + 375);
    }
    return { status: sprites.realisticArtStatus(), states, aimed, gallery, levels: levels.toDataURL('image/png').split(',')[1] };
  });
  expect(result.status).toHaveLength(15); // (+ la cara de Demian y las piezas del dragón volando)
  expect(result.status.every((s: { ready: boolean }) => s.ready)).toBe(true);
  expect(result.status.reduce((n: number, s: { frames: number }) => n + s.frames, 0)).toBe(277);
  expect(result.states).toBe(528);
  expect(result.aimed).toBe(15);
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'desktop') {
    fs.writeFileSync('docs/vampyium2-realistic-characters.png', Buffer.from(result.gallery, 'base64'));
    fs.writeFileSync('docs/vampyium2-realistic-levels.png', Buffer.from(result.levels, 'base64'));
  }
});
