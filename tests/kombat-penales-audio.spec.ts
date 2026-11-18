import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('el juego real reproduce vuelo, carga del ovni y grito previo al pisotón', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const bytes = new WeakMap<ArrayBuffer, string>(), decoded = new WeakMap<AudioBuffer, string>();
    const state = window as unknown as { penAudioStarts: string[]; penDecoded: string[] };
    state.penAudioStarts = []; state.penDecoded = [];
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const response = await fetchOriginal(...args), arrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => { const buffer = await arrayBuffer(); bytes.set(buffer, String(args[0])); return buffer; };
      return response;
    };
    const decodeOriginal = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (buffer: ArrayBuffer) {
      const url = bytes.get(buffer) ?? '';
      return decodeOriginal.call(this, buffer).then(audio => { decoded.set(audio, url); state.penDecoded.push(url); return audio; });
    };
    const createOriginal = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = createOriginal.call(this), start = source.start.bind(source);
      source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => { state.penAudioStarts.push(source.buffer ? decoded.get(source.buffer) ?? '' : ''); start(...args); };
      return source;
    };
  });
  const base = project.name === 'minijuegos' ? '/MiniJuegos/' : '/escritorio-personal/';
  await page.goto(`${base}#/juegos/penales`);
  await page.getByRole('button', { name: '2 Jugadores' }).click();
  const a = page.getByRole('group', { name: 'Tu jugador' }).getByRole('button', { name: 'TOXIC' }); await a.click(); await a.click();
  const b = page.getByRole('group', { name: 'Rival' }).getByRole('button', { name: 'CYBER' }); await b.click(); if (await b.isVisible()) await b.click();
  await page.getByRole('button', { name: /Elegir el estadio/ }).click();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByRole('button', { name: '¡A patear!' }).click();
  await expect(page.locator('canvas.kp-referee-layer')).toHaveCount(1);
  const refereeResolution = await page.locator('canvas.kp-referee-layer').evaluate(async (node, base) => {
    const { pixelRatio } = await import(/* @vite-ignore */ `${base}src/features/games/fitScreen.ts`);
    const c = node as HTMLCanvasElement, parent = c.parentElement!;
    const ratio = Math.min(pixelRatio(3), 3840 / parent.clientWidth, 2160 / parent.clientHeight);
    return { actual: [c.width, c.height], expected: [Math.round(parent.clientWidth * ratio), Math.round(parent.clientHeight * ratio)] };
  }, base);
  expect(refereeResolution.actual).toEqual(refereeResolution.expected);
  await expect.poll(() => page.locator('canvas.kp-referee-layer').evaluate(node => {
    const c = node as HTMLCanvasElement, data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 200) count++;
    return count;
  })).toBeGreaterThan(500);
  await page.locator('.runner-stage').screenshot({ path: test.info().outputPath('referee-native-resolution.png') });
  await page.waitForFunction(() => (window as unknown as { penDecoded: string[] }).penDecoded.some(s => s.includes('pen-grito')));
  await page.evaluate(() => {
    const state = window as unknown as { __kpMatch: () => { phase: string; phaseT: number; winner: number; finale: unknown; kick: unknown; death: unknown }; penAudioStarts: string[] };
    const m = state.__kpMatch(); m.phase = 'execution'; m.phaseT = 0; m.winner = 1; m.finale = { loser: 0, fired: false }; m.kick = null; m.death = null; state.penAudioStarts = [];
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { penAudioStarts: string[] }).penAudioStarts.filter(s => /pen-ovni/.test(s))), { timeout: 10_000 }).toEqual(expect.arrayContaining([expect.stringContaining('pen-ovni.mp3'), expect.stringContaining('pen-ovni-dispara.mp3')]));
  // Ejercita el mismo bucle del juego con el pie a 0,1 s del umbral del grito.
  await page.evaluate(() => {
    const state = window as unknown as { __kpMatch: () => { phase: string; phaseT: number; finale: unknown; kick: unknown; death: unknown }; penAudioStarts: string[] };
    const m = state.__kpMatch(); m.phase = 'kick'; m.phaseT = 0; m.finale = null;
    m.kick = { shooter: 0, shot: 0, dive: 0, outcome: 'save', t: 3.9, scored: true, boom: true, kboom: false, hit: true, sounded: true, fx: 'fuego' };
    m.death = { type: 'stomp', side: 0, keeper: false, at: 2, clock: 0, t: 1.9, finished: false, x: 100, y: 500, h: 300 }; state.penAudioStarts = [];
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { penAudioStarts: string[] }).penAudioStarts), { timeout: 5000 }).toContainEqual(expect.stringContaining('pen-grito.mp3'));
});
