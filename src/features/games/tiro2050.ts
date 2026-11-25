export const ROUND_MS = 180_000;
export const WAVE_MS = 3_000;
export const TARGET_RISE_MS = 220;
export const TARGET_VISIBLE_MS = 1_000;
export const RELOAD_MS = 1_120;

export const primaries = [
  { name: 'Escopeta Ígnea', ammo: 65, magazine: 8, cooldown: 590, art: 0 },
  { name: 'Ametralladora Plasma', ammo: 142, magazine: 24, cooldown: 115, art: 1 },
  { name: 'Rifle Vector', ammo: 105, magazine: 15, cooldown: 750, art: 2 },
];

export const primaryVariants = [
  ['Ígnea', 'Alba', 'Marea', 'Forja', 'Ascua'],
  ['Plasma', 'Arco', 'Helio', 'Nexo', 'Pulso'],
  ['Vector', 'Prisma', 'Horizonte', 'Umbral', 'Espectro'],
];

export const secondaries = [
  { name: 'Pistola Ion', ammo: 26, magazine: 10, cooldown: 260, art: 3 },
  { name: 'Revólver Pulsar', ammo: 18, magazine: 6, cooldown: 410, art: 4 },
];

// Center and floor contact in scene percent, followed by width and artwork.
const wavePositions = [
  [[20, 96, 22, 12], [44, 64, 7, 17], [78, 83, 15, 12], [34, 75, 10, 17], [58, 60, 6, 12], [90, 96, 16, 17]],
  [[19, 96, 19, 13], [46, 64, 7, 12], [78, 83, 13, 13], [34, 75, 10, 17], [58, 60, 6, 12], [91, 96, 15, 13]],
  [[20, 96, 19, 14], [46, 63, 7, 14], [77, 83, 13, 14], [33, 75, 12, 12], [58, 60, 6, 14], [91, 96, 14, 17]],
  [[21, 96, 19, 15], [46, 64, 7, 15], [78, 83, 13, 17], [35, 75, 11, 15], [57, 60, 6, 15], [91, 96, 14, 17]],
  [[20, 96, 18, 16], [46, 64, 7, 16], [77, 83, 13, 16], [34, 75, 11, 17], [58, 60, 6, 16], [91, 96, 14, 12]],
];

const firingPositions = [[0, 1, 2], [3, 4, 5], [0, 3, 4], [1, 2, 5], [0, 4, 5], [1, 3, 2]];

export function getWave(scene: number, wave: number) {
  const hostage = (wave * 7 + Math.floor(wave / 4) + scene) % 3;
  const civilian = wave % 4 === 0 ? (hostage + 1) % 3 : -1;
  const active = firingPositions[wave % firingPositions.length];
  return wavePositions[scene].map(([x, y, width, cover], slot) => {
    const i = active.indexOf(slot);
    return {
      id: wave * wavePositions[scene].length + slot,
      x, y, width, cover,
      visible: i >= 0,
      kind: i === hostage ? 'rehén' : i === civilian ? 'civil' : 'alien',
      art: i === hostage ? 4 + (wave % 2) : i === civilian ? 2 + (Math.floor(wave / 4) % 2) : (wave * 2 + slot + scene) % 5,
    };
  });
}

export function getAmmo(primaryCapacity: number, secondaryCapacity: number, shots: number) {
  const primaryUsed = Math.min(primaryCapacity, shots);
  const secondaryUsed = Math.min(secondaryCapacity, Math.max(0, shots - primaryCapacity));
  return [
    { remaining: primaryCapacity - primaryUsed, used: primaryUsed },
    { remaining: secondaryCapacity - secondaryUsed, used: secondaryUsed },
  ];
}

export function scoreImpact(kind: string, zone: 'head' | 'chest') {
  if (kind !== 'alien') return -10;
  return zone === 'head' ? 10 : 5;
}
