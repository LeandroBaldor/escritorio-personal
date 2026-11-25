import type { CSSProperties } from 'react';

const shards = [
  ['0 0, 50% 0, 33% 28%, 0 43%', -78, -62, -42],
  ['50% 0, 100% 0, 68% 28%, 53% 48%, 33% 28%', 12, -92, 24],
  ['100% 0, 100% 44%, 68% 28%', 76, -57, 68],
  ['0 43%, 33% 28%, 53% 48%, 24% 68%, 0 70%', -108, -5, -54],
  ['68% 28%, 100% 44%, 100% 68%, 77% 73%, 53% 48%', 107, -9, 46],
  ['0 70%, 24% 68%, 38% 100%, 0 100%', -83, 66, 57],
  ['24% 68%, 53% 48%, 77% 73%, 65% 100%, 38% 100%', -6, 85, -37],
  ['77% 73%, 100% 68%, 100% 100%, 65% 100%', 86, 69, 60],
] as const;

const blastChips = Array.from({ length: 24 }, (_, index) => {
  const angle = index * Math.PI / 12;
  const distance = 205 + index % 4 * 38;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, rotation: (index % 2 === 0 ? 1 : -1) * (95 + index * 9) };
});

export function TargetBlast({ image, x = 50, y = 50 }: { image?: string; x?: number; y?: number }) {
  return <div className="tiro-shatter" aria-hidden="true" style={{
    '--tiro-shard-art': image ? `url(${image})` : undefined, '--tiro-hit-x': `${x}%`, '--tiro-hit-y': `${y}%`,
  } as CSSProperties}>
    {image && shards.map(([shape, dx, dy, twist]) => <span key={shape} className="tiro-shard" style={{
      clipPath: `polygon(${shape})`, '--tiro-shard-x': `${dx * 2.4}%`, '--tiro-shard-y': `${dy * 2.3}%`, '--tiro-shard-rotation': `${twist * 2.2}deg`,
    } as CSSProperties} />)}
    {blastChips.map((chip, index) => <span key={index} className="tiro-blast-chip" style={{
      '--tiro-chip-x': `${chip.x}%`, '--tiro-chip-y': `${chip.y}%`, '--tiro-chip-rotation': `${chip.rotation}deg`,
    } as CSSProperties} />)}
  </div>;
}

export function PrecisionBoard({ x, y, width, number, holes }: { x: number; y: number; width: number; number: number; holes: { x: number; y: number }[] }) {
  return <div className="tiro-precision-board" style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, maxWidth: `${15 * width / 8.8}cqh` }}>
    <svg className="tiro-precision-sheet" viewBox="0 0 100 150" role="img" aria-label={`Cartel a distancia ${number}`}>
      <rect width="100" height="150" rx="3" fill="#e4e6e3" />
      <path d="M10 150V91Q10 67 34 52Q41 47 36 41Q32 33 32 25Q32 4 50 4Q68 4 68 25Q68 33 64 41Q59 47 66 52Q90 67 90 91V150Z" fill="#142031" />
      <ellipse cx="50" cy="25" rx="17" ry="21" fill="none" stroke="#9ccce2" strokeWidth=".8" />
      {[1, .72, .46, .22].map(ring => <ellipse key={ring} cx="50" cy="102" rx={42 * ring} ry={44 * ring} fill="none" stroke="#e1e8e9" strokeWidth=".8" />)}
      <g fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize="6" fontWeight="700">
        <text x="50" y="25" fontSize="9">15</text>
        <text x="50" y="102">10</text>
        <text x="50" y="86">9</text>
        <text x="50" y="77">8</text>
        <text x="50" y="64">7</text>
      </g>
      {holes.map((hole, i) => <circle className="tiro-precision-hole" key={i} cx={hole.x} cy={hole.y} r="3.1" fill="#000" stroke="#888" strokeWidth=".6" />)}
    </svg>
  </div>;
}
