export const ROUND_MS = 180_000;
export const WAVE_MS = 3_000;
export const TARGET_RISE_MS = 220;
export const TARGET_VISIBLE_MS = 1_000;
export const RELOAD_MS = 1_120;

export const primaries = [
  { name: 'Ametralladora', models: ['Minigun XM-9', 'LMG Titán', 'LMG Pulsar', 'LMG Cerberus'], catalogStart: 0, ammo: 142, magazine: 24, cooldown: 115, effect: 1, zoom: 2.2 },
  { name: 'Rifle de asalto', models: ['AR Vanguard', 'AR Inferno', 'AR Nexus', 'AR Orion'], catalogStart: 4, ammo: 120, magazine: 20, cooldown: 180, effect: 1, zoom: 2.8 },
  { name: 'Escopeta', models: ['Escopeta R-12', 'Escopeta Hércules', 'Escopeta de Plasma', 'Escopeta Legión'], catalogStart: 8, ammo: 65, magazine: 8, cooldown: 590, effect: 0, zoom: 1 },
  { name: 'Rifle de precisión', models: ['Sniper Specter', 'Sniper Polaris', 'Sniper Void', 'Sniper Mástil'], catalogStart: 12, ammo: 105, magazine: 15, cooldown: 750, effect: 2, zoom: 4 },
];

export const secondaries = [
  { name: 'Pistola Ion', catalogStart: 16, ammo: 26, magazine: 10, cooldown: 260, effect: 3, zoom: 1 },
  { name: 'Pistola Omega', catalogStart: 17, ammo: 26, magazine: 10, cooldown: 260, effect: 3, zoom: 1 },
  { name: 'Pistola Alien', catalogStart: 18, ammo: 26, magazine: 10, cooldown: 260, effect: 3, zoom: 1 },
  { name: 'Revólver Electro', catalogStart: 19, ammo: 18, magazine: 6, cooldown: 410, effect: 4, zoom: 1 },
  { name: 'Pistola Fénix', catalogStart: 20, ammo: 26, magazine: 10, cooldown: 260, effect: 3, zoom: 1 },
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

export function getWeaponPose(
  aim: { x: number; y: number },
  range: { width: number; height: number },
  [tipX, tipY]: readonly number[],
  primary: boolean,
) {
  const { width, height } = range;
  const aimX = aim.x / 100 * width;
  const aimY = aim.y / 100 * height;
  const left = 50 + (aim.x - 50) * (primary ? .49 : .68);
  const dx = aimX - left / 100 * width;
  const facing = dx > 0 ? -1 : 1;
  const muzzleX = (tipX - .5) * facing;
  const muzzleY = 1 - tipY;
  const nominal = primary
    ? Math.max(156, Math.min(width * .47, height * .69, 590))
    : Math.max(126, Math.min(width * .32, height * .43, 270));
  const size = Math.min(nominal, Math.max(nominal * .55, (height - aimY - 18) / .64));
  const clearance = 14 + size * .1;
  const pivotY = Math.max(height * (primary ? .98 : 1.10), aimY + Math.hypot(muzzleX, muzzleY) * size + clearance);
  const angle = (Math.atan2(dx, pivotY - aimY) - Math.atan2(muzzleX, muzzleY)) * 180 / Math.PI;

  return { left, bottom: height - pivotY, angle, facing, size };
}
