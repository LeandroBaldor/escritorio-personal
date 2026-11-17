// Fuego continuo: campo de combustible, turbulencia y temperatura, sin partículas geométricas.
const W = 112, H = 192, TABLE = 128;
const turbulence = new Float32Array(TABLE * TABLE);
let seed = 7319;
for (let i = 0; i < turbulence.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; turbulence[i] = seed / 4294967296; }
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = turbulence[(iy & 127) * TABLE + (ix & 127)], b = turbulence[(iy & 127) * TABLE + ((ix + 1) & 127)];
  const c = turbulence[((iy + 1) & 127) * TABLE + (ix & 127)], d = turbulence[((iy + 1) & 127) * TABLE + ((ix + 1) & 127)];
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let pixels: ImageData | null = null;
let lastFrame = '';
const fuelX = [-0.22, 0.25, -0.05, -0.24, 0.18];
const centers = new Float32Array(5), widths = new Float32Array(5), strengths = new Float32Array(5);

export function drawPenFire(ctx: CanvasRenderingContext2D, t: number, intensity: number) {
  if (intensity <= 0) return;
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; context = canvas.getContext('2d'); pixels = context?.createImageData(W, H) ?? null; }
  if (!canvas || !context || !pixels) return;
  const frame = `${Math.floor(t * 40)}:${Math.round(intensity * 40)}`;
  if (frame !== lastFrame) {
    const data = pixels.data, length = 0.8 + intensity * 0.95;
    data.fill(0);
    for (let y = 0; y < H; y++) {
      const z = (1 - y / (H - 1)) * 4.3 - 0.08;
      for (let i = 0; i < 5; i++) {
        const travel = (z - i * 0.48) / length;
        strengths[i] = travel >= 0 && travel < 1 ? Math.pow(1 - travel, 0.62) : 0;
        centers[i] = fuelX[i] + (noise(i * 17 + z * 1.25, t * 1.35) - 0.5) * (0.18 + Math.max(0, travel) * 0.55);
        widths[i] = (0.2 + intensity * 0.075) * (1 - Math.max(0, travel) * 0.76);
      }
      for (let x = 0; x < W; x++) {
        const xx = (x / (W - 1) - 0.5) * 2.1;
        let fuel = 0;
        for (let i = 0; i < 5; i++) {
          const distance = (xx - centers[i]) / widths[i], profile = Math.max(0, 1 - distance * distance);
          fuel += profile * strengths[i];
        }
        if (fuel <= 0) continue;
        const flow = noise(xx * 5 + 31, z * 3.8 - t * 3.1) * 0.7 + noise(xx * 12 - t * 0.6, z * 8.5 - t * 6.4) * 0.3;
        const heat = Math.max(0, Math.min(1, fuel * 0.78 + (flow - 0.5) * 0.9 - 0.1));
        if (heat <= 0) continue;
        const p = (y * W + x) * 4, hot = Math.max(0, (heat - 0.66) / 0.34);
        data[p] = Math.min(255, 180 + heat * 140);
        data[p + 1] = Math.min(255, 28 + Math.pow(heat, 0.8) * 185 + hot * 40);
        data[p + 2] = 4 + hot * hot * 150;
        data[p + 3] = Math.min(218, Math.pow(heat, 0.72) * 235) * Math.min(1, intensity * 1.8);
      }
    }
    context.putImageData(pixels, 0, 0); lastFrame = frame;
  }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // El brillo suave ilumina el humo; el campo conserva bordes oscuros y núcleos calientes.
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, -1.35, 0.1, 0, -1.35, 2.1);
  glow.addColorStop(0, 'rgba(255,106,18,0.09)'); glow.addColorStop(1, 'rgba(128,25,4,0)');
  ctx.fillStyle = glow; ctx.fillRect(-2.1, -3.5, 4.2, 4.3);
  ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(canvas, -1.05, -4.22, 2.1, 4.3); ctx.restore();
}
