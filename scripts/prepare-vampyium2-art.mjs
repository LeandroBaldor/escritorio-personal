/* global process, console, Image, document */
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright';

// Convert generated PNG atlases without repainting them; preserve their original alpha.
// node scripts/prepare-vampyium2-art.mjs manifest.json
const entries = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const out = 'src/features/games/assets/vampyium2';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const atlas = {};
try {
  const page = await browser.newPage();
  for (const entry of entries) {
    const result = await page.evaluate(async ({ raw, cols, rows, loose, opaque }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + raw; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 16) transparent++;
      const alphaRatio = transparent / (canvas.width * canvas.height);
      if (!opaque && alphaRatio < .12) return { error: 'No genuine transparency', alphaRatio };
      const frames = [];
      for (let row = 0; row < rows; row++) {
        let spans = [];
        if (loose) {
          let start = -1, last = -1;
          for (let x = 0; x < canvas.width; x++) {
            let count = 0;
            for (let y = Math.round(row * canvas.height / rows); y < Math.round((row + 1) * canvas.height / rows); y++) if (pixels[(y * canvas.width + x) * 4 + 3] > 100) count++;
            if (count > 3) { if (start < 0) start = x; last = x; }
            else if (start >= 0 && x - last > 5) { spans.push([start, last + 1]); start = -1; }
          }
          if (start >= 0) spans.push([start, last + 1]);
          spans = spans.filter(([a, b]) => b - a > 12);
          while (spans.length > cols) {
            let at = 0, gap = Infinity;
            for (let i = 0; i < spans.length - 1; i++) if (spans[i + 1][0] - spans[i][1] < gap) { gap = spans[i + 1][0] - spans[i][1]; at = i; }
            spans.splice(at, 2, [spans[at][0], spans[at + 1][1]]);
          }
        }
        for (let col = 0; col < cols; col++) {
        const x0 = spans.length === cols ? spans[col][0] : Math.round(col * canvas.width / cols), x1 = spans.length === cols ? spans[col][1] : Math.round((col + 1) * canvas.width / cols);
        const y0 = Math.round(row * canvas.height / rows), y1 = Math.round((row + 1) * canvas.height / rows);
        let left = x1, top = y1, right = x0, bottom = y0, count = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] < 48) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
        }
        if (count < 120) throw Error('Empty sprite ' + row + ':' + col);
        frames.push({ x: left, y: top, w: right - left + 1, h: bottom - top + 1 });
        }
      }
      return { width: canvas.width, height: canvas.height, alphaRatio, frames, data: canvas.toDataURL('image/webp', .94).split(',')[1] };
    }, { ...entry, raw: fs.readFileSync(entry.path).toString('base64') });
    if (result.error) { console.log(JSON.stringify({ name: entry.name, ...result })); continue; }
    const { data, ...meta } = result;
    fs.writeFileSync(path.join(out, entry.name + '.webp'), Buffer.from(data, 'base64'));
    if (!entry.opaque) atlas[entry.name] = { cols: entry.cols, rows: entry.rows, ...meta };
    console.log(JSON.stringify({ name: entry.name, frames: result.frames.length, alphaRatio: result.alphaRatio, width: result.width, height: result.height }));
  }
  const manifest = path.join(out, 'atlas.json');
  const previous = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : {};
  fs.writeFileSync(manifest, JSON.stringify({ ...previous, ...atlas }, null, 2) + '\n');
} finally { await browser.close(); }
