/* global process, console, Buffer, Image, document */
// node scripts/prepare-land-world.mjs <atlas-paisajes.png> <atlas-objetos.png> [atlas-agua.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const [scenes, props, liquids] = process.argv.slice(2);
if (!scenes || !props) throw new Error('Indicá el atlas de paisajes (2 × 5) y el de objetos (4 × 3).');
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/features/games/assets/land');
fs.mkdirSync(path.join(output, 'scenes'), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const inputs = [['scenes', scenes], ['props', props]];
  if (liquids) inputs.push(['liquids', liquids]);
  for (const [kind, file] of inputs) {
    const raw = fs.readFileSync(file).toString('base64');
    const images = await page.evaluate(async ({ raw, kind }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + raw; await image.decode();
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
      if (kind !== 'scenes') {
        cv.width = image.naturalWidth; cv.height = image.naturalHeight; ctx.drawImage(image, 0, 0);
        if (kind === 'liquids') return [cv.toDataURL('image/webp', .95).split(',')[1]];
        const pixels = ctx.getImageData(0, 0, cv.width, cv.height), histogram = new Uint32Array(256);
        for (let i = 3; i < pixels.data.length; i += 4) histogram[pixels.data[i]]++;
        let peak = 255; for (let a = 232; a <= 255; a++) if (histogram[a] > histogram[peak]) peak = a;
        for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = Math.max(0, Math.min(255, (pixels.data[i] - peak + 12) * 255 / 9));
        ctx.putImageData(pixels, 0, 0); return [cv.toDataURL('image/webp', .95).split(',')[1]];
      }
      const out = [];
      for (let i = 0; i < 10; i++) {
        const x0 = Math.round(i % 2 * image.naturalWidth / 2), x1 = Math.round((i % 2 + 1) * image.naturalWidth / 2);
        const y0 = Math.round(Math.floor(i / 2) * image.naturalHeight / 5), y1 = Math.round((Math.floor(i / 2) + 1) * image.naturalHeight / 5);
        cv.width = x1 - x0; cv.height = y1 - y0; ctx.drawImage(image, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
        out.push(cv.toDataURL('image/webp', .94).split(',')[1]);
      }
      return out;
    }, { raw, kind });
    for (let i = 0; i < images.length; i++) {
      const file = kind === 'liquids' ? 'liquids.webp' : kind === 'props' ? 'world-props.webp' : 'scenes/scene-' + i + '.webp';
      fs.writeFileSync(path.join(output, file), Buffer.from(images[i], 'base64')); console.log(file);
    }
  }
} finally { await browser.close(); }
