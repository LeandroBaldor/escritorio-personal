// Iconos del panel de mando trazados como geometría, para mantener nitidez a cualquier tamaño.
const PATHS: Record<string, string> = {
  target: 'M16 2v7m0 14v7M2 16h7m14 0h7M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  move: 'M3 10h13V4l13 12-13 12v-6H3z',
  stop: 'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26M7 7l18 18M25 7 7 25',
  army: 'M4 4h8v8H4zM20 4h8v8h-8zM4 20h8v8H4zM20 20h8v8h-8z',
  rifle: 'm4 24 6-7 12-6 7-7 1 2-7 8-5 2-5 6-3-2-3 5zM15 18l4 4 3-4M7 19l3 3',
  shield: 'M16 3 28 7v9c0 7-6 11-12 14C10 27 4 23 4 16V7zM16 7v18',
  heal: 'M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z',
  wrench: 'M25 3a8 8 0 0 0-10 10L4 24a3 3 0 0 0 4 4l11-11A8 8 0 0 0 29 7l-6 5-4-4z',
  rocket: 'M5 23 3 29l6-2M9 22l-2-7 8-2M10 23l7 2 2-8M11 21C11 10 22 4 29 3c-1 8-7 19-17 19zM22 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  blast: 'm16 1 3 10 8-7-4 10 9 2-10 3 7 9-11-5-2 9-3-10-9 6 6-10-10-2 11-3L7 4l7 7z',
  radar: 'M8 5a14 14 0 0 0 0 23M24 5a14 14 0 0 1 0 23M11 9a9 9 0 0 0 0 15M21 9a9 9 0 0 1 0 15M16 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  base: 'M4 29V14l12-8 12 8v15zM1 14 16 3l15 11M12 29V18h8v11',
  layers: 'm2 12 14-8 14 8-14 8zM3 18l13 8 13-8M3 24l13 7 13-7',
  people: 'M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M23 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 28V18c0-7 16-7 16 0v10zM20 14c8-2 10 2 10 6v8h-9',
  gear: 'm13 2 6 0 1 5 4 2 4-2 3 5-3 4v4l3 3-3 5-5-2-3 2-1 4h-6l-1-4-4-2-4 2-3-5 3-4v-4L1 12l3-5 4 2 4-2zM16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12',
};
export function LandIcon({ kind }: { kind: string }) {
  return <svg className="land-icon" viewBox="0 0 32 32" aria-hidden="true"><path d={PATHS[kind] ?? PATHS.target} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export function LandEagle() {
  return <svg viewBox="0 0 160 64" aria-hidden="true"><defs><linearGradient id="land-eagle-metal" x2=".2" y2="1"><stop stopColor="#fff3b1" /><stop offset=".35" stopColor="#f3cb62" /><stop offset=".52" stopColor="#ad7920" /><stop offset=".7" stopColor="#ffe49a" /><stop offset="1" stopColor="#bd8c36" /></linearGradient></defs>
    {[-1, 1].map(side => <g key={side} transform={`translate(80 0) scale(${side} 1)`} fill="url(#land-eagle-metal)" stroke="#77501d" strokeWidth=".8">
      <path d="M5 29C19 18 40 9 77 7L65 18 39 25 68 18 60 29 34 34 59 28 49 39 29 42 47 38 37 49 22 49 34 47 24 55 12 48 4 38Z" />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${10 + i * 5} ${29 + i * 4}L${58 - i * 8} ${20 + i * 10}`} fill="none" stroke="#fff0ac" strokeWidth="1.2" />)}
      <path d="M2 20 8 12 18 13 21 19 14 18 10 22 7 30Z" /><circle cx="14" cy="15.5" r="1.2" fill="#533715" />
    </g>)}
    <path d="M79 18 90 29 86 43 94 52 83 48 80 60 76 48 65 52 73 43 69 29Z" fill="url(#land-eagle-metal)" stroke="#77501d" />
    <path d="M74 28H86V39L80 44 74 39Z" fill="#145690" stroke="#ffde7d" strokeWidth="1.5" />
  </svg>;
}
