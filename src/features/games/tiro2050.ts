export const ROUND_MS = 180_000;
export const WAVE_MS = 3_000;
export const TARGET_RISE_MS = 220;
export const TARGET_VISIBLE_MS = 1_000;
export const RELOAD_MS = 1_120;
export const PRECISION_DISTANCES = 10;
export const PRECISION_ROUNDS = 3;
export const PRECISION_STEP_MS = 520;
export const levelNames = ['Aliens y rehenes', 'Platos orbitales', 'Tiro de precisión'] as const;
export type Level = 1 | 2 | 3;

export const primaries = [
  { name: 'Ametralladora', models: ['Minigun XM-9', 'LMG Titán', 'LMG Pulsar', 'LMG Cerberus'], catalogStart: 0, ammo: 142, magazine: 24, cooldown: 115, effect: 1, zoom: 2.2 },
  { name: 'Rifle de asalto', models: ['AR Vanguard', 'AR Inferno', 'AR Nexus', 'AR Orion'], catalogStart: 4, ammo: 120, magazine: 20, cooldown: 180, effect: 1, zoom: 2.8 },
  { name: 'Escopeta', models: ['Escopeta R-12', 'Escopeta Hércules', 'Escopeta de Plasma', 'Escopeta Legión'], catalogStart: 8, ammo: 65, magazine: 8, cooldown: 590, effect: 0, zoom: 1 },
  { name: 'Rifle de precisión', models: ['Sniper Specter', 'Sniper Polaris', 'Sniper Void', 'Sniper Mástil'], catalogStart: 12, ammo: 105, magazine: 15, cooldown: 750, effect: 2, zoom: 4 },
] as const;

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
      x: 50 + (x - 50) * .5,
      y: 50 + (y - 50) * .54,
      width: width * .72,
      cover,
      depth: y <= 64 ? 'far' : y >= 90 ? 'near' : 'mid',
      visible: i >= 0,
      kind: i === hostage ? 'rehén' : i === civilian ? 'civil' : 'alien',
      art: i === hostage ? 4 + (wave % 2) : i === civilian ? 2 + (Math.floor(wave / 4) % 2) : (wave * 2 + slot + scene) % 5,
    };
  });
}

export function scoreImpact(kind: string, zone: 'head' | 'chest') {
  if (kind !== 'alien') return -10;
  return zone === 'head' ? 10 : 5;
}

const plateStart = 450;
const plateInterval = 1_150;
const plateFlight = 1_720;
const plateImpactTime = 600;
export const plateLauncher = { x: 29, y: 55.5 };
export const plateWall = { x: 74.6, y: 61 };
const plateArcs = [[10, 2], [24, -2], [15, 4], [20, 0], [12, -3], [22, 3]];

export function launchedPlates(elapsed: number) {
  return Math.max(0, 1 + Math.floor((elapsed - plateStart) / plateInterval));
}

export function getPlates(elapsed: number) {
  const launched = launchedPlates(elapsed);
  const flying = [];
  for (let id = Math.max(0, launched - 3); id < launched; id++) {
    const age = elapsed - plateStart - id * plateInterval;
    if (age >= plateFlight + plateImpactTime) continue;
    const progress = Math.min(1, age / plateFlight);
    const [rise, wallOffset] = plateArcs[id % plateArcs.length];
    flying.push({ id, crashed: progress === 1,
      x: plateLauncher.x + (plateWall.x - plateLauncher.x) * progress,
      y: plateLauncher.y + (plateWall.y + wallOffset - plateLauncher.y) * progress - rise * 4 * progress * (1 - progress),
    });
  }
  return flying;
}

export function getPrecisionPosition(distance: number) {
  const depth = Math.pow(.84, distance);
  // Anchor the head directly so that shrinkage cannot cancel the movement towards the horizon.
  return { x: 50, y: 60 - 3.6 * (1 - depth) / .16, width: 8.8 * depth };
}

// Coordinates are in the target's 100 × 150 viewBox.
export function scorePrecision(x: number, y: number) {
  if (Math.hypot((x - 50) / 17, (y - 25) / 21) <= 1) return 15;
  const ring = Math.hypot((x - 50) / 42, (y - 102) / 44);
  if (ring > 1) return 0;
  if (ring <= .22) return 10;
  if (ring <= .46) return 9;
  if (ring <= .72) return 8;
  return 7;
}

const cameraBaseScale = 2.1;

export function getCameraView(camera: { x: number; y: number }, zoom: number) {
  const scale = cameraBaseScale * zoom;
  const focus = (position: number) => 50 + (position - 50) * .51;
  return { scale, x: 50 - focus(camera.x) * scale, y: 50 - focus(camera.y) * scale };
}
