import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('referencias de Demian y caminata con tobillo independiente', async ({ page }, testInfo) => {
  await page.goto('/escritorio-personal/#/juegos/vampyium2');
  await expect(page.locator('.vamp2')).toHaveAttribute('data-realistic-art', 'ready', { timeout: 15000 });
  const result = await page.evaluate(async ({ record }) => {
    const base = '/escritorio-personal/src/features/games/';
    const sprites = await import(/* @vite-ignore */ base + 'vampyium2Sprites.ts');
    const chars = await import(/* @vite-ignore */ base + 'vampyium2Chars.ts');
    const logic = await import(/* @vite-ignore */ base + 'vampyium2.ts');
    const motion = await import(/* @vite-ignore */ base + 'vampyium2Motion.ts');
    await sprites.waitForRealisticArt();
    const game = logic.newGame(1, 1), canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 760;
    const c = canvas.getContext('2d')!;
    const draw = (time: number) => {
      c.fillStyle = '#111a23'; c.fillRect(0, 0, 1400, 760);
      c.fillStyle = '#d8c399'; c.font = '25px Georgia'; c.fillText('Demian: reposo y estocada (camara lenta)', 55, 58);
      c.fillText('Paso lateral: talon, apoyo y despegue', 760, 58);
      c.strokeStyle = '#53606a'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 635); c.lineTo(1370, 635); c.stroke();
      const phase = time / 3.6;
      const at = phase < .30 ? -1 : phase < .50 ? (phase - .30) / .20 * .09
        : phase < .70 ? .13 : .21 + (phase - .70) / .30 * .09;
      const p = logic.newPlayer(); p.onGround = true; p.attackT = at; p.attackWeapon = 'sword';
      c.save(); c.translate(260, 635); c.scale(220, 220); chars.drawHunterK(c, p, game, time); c.restore();
      const kind = 'walker', speed = 2.2, pixels = 60;
      const v = logic.makeVamp(game, kind, { onGround: true, vx: speed, state: 'walk', walkT: speed * time });
      c.save(); c.translate(750 + speed * time * pixels, 635);
      const scale = .88 * motion.VAMP_VISUAL_SCALE * logic.BODY[kind].k * pixels;
      c.scale(scale, scale); sprites.drawRealisticEnemy(c, v, time); c.restore();
    };
    draw(0); const idle = canvas.toDataURL('image/png').split(',')[1];
    draw(2.1); const strike = canvas.toDataURL('image/png').split(',')[1];
    const heads = document.createElement('canvas'); heads.width = 1600; heads.height = 880;
    const hc = heads.getContext('2d')!; hc.fillStyle = '#111a23'; hc.fillRect(0, 0, 1600, 880);
    for (let i = 0; i < 8; i++) {
      const h = 360, w = h * sprites.assetAspect('heads', i);
      sprites.drawAsset(hc, 'heads', i, i % 4 * 400 + 200 - w / 2, Math.floor(i / 4) * 440 + 45, w, h);
    }
    const frames: string[] = [];
    if (record) {
      for (let i = 0; i < 48; i++) { draw(i / 47 * 3.6); frames.push(canvas.toDataURL('image/webp', .84)); }
    }
    return { idle, strike, heads: heads.toDataURL('image/png').split(',')[1], frames,
      headReady: sprites.atlasReady('heads'), legsReady: sprites.atlasReady('enemy-legs') };
  }, { record: testInfo.project.name === 'desktop' });
  expect(result.headReady && result.legsReady).toBe(true);
  if (testInfo.project.name === 'desktop') {
    for (const name of ['idle', 'strike', 'heads'] as const)
      fs.writeFileSync('docs/vampyium2-round3-' + name + '.png', Buffer.from(result[name], 'base64'));
    expect(result.frames.length).toBe(48);
    const html = '<!doctype html><html lang="es"><meta charset="utf-8"><title>Vampyium 2 - tercera ronda</title>' +
      '<style>body{margin:0;background:#111a23;color:#e2d3b4;font:16px system-ui}main{max-width:1400px;margin:auto;padding:20px}img{width:100%;display:block}button,input{accent-color:#ad843b}button{padding:10px 24px;background:#512329;border:1px solid #c29d60;color:#fff;font:inherit}label{margin:0 15px}input[type=range]{width:230px}</style>' +
      '<main><h1>Vampyium 2: Demian y caminata</h1><p>Vista previa de poses y movimiento.</p><img id="view" alt="Demian pasa del reposo a la estocada y un vampiro camina con apoyo de talon y punta">' +
      '<button id="play">Pausar</button><label>Posicion <input id="frame" type="range" min="0" max="47" value="0"></label><label>Velocidad <input id="speed" type="range" min=".25" max="1.5" step=".25" value="1"></label></main>' +
      '<script>const frames=' + JSON.stringify(result.frames) + ';const view=document.getElementById("view"),slider=document.getElementById("frame"),button=document.getElementById("play");let playing=true,phase=0,last=performance.now();button.onclick=()=>{playing=!playing;button.textContent=playing?"Pausar":"Reproducir"};slider.oninput=()=>{phase=Number(slider.value)/48;playing=false;button.textContent="Reproducir"};function tick(now){if(playing)phase=(phase+(now-last)/3600*Number(document.getElementById("speed").value))%1;last=now;const i=Math.min(47,Math.floor(phase*48));view.src=frames[i];slider.value=i;requestAnimationFrame(tick)}requestAnimationFrame(tick);</script></html>';
    fs.writeFileSync('docs/vampyium2-round3-preview.html', html);
  }
});
