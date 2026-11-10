/* global console, Buffer, Image, document */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const target = path.resolve('src/features/games/assets/factory');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const name of ['backgrounds', 'hero', 'foods']) {
    const raw = fs.readFileSync(path.join(target, `${name}-source.png`)).toString('base64');
    const output = await page.evaluate(async ({ raw, name }) => {
      const image = new Image(); image.src = `data:image/png;base64,${raw}`; await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, webp: canvas.toDataURL('image/webp', name === 'hero' ? 0.94 : 0.9).split(',')[1] };
    }, { raw, name });
    fs.writeFileSync(path.join(target, `${name}.webp`), Buffer.from(output.webp, 'base64'));
    console.log(`${name}: ${output.width}x${output.height}`);
  }
} finally { await browser.close(); }
