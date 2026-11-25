import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { getCameraView, getPlates, getPrecisionPosition, getWave, launchedPlates, levelNames, plateLauncher, plateWall, PRECISION_DISTANCES, PRECISION_ROUNDS, PRECISION_STEP_MS, primaries, RELOAD_MS, ROUND_MS, scoreImpact, scorePrecision, secondaries, TARGET_RISE_MS, TARGET_VISIBLE_MS, WAVE_MS } from './tiro2050';
import type { Level } from './tiro2050';
import { PrecisionBoard, TargetBlast } from './Tiro2050Targets';
import { playBolt, playReload, playRifleShot } from './sounds';
import './tiro2050.css';
import menuSoundUrl from './assets/sonidos/tiro2050-menu.mp3';

// Sonido al elegir algo en el menú (menu_boton_2.mp3 del usuario).
let menuSound: HTMLAudioElement | null = null;
function playMenu() {
  try {
    menuSound ??= new Audio(menuSoundUrl);
    const copy = menuSound.cloneNode() as HTMLAudioElement;
    copy.volume = .7;
    void copy.play().catch(() => undefined);
  } catch { /* sin audio */ }
}

// Animación de la ráfaga de cada arma (como en Invasión): atlas de 10 cuadros, por diseño (catalogStart + variante).
const shotFx = [
  'ametralladora-fuego', 'ametralladora-fuego', 'ametralladora-azul', 'ametralladora-amarillo', // Minigun XM-9, LMG Titán, LMG Pulsar, LMG Cerberus
  'ametralladora-azul', 'ametralladora-fuego', 'ametralladora-violeta', 'ametralladora-fuego', // AR Vanguard, AR Inferno, AR Nexus, AR Orion
  'escopeta-fuego', 'escopeta-azul', 'escopeta-azul', 'escopeta-fuego', // Escopeta R-12, Hércules, de Plasma, Legión
  'ametralladora-fuego', 'ametralladora-azul', 'ametralladora-violeta', 'ametralladora-verde', // Sniper Specter, Polaris, Void, Mástil
  'escopeta-azul', 'escopeta-fuego', 'escopeta-violeta', 'escopeta-azul', 'escopeta-fuego', // Pistola Ion, Omega, Alien, Revólver Electro, Pistola Fénix
];
// Automáticas (ametralladoras y rifles de asalto): cada tiro pasa el destello (cuadros 1 a 3) y, al dejar de tirar,
// el último sigue con el humo (4 a 10). Las demás pasan los 10 cuadros en cada tiro.
const shotFrame = (design: number, age: number) => {
  if (age < 0) return -1;
  if (design < 8) return age < 96 ? Math.floor(age / 32) : age < 411 ? 3 + Math.floor((age - 96) / 45) : -1;
  return age < 360 ? Math.floor(age / 36) : -1;
};

const assets = import.meta.glob(['./assets/tiro2050/{escenario,operador,arsenal,alien}-*', './assets/tiro2050/silueta-[2345].png', './assets/tiro2050/cobertura-1[2-7].png', './assets/tiro2050/{mano-recarga,lanzadora,pared-platos}.png', './assets/tiro2050/rafaga-*.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const art = (name: string) => assets[`./assets/tiro2050/${name}`];
export const tiro2050Cover = art('escenario-3.jpg');

const scenes = ['Hangar estelar', 'Fábrica robotizada', 'Puente de mando', 'Reactor orbital', 'Laboratorio de contención'];
const operators = ['Atlas', 'Nova', 'Diesel', 'Vega'];
const operatorSuits = ['Blindaje pesado', 'Traje de sigilo', 'Exoesqueleto industrial', 'Armadura de exploración'];
const colors = ['#ffc261', '#d9a9ff', '#ff9270', '#7bf4e6'];
const muzzleTips = [
  [.097, .211], [.132, .368], [.096, .291], [.095, .322],
  [.097, .250], [.081, .256], [.068, .260], [.058, .261],
  [.113, .198], [.081, .214], [.073, .249], [.084, .213],
  [.066, .216], [.044, .227], [.039, .215], [.050, .211],
  [.089, .247], [.095, .263], [.043, .318], [.063, .261], [.097, .239],
];
// Rightmost opaque column at the original sleeve or stock cut, in the 384 px sprites.
const weaponCutoffs = [378, 378, 378, 377, 378, 378, 378, 377, 378, 378, 378, 377, 378, 378, 378, 377, 351, 352, 371, 362, 350];
const gunBottomBleed = .04;
const rightBleed = (design: number) => (387 - weaponCutoffs[design]) / 384;
const rifleScopes: Partial<Record<number, { name: string; color: string; frame: string; marks: string; precision?: boolean }>> = {
  4: { name: 'Vanguard', color: '#66ebff', frame: 'M18 19H82L90 27V71L81 81H19L10 71V27Z', marks: 'M21 50H41M59 50H79M35 46V54M65 46V54M50 67V77' },
  5: { name: 'Inferno', color: '#ff8570', frame: 'M23 19H77L87 32V68L75 81H25L13 68V32Z', marks: 'M30 58L42 48L50 40L58 48L70 58M38 67H62M50 58V74' },
  6: { name: 'Nexus', color: '#d997ff', frame: 'M50 9L88 30V70L50 91L12 70V30Z', marks: 'M50 32L68 50L50 68L32 50ZM20 50H29M71 50H80M50 20V29M50 71V80' },
  7: { name: 'Orion', color: '#8cf4c9', frame: 'M11 36L24 18H76L89 36V64L76 82H24L11 64Z', marks: 'M26 42V33H39M61 33H74V42M26 58V67H39M61 67H74V58M35 57H65M42 61V66M58 61V66' },
  12: { name: 'Specter', color: '#ffb968', precision: true, frame: 'M50 3A47 47 0 1 0 50 97A47 47 0 1 0 50 3Z', marks: 'M9 50H37M63 50H91M50 9V38M50 62V91M45 66H55M42 73H58M39 80H61' },
  13: { name: 'Polaris', color: '#79dfff', precision: true, frame: 'M50 3A47 47 0 1 0 50 97A47 47 0 1 0 50 3Z', marks: 'M12 50H40M60 50H88M50 12V38M50 62V88M24 46V54M34 47V53M66 47V53M76 46V54M44 68H56M44 78H56M50 20L47 25H53Z' },
  14: { name: 'Void', color: '#e69dff', precision: true, frame: 'M50 3A47 47 0 1 0 50 97A47 47 0 1 0 50 3Z', marks: 'M50 28L72 50L50 72L28 50ZM7 50H28M72 50H93M50 7V28M50 72V93M21 21L28 28M72 28L79 21M21 79L28 72M72 72L79 79' },
  15: { name: 'Mástil', color: '#b9ff81', precision: true, frame: 'M50 3A47 47 0 1 0 50 97A47 47 0 1 0 50 3Z', marks: 'M8 50H30M70 50H92M50 10V35M50 60V91M39 60H61M35 70H65M31 81H69M39 69V74M61 69V74M35 80V85M65 80V85M39 44L50 36L61 44' },
};
const initialCamera = { x: 50, y: 50 };
const clampCamera = (position: number) => Math.min(100, Math.max(0, position));
const initialLoadout = { operator: 0, primary: 3, variant: 0, secondary: 0 };
type Loadout = typeof initialLoadout;
type Result = { score: number; shots: number; hits: number; headshots: number; errors: number };
type LevelResult = Result & { level: Level; rounds?: Result[] };
type CampaignResult = Result & { levels: LevelResult[] };
type Impact = { id: number; at: number };
type TargetImpact = { value: number; at: number; x: number; y: number; worldX: number; worldY: number; plate?: { x: number; y: number } };
type Casing = { id: number; x: number; y: number; at: number };
type WeaponSlot = 0 | 1;
type Arsenal = { slot: WeaponSlot; shots: [number, number]; reloadEnds: [number, number] };
const emptyResult: Result = { score: 0, shots: 0, hits: 0, headshots: 0, errors: 0 };
const sumResults = (results: Result[]) => results.reduce((sum, entry) => ({
  score: sum.score + entry.score, shots: sum.shots + entry.shots, hits: sum.hits + entry.hits,
  headshots: sum.headshots + entry.headshots, errors: sum.errors + entry.errors,
}), emptyResult);
const scoreNoticeDuration = 1750;
const newArsenal = (slot: WeaponSlot = 0): Arsenal => ({ slot, shots: [0, 0], reloadEnds: [0, 0] });
const newRound = (arsenal: Arsenal, start = 0) => ({
  arsenal, start, lastShot: -Infinity, nextPulse: 0, pendingShots: [0, 0], finishAt: Infinity, finished: false, result: emptyResult, fallen: new Set<number>(),
});

function WeaponPreview({ design }: { design: number }) {
  return <div className="tiro-weapon-preview" style={{
    '--tiro-gun-bottom-bleed': gunBottomBleed, '--tiro-gun-right-bleed': rightBleed(design),
  } as CSSProperties}>
    <img src={art(`arsenal-${design}.png`)} alt="" />
  </div>;
}

export function Tiro2050Game() {
  const [scene, setScene] = useState(0);
  const [players, setPlayers] = useState(1);
  const [loadouts, setLoadouts] = useState<Loadout[]>(() => operators.map((_, operator) => ({ ...initialLoadout, operator })));
  const [turn, setTurn] = useState(0);
  const [level, setLevel] = useState<Level>(1);
  const [phase, setPhase] = useState<'setup' | 'round' | 'precision-break' | 'level-report' | 'between' | 'results'>('setup');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result>(emptyResult);
  const [results, setResults] = useState<CampaignResult[]>([]);
  const [levelResults, setLevelResults] = useState<LevelResult[]>([]);
  const [precisionRound, setPrecisionRound] = useState(1);
  const [precisionResults, setPrecisionResults] = useState<Result[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [muzzlePulses, setMuzzlePulses] = useState<Impact[]>([]);
  const [targetImpacts, setTargetImpacts] = useState<Record<number, TargetImpact>>({});
  const [precisionHoles, setPrecisionHoles] = useState<{ x: number; y: number }[]>([]);
  const [casings, setCasings] = useState<Casing[]>([]);
  const [camera, setCamera] = useState(initialCamera);
  const [zoom, setZoom] = useState(1);
  const [arsenal, setArsenal] = useState(newArsenal);
  const rangeRef = useRef<HTMLDivElement>(null);
  const ejectPortRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<number | null>(null);
  const handledClick = useRef(false);
  const touchAim = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const round = useRef(newRound(arsenal));
  const loadout = loadouts[turn];
  const primary = primaries[loadout.primary];
  const selectedSecondary = secondaries[loadout.secondary];
  const secondary = level === 3 && selectedSecondary.effect !== 3 ? secondaries[0] : selectedSecondary;
  const weapons = [primary, secondary];
  const ammo = weapons.map((item, slot) => ({ remaining: item.ammo - arsenal.shots[slot], used: arsenal.shots[slot] }));
  const activeSlot = arsenal.slot;
  const weapon = weapons[activeSlot];
  const canSwap = level !== 3 && ammo[1 - activeSlot].remaining > 0;
  const zoomLimit = level === 3 ? 1 : weapon.zoom;
  const zoomValue = Math.min(zoomLimit, zoom);
  const primaryName = primary.models[loadout.variant];
  const activeDesign = activeSlot === 0 ? primary.catalogStart + loadout.variant : secondary.catalogStart;
  const weaponImage = `arsenal-${activeDesign}.png`;
  const [tipX, tipY] = muzzleTips[activeDesign];
  const gunRightBleed = rightBleed(activeDesign);
  const gunHeight = Math.min(activeSlot === 0 ? .74 : .61, (activeSlot === 0 ? .46 : .43) / (1 - tipY - gunBottomBleed));
  // Extend the sprite's forward axis through its muzzle to the fixed center of the arena.
  const gunAnchor = tipX - (.5 / gunHeight - (1 - tipY - gunBottomBleed)) * (.9 - tipX) / (.84 - tipY);
  const scope = zoomValue > 1 ? rifleScopes[activeDesign] : undefined;
  const view = getCameraView(camera, zoomValue);
  const reloading = elapsed < arsenal.reloadEnds[activeSlot];
  const wave = Math.floor(elapsed / WAVE_MS);
  const targetsHiding = elapsed % WAVE_MS >= TARGET_RISE_MS + TARGET_VISIBLE_MS;
  const clock = Math.ceil((ROUND_MS - elapsed) / 1000);
  const tint = colors[loadout.operator];
  const stageName = level === 1 ? scenes[scene] : levelNames[level - 1];
  const precisionStep = Math.max(0, Math.min(PRECISION_DISTANCES - 1, result.shots - Number(level === 3 && impact !== null && elapsed - impact.at < PRECISION_STEP_MS)));
  const settledLevel = levelResults.at(-1);
  const accumulatedScore = levelResults.reduce((total, entry) => total + entry.score, 0);
  const precisionTotal = sumResults(precisionResults);

  const finishLevel = useEffectEvent(() => {
    const live = round.current;
    if (live.finished) return;
    live.finished = true;
    if (level === 3) {
      const rounds = [...precisionResults, live.result];
      setPrecisionResults(rounds);
      if (precisionRound < PRECISION_ROUNDS) {
        setPhase('precision-break');
        return;
      }
      setLevelResults(previous => [...previous, { level, ...sumResults(rounds), rounds }]);
    } else {
      setLevelResults(previous => [...previous, { level, ...live.result }]);
    }
    setPhase('level-report');
  });

  useEffect(() => {
    if (phase !== 'round') return;
    let frame = 0;
    const tick = (now: number) => {
      const time = Math.max(0, now - round.current.start);
      if (level !== 3 ? time >= ROUND_MS : now >= round.current.finishAt) {
        finishLevel();
        return;
      }
      setElapsed(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, level]);

  function start(player: number, nextLevel: Level = 1, nextPrecisionRound = 1) {
    const nextArsenal = newArsenal(nextLevel === 3 ? 1 : 0);
    round.current = newRound(nextArsenal, performance.now());
    setArsenal(nextArsenal);
    setTurn(player);
    setLevel(nextLevel);
    setPrecisionRound(nextPrecisionRound);
    if (nextPrecisionRound === 1) setPrecisionResults([]);
    if (nextLevel === 1) setLevelResults([]);
    setElapsed(0);
    setResult(emptyResult);
    setImpact(null);
    setMuzzlePulses([]);
    setTargetImpacts({});
    setPrecisionHoles([]);
    setCasings([]);
    setCamera(initialCamera);
    setZoom(1);
    trigger.current = null;
    handledClick.current = false;
    touchAim.current = null;
    setPhase('round');
  }

  function continueCampaign() {
    if (level !== 3) {
      start(turn, level === 1 ? 2 : 3);
      return;
    }
    const total = sumResults(levelResults);
    setResults(previous => [...previous, { ...total, levels: levelResults }]);
    setPhase(turn + 1 < players ? 'between' : 'results');
  }

  function configure(player: number, changes: Partial<Loadout>) {
    playMenu();
    setLoadouts(previous => previous.map((value, index) => index === player ? { ...value, ...changes } : value));
  }

  function updateArsenal(next: Arsenal) {
    if (next.slot !== round.current.arsenal.slot) {
      trigger.current = null;
      setZoom(1);
    }
    round.current.arsenal = next;
    setArsenal(next);
  }

  function swapWeapon() {
    if (phase !== 'round' || level === 3) return;
    const current = round.current.arsenal;
    const slot = current.slot === 0 ? 1 : 0;
    if (current.shots[slot] < weapons[slot].ammo) updateArsenal({ ...current, slot });
  }

  function point({clientX, clientY}: { clientX: number; clientY: number }, bounds: DOMRect) {
    return { x: (clientX - bounds.left) / bounds.width * 100, y: (clientY - bounds.top) / bounds.height * 100 };
  }

  function fire(source: 'click' | 'queued' | 'automatic' = 'click') {
    const range = rangeRef.current;
    if (!range || phase !== 'round') return;
    const bounds = range.getBoundingClientRect();
    const live = round.current;
    const now = performance.now();
    const shots = live.result.shots;
    const current = live.arsenal;
    const slot = current.slot;
    const activeWeapon = weapons[slot];
    const time = now - live.start;
    const available = Math.min(activeWeapon.ammo - current.shots[slot], level === 3 ? PRECISION_DISTANCES - shots : Infinity);
    if (live.finished || (level !== 3 && time >= ROUND_MS) || available <= 0) return;
    const pending = live.pendingShots[slot];
    const waiting = time < current.reloadEnds[slot] || (level === 3 && now - live.lastShot < PRECISION_STEP_MS + 220);
    if (source === 'click' && (waiting || pending > 0)) {
      if (pending < available) live.pendingShots[slot]++;
      return;
    }
    if (waiting || (source === 'automatic' && now - live.lastShot < activeWeapon.cooldown)) return;
    if (source === 'queued') live.pendingShots[slot]--;
    live.lastShot = now;
    const pulse = Math.max(time, live.nextPulse);
    live.nextPulse = pulse + 65;
    playRifleShot((pulse - time) / 1000, 0.9);
    setMuzzlePulses(previous => [...previous.filter(shot => shot.at + 450 > time).slice(-3), { id: shots, at: pulse }]);
    const ejectPort = ejectPortRef.current?.getBoundingClientRect();
    if (ejectPort) {
      const position = point({ clientX: ejectPort.x, clientY: ejectPort.y }, bounds);
      setCasings(previous => [...previous.filter(casing => time - casing.at < 520), { id: shots, ...position, at: time }]);
    }
    const next: Arsenal = { slot, shots: [...current.shots], reloadEnds: [...current.reloadEnds] };
    const used = ++next.shots[slot];
    if (!(level === 3 && shots + 1 === PRECISION_DISTANCES) && used < activeWeapon.ammo && used % activeWeapon.magazine === 0) {
      next.reloadEnds[slot] = time + RELOAD_MS;
      playReload();
    } else if (activeWeapon.effect === 2 && used < activeWeapon.ammo) playBolt();
    const otherSlot = slot === 0 ? 1 : 0;
    if (level !== 3 && used === activeWeapon.ammo && next.shots[otherSlot] < weapons[otherSlot].ammo) next.slot = otherSlot;

    const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const element = document.elementFromPoint(center.x, center.y);
    const world = (x: number, y: number) => ({
      x: ((x - bounds.left) / bounds.width * 100 - view.x) / view.scale,
      y: ((y - bounds.top) / bounds.height * 100 - view.y) / view.scale,
    });
    function recordHit(id: number, box: DOMRect, points: number, isPlate = false) {
      live.fallen.add(id);
      const top = world(box.left + box.width / 2, box.top);
      setTargetImpacts(previous => ({ ...previous, [id]: {
        value: points, at: time,
        x: (center.x - box.left) / box.width * 100,
        y: (center.y - box.top) / box.height * 100,
        worldX: top.x, worldY: top.y,
        plate: isPlate ? world(box.left + box.width / 2, box.top + box.height / 2) : undefined,
      } }));
    }
    let value: number | null = null;
    let headshot = false;
    if (level === 1) {
      const zoneElement = element?.closest<HTMLElement>('[data-zone]');
      const id = Number(zoneElement?.dataset.target);
      const waveTime = time % WAVE_MS;
      const target = Math.floor(time / WAVE_MS) === wave && waveTime >= TARGET_RISE_MS && waveTime < TARGET_RISE_MS + TARGET_VISIBLE_MS
        ? getWave(scene, wave).find(card => card.visible && card.id === id && !live.fallen.has(id))
        : undefined;
      const box = zoneElement?.closest('.tiro-target')?.getBoundingClientRect();
      if (target && box) {
        const zone = zoneElement?.dataset.zone === 'head' ? 'head' : 'chest';
        value = scoreImpact(target.kind, zone);
        headshot = value > 0 && zone === 'head';
        recordHit(id, box, value);
      }
    } else if (level === 2) {
      const plate = element?.closest<HTMLElement>('[data-plate]');
      const id = Number(plate?.dataset.plate);
      if (plate && !live.fallen.has(id) && getPlates(time).some(flying => flying.id === id && !flying.crashed)) {
        value = 1;
        recordHit(id, plate.getBoundingClientRect(), value, true);
      }
    } else {
      const board = range.querySelector('.tiro-precision-sheet')?.getBoundingClientRect();
      if (board) {
        const x = (center.x - board.left) / board.width * 100;
        const y = (center.y - board.top) / board.height * 150;
        if (x >= 0 && x <= 100 && y >= 0 && y <= 150) setPrecisionHoles(previous => [...previous, { x, y }]);
        const points = scorePrecision(x, y);
        if (points > 0) {
          value = points;
          headshot = points === 15;
          recordHit(shots, board, value);
        }
      }
      if (shots + 1 === PRECISION_DISTANCES) live.finishAt = now + PRECISION_STEP_MS;
    }
    live.result = {
      score: live.result.score + (value ?? 0),
      shots: shots + 1,
      hits: live.result.hits + Number(value !== null && value > 0),
      headshots: live.result.headshots + Number(headshot),
      errors: live.result.errors + Number(value === -10),
    };
    setResult(live.result);
    setImpact({ id: shots, at: time });
    updateArsenal(next);
  }

  function aimAt(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.pointerType !== 'touch') {
      const position = point(event, bounds);
      setCamera({ x: clampCamera(position.x), y: clampCamera(position.y) });
      return;
    }
    const gesture = touchAim.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    touchAim.current = { id: gesture.id, x: event.clientX, y: event.clientY, moved: true };
    setCamera(previous => ({
      x: clampCamera(previous.x + dx / bounds.width * 100),
      y: clampCamera(previous.y + dy / bounds.height * 100),
    }));
  }

  function beginAim(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    handledClick.current = event.pointerType === 'touch';
    if (event.pointerType === 'touch') {
      if (touchAim.current) return;
      touchAim.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      trigger.current = weapon.effect === 1 ? performance.now() : null;
    }
  }

  function endAim(event: PointerEvent<HTMLDivElement>) {
    const gesture = touchAim.current;
    if (gesture?.id !== event.pointerId) return;
    touchAim.current = null;
    if (!gesture.moved) fire();
  }

  function zoomBy(factor: number) {
    setZoom(previous => Math.min(zoomLimit, Math.max(1, previous * factor)));
  }

  const repeatShot = useEffectEvent(() => {
    const live = round.current;
    if (live.pendingShots[live.arsenal.slot] > 0) fire('queued');
    else if (level !== 3 && weapon.effect === 1 && trigger.current !== null && performance.now() - trigger.current >= 160) {
      const shots = live.result.shots;
      fire('automatic');
      if (live.result.shots !== shots) handledClick.current = true;
    }
  });
  const scrollZoom = useEffectEvent((event: WheelEvent) => {
    if (zoomLimit <= 1) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18);
  });
  const keySwap = useEffectEvent((event: KeyboardEvent) => {
    if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || level === 3) return;
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, select, textarea'))) return;
    event.preventDefault();
    if (!event.repeat) swapWeapon();
  });

  useEffect(() => {
    const range = rangeRef.current;
    if (phase !== 'round' || !range) return;
    const wheel = (event: WheelEvent) => scrollZoom(event);
    const key = (event: KeyboardEvent) => keySwap(event);
    const release = () => { trigger.current = null; };
    const blur = () => { release(); touchAim.current = null; };
    range.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', blur);
    const timer = window.setInterval(() => repeatShot(), 20);
    return () => {
      window.clearInterval(timer);
      range.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', blur);
      blur();
    };
  }, [phase]);

  const ranking = results.map((stats, index) => ({ ...stats, index })).sort((a, b) => b.score - a.score);
  const muzzlePulse = muzzlePulses.find(shot => elapsed >= shot.at && elapsed - shot.at < 45);
  const lastShot = muzzlePulses.filter(shot => elapsed >= shot.at).at(-1);
  const shotFxFrame = lastShot ? shotFrame(activeDesign, elapsed - lastShot.at) : -1;
  const visibleNotices = Object.entries(targetImpacts).filter(([, hit]) => elapsed - hit.at < scoreNoticeDuration);

  return <section className={`tiro2050${phase === 'round' ? ' tiro2050--round' : ''}`} style={{ '--tiro-accent': tint } as CSSProperties}>
    <svg className="tiro-art-filters" aria-hidden="true" width="0" height="0">
      <filter id="tiro-clean-weapon-edge" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="erode" radius="1.25" result="trimmedAlpha" />
        <feComposite in="SourceGraphic" in2="trimmedAlpha" operator="in" />
      </filter>
    </svg>
    <div className="tiro-top">
      <Link to="/juegos">MiniJuegos</Link>
      <h1>Tiro al Blanco <em>2050</em></h1>
      {phase !== 'setup' && <button type="button" onClick={() => setPhase('setup')}>Menú</button>}
    </div>

    {phase === 'setup' && <div className="tiro-setup">
      <figure className="tiro-scene-hero">
        <img className="tiro-scene-preview" src={art(`escenario-${scene}.jpg`)} alt="" />
        <figcaption>{scenes[scene]}</figcaption>
      </figure>
      <fieldset className="tiro-scenes">
        <legend>Escenario</legend>
        {scenes.map((name, i) => <button key={name} type="button" aria-pressed={scene === i} onClick={() => { playMenu(); setScene(i); }}>
          <img src={art(`escenario-${i}.jpg`)} alt="" />{name}
        </button>)}
      </fieldset>
      <div className="tiro-brief">
        <p>Tres niveles. Aliens y platos en rondas de 3 minutos, más tres rondas de precisión de 10 distancias cada una.</p>
        <label>Jugadores locales <select value={players} onChange={event => { playMenu(); setPlayers(Number(event.target.value)); }}>
          {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
      </div>
      <div className="tiro-loadouts">
        {loadouts.slice(0, players).map((selection, index) => <fieldset className="tiro-loadout" key={index}>
          <legend>Jugador {index + 1}</legend>
          <div className="tiro-operators" role="group" aria-label="Soldados">
            {operators.map((name, i) => <button key={name} type="button" aria-pressed={selection.operator === i} onClick={() => configure(index, { operator: i })}
              style={{ '--tiro-suit-color': colors[i] } as CSSProperties}>
              <img src={art(`operador-${i}.jpg`)} alt="" />
              <strong>{name}</strong>
              <small>{operatorSuits[i]}</small>
            </button>)}
          </div>
          <div className="tiro-selects">
            <label>Arma principal <select value={selection.primary} onChange={event => configure(index, { primary: Number(event.target.value), variant: 0 })}>
              {primaries.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
            </select></label>
          </div>
          <div className="tiro-armory">
            <div className="tiro-armory-slot">
              <label>Diseño <select value={selection.variant} onChange={event => configure(index, { variant: Number(event.target.value) })}>
                {primaries[selection.primary].models.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select></label>
              <WeaponPreview design={primaries[selection.primary].catalogStart + selection.variant} />
            </div>
            <div className="tiro-armory-slot">
              <label>Arma de reserva <select value={selection.secondary} onChange={event => configure(index, { secondary: Number(event.target.value) })}>
                {secondaries.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
              </select></label>
              <WeaponPreview design={secondaries[selection.secondary].catalogStart} />
            </div>
          </div>
        </fieldset>)}
      </div>
      <button className="tiro-action" type="button" onClick={() => { playMenu(); setResults([]); start(0); }}>Empezar ronda</button>
    </div>}

    {phase === 'round' && <>
      <div className="tiro-command">
      <div className="tiro-hud">
        <span className="tiro-hud-player"><img src={art(`operador-${loadout.operator}.jpg`)} alt="" /><span><small>Jugador {turn + 1}</small><b>{operators[loadout.operator]}</b></span></span>
        <span className="tiro-hud-score"><small>Nivel {level} de 3</small><strong><b>{result.score + (level === 3 ? precisionTotal.score : 0)}</b> pts</strong></span>
        {level === 3 ? <span className="tiro-hud-score tiro-distance"><small>Ronda {precisionRound}/{PRECISION_ROUNDS}</small><strong aria-label="Distancia del blanco">{precisionStep + 1}/{PRECISION_DISTANCES}</strong></span>
          : <time aria-label="Tiempo restante">{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, '0')}</time>}
      </div>
      <div className="tiro-ammo" aria-label="Munición disponible y gastada">
        {[primary, secondary].map((item, index) => level === 3 && index === 0 ? null : <div key={item.name} className={index === activeSlot ? 'tiro-ammo-active' : undefined}>
          <span>{index === 0 ? `Principal · ${primaryName}` : level === 3 ? item.name : `Reserva · ${item.name}`}</span>
          <strong>{ammo[index].remaining}/{ammo[index].used}</strong>
        </div>)}
        <small>Disponibles / gastadas</small>
        {level !== 3 && <button type="button" className="tiro-swap" aria-keyshortcuts="Space" disabled={!canSwap} onClick={swapWeapon}>Cambiar arma</button>}
        {zoomLimit > 1 && <div className="tiro-zoom" aria-label="Zoom de la mira">
          <button type="button" aria-label="Alejar la mira" disabled={zoomValue <= 1} onClick={() => zoomBy(1 / 1.35)}>−</button>
          <output>{zoomValue.toFixed(1)}×</output>
          <button type="button" aria-label="Acercar la mira" disabled={zoomValue >= zoomLimit} onClick={() => zoomBy(1.35)}>+</button>
        </div>}
      </div>
      </div>
      <div ref={rangeRef} className="tiro-range" aria-label={stageName} onPointerMove={aimAt} onPointerLeave={() => { trigger.current = null; }}
        onClick={event => { if (event.button === 0 && !handledClick.current) fire(); }}
        onPointerDown={beginAim} onPointerUp={endAim} onLostPointerCapture={event => {
          if (touchAim.current?.id === event.pointerId) touchAim.current = null;
        }}>
        {reloading && <strong className="tiro-reload-label" role="status">Recargando…</strong>}
        <div className="tiro-world" style={{ transform: `translate(${view.x}%, ${view.y}%) scale(${view.scale})` }}>
        <img className="tiro-backdrop" src={art(`escenario-${level === 1 ? scene : level + 3}.jpg`)} alt="" draggable={false} />
        {level === 1 && getWave(scene, wave).map((card, slot) => {
          const alien = card.kind === 'alien';
          const hit = targetImpacts[card.id];
          const silhouette = art(`${alien ? 'alien' : 'silueta'}-${card.art}.png`);
          return <div className={`tiro-cover tiro-cover--${card.depth}`} key={slot}
            style={{ left: `${card.x}%`, top: `${card.y}%`, width: `${card.width}%` }}>
            {card.visible && <div className={`tiro-reveal${hit ? ' tiro-reveal--reacting' : ''}`}>
              {hit ? <TargetBlast key={card.id} image={silhouette} x={hit.x} y={hit.y} />
                : <div key={card.id} className={`tiro-target${alien ? ' tiro-target--alien' : ''}${targetsHiding ? ' tiro-target--hide' : ''}`}>
                  <img src={silhouette} alt={card.kind} draggable={false} />
                  <span className="tiro-zone tiro-zone--head" data-zone="head" data-target={card.id} />
                  <span className="tiro-zone tiro-zone--chest" data-zone="chest" data-target={card.id} />
                </div>}
            </div>}
            <img className="tiro-obstacle" src={art(`cobertura-${card.cover}.png`)} alt="" draggable={false} />
          </div>;
        })}
        {level === 2 && <>
          <img className="tiro-plate-launcher" src={art('lanzadora.png')} alt="Lanzadora de platos" draggable={false}
            style={{ left: `${plateLauncher.x}%`, top: `${plateLauncher.y}%` }} />
          <img className="tiro-plate-wall" src={art('pared-platos.png')} alt="Pared de impacto" draggable={false}
            style={{ left: `${plateWall.x}%`, top: `${plateWall.y + 7}%` }} />
          {getPlates(elapsed).filter(plate => !targetImpacts[plate.id]).map(plate => plate.crashed
            ? <div key={plate.id} className="tiro-plate-break tiro-wall-crash" style={{ left: `${plate.x}%`, top: `${plate.y}%` }}><TargetBlast /></div>
            : <div key={plate.id} className="tiro-flying-plate" data-plate={plate.id}
              role="img" aria-label="Plato volador" style={{ left: `${plate.x}%`, top: `${plate.y}%` }} />)}
          {visibleNotices.flatMap(([id, hit]) => hit.plate && elapsed - hit.at < 870 ? [<div key={id} className="tiro-plate-break"
            style={{ left: `${hit.plate.x}%`, top: `${hit.plate.y}%` }}><TargetBlast /></div>] : [])}
        </>}
        {level === 3 && <PrecisionBoard {...getPrecisionPosition(precisionStep)} number={precisionStep + 1} holes={precisionHoles} />}
        </div>
        {level !== 3 && (scope ? <svg className={`tiro-scope${scope.precision ? ' tiro-scope--precision' : ''}`} viewBox="0 0 100 100" data-model={scope.name}
          style={{ '--tiro-scope-color': scope.color } as CSSProperties} aria-hidden="true">
          <path className="tiro-scope-frame" d={scope.frame} />
          <path className="tiro-scope-marks" d={scope.marks} />
          <path className="tiro-scope-core" d="M46 50H54M50 46V54" />
        </svg> : <div className={`tiro-mira${zoomValue > 1 ? ' tiro-mira--zoom' : ''}`} aria-hidden="true" />)}
        <div className={`tiro-weapon${activeSlot === 0 ? ' tiro-weapon--long' : ''}`} style={{
          '--tiro-tip-x': `${tipX * 100}%`,
          '--tiro-tip-y': `${tipY * 100}%`,
          '--tiro-gun-anchor': gunAnchor,
          '--tiro-gun-bottom-bleed': gunBottomBleed,
          '--tiro-gun-right-bleed': gunRightBleed,
          '--tiro-gun-height': `${gunHeight * 100}cqh`,
          '--tiro-reload-duration': `${RELOAD_MS}ms`,
        } as CSSProperties} aria-hidden="true">
          <div className={reloading ? 'tiro-weapon--reloading' : undefined}>
            {shotFxFrame >= 0 && <span className={`tiro-shot-fx${activeDesign >= 8 && activeDesign < 12 ? ' tiro-shot-fx--wide' : ''}`}
              style={{ backgroundImage: `url(${art(`rafaga-${shotFx[activeDesign]}.webp`)})`, backgroundPositionX: `${shotFxFrame / 9 * 100}%` }} />}
            <img className="tiro-weapon-art" alt="" draggable={false} src={art(weaponImage)} />
            <span ref={ejectPortRef} className="tiro-eject-port" />
            {muzzlePulse && <span key={muzzlePulse.id} className="tiro-muzzle-flash" />}
            {reloading && <img className="tiro-reload-hand" src={art('mano-recarga.png')} alt="" draggable={false} />}
          </div>
        </div>
        {casings.filter(casing => elapsed - casing.at < 520).map(casing => <span key={casing.id} className="tiro-casing" aria-hidden="true"
          style={{ left: `${casing.x}%`, top: `${casing.y}%`, '--tiro-casing-drift': `${(casing.id % 3 + 2) * 17}px` } as CSSProperties} />)}
        <div className="tiro-score-feed" role="status" aria-label="Puntos de los impactos">
          {visibleNotices.map(([id, hit]) => {
            const left = view.x + hit.worldX * view.scale;
            const top = view.y + hit.worldY * view.scale;
            return <strong key={id} className={`tiro-score-notice${hit.value < 0 ? ' tiro-score-notice--penalty' : ''}`}
              style={{ left: `clamp(2rem, ${left}%, calc(100% - 2rem))`, top: `clamp(2rem, ${top}%, 100%)`, visibility: left < 0 || left > 100 ? 'hidden' : undefined }}>
              {hit.value > 0 ? '+' : '−'}{Math.abs(hit.value)} {Math.abs(hit.value) === 1 ? 'punto' : 'puntos'}
            </strong>;
          })}
        </div>
        <button type="button" className="tiro-touch-fire" onPointerDown={event => {
          event.stopPropagation();
          if (event.button !== 0) return;
          trigger.current = weapon.effect === 1 ? performance.now() : null;
          fire();
        }} onClick={event => { event.stopPropagation(); if (event.detail === 0) fire(); }}>Disparar</button>
      </div>
      <p className="tiro-hint">{ammo[activeSlot].remaining === 0 ? 'Munición agotada. La ronda termina al vencer el reloj.' : level === 3
        ? 'Un tiro por distancia. Cabeza +15 · anillos del torso +7 a +10.' : <>
          <span className="tiro-hint-mouse">Mové el mouse para mirar, hacé clic para disparar y usá Espacio para cambiar de arma.</span>
          <span className="tiro-hint-touch">Arrastrá para mirar y tocá para disparar al centro.</span>
        </>}</p>
    </>}

    {phase === 'precision-break' && <section className="tiro-results" aria-labelledby="tiro-precision-break-title">
      <h2 id="tiro-precision-break-title">Ronda {precisionRound} de {PRECISION_ROUNDS} completada</h2>
      <p>{precisionResults.at(-1)?.score} puntos en esta ronda · {precisionTotal.score} puntos acumulados</p>
      <button className="tiro-action" type="button" onClick={() => start(turn, 3, precisionRound + 1)}>Empezar ronda {precisionRound + 1}</button>
    </section>}

    {phase === 'level-report' && settledLevel && <article className="tiro-level-report" aria-labelledby="tiro-level-report-title">
      <div className="tiro-report-profile">
        <figure className="tiro-report-soldier">
          <img src={art(`operador-${loadout.operator}.jpg`)} alt={`Retrato de ${operators[loadout.operator]}`} />
          <figcaption>{operators[loadout.operator]} <small>Jugador {turn + 1}</small></figcaption>
        </figure>
        <div className="tiro-campaign-total"><span>Total acumulado</span><strong>{accumulatedScore} pts</strong></div>
      </div>
      <div className="tiro-report-details">
        <p>Nivel {settledLevel.level} completado</p>
        <h2 id="tiro-level-report-title">{levelNames[settledLevel.level - 1]}</h2>
        <dl className="tiro-report-metrics">
          <div><dt>Puntos del nivel</dt><dd>{settledLevel.score}</dd></div>
          <div><dt>Tiros</dt><dd>{settledLevel.shots}</dd></div>
          <div><dt>Aciertos</dt><dd>{settledLevel.hits}</dd></div>
          <div><dt>Precisión</dt><dd>{settledLevel.shots ? Math.round(settledLevel.hits / settledLevel.shots * 100) : 0}%</dd></div>
          {settledLevel.level === 2 ? <>
            <div><dt>Platos rotos</dt><dd>{settledLevel.hits}</dd></div>
            <div><dt>Platos lanzados</dt><dd>{launchedPlates(ROUND_MS)}</dd></div>
          </> : <>
            <div><dt>Aciertos a la cabeza</dt><dd>{settledLevel.headshots}</dd></div>
            <div><dt>Aciertos al torso</dt><dd>{settledLevel.hits - settledLevel.headshots}</dd></div>
            {settledLevel.level === 1 ? <div><dt>Impactos a inocentes</dt><dd>{settledLevel.errors}</dd></div>
              : <div><dt>Distancias completadas</dt><dd>{settledLevel.shots}/{PRECISION_DISTANCES * PRECISION_ROUNDS}</dd></div>}
          </>}
        </dl>
        {settledLevel.rounds && <ul className="tiro-level-scores" aria-label="Puntos por ronda">
          {settledLevel.rounds.map((entry, index) => <li key={index}>Ronda {index + 1} <strong>{entry.score} pts</strong></li>)}
        </ul>}
        {levelResults.length > 1 && <ul className="tiro-level-scores" aria-label="Puntos por nivel">
          {levelResults.map(entry => <li key={entry.level}>{levelNames[entry.level - 1]} <strong>{entry.score} pts</strong></li>)}
        </ul>}
        <button className="tiro-action" type="button" onClick={continueCampaign}>{level < 3 ? `Ir al nivel ${level + 1}` : 'Ver resultados'}</button>
      </div>
    </article>}

    {(phase === 'between' || phase === 'results') && <div className="tiro-results">
      <h2>{phase === 'between' ? 'Cambio de jugador' : 'Resultados'}</h2>
      {phase === 'results' && players > 1 && <p>{ranking[0].score === ranking[1].score ? 'Empate en el primer puesto' : `Ganó el jugador ${ranking[0].index + 1}`}</p>}
      <ol>{ranking.map(entry => <li key={entry.index}>
        <strong>Jugador {entry.index + 1} · {operators[loadouts[entry.index].operator]}</strong>
        <b>{entry.score} pts</b>
        <span>{entry.hits} aciertos · {entry.errors} impactos a inocentes · {entry.shots} tiros</span>
        <span>{entry.levels.map(entry => `${levelNames[entry.level - 1]} ${entry.score} pts`).join(' · ')}</span>
      </li>)}</ol>
      {phase === 'between'
        ? <button type="button" className="tiro-action" onClick={() => start(turn + 1)}>Jugar turno {turn + 2}</button>
        : <button type="button" className="tiro-action" onClick={() => setPhase('setup')}>Nueva partida</button>}
    </div>}
  </section>;
}
