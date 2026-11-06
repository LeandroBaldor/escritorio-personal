/* global process, console, Buffer, Image, document */
// Convierte las hojas generadas a WebP y elimina el velo residual del fondo.
// node scripts/prepare-land-art.mjs /ruta/a/las/hojas-png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const input = process.argv[2];
if (!input) throw new Error('Indicá la carpeta con units-<civilización>.png y terrain-materials.png.');
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/features/games/assets/land');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const file of fs.readdirSync(input).filter(n => /^units-[a-z]+\.png$|^terrain-materials\.png$/.test(n))) {
    const raw = fs.readFileSync(path.join(input, file)).toString('base64');
    const encoded = await page.evaluate(async ({ raw, clean }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + raw; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      if (clean) {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const histogram = new Uint32Array(256);
        for (let i = 3; i < pixels.data.length; i += 4) histogram[pixels.data[i]]++;
        let peak = 255;
        for (let a = 232; a <= 255; a++) if (histogram[a] > histogram[peak]) peak = a;
        const threshold = peak - 12;
        for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = Math.max(0, Math.min(255, (pixels.data[i] - threshold) * 255 / 9));
        ctx.putImageData(pixels, 0, 0);
      }
      return canvas.toDataURL('image/webp', 0.94).split(',')[1];
    }, { raw, clean: file.startsWith('units-') });
    const name = file.replace('.png', '.webp'), bytes = Buffer.from(encoded, 'base64');
    fs.writeFileSync(path.join(output, name), bytes);
    console.log(`${name}: ${Math.round(bytes.length / 1024)} KiB`);
  }
} finally { await browser.close(); }
