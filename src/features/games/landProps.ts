// Recortes de objetos del mundo, compartidos por el escenario, los recursos y el HUD.
const URLS = import.meta.glob('./assets/land/world-props.webp', { eager: true, import: 'default' }) as Record<string, string>;
let image: HTMLImageElement | null = null;
const frames: { x: number; y: number; w: number; h: number }[] = [];
export function worldPropsReady() {
  if (!image && typeof Image !== 'undefined' && URLS['./assets/land/world-props.webp']) {
    image = new Image();
    image.onload = () => {
      const cv = document.createElement('canvas'); cv.width = image!.naturalWidth; cv.height = image!.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image!, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < 12; i++) {
        const x0 = Math.round(i % 4 * cv.width / 4), x1 = Math.round((i % 4 + 1) * cv.width / 4);
        const y0 = Math.round(Math.floor(i / 4) * cv.height / 3), y1 = Math.round((Math.floor(i / 4) + 1) * cv.height / 3);
        let left = x1, top = y1, right = x0, bottom = y0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * cv.width + x) * 4 + 3] > 32) {
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        frames[i] = right >= left && bottom >= top ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    };
    image.src = URLS['./assets/land/world-props.webp'];
  }
  return frames.length === 12;
}
export function drawWorldProp(ctx: CanvasRenderingContext2D, index: number, x: number, y: number, height: number, maxWidth = height * 1.5, flip = false) {
  if (!worldPropsReady()) return false;
  const f = frames[index], k = Math.min(height / f.h, maxWidth / f.w);
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image!, f.x, f.y, f.w, f.h, -f.w * k / 2, -f.h * k, f.w * k, f.h * k); ctx.restore(); return true;
}
