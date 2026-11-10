export { metal as factoryMetal, ellipse as factoryEllipse, gear as factoryGear };

function metal(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tint = '#667685') {
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#d6e1e6'); g.addColorStop(0.15, tint); g.addColorStop(0.65, '#26333e'); g.addColorStop(1, '#0b1219');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.strokeStyle = '#aab8bf66'; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.fillStyle = '#c0c9ce'; for (const dx of [5, w - 7]) for (const dy of [5, h - 7]) c.fillRect(x + dx, y + dy, 2, 2);
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function gear(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  c.save(); c.translate(x, y); c.rotate(t);
  const g = c.createRadialGradient(-10, -12, 2, 0, 0, r); g.addColorStop(0, '#dbe2e7'); g.addColorStop(0.55, color); g.addColorStop(1, '#1b242e');
  c.fillStyle = g; c.strokeStyle = '#a0b0ba'; c.lineWidth = 2;
  c.beginPath(); for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, k = i % 4 < 2 ? r : r * 0.82; c.lineTo(Math.cos(a) * k, Math.sin(a) * k); } c.closePath(); c.fill(); c.stroke();
  ellipse(c, 0, 0, r * 0.56, r * 0.56, '#101922');
  for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); metal(c, 0, -5, r * 0.68, 10); c.restore(); }
  ellipse(c, 0, 0, 12, 12, '#91a1ac'); ellipse(c, 0, 0, 5, 5, '#14202c'); c.restore();
}
