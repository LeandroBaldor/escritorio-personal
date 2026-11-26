import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { campaignRating, getCameraView, getPlates, getPrecisionPosition, getWave, precisionLane, launchedPlates, levelNames, levelOrdinals, plateLauncher, plateWall, PRECISION_DISTANCES, PRECISION_ROUNDS, PRECISION_STEP_MS, primaries, ROUND_MS, roundLimit, scoreImpact, scorePrecision, secondaries, TARGET_RISE_MS, TARGET_VISIBLE_MS, WAVE_MS } from './tiro2050';
import type { Level } from './tiro2050';
import { PrecisionBoard, TargetBlast } from './Tiro2050Targets';
import { playBolt } from './sounds';
import { gunFamily, isTiroMusicMuted, playTiroReload, playTiroShot, preloadTiroSounds, playTiroAlarm, preloadTiroAlarm, RELOAD_DURATION, setTiroMusicMuted, startTiroMusic, stopTiroMusic, COUNTDOWN_LEAD_MS, pauseTiroCountdown, playTiroCountdown, preloadTiroCountdown, resumeTiroCountdown, stopTiroCountdown } from './tiro2050Sound';
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

const assets = import.meta.glob(['./assets/tiro2050/{escenario,operador,arsenal,alien}-*', './assets/tiro2050/silueta-[2345].png', './assets/tiro2050/cobertura-1[2-7].png', './assets/tiro2050/{lanzadora,pared-platos}.png', './assets/tiro2050/rafaga-*.webp', './assets/tiro2050/ejemplo-*.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const art = (name: string) => assets[`./assets/tiro2050/${name}`];
export const tiro2050Cover = art('escenario-3.jpg');

const scenes = ['Hangar estelar', 'Fábrica robotizada', 'Puente de mando', 'Reactor orbital', 'Laboratorio de contención'];
// Escenarios de cada prueba (5 cada una). Imágenes: escenario-0…4 Aliens, 5…9 Platos, 10…14 Target.
const levelScenes: Record<Level, string[]> = {
  1: scenes,
  2: ['Apocalipsis', 'Estadio de fútbol', 'Metrópolis cyberpunk', 'Campo orbital', 'Fábrica de radiación'],
  3: ['Galería de tiro', 'Fábrica futurista', 'Inferno', 'Jurásico', 'Nostromo'],
};
const sceneArt = (level: Level, index: number) => art(`escenario-${(level - 1) * 5 + index}.jpg`);
const levelBriefs: Record<Level, { text: string; points: string; time: string }> = {
  1: { text: 'Los aliens asoman detrás de las coberturas entre rehenes y civiles. Bajá solo a los aliens.', points: 'Cabeza +10 · torso +5 · rehén o civil −10', time: '3 minutos' },
  2: { text: 'La lanzadora tira platos que cruzan el campo hasta la pared. Rompé todos los que puedas antes de que choquen.', points: 'Cada plato roto +1', time: '3 minutos' },
  3: { text: 'El blanco se aleja en cada tiro. Un solo disparo por distancia, con el arma de reserva.', points: 'Cabeza +15 · anillos del torso +7 a +10', time: '4 rondas de 10 distancias · 40 s cada una' },
};
// Color del plato (segunda prueba): se cambia el tono del plato naranja original.
const plateColors = [
  { name: 'Naranja', hue: 0, swatch: '#ef752e' }, { name: 'Rojo', hue: -28, swatch: '#e2383a' }, { name: 'Amarillo', hue: 26, swatch: '#f3c626' },
  { name: 'Verde', hue: 95, swatch: '#3fc34a' }, { name: 'Azul', hue: 185, swatch: '#2f8ff0' }, { name: 'Violeta', hue: 250, swatch: '#a35cf0' },
];
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
  arsenal, start, lastShot: -Infinity, nextPulse: 0, pendingShots: [0, 0], finishAt: Infinity, finished: false, pausedAt: 0, countdown: false, result: emptyResult, fallen: new Set<number>(),
});

function WeaponPreview({ design }: { design: number }) {
  return <div className="tiro-weapon-preview" style={{
    '--tiro-gun-bottom-bleed': gunBottomBleed, '--tiro-gun-right-bleed': rightBleed(design),
  } as CSSProperties}>
    <img src={art(`arsenal-${design}.png`)} alt="" />
  </div>;
}

export function Tiro2050Game() {
  const [scenePicks, setScenePicks] = useState<number[]>([0, 0, 0]);
  const [players, setPlayers] = useState(1);
  const [loadouts, setLoadouts] = useState<Loadout[]>(() => operators.map((_, operator) => ({ ...initialLoadout, operator })));
  const [turn, setTurn] = useState(0);
  const [level, setLevel] = useState<Level>(1);
  const scene = scenePicks[level - 1];
  const [phase, setPhase] = useState<'setup' | 'briefing' | 'stage' | 'round' | 'precision-break' | 'level-report' | 'final' | 'results'>('setup');
  const [plateColor, setPlateColor] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result>(emptyResult);
  const [results, setResults] = useState<CampaignResult[]>([]);
  const [levelResults, setLevelResults] = useState<LevelResult[]>([]);
  const [precisionRound, setPrecisionRound] = useState(1);
  const [paused, setPaused] = useState(false);
  // Cambia en cada start(): así el bucle de la ronda se reinicia aunque la fase siga siendo 'round' (rondas de Target).
  const [roundSerial, setRoundSerial] = useState(0);
  const [musicMuted, setMusicMuted] = useState(isTiroMusicMuted);
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
  const sideRef = useRef<HTMLDivElement>(null);
  // Ancho de la franja izquierda en % del campo: la cámara no deja ver más allá del borde del mapa en esa franja.
  const [leftBand, setLeftBand] = useState(0);
  // Música de fondo mientras se está en el juego (si el navegador la frena hasta el primer clic o tecla, arranca ahí).
  useEffect(() => {
    startTiroMusic();
    const kick = () => startTiroMusic();
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
      stopTiroMusic();
    };
  }, []);
  useEffect(() => {
    const side = sideRef.current, range = rangeRef.current;
    if (phase !== 'round' || !side || !range) return;
    const observer = new ResizeObserver(() => {
      const width = range.getBoundingClientRect().width;
      setLeftBand(width ? side.getBoundingClientRect().width / width * 100 : 0);
    });
    observer.observe(side);
    observer.observe(range);
    return () => observer.disconnect();
  }, [phase]);
  const ejectPortRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<number | null>(null);
  const handledClick = useRef(false);
  const touchAim = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const round = useRef(newRound(arsenal));
  const loadout = loadouts[turn];
  const primary = primaries[loadout.primary];
  const selectedSecondary = secondaries[loadout.secondary];
  const secondary = level === 3 && selectedSecondary.effect !== 3 ? secondaries[0] : selectedSecondary;
  // Correcciones 20: en Platos, el doble de balas en las dos armas.
  const weapons = level === 2 ? [primary, secondary].map(item => ({ ...item, ammo: item.ammo * 2 })) : [primary, secondary];
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
  const view = getCameraView(camera, zoomValue, leftBand);
  const wave = Math.floor(elapsed / WAVE_MS);
  const targetsHiding = elapsed % WAVE_MS >= TARGET_RISE_MS + TARGET_VISIBLE_MS;
  const limit = roundLimit(level);
  const clock = Math.max(0, Math.ceil((limit - elapsed) / 1000));
  const tint = colors[loadout.operator];
  const stageName = levelScenes[level][scene];
  const precisionShot = Math.max(0, Math.min(PRECISION_DISTANCES - 1, result.shots - Number(level === 3 && impact !== null && elapsed - impact.at < PRECISION_STEP_MS)));
  // Target: las rondas impares el cartel se va 10 veces para atrás y las pares vuelve 10 veces hacia adelante (4 rondas).
  const precisionStep = precisionRound % 2 === 0 ? PRECISION_DISTANCES - 1 - precisionShot : precisionShot;
  const settledLevel = levelResults.at(-1);
  const accumulatedScore = levelResults.reduce((total, entry) => total + entry.score, 0);
  const precisionTotal = sumResults(precisionResults);

  const finishLevel = useEffectEvent(() => {
    const live = round.current;
    if (live.finished) return;
    live.finished = true;
    if (performance.now() - live.start < roundLimit(level) - 120) stopTiroCountdown();
    if (level === 3) {
      const rounds = [...precisionResults, live.result];
      setPrecisionResults(rounds);
      // Sin pantalla entre rondas: la siguiente arranca sola y la anuncia la alarma.
      if (precisionRound < PRECISION_ROUNDS) {
        start(turn, 3, precisionRound + 1);
        return;
      }
      setLevelResults(previous => [...previous, { level, ...sumResults(rounds), rounds }]);
    } else {
      setLevelResults(previous => [...previous, { level, ...live.result }]);
    }
    setPhase('level-report');
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __tiro2050Finish?: () => void }).__tiro2050Finish = () => { round.current.start -= ROUND_MS; round.current.finishAt = 0; };
    (window as unknown as { __tiro2050Skip?: (ms: number) => void }).__tiro2050Skip = ms => { round.current.start -= ms; };
  }, []);

  useEffect(() => {
    if (phase !== 'round') return;
    let frame = 0;
    const tick = (now: number) => {
      if (round.current.pausedAt) { frame = requestAnimationFrame(tick); return; }
      const time = Math.max(0, now - round.current.start);
      const end = roundLimit(level);
      if (time >= end || (level === 3 && now >= round.current.finishAt)) {
        finishLevel();
        return;
      }
      // Cuenta regresiva: el 4.º pitido suena justo cuando se termina el tiempo y aparecen los resultados.
      if (!round.current.countdown && time >= end - COUNTDOWN_LEAD_MS) {
        round.current.countdown = true;
        playTiroCountdown(time - (end - COUNTDOWN_LEAD_MS));
      }
      setElapsed(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, level, roundSerial]);
  useEffect(() => () => stopTiroCountdown(), []);

  function start(player: number, nextLevel: Level = 1, nextPrecisionRound = 1) {
    preloadTiroSounds();
    preloadTiroAlarm();
    preloadTiroCountdown();
    const nextArsenal = newArsenal(nextLevel === 3 ? 1 : 0);
    round.current = newRound(nextArsenal, performance.now());
    setArsenal(nextArsenal);
    setTurn(player);
    setLevel(nextLevel);
    setPrecisionRound(nextPrecisionRound);
    if (nextPrecisionRound === 1) setPrecisionResults([]);
    setPaused(false);
    setRoundSerial(serial => serial + 1);
    if (nextLevel === 3) playTiroAlarm();
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

  function goTo(next: typeof phase) { playMenu(); if (next === 'setup') stopTiroCountdown(); setPhase(next); }
  function nextTest() {
    playMenu();
    setLevel(level === 1 ? 2 : 3);
    setPhase('stage');
  }
  function showFinal() {
    playMenu();
    setResults(previous => [...previous, { ...sumResults(levelResults), levels: levelResults }]);
    setPhase('final');
  }
  function nextPlayer() {
    playMenu();
    setTurn(turn + 1);
    setLevel(1);
    setLevelResults([]);
    setPhase('stage');
  }
  function newGame() {
    playMenu();
    setResults([]);
    setTurn(0);
    setLevel(1);
    setPhase('setup');
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
    if (!range || phase !== 'round' || round.current.pausedAt) return;
    const bounds = range.getBoundingClientRect();
    const live = round.current;
    const now = performance.now();
    const shots = live.result.shots;
    const current = live.arsenal;
    const slot = current.slot;
    const activeWeapon = weapons[slot];
    const time = now - live.start;
    const available = Math.min(activeWeapon.ammo - current.shots[slot], level === 3 ? PRECISION_DISTANCES - shots : Infinity);
    if (live.finished || time >= roundLimit(level) || available <= 0) return;
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
    const family = gunFamily(slot, slot === 0 ? loadout.primary : loadout.secondary);
    playTiroShot(family, (pulse - time) / 1000);
    setMuzzlePulses(previous => [...previous.filter(shot => shot.at + 450 > time).slice(-3), { id: shots, at: pulse }]);
    const ejectPort = ejectPortRef.current?.getBoundingClientRect();
    if (ejectPort) {
      const position = point({ clientX: ejectPort.x, clientY: ejectPort.y }, bounds);
      setCasings(previous => [...previous.filter(casing => time - casing.at < 520), { id: shots, ...position, at: time }]);
    }
    const next: Arsenal = { slot, shots: [...current.shots], reloadEnds: [...current.reloadEnds] };
    const used = ++next.shots[slot];
    if (!(level === 3 && shots + 1 === PRECISION_DISTANCES) && used < activeWeapon.ammo && used % activeWeapon.magazine === 0) {
      next.reloadEnds[slot] = time + RELOAD_DURATION[family];
      playTiroReload(family);
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
  function togglePause() {
    const live = round.current;
    if (phase !== 'round' || live.finished) return;
    const now = performance.now();
    if (live.pausedAt) {
      const gap = now - live.pausedAt;
      live.start += gap;
      live.finishAt += gap;
      live.lastShot += gap;
      live.pausedAt = 0;
      resumeTiroCountdown();
      setPaused(false);
    } else {
      live.pausedAt = now;
      pauseTiroCountdown();
      live.pendingShots = [0, 0];
      trigger.current = null;
      setPaused(true);
    }
  }
  const keyPause = useEffectEvent((event: KeyboardEvent) => {
    if (event.code !== 'KeyP' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, select, textarea'))) return;
    event.preventDefault();
    togglePause();
  });
  const keySwap = useEffectEvent((event: KeyboardEvent) => {
    if (round.current.pausedAt) return;
    if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || level === 3) return;
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, select, textarea'))) return;
    event.preventDefault();
    if (!event.repeat) swapWeapon();
  });

  useEffect(() => {
    const range = rangeRef.current;
    if (phase !== 'round' || !range) return;
    const wheel = (event: WheelEvent) => scrollZoom(event);
    const key = (event: KeyboardEvent) => { keyPause(event); keySwap(event); };
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
  // Movimiento del arma (correcciones 17). Recarga: se va un poco para atrás y después inclina la punta hacia abajo;
  // dura lo mismo que el sonido de recarga. Disparo: con cada tiro la punta sube y toda el arma se va un poco para atrás.
  const reloadLength = RELOAD_DURATION[gunFamily(activeSlot, activeSlot === 0 ? loadout.primary : loadout.secondary)];
  const reloadLeft = arsenal.reloadEnds[activeSlot] - elapsed;
  const reloadProgress = reloadLeft > 0 && reloadLeft <= reloadLength ? 1 - reloadLeft / reloadLength : -1;
  const ease = (value: number) => .5 - Math.cos(Math.PI * Math.min(1, Math.max(0, value))) / 2;
  const reloadBack = reloadProgress < 0 ? 0 : reloadProgress < .25 ? ease(reloadProgress / .25) : reloadProgress < .8 ? 1 : 1 - ease((reloadProgress - .8) / .2);
  const reloadTilt = reloadProgress < 0 ? 0 : reloadProgress < .25 ? 0 : reloadProgress < .45 ? ease((reloadProgress - .25) / .2) : reloadProgress < .8 ? 1 : 1 - ease((reloadProgress - .8) / .2);
  const recoilAge = lastShot ? elapsed - lastShot.at : Infinity;
  const recoil = recoilAge < 30 ? recoilAge / 30 : recoilAge < 170 ? 1 - ease((recoilAge - 30) / 140) : 0;
  // Correcciones 18: todo más exagerado. Al recargar el arma casi sale de la pantalla (la pistola todavía más).
  const pistolPose = activeSlot === 1;
  const backX = pistolPose ? 20 : 14, backY = pistolPose ? 28 : 24, tiltDown = pistolPose ? 30 : 24;
  // Correcciones 19: con el arma principal el retroceso la tira más para atrás, así no se ve dónde termina el brazo izquierdo.
  const kickX = pistolPose ? 4.5 : 9, kickY = pistolPose ? 5 : 13;
  const weaponPose = `translate(${(reloadBack * backX + recoil * kickX).toFixed(2)}%, ${(reloadBack * backY + reloadTilt * (pistolPose ? 22 : 20) + recoil * kickY).toFixed(2)}%) rotate(${(recoil * 7 - reloadTilt * tiltDown).toFixed(2)}deg)`;
  const visibleNotices = Object.entries(targetImpacts).filter(([, hit]) => elapsed - hit.at < scoreNoticeDuration);

  return <section className={`tiro2050${phase === 'round' ? ' tiro2050--round' : ''}`} style={{ '--tiro-accent': tint } as CSSProperties}>
    <button type="button" className="tiro-music-toggle" aria-pressed={musicMuted} aria-label={musicMuted ? 'Activar la música' : 'Silenciar la música'}
      title={musicMuted ? 'Activar la música' : 'Silenciar la música'} onClick={() => { setTiroMusicMuted(!musicMuted); setMusicMuted(!musicMuted); }}>
      {musicMuted ? '🔇' : '🔊'}
    </button>
    <svg className="tiro-art-filters" aria-hidden="true" width="0" height="0">
      <filter id="tiro-clean-weapon-edge" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="erode" radius="1.25" result="trimmedAlpha" />
        <feComposite in="SourceGraphic" in2="trimmedAlpha" operator="in" />
      </filter>
    </svg>
    <div className="tiro-top">
      <Link to="/juegos">MiniJuegos</Link>
      <h1>Tiro al Blanco <em>2050</em></h1>
      {phase !== 'setup' && <button type="button" onClick={newGame}>Menú</button>}
    </div>

    {phase === 'setup' && <div className="tiro-setup">
      <div className="tiro-headline">
      <h2 className="tiro-menu-title">Elegí tu soldado y sus armas</h2>
      <div className="tiro-headline-actions">
      <div className="tiro-brief tiro-brief--players">
        <label>Jugadores locales <select value={players} onChange={event => { playMenu(); setPlayers(Number(event.target.value)); }}>
          {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
      </div>
      <button className="tiro-action tiro-go" type="button" onClick={() => { setResults([]); setTurn(0); setLevel(1); goTo('briefing'); }}>Continuar</button>
      </div>
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
          <div className="tiro-armory">
            <div className="tiro-armory-slot">
              <label>Arma principal <select value={selection.primary} onChange={event => configure(index, { primary: Number(event.target.value), variant: 0 })}>
                {primaries.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
              </select></label>
            </div>
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
    </div>}

    {phase === 'briefing' && <div className="tiro-setup">
      <div className="tiro-headline">
        <h2 className="tiro-menu-title">La competencia</h2>
        <button className="tiro-action tiro-go" type="button" onClick={() => goTo('stage')}>Continuar</button>
      </div>
      <p className="tiro-menu-lead">Tres pruebas, una después de la otra. Al final se suman los puntos y se califica cómo jugaste.</p>
      <ol className="tiro-tests">
        {([1, 2, 3] as Level[]).map(test => <li key={test}>
          <img src={art(`ejemplo-${['aliens', 'platos', 'target'][test - 1]}.webp`)} alt={`Ejemplo de una partida de ${levelNames[test - 1]}`} />
          <span><small>{levelOrdinals[test - 1]}</small><strong>{levelNames[test - 1]}</strong></span>
          <p>{levelBriefs[test].text}</p>
        </li>)}
      </ol>
    </div>}

    {phase === 'stage' && <div className="tiro-setup tiro-setup--stage">
      <div className="tiro-headline">
        <h2 className="tiro-menu-title">{levelOrdinals[level - 1]}: {levelNames[level - 1]}{players > 1 && <small> · Jugador {turn + 1}</small>}</h2>
        <button className="tiro-action tiro-go" type="button" onClick={() => { playMenu(); start(turn, level); }}>Iniciar</button>
      </div>
      <div className="tiro-stage-menu">
      <div className="tiro-stage-main">
      <figure className="tiro-scene-hero">
        <img className="tiro-scene-preview" src={sceneArt(level, scene)} alt="" />
        <figcaption>{stageName}</figcaption>
      </figure>
      <fieldset className="tiro-scenes">
        <legend>Escenario</legend>
        {levelScenes[level].map((name, i) => <button key={i} type="button" aria-pressed={scene === i}
          onClick={() => { playMenu(); setScenePicks(previous => previous.map((pick, index) => index === level - 1 ? i : pick)); }}>
          <img src={sceneArt(level, i)} alt="" />
          {name}
        </button>)}
      </fieldset>
      </div>
      <div className="tiro-stage-side">
      {level === 2 && <fieldset className="tiro-plate-colors">
        <legend>Color del plato</legend>
        {plateColors.map((color, i) => <button key={color.name} type="button" aria-pressed={plateColor === i} onClick={() => { playMenu(); setPlateColor(i); }}>
          <span className="tiro-plate-swatch" style={{ '--tiro-plate-hue': `${color.hue}deg` } as CSSProperties} />{color.name}
        </button>)}
      </fieldset>}
      <dl className="tiro-test-brief">
        <div className="tiro-test-brief-text"><dt>La prueba</dt><dd>{levelBriefs[level].text}</dd></div>
        <div><dt>Puntos</dt><dd>{levelBriefs[level].points}</dd></div>
        <div><dt>Tiempo</dt><dd>{levelBriefs[level].time}</dd></div>
        <div><dt>Arma</dt><dd>{level === 3 ? (selectedSecondary.effect === 3 ? selectedSecondary.name : secondaries[0].name) : `${primaryName} y ${selectedSecondary.name}`}</dd></div>
      </dl>
      </div>
      </div>
    </div>}

    {phase === 'round' && <>
      <div className="tiro-play-wrap"><div className="tiro-play">
      <div ref={sideRef} className="tiro-side" aria-hidden="true" />
      <div className="tiro-field">
      <div ref={rangeRef} className="tiro-range" aria-label={stageName} onPointerMove={aimAt} onPointerLeave={() => { trigger.current = null; }}
        onClick={event => { if (event.button === 0 && !handledClick.current) fire(); }}
        onPointerDown={beginAim} onPointerUp={endAim} onLostPointerCapture={event => {
          if (touchAim.current?.id === event.pointerId) touchAim.current = null;
        }}>
        <div className="tiro-world" style={{ transform: `translate(${view.x}%, ${view.y}%) scale(${view.scale})` }}>
        <img className="tiro-backdrop" src={sceneArt(level, scene)} alt="" draggable={false} />
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
              role="img" aria-label="Plato volador" style={{ left: `${plate.x}%`, top: `${plate.y}%`, '--tiro-plate-hue': `${plateColors[plateColor].hue}deg` } as CSSProperties} />)}
          {visibleNotices.flatMap(([id, hit]) => hit.plate && elapsed - hit.at < 870 ? [<div key={id} className="tiro-plate-break"
            style={{ left: `${hit.plate.x}%`, top: `${hit.plate.y}%` }}><TargetBlast /></div>] : [])}
        </>}
        {level === 3 && <PrecisionBoard {...getPrecisionPosition(precisionStep, precisionLane(precisionRound, precisionShot))} number={precisionStep + 1} holes={precisionHoles} />}
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
        } as CSSProperties} aria-hidden="true">
          <div className="tiro-weapon-pose" style={{ transform: weaponPose }}>
            {shotFxFrame >= 0 && <span className={`tiro-shot-fx${activeDesign >= 8 && activeDesign < 12 ? ' tiro-shot-fx--wide' : ''}`}
              style={{ backgroundImage: `url(${art(`rafaga-${shotFx[activeDesign]}.webp`)})`, backgroundPositionX: `${shotFxFrame / 9 * 100}%` }} />}
            <img className="tiro-weapon-art" alt="" draggable={false} src={art(weaponImage)} />
            <span ref={ejectPortRef} className="tiro-eject-port" />
            {muzzlePulse && <span key={muzzlePulse.id} className="tiro-muzzle-flash" />}
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
        {paused && <div className="tiro-pause" role="status" onPointerDown={event => event.stopPropagation()}>
          <strong>Pausa</strong>
          <span>Apretá P para seguir</span>
        </div>}
      </div>
      </div>
      <div className="tiro-command">
      <div className="tiro-hud">
        <span className="tiro-hud-player"><img src={art(`operador-${loadout.operator}.jpg`)} alt="" /><span><small>Jugador {turn + 1}</small><b>{operators[loadout.operator]}</b></span></span>
        <span className="tiro-hud-score"><small>Prueba {level} de 3 · {levelNames[level - 1]}</small><strong><b>{result.score + (level === 3 ? precisionTotal.score : 0)}</b> pts</strong></span>
        {level === 3 && <span className="tiro-hud-score tiro-distance"><small>Ronda {precisionRound}/{PRECISION_ROUNDS}</small><strong aria-label="Distancia del blanco">{precisionStep + 1}/{PRECISION_DISTANCES}</strong></span>}
        <time aria-label="Tiempo restante">{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, '0')}</time>
      </div>
      <div className="tiro-ammo" aria-label="Munición disponible y gastada">
        {[primary, secondary].map((item, index) => level === 3 && index === 0 ? null : <div key={item.name} className={index === activeSlot ? 'tiro-ammo-active' : undefined}>
          <span>{index === 0 ? `Principal · ${primaryName}` : level === 3 ? item.name : `Reserva · ${item.name}`}</span>
          <strong>{ammo[index].remaining}/{ammo[index].used}</strong>
        </div>)}
        <small>Disponibles / gastadas</small>
        {level !== 3 && <button type="button" className="tiro-swap" aria-keyshortcuts="Space" disabled={!canSwap || paused} onClick={swapWeapon}>Cambiar arma</button>}
        <button type="button" className="tiro-swap tiro-pause-button" aria-keyshortcuts="P" aria-pressed={paused} onClick={togglePause}>{paused ? 'Seguir (P)' : 'Pausa (P)'}</button>
        {zoomLimit > 1 && <div className="tiro-zoom" aria-label="Zoom de la mira">
          <button type="button" aria-label="Alejar la mira" disabled={zoomValue <= 1} onClick={() => zoomBy(1 / 1.35)}>−</button>
          <output>{zoomValue.toFixed(1)}×</output>
          <button type="button" aria-label="Acercar la mira" disabled={zoomValue >= zoomLimit} onClick={() => zoomBy(1.35)}>+</button>
        </div>}
      </div>
      </div>
      </div></div>
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
        <p>{levelOrdinals[settledLevel.level - 1]} terminada</p>
        <h2 id="tiro-level-report-title">{levelNames[settledLevel.level - 1]}</h2>
        <dl className="tiro-report-metrics">
          <div className="tiro-report-score"><dt>Puntos</dt><dd>{settledLevel.score}</dd></div>
          {settledLevel.level === 2 ? <>
            <div><dt>Platos destruidos</dt><dd>{settledLevel.hits}</dd></div>
            <div><dt>Platos lanzados</dt><dd>{launchedPlates(ROUND_MS)}</dd></div>
            <div><dt>Platos que se escaparon</dt><dd>{Math.max(0, launchedPlates(ROUND_MS) - settledLevel.hits)}</dd></div>
            <div><dt>Disparos</dt><dd>{settledLevel.shots}</dd></div>
            <div><dt>Disparos errados</dt><dd>{settledLevel.shots - settledLevel.hits}</dd></div>
          </> : settledLevel.level === 1 ? <>
            <div><dt>Balas disparadas</dt><dd>{settledLevel.shots}</dd></div>
            <div><dt>Aciertos</dt><dd>{settledLevel.hits}</dd></div>
            <div><dt>Tiros a la cabeza</dt><dd>{settledLevel.headshots}</dd></div>
            <div><dt>Tiros al torso</dt><dd>{settledLevel.hits - settledLevel.headshots}</dd></div>
            <div><dt>Rehenes y civiles heridos</dt><dd>{settledLevel.errors}</dd></div>
          </> : <>
            <div><dt>Disparos</dt><dd>{settledLevel.shots}</dd></div>
            <div><dt>Aciertos</dt><dd>{settledLevel.hits}</dd></div>
            <div><dt>Tiros a la cabeza</dt><dd>{settledLevel.headshots}</dd></div>
            <div><dt>Tiros al torso</dt><dd>{settledLevel.hits - settledLevel.headshots}</dd></div>
            <div><dt>Distancias completadas</dt><dd>{settledLevel.shots}/{PRECISION_DISTANCES * PRECISION_ROUNDS}</dd></div>
          </>}
          <div><dt>Precisión</dt><dd>{settledLevel.shots ? Math.round(settledLevel.hits / settledLevel.shots * 100) : 0}%</dd></div>
        </dl>
        {settledLevel.rounds && <ul className="tiro-level-scores" aria-label="Puntos por ronda">
          {settledLevel.rounds.map((entry, index) => <li key={index}>Ronda {index + 1} <strong>{entry.score} pts</strong></li>)}
        </ul>}
      </div>
      <div className={`tiro-report-actions${level === 3 ? ' tiro-report-actions--center' : ''}`}>
        {level < 3 ? <button className="tiro-action" type="button" onClick={nextTest}>Siguiente prueba</button>
          : <button className="tiro-action" type="button" onClick={showFinal}>Resultado Final</button>}
      </div>
    </article>}

    {phase === 'final' && (() => {
      const total = sumResults(levelResults);
      const rating = campaignRating(levelResults);
      const percent = (entry: { hits: number; shots: number }) => entry.shots ? Math.round(entry.hits / entry.shots * 100) : 0;
      return <article className="tiro-level-report tiro-final" aria-labelledby="tiro-final-title">
        <div className="tiro-report-profile">
          <figure className="tiro-report-soldier">
            <img src={art(`operador-${loadout.operator}.jpg`)} alt={`Retrato de ${operators[loadout.operator]}`} />
            <figcaption>{operators[loadout.operator]} <small>Jugador {turn + 1}</small></figcaption>
          </figure>
        </div>
        <div className="tiro-report-details">
          <p>Fin de la competencia</p>
          <h2 id="tiro-final-title">Resultado Final</h2>
          <table className="tiro-final-table">
            <thead><tr><th scope="col">Prueba</th><th scope="col">Puntos</th><th scope="col">Disparos</th><th scope="col">Aciertos</th><th scope="col">Precisión</th></tr></thead>
            <tbody>
              {levelResults.map(entry => <tr key={entry.level}><th scope="row">{levelNames[entry.level - 1]}</th><td>{entry.score}</td><td>{entry.shots}</td><td>{entry.hits}</td><td>{percent(entry)}%</td></tr>)}
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td>{total.score}</td><td>{total.shots}</td><td>{total.hits}</td><td>{percent(total)}%</td></tr></tfoot>
          </table>
          <div className={`tiro-rating tiro-rating--${rating.label === 'Muy malo' ? 0 : ['Malo', 'Regular', 'Bueno', 'Excelente'].indexOf(rating.label) + 1}`} data-testid="tiro2050-rating">
            <span>Calificación</span><strong>{rating.label}</strong><small>Rendimiento {rating.percent}%</small>
          </div>
          <p className="tiro-rating-note">El rendimiento es el promedio de las tres pruebas: en Aliens los aciertos sobre los disparos (cada rehén o civil herido resta dos aciertos), en Platos los platos rotos sobre los lanzados y en Target los puntos sobre el máximo posible. Muy malo: menos de 20% · Malo: 20 a 39% · Regular: 40 a 59% · Bueno: 60 a 79% · Excelente: 80% o más.</p>
        </div>
        <div className="tiro-report-actions">
          {turn + 1 < players ? <button className="tiro-action" type="button" onClick={nextPlayer}>Turno del jugador {turn + 2}</button>
            : players > 1 ? <button className="tiro-action" type="button" onClick={() => goTo('results')}>Ver ganador</button>
              : <button className="tiro-action" type="button" onClick={newGame}>Nueva partida</button>}
        </div>
      </article>;
    })()}

    {phase === 'results' && <div className="tiro-results">
      <h2>Resultados</h2>
      {players > 1 && ranking.length > 1 && <p>{ranking[0].score === ranking[1].score ? 'Empate en el primer puesto' : `Ganó el jugador ${ranking[0].index + 1}`}</p>}
      <ol>{ranking.map(entry => <li key={entry.index}>
        <strong>Jugador {entry.index + 1} · {operators[loadouts[entry.index].operator]}</strong>
        <b>{entry.score} pts</b>
        <span>{campaignRating(entry.levels).label} · {entry.hits} aciertos · {entry.errors} rehenes o civiles heridos · {entry.shots} disparos</span>
        <span>{entry.levels.map(item => `${levelNames[item.level - 1]} ${item.score} pts`).join(' · ')}</span>
      </li>)}</ol>
      <div className="tiro-menu-actions"><button type="button" className="tiro-action" onClick={newGame}>Nueva partida</button></div>
    </div>}
  </section>;
}
