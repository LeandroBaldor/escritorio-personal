import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('ciclo completo: brazos enteros detras y delante del torso, ocho personajes y ambos sentidos', async ({ page }, info) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  await expect(page.locator('.vamp2')).toHaveAttribute('data-realistic-art', 'ready', { timeout: 15000 });
  const result = await page.evaluate(async (record) => {
    const base = '/escritorio-personal/src/features/games/';
    const sprites = await import(/* @vite-ignore */ base + 'vampyium2Sprites.ts');
    const chars = await import(/* @vite-ignore */ base + 'vampyium2Chars.ts');
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const gait = await import(/* @vite-ignore */ base + 'vampyium2Gait.ts');
    const meta = (await import(/* @vite-ignore */ base + 'assets/vampyium2/atlas.json')).default;
    await sprites.waitForRealisticArt();
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1000;
    const c = canvas.getContext('2d')!, game = logic.newGame(1, 1);
    const kinds = ['walker', 'giant', 'mage', 'hammer', 'warrior', 'wolf', 'dracula'];
    const traces: number[][] = [];
    const heroTraces: number[][] = [];
    const nativeDraw = c.drawImage.bind(c);
    let trace: number[] | undefined;
    let heroTrace: number[] | undefined;
    c.drawImage = ((...args: Parameters<typeof c.drawImage>) => {
      const source = args[0] as HTMLImageElement;
      if (heroTrace && source.src?.includes('hunter') && args.length === 9) {
        const index = meta.hunter.frames.findIndex((f: { x: number; y: number; w: number }) =>
          f.y === args[2] && Number(args[1]) >= f.x && Number(args[1]) < f.x + f.w);
        if ([1, 3, 4].includes(index)) heroTrace.push(index);
      }
      if (trace && source.src && args.length === 9) {
        const atlas = source.src.includes('rig-a') ? 'rig-a' : source.src.includes('rig-b') ? 'rig-b' : '';
        if (atlas) {
          const index = meta[atlas].frames.findIndex((f: { x: number; y: number; w: number }) =>
            f.y === args[2] && Number(args[1]) >= f.x && Number(args[1]) < f.x + f.w);
          const part = index % meta[atlas].cols;
          if ([1, 2, 3].includes(part)) trace.push(part);
        }
      }
      nativeDraw(...args);
    }) as typeof c.drawImage;
    const draw = (phase: number, speed = 3) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillStyle = '#111a23'; c.fillRect(0, 0, 1800, 1000);
      c.fillStyle = '#f0d5a0'; c.font = '25px Georgia';
      c.fillText('Ciclo completo: brazo y pierna del mismo lado se oponen', 25, 40);
      c.font = '18px sans-serif'; c.fillText('El brazo que retrocede se dibuja ENTERO detras del torso. El que avanza, delante.', 25, 70);
      for (const direction of [1, -1]) for (let actor = 0; actor < 8; actor++) {
        const x = actor * 225 + 112, floor = direction === 1 ? 430 : 890;
        const K = 1.98 * (actor ? logic.BODY[kinds[actor - 1]].k : 1);
        const stance = gait.humanWalk(0, speed, K, true).stance;
        const distance = phase * K * .58 / stance;
        const cycle = gait.humanWalk(distance, speed, K, true);
        c.strokeStyle = '#5b6470'; c.beginPath(); c.moveTo(x - 105, floor); c.lineTo(x + 105, floor); c.stroke();
        c.save(); c.translate(x, floor); c.scale(direction * 150, 150);
        if (!actor) {
          const p = logic.newPlayer(); p.onGround = true; p.vx = direction * speed; p.walkT = distance * 2.4 / 7;
          if (phase === 0 || phase === .5) heroTrace = [];
          chars.drawHunterK(c, p, game, phase * 2);
          if (heroTrace) { heroTraces.push(heroTrace); heroTrace = undefined; }
        } else {
          const v = logic.makeVamp(game, kinds[actor - 1], { onGround: true, vx: direction * speed, state: 'walk', walkT: distance });
          if (phase === 0 || phase === .5) trace = [];
          sprites.drawRealisticEnemy(c, v, phase * 2);
          if (trace) { traces.push(trace); trace = undefined; }
        }
        c.restore();
        const transform = c.getTransform();
        if (transform.a !== 1 || transform.d !== 1 || transform.e !== 0 || transform.f !== 0)
          throw new Error('Unbalanced character transform: ' + actor);
        c.fillStyle = '#111a23'; c.fillRect(actor * 225, floor + 5, 225, 84);
        c.fillStyle = '#eadbc4'; c.font = '18px sans-serif'; c.textAlign = 'left';
        c.fillText(actor ? kinds[actor - 1] : 'Demian', x - 70, floor + 28);
        c.font = '14px sans-serif';
        const side = cycle.dx[1] > 0 ? 'D' : 'I';
        c.fillText('Pierna ' + side + ' delante', x - 85, floor + 50);
        c.fillText('Brazo ' + side + ' detras', x - 85, floor + 69);
      }
    };
    draw(0); const contact = canvas.toDataURL('image/png').split(',')[1];
    draw(.5); const opposite = canvas.toDataURL('image/png').split(',')[1];
    const frames: string[] = [];
    if (record) for (let i = 0; i < 32; i++) { draw(i / 32); frames.push(canvas.toDataURL('image/webp', .85)); }
    const fast = document.createElement('canvas'); fast.width = 1800; fast.height = 430;
    const fc = fast.getContext('2d')!;
    for (let i = 0; i < 8; i++) { draw(i / 8, 7); fc.drawImage(canvas, 0, 80, 225, 430, i * 225, 0, 225, 430); }
    return { contact, opposite, traces, heroTraces, frames, fast: fast.toDataURL('image/png').split(',')[1] };
  }, info.project.name === 'desktop');
  // Upper arm + forearm behind chest, then the OTHER whole arm in front, for every enemy/direction.
  for (const trace of result.traces) expect(trace).toEqual([2, 3, 1, 2, 3]);
  expect(result.traces.length).toBeGreaterThanOrEqual(28);
  for (const trace of result.heroTraces) expect(trace).toEqual([3, 4, 1, 3, 4]);
  expect(result.heroTraces.length).toBeGreaterThanOrEqual(4);
  if (info.project.name === 'desktop') {
    fs.writeFileSync('docs/vampyium2-round6-contact.png', Buffer.from(result.contact, 'base64'));
    fs.writeFileSync('docs/vampyium2-round6-opposite.png', Buffer.from(result.opposite, 'base64'));
    fs.writeFileSync('docs/vampyium2-round6-running.png', Buffer.from(result.fast, 'base64'));
    fs.writeFileSync('docs/vampyium2-round6-preview.html', '<!doctype html><html lang="es"><meta charset="utf-8"><title>Vampyium 2: ciclo y capas</title><style>body{background:#111a23;color:#eadbc4;font:18px system-ui;margin:20px}img{width:100%;max-width:1800px}button,input{margin:12px;padding:8px}input{width:280px}</style><h1>Caminata: ocho personajes, ambos sentidos</h1><p>Brazo completo atras al avanzar la pierna del mismo lado. Demian baja la espada para alternar ambos brazos al caminar.</p><button id="play">Pausar</button><input id="position" aria-label="Fase del paso" type="range" min="0" max="31" value="0"><label>Velocidad <select id="speed"><option value=".25">0.25x</option><option value=".5">0.5x</option><option selected value="1">1x</option></select></label><img id="view" alt="Caminata de Demian y siete vampiros a derecha e izquierda"><script>const frames=' + JSON.stringify(result.frames) + ';let playing=true,phase=0,last=performance.now();const slider=document.getElementById("position"),button=document.getElementById("play");button.onclick=()=>{playing=!playing;button.textContent=playing?"Pausar":"Reproducir"};slider.oninput=()=>{phase=Number(slider.value)/32;playing=false;button.textContent="Reproducir"};function tick(now){if(playing)phase=(phase+(now-last)/2200*Number(document.getElementById("speed").value))%1;last=now;const i=Math.floor(phase*32)%32;document.getElementById("view").src=frames[i];slider.value=i;requestAnimationFrame(tick)}requestAnimationFrame(tick);</script></html>');
  }
});

