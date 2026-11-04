// Vampyrium: el componente (pantalla, teclado, panel de la derecha y carteles). La lógica está en vampyrium.ts
// y el dibujo en vampyriumArt.ts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { pixelRatio, useFitScreen } from './fitScreen';
import { EndBanner } from './EndBanner';
import { BOSS_HP, CHAPTERS, goalProgress, DAMAGE, HOLD_MENU, LEVELS, LEVEL_COUNT, MAX_HP, STRENGTH, VAMP_NAME, isBoss, rosterOf, type VampKind, MAX_AMMO, POWER_MAX, WEAPONS, WEAPON_DMG, WEAPON_LEVEL, GARLIC_R, PISTOL_RANGE, BOLT_PIERCE, CROSS_TARGETS, GUARD_HP, HOLY_TARGETS, isArmor, WEAPON_NAME, chooseWeapon, closeMenu, newPlayer, newGame, formatVampTime, menuMove, noteTap, pressAttack, step, takeEvents, type Game, type Input, type Weapon } from './vampyrium';
import { drawGame, drawPortrait, drawSwordIcon, setBackdrop } from './vampyriumArt';
import { drawWeaponIcon } from './vampyriumWeapons';
import { setNoGrain } from './gravityMonsters';
// Los fondos de los 10 niveles (fondo-nivel-N.webp)
const FONDOS = import.meta.glob('./assets/vampyrium/fondo-nivel-*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const fondoOf = (bg: string) => FONDOS[`./assets/vampyrium/${bg}.webp`];
import {
  playGameOver, playKfPickup, playThunder, playVampBell, playVampBones, playVampCombo, playVampCrate, playVampDeath, playVampDive,
  playVampFall, playVampHurt, playVampMenu, playVampSpikes, playVampStakeHit, playVampSwing, playVampTrapFire, playVampPendulum, playVampThrow, playDoor,
  playWinFanfare, playVampButton, playVampMenuButton, setVampMenuMusic, playVampCrossbow, playVampGarlicBomb, playVampPistol, playVampDeep, playVampHammer, playVampStaff, playVampPunch, playVampFlame, setVampAmbient, setVampWings, preloadVampSounds, playVampStep, playVampVoice, playVampCross, playVampSword, playVampJumpSound, playVampBurn, playVampExplosion,
} from './sounds';

const RECORD_KEY = 'escritorio-personal-juegos:vampyrium-record';
export interface VampRecord { kills: number; time: number | null }
export const readVampyriumRecord = (): VampRecord => { try { const r = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return { kills: Number(r?.kills) || 0, time: Number(r?.time) || null }; } catch { return { kills: 0, time: null }; } };
// MODO TEST (para probar): todos los niveles abiertos y vida que no se acaba. Para desactivarlo, poner false.
export const VAMP_TEST_MODE = true;
const makeGame = (seed?: number, level?: number) => { const g = newGame(seed, level); g.immortal = VAMP_TEST_MODE; return g; };
// Hasta qué nivel llegó (hay que ganar cada nivel para que se abra el siguiente).
const PROGRESS_KEY = 'escritorio-personal-juegos:vampyrium-nivel';
export const readVampyriumProgress = () => { try { return Math.max(1, Math.min(LEVEL_COUNT, Number(localStorage.getItem(PROGRESS_KEY)) || 1)); } catch { return 1; } };
const saveProgress = (n: number) => { try { localStorage.setItem(PROGRESS_KEY, String(Math.max(readVampyriumProgress(), Math.min(LEVEL_COUNT, n)))); } catch { /* sin almacenamiento */ } };
const saveRecord = (r: VampRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento: dura esta partida */ } };

// Un nombre en dos renglones: «Vampiro» arriba y el resto abajo (así no quedan pegados al borde de la tarjeta).
function TwoLines({ text }: { text: string }) {
  const [a, ...r] = text.split(' ');
  return <>{a}{' '}<br />{r.length ? r.join(' ') : '\u00a0'}</>; // (con el espacio, el texto sigue siendo «Vampiro gigante»)
}
type Status = 'ready' | 'intro' | 'playing' | 'paused' | 'over' | 'won';
interface Hud { time: number; walker: number; flyer: number; total: number; hp: number; kills: string; boss: string; goal: number; ammo: string; weapon: Weapon; power: number; menu: boolean; sel: number; combo: number; garlic: boolean; door: boolean; hold: number; guard: number }
const bossOf = (g: Game) => { const b = g.vamps.find(v => isBoss(v.kind)); return b ? `${b.kind}:${Math.max(0, b.hp ?? 0)}` : g.transformT > 0 ? 'transform:0' : ''; };
const hudOf = (g: Game): Hud => ({ guard: g.guardHp, time: Math.floor(g.time), walker: g.kills.walker, flyer: g.kills.flyer, total: g.total, hp: g.player.hp, goal: goalProgress(g), kills: rosterOf(g.level).map(k => g.kills[k]).join(','), boss: bossOf(g), ammo: WEAPONS.map(w => g.ammo[w] === Infinity ? -1 : g.ammo[w]).join(','), weapon: g.weapon, power: g.power, menu: g.phase === 'menu', sel: g.menu.sel, combo: g.combo.t > 0 ? g.combo.n : 0, garlic: g.garlicT > 0, door: g.door.open, hold: g.phase === 'play' && g.holdT > 0.35 ? Math.round(g.holdT / HOLD_MENU * 20) / 20 : 0 });
const sameHud = (a: Hud, b: Hud) => (Object.keys(a) as (keyof Hud)[]).every(k => a[k] === b[k]);
const ICON: Record<Weapon, string> = { sword: '🗡️', crossbow: '🏹', garlic: '🧄', cross: '✝️', firesword: '🔥', pistol: '🔫', ice: '❄️', holy: '✨', venom: '🧪', violet: '💜', guard: '🛡️', bone: '💀' };
// Nombres cortos (para el menú de inicio y el panel): las armaduras por su color o material.
const SHORT: Record<Weapon, string> = { sword: 'Espada', crossbow: 'Ballesta', garlic: 'Bomba de ajo', cross: 'Cruz', firesword: 'Espada de fuego', pistol: 'Pistola de fuego', ice: 'Armadura de Hielo', holy: 'Armadura Dorada', venom: 'Armadura Verde', violet: 'Armadura Violeta', guard: 'Armadura Protectora', bone: 'Armadura de Huesos' };
const KIND_ICON: Record<VampKind, string> = { walker: '🧛', flyer: '🦇', giant: '👹', mage: '🔮', hammer: '🔨', warrior: '🛡️', wolf: '🐺', dracula: '🧛‍♂️', dragon: '🐉' };
// El enemigo nuevo de cada nivel (el que se presenta en el cartel del nivel).
const newcomerOf = (level: number): VampKind | null => level >= LEVEL_COUNT ? 'dracula' : level >= 2 && level <= 6 ? rosterOf(level).at(-1)! : null;
const SPAWN_TEXT: Partial<Record<VampKind, string>> = { giant: '👹 ¡Un vampiro gigante! Aguanta 12 golpes', mage: '🔮 ¡Un vampiro mago! Tira bolas de fuego (cortalas con la espada)', hammer: '🔨 ¡Vampiro martillo! Cuidado cuando lo levanta', warrior: '🛡️ ¡Vampiro guerrero! Su escudo ataja las estacas', wolf: '🐺 ¡Un hombre lobo! Salta encima tuyo' };

const INFO: Record<Weapon, { text: string; stats: [string, string][] }> = {
  sword: { text: 'Hoja de plata bendecida. Corta en arco a los vampiros que tenés adelante, en el piso o en el aire.', stats: [['Daño', '1 de vida'], ['Alcance', '2,6 m adelante'], ['Cantidad', 'Ilimitada']] },
  crossbow: { text: `Dispara flechas de punta roja que atraviesan hasta ${BOLT_PIERCE} vampiros en fila. El escudo del guerrero las ataja.`, stats: [['Daño', `${WEAPON_DMG.crossbow} a cada uno`], ['Alcance', `Toda la pantalla, atraviesa ${BOLT_PIERCE}`], ['Cantidad', '']] },
  garlic: { text: `Se tira, rebota y explota: la onda de ajo lastima a todos los que estén a ${GARLIC_R} metros (unos 7 vampiros en fila) y espanta a los demás.`, stats: [['Daño', `${WEAPON_DMG.garlic} a cada uno`], ['Alcance', `Onda de ${GARLIC_R} m a la redonda`], ['Cantidad', '']] },
  cross: { text: `Una tormenta de rayos sagrados cae sobre los ${CROSS_TARGETS} vampiros más cercanos. Con la cruz en la mano te ponés la armadura dorada. Se carga matando ${POWER_MAX} vampiros.`, stats: [['Daño', `${WEAPON_DMG.cross} a cada uno`], ['Alcance', `${CROSS_TARGETS} vampiros a la vista`], ['Cantidad', '']] },
  firesword: { text: 'Una espada enorme de lava. Cada tajo larga una ola de fuego 5 veces más grande que la de la espada común; también corta el fuego del dragón.', stats: [['Daño', `${WEAPON_DMG.firesword} a cada uno`], ['Alcance', '6,5 m adelante y 5,4 de alto'], ['Cantidad', '']] },
  pistol: { text: `Dispara una bala de fuego que revienta al primer vampiro que toca, hasta ${PISTOL_RANGE} metros (unos 10 vampiros).`, stats: [['Daño', `${WEAPON_DMG.pistol} a uno`], ['Alcance', `${PISTOL_RANGE} m`], ['Cantidad', '']] },
  ice: { text: 'Armadura de Hielo: tira un rayo helado que congela al vampiro y a los pocos segundos lo hace pedazos (si le pegás mientras está congelado, se rompe al instante).', stats: [['Daño', 'Congela y rompe'], ['Alcance', 'Toda la pantalla, al primero'], ['Cantidad', '']] },
  holy: { text: `Armadura Dorada: la cruz larga un rayo de luz hacia adelante que atraviesa y mata hasta ${HOLY_TARGETS} vampiros en fila.`, stats: [['Daño', `Mata a ${HOLY_TARGETS}`], ['Alcance', '16 m en línea recta'], ['Cantidad', '']] },
  venom: { text: 'Armadura Verde: tira bolas verdes que caen en curva; el vampiro que toca se pone verde y se derrite en el piso.', stats: [['Daño', 'Lo derrite'], ['Alcance', 'Tiro en curva'], ['Cantidad', '']] },
  violet: { text: `Armadura Violeta: una espada poderosa que saca ${WEAPON_DMG.violet} de vida en cada tajo y hace explotar al vampiro en violeta.`, stats: [['Daño', `${WEAPON_DMG.violet} a cada uno`], ['Alcance', '3 m adelante'], ['Cantidad', '']] },
  guard: { text: `Armadura Protectora: un escudo que aguanta ${GUARD_HP} puntos de ataques de los vampiros (las trampas sí lastiman). Se suma al arma que tengas en la mano.`, stats: [['Escudo', `${GUARD_HP} de vida`], ['Arma', 'La que tenías'], ['Cantidad', '']] },
  bone: { text: `Armadura de Huesos: un martillo enorme que saca ${WEAPON_DMG.bone} de vida de un golpe. Dura 50 golpes.`, stats: [['Daño', `${WEAPON_DMG.bone} a cada uno`], ['Alcance', '2,9 m adelante'], ['Cantidad', '']] },
};
// Un lienzo chico que se redibuja solo (el retrato del cazador y los íconos del inventario).
function ArtCanvas({ w, h, draw }: { w: number; h: number; draw: (ctx: CanvasRenderingContext2D, t: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; });
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0;
    const loop = (now: number) => { ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h); ctx.save(); drawRef.current(ctx, now / 1000); ctx.restore(); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}

// Los nombres de los ataques especiales de Demian (aparecen en grande al hacerlos).
const SPECIAL_NAME = { spin: '🌀 ¡Giro en el aire!', dash: '⚡ ¡Estocada relámpago!', whirl: '🌪️ ¡Torbellino!', throw: '🗡️ ¡Espada bumerán!' } as const;

// Enfoca el botón (para jugar con el teclado) sin mover el cartel: así no queda cortado arriba.
const focusNoScroll = (el: HTMLButtonElement | null) => { el?.focus({ preventScroll: true }); };

export function Vampyrium() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [firstGame] = useState(() => makeGame());
  const gameRef = useRef<Game>(firstGame);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __vampGame?: () => Game }).__vampGame = () => gameRef.current; }, []); // (para probar en desarrollo)
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const [status, setStatus] = useState<Status>('ready');
  const [unlocked, setUnlocked] = useState(() => VAMP_TEST_MODE ? LEVEL_COUNT : readVampyriumProgress());
  const [level, setLevel] = useState(() => readVampyriumProgress());
  const def = LEVELS[level - 1];
  const [hud, setHud] = useState<Hud>(() => hudOf(firstGame));
  const [record, setRecord] = useState(readVampyriumRecord);
  const [result, setResult] = useState({ time: 0, total: 0, walker: 0, flyer: 0, combo: 0, falls: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean; bad?: boolean } | null>(null);
  const statusRef = useRef(status);
  const seenRef = useRef(new Set<VampKind>());
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), toast.big ? 2600 : 1600); return () => clearTimeout(id); }, [toast]);

  const paint = useCallback(() => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    const k = pixelRatio(touch ? 1.5 : 2), w = Math.round(stage.clientWidth * k), h = Math.round(stage.clientHeight * k);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    setNoGrain(touch); // (en celulares sin la textura: es lo más lento)
    drawGame(ctx, gameRef.current, w, h, performance.now() / 1000);
    setNoGrain(false);
  }, []);

  useLayoutEffect(() => { setBackdrop(fondoOf(def.bg), () => paint()); paint(); }, [def, paint]);
  useLayoutEffect(() => {
    paint();
    const stage = stageRef.current; if (!stage) return;
    const observer = new ResizeObserver(paint); observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  const start = useCallback((n: number) => {
    playVampMenuButton(); playVampBell(0.2); preloadVampSounds(n);
    setLevel(n);
    gameRef.current = makeGame(undefined, n); seenRef.current = new Set();
    input.current = { left: false, right: false, up: false, down: false };
    setHud(hudOf(gameRef.current));
    setStatus('intro'); // primero el cartel con los vampiros del nivel y las armas
  }, []);
  // Del cartel al juego: arranca con la meta arriba.
  const begin = useCallback(() => {
    if (statusRef.current !== 'intro') return;
    playVampMenuButton(); playVampBell(0.25);
    setToast({ text: `🎯 ${CHAPTERS[gameRef.current.level].goalText}`, id: performance.now() });
    setStatus('playing');
  }, []);

  // El bucle del juego
  useEffect(() => {
    if (status !== 'playing') { setVampAmbient(false); paint(); return; }
    setVampAmbient(true, gameRef.current.level);
    let frame = 0, last = performance.now(), bellT = 14, ambT = 1;
    const tick = (now: number) => {
      const g = gameRef.current, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      // pasos fijos chicos: la física no depende de los cuadros por segundo
      let left = dt; while (left > 0) { const d = Math.min(1 / 60, left); step(g, input.current, d); left -= d; }
      ambT -= dt; if (ambT <= 0) { ambT = 1; setVampAmbient(true, g.level); } // el fondo del nivel arranca apenas termina de cargar
      bellT -= dt; if (bellT <= 0 && g.phase === 'play') { playVampBell(0.12); bellT = 18 + Math.random() * 10; }
      // las trampas suenan más fuerte cuanto más cerca del cazador (las de lejos, apenas)
      const near = (x: number, y: number) => Math.max(0.08, 1 - Math.hypot(x - g.player.x, (y - g.player.y) * 1.3) / 16);
      for (const e of takeEvents(g)) {
        switch (e.type) {
          case 'slash': playVampSword(); break;
          case 'throw': playVampThrow(); break;
          case 'shoot': if (e.weapon === 'crossbow') playVampCrossbow(); else if (e.weapon === 'pistol') playVampPistol(); else if (e.weapon === 'ice' || e.weapon === 'venom') playVampStaff(); else if (e.weapon === 'holy') { playVampCross(); playThunder(0.4); } else if (e.weapon === 'violet') playVampSword(); else if (e.weapon === 'bone') { playVampSwing(); playVampHammer(); } else { playVampSword(); playVampBurn(); } break;
          case 'guard': if (e.on) { playVampBell(0.3); setToast({ text: `🛡️ ¡Armadura protectora! Aguanta ${GUARD_HP} de ataques`, id: now, big: true }); } else setToast({ text: '🛡️ Se rompió la armadura protectora', id: now, bad: true }); break;
          case 'guardHit': playVampStakeHit(); break;
          case 'freeze': playVampStakeHit(); break;
          case 'shatter': playVampExplosion(); playVampBones(); break;
          case 'melt': playVampBurn(); break;
          case 'nova': playVampExplosion(); break;
          case 'blast': playVampGarlicBomb(); if (e.count >= 3) setToast({ text: `🧄 ¡La onda de ajo alcanzó a ${e.count} vampiros!`, id: now }); break;
          case 'crossReady': break;
          case 'stakeHit': playVampStakeHit(); break;
          case 'empty': setToast({ text: e.weapon === 'cross' ? '✝ No tenés cruces: se cargan matando 10 vampiros' : `Sin munición de ${WEAPON_NAME[e.weapon].toLowerCase()}: vuelve la espada 🗡️ (buscá cajas que caen del cielo)`, id: now, bad: true }); break;
          case 'kill': playVampDeath(); if (STRENGTH[e.kind] >= 12) playVampDeep(0.65, 0.7); break;
          case 'vampHurt': playVampVoice(0.5); break;
          case 'bones': playVampExplosion(); playVampBones(); break;
          case 'hurt': playVampHurt(); break;
          case 'fall': playVampFall(); setToast({ text: '¡Te caíste al vacío! −10 de vida', id: now, bad: true }); break;
          case 'vampHit': if (STRENGTH[e.kind] >= 12) playVampDeep(isBoss(e.kind) ? 0.6 : 0.75, 0.5); playVampStakeHit(); break;
          case 'block': playVampStakeHit(); setToast({ text: '🛡️ ¡Lo atajó con el escudo! Usá la espada (o tirale cuando ataca)', id: now }); break;
          case 'slam': playVampHammer(); break;
          case 'cast': playVampStaff(); break;
          case 'bats': playVampDive(); break;
          case 'zapCast': playVampStaff(); playVampDeep(0.6, 0.5); break;
          case 'zap': playThunder(0.85); break;
          case 'launch': playVampPunch(); break;
          case 'breath': playVampFlame(); break;
          case 'mist': playVampDeep(0.6, 0.6); break;
          case 'howl': playVampDeep(0.55, 0.8); if (!seenRef.current.has(e.kind)) { seenRef.current.add(e.kind); setToast({ text: SPAWN_TEXT.wolf!, id: now, big: true, bad: true }); } break;
          case 'spawn': playVampDeep(0.75, 0.6); if (!seenRef.current.has(e.kind)) { seenRef.current.add(e.kind); setToast({ text: SPAWN_TEXT[e.kind] ?? VAMP_NAME[e.kind], id: now, big: true, bad: true }); } break;
          case 'transform': playThunder(1); playVampDeep(0.5, 1); setToast({ text: '🐉 ¡Drácula se convierte en dragón!', id: now, big: true, bad: true }); break;
          case 'dragon': playVampExplosion(); playVampDeep(0.45, 1); break;
          case 'bossDead': playVampExplosion(); playThunder(1); setToast({ text: '🏆 ¡Venciste a Drácula!', id: now, big: true }); break;
          case 'jump': playVampJumpSound(e.double); break;
          case 'step': playVampStep(); break;
          case 'crate': playVampCrate(); setToast({ text: '📦 ¡Cayó una caja del cielo!', id: now }); break;
          case 'pickup': playKfPickup(); setToast({ text: e.kind === 'armor' && e.weapon ? `${ICON[e.weapon]} +${e.amount} de ${WEAPON_NAME[e.weapon].toLowerCase()}` : e.kind === 'bolts' ? `🏹 +${e.amount} flechas` : e.kind === 'heart' ? `+${e.amount} de vida ♥` : e.kind === 'fire' ? `🔥 +${e.amount} tajos de la espada de fuego` : e.kind === 'bullets' ? `🔫 +${e.amount} balas de fuego` : e.amount ? `🧄 +${e.amount} bombas de ajo, y los vampiros te tienen miedo 8 segundos` : '🧄 ¡Ajo! Los vampiros te tienen miedo por 8 segundos', id: now, big: e.kind === 'fire' || e.kind === 'bullets' }); break;
          case 'door': playDoor(true); playVampBell(0.3); setToast({ text: '✨ ¡Meta cumplida! Se abrió la puerta de la derecha ▶', id: now, big: true }); break;
          case 'collect': playKfPickup(); setToast({ text: `${e.kind === 'star' ? '⭐ Estrella dorada' : '👻 Alma liberada'} ${e.n}/${e.of}`, id: now }); break;
          case 'break': playVampExplosion(); setToast({ text: e.kind === 'cage' ? `⛓ ¡Prisionero libre! ${e.n}/${e.of}` : `⚰ Ataúd destruido ${e.n}/${e.of} ¡salió un vampiro!`, id: now, big: e.n === e.of }); break;
          case 'objHit': playVampStakeHit(); break;
          case 'spikes': playVampSpikes(near(e.x, e.y)); break;
          case 'fire': playVampTrapFire(near(e.x, e.y)); break;
          case 'swing': playVampPendulum(near(e.x, e.y) * 0.9); break;
          case 'combo': playVampCombo(e.n); break;
          case 'holy': playVampCross(); playThunder(0.8); setToast({ text: e.count ? `✝ ¡TORMENTA SAGRADA! ${e.count} vampiros hechos polvo` : '✝ ¡TORMENTA SAGRADA!', id: now, big: true }); break;
          case 'powerReady': playVampBell(0.2); setToast({ text: '✝ ¡+1 cruz! Elegila manteniendo Espacio', id: now, big: true }); break;
          case 'wave': setToast({ text: `Oleada ${e.n}: vienen más vampiros 🦇`, id: now }); break;
          case 'thunder': playThunder(e.near); break;
          case 'special': playVampSword(); playVampSwing(); if (e.kind !== 'dash') playVampSword(); setToast({ text: SPECIAL_NAME[e.kind], id: now, big: true }); break;
          case 'catch': playVampSword(); break;
          case 'bloodMoon': playThunder(1); setToast({ text: '🌕 ¡LUNA DE SANGRE! Los vampiros se ponen más rápidos', id: now, big: true, bad: true }); break;
          case 'menu': playVampMenu(e.open); break;
          case 'choose': playVampButton(); setToast({ text: `${ICON[e.weapon]} ${WEAPON_NAME[e.weapon]}`, id: now, big: isArmor(e.weapon) }); break;
          case 'hiss': playVampVoice(0.65); break;
          case 'dive': playVampDive(); break;
          case 'burn': playVampBurn(); break;
          case 'emerge': playVampVoice(0.45); break;
          case 'won': break;
        }
      }
      setVampWings(g.phase === 'play' ? g.vamps.filter(v => v.kind === 'flyer').length * 0.3 : 0); // las alas de los voladores
      paint();
      const next = hudOf(g);
      setHud(prev => sameHud(prev, next) ? prev : next);
      if (g.phase === 'over' || g.phase === 'won') {
        const won = g.phase === 'won', rec = readVampyriumRecord();
        const newRecord = won ? rec.time === null || g.time < rec.time : !rec.time && g.total > rec.kills;
        const nextRec = { kills: Math.max(rec.kills, g.total), time: won ? Math.min(rec.time ?? Infinity, Math.ceil(g.time)) : rec.time };
        saveRecord(nextRec); setRecord(nextRec);
        setResult({ time: g.time, total: g.total, walker: g.kills.walker, flyer: g.kills.flyer, combo: g.combo.best, falls: g.stats.falls, newRecord });
        if (won) { playWinFanfare(); saveProgress(g.level + 1); setUnlocked(VAMP_TEST_MODE ? LEVEL_COUNT : readVampyriumProgress()); } else playGameOver();
        setStatus(won ? 'won' : 'over');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint]);
  useEffect(() => () => setVampAmbient(false), []);
  // La música del menú: suena mientras está la pantalla de inicio (reintenta hasta que el navegador deja sonar)
  useEffect(() => {
    if (status !== 'ready') { setVampMenuMusic(false); return; }
    preloadVampSounds(); setVampMenuMusic(true);
    const id = setInterval(() => setVampMenuMusic(true), 700);
    const unlock = () => setVampMenuMusic(true);
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { clearInterval(id); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [status]);
  useEffect(() => () => setVampMenuMusic(false), []);

  // Teclado: flechas para moverse y saltar, Espacio ataca (dos veces rápido: las armas), C la cruz, P pausa.
  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (e: KeyboardEvent) => {
      const s = statusRef.current, g = gameRef.current;
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (s === 'playing' || s === 'paused')) {
        if (e.key === 'Escape' && g.phase === 'menu') { closeMenu(g); return; }
        playVampMenuButton(); setStatus(s === 'playing' ? 'paused' : 'playing'); return;
      }
      if (s === 'intro' && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) { e.preventDefault(); begin(); return; }
      if (s !== 'playing') return;
      if (g.phase === 'menu') {
        if (e.key.startsWith('Arrow')) { e.preventDefault(); playVampButton(); menuMove(g, e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1); return; }
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); input.current.attack = true; if (e.repeat) return;
        pressAttack(g); return;
      }
      const k = keys[e.key]; if (!k) return;
      e.preventDefault(); if (!e.repeat && (k === 'left' || k === 'right') && !input.current[k] && g.phase === 'play') noteTap(g, k === 'right' ? 1 : -1); // para los ataques especiales
      input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.code === 'Space') input.current.attack = false; const k = keys[e.key]; if (k) input.current[k] = false; };
    const blur = () => { input.current = { left: false, right: false, up: false, down: false }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [begin]);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; }, onPointerLeave: () => { input.current[k] = false; }, onPointerCancel: () => { input.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const noMenu = (e: React.MouseEvent) => e.preventDefault();
  const attackTap = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current.attack = true; if (statusRef.current === 'playing') pressAttack(gameRef.current); }, onPointerUp: () => { input.current.attack = false; }, onPointerLeave: () => { input.current.attack = false; }, onPointerCancel: () => { input.current.attack = false; }, onContextMenu: noMenu };
  const ammo = hud.ammo.split(',').map(Number), ammoOf = (w: Weapon) => ammo[WEAPONS.indexOf(w)];
  const ready = ammoOf('cross') > 0;
  const [bossKindRaw, bossHpRaw] = hud.boss.split(':'), bossKind = (bossKindRaw || null) as VampKind | 'transform' | null, bossHp = Number(bossHpRaw) || 0;
  const roster = rosterOf(level), newWeapons = WEAPONS.filter(w => w !== 'sword' && WEAPON_LEVEL[w] === level), newcomer = newcomerOf(level), finalLevel = level >= LEVEL_COUNT;
  const killsOf = hud.kills.split(',').map(Number);
  const chapter = CHAPTERS[level], goal = chapter.goal;
  const goalLabel = goal.type === 'kill' ? 'Vampiros' : goal.type === 'collect' ? (goal.item === 'star' ? '⭐ Estrellas' : '👻 Almas') : goal.type === 'break' ? (goal.obj === 'cage' ? '⛓ Jaulas' : '⚰ Ataúdes') : goal.type === 'survive' ? '⏳ Resistí' : goal.type === 'hunt' ? (goal.kind === 'warrior' ? '🛡️ Guerreros' : '🦇 Voladores') : 'Drácula';
  const recordText = record.time ? `🏆 ${formatVampTime(record.time)}` : `${record.kills} 🧛`;

  return <section className="runner trepa vamp" style={fit} aria-label="Vampyrium">
    <TouchGrips actionLabel={hud.menu ? 'Elegir' : 'Atacar'} />
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1 className="vamp-logo">Vampyrium</h1>
      <div className="runner-scores"><span>Récord <strong>{recordText}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => { playVampMenuButton(); setStatus(s => s === 'playing' ? 'paused' : 'playing'); }}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label={`Nivel ${level}: ${def.name}`} />
        {(status === 'playing' || status === 'paused') && <div className={`vamp-life${hud.hp <= 25 ? ' vamp-life--low' : ''}`} aria-label={`Vida ${hud.hp} de ${MAX_HP}`}>
          <span>❤ Vida</span><i><b style={{ width: `${hud.hp / MAX_HP * 100}%` }} /></i><em data-testid="vamp-hp">{hud.hp}/{MAX_HP}</em>
        </div>}
        {(status === 'playing' || status === 'paused') && bossKind && <div className={`vamp-boss${bossKind === 'transform' ? ' vamp-boss--transform' : ''}`} aria-label={bossKind === 'transform' ? 'Drácula se transforma' : `${VAMP_NAME[bossKind]}: ${bossHp} de ${BOSS_HP}`}>
          <span>{bossKind === 'transform' ? '🐉 Drácula se transforma…' : `${KIND_ICON[bossKind]} ${VAMP_NAME[bossKind]}`}</span><i><b style={{ width: `${bossHp / BOSS_HP * 100}%` }} /></i><em data-testid="vamp-boss-hp">{bossHp}/{BOSS_HP}</em>
        </div>}
        {status === 'playing' && toast && <div key={toast.id} className={`${toast.big ? 'trepa-record' : 'trepa-toast'}${toast.bad ? ' vamp-bad' : ''}`} role="status">{toast.text}</div>}
        {status === 'playing' && hud.combo >= 2 && <div key={`c${hud.combo}`} className="vamp-combo" aria-live="polite">COMBO ×{hud.combo}</div>}
        {status === 'playing' && hud.hold > 0 && !hud.menu && <div className="vamp-hold" role="status"><span>Mantené para abrir las armas</span><i><b style={{ width: `${hud.hold * 100}%` }} /></i></div>}
        {status === 'playing' && hud.menu && <div className="vamp-arsenal ds-frame" role="dialog" aria-label="Armas">
          <div className="ds-plate"><span className="vamp-paused">⏸ Juego en pausa</span><h2>Arsenal del cazador</h2></div>
          <div className="ds-body">
            <div className="ds-hero">
              <ArtCanvas w={220} h={310} draw={(ctx, t) => { const g = gameRef.current, w = WEAPONS[g.menu.sel]; drawPortrait(ctx, 'hunter', isArmor(w) && w !== g.weapon ? { ...g, weapon: w === 'guard' ? g.weapon : w, guardHp: w === 'guard' ? GUARD_HP : g.guardHp } : g, 96, 302, 136, t); }} />
              <b>Cazador</b>
              <div className="ds-bar ds-bar--hp" aria-label={`Vida ${hud.hp} de ${MAX_HP}`}><i style={{ width: `${hud.hp / MAX_HP * 100}%` }} /><span>Vida {hud.hp}/{MAX_HP}</span></div>
{level >= WEAPON_LEVEL.cross &&               <div className="ds-bar ds-bar--holy" aria-label={`Cruz ${hud.power} de ${POWER_MAX}`}><i style={{ width: `${hud.power / POWER_MAX * 100}%` }} /><span>Cruz {hud.power}/{POWER_MAX}</span></div>}
            </div>
            <div className="ds-inv">
              <ul className="ds-grid">
                {WEAPONS.map((w, i) => {
                  if (WEAPON_LEVEL[w] > level) return <li key={w}><span className="ds-slot ds-locked" title={`${WEAPON_NAME[w]}: aparece en el nivel ${WEAPON_LEVEL[w]}`} aria-label={`${WEAPON_NAME[w]}: aparece en el nivel ${WEAPON_LEVEL[w]}`}>🔒<small>Nivel {WEAPON_LEVEL[w]}</small></span></li>;
                  const off = ammoOf(w) === 0;
                  return <li key={w}><button type="button" disabled={off} aria-label={WEAPON_NAME[w]} className={`ds-slot${hud.sel === i ? ' ds-sel' : ''}${hud.weapon === w ? ' ds-now' : ''}`}
                    onPointerEnter={() => { const g = gameRef.current; if (g.phase === 'menu' && g.menu.sel !== i) { g.menu.sel = i; g.menu.t = 0; playVampButton(); } }} onClick={() => { if (!off && gameRef.current.phase === 'menu') chooseWeapon(gameRef.current, w); }}>
                    <ArtCanvas w={104} h={104} draw={(ctx, t) => { ctx.translate(52, 52); drawWeaponIcon(ctx, w, 92, t, drawSwordIcon); }} />
                    <em>{w === 'sword' ? '∞' : ammoOf(w)}</em>
                  </button></li>;
                })}
              </ul>
              <div className="ds-info">
                <h3>{WEAPON_NAME[WEAPONS[hud.sel]]}{hud.weapon === WEAPONS[hud.sel] && <small> · en la mano</small>}</h3>
                <p>{INFO[WEAPONS[hud.sel]].text}</p>
                <dl>{INFO[WEAPONS[hud.sel]].stats.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{k === 'Cantidad' && WEAPONS[hud.sel] !== 'sword' ? `${ammoOf(WEAPONS[hud.sel])} / ${MAX_AMMO[WEAPONS[hud.sel]]}` : val}</dd></div>)}</dl>
              </div>
            </div>
          </div>
          <p className="ds-keys">← → o el mouse para elegir · Espacio o clic para confirmar · Esc cerrar</p>
        </div>}
        {status === 'intro' && <div className="vamp-intro2" role="dialog" aria-labelledby="vamp-intro-title">
          <div className="vamp-intro2-card">
            <p className="vamp-intro2-lv">Nivel {level} · {def.name}</p>
            <h2 id="vamp-intro-title">Los vampiros de este nivel</h2>
            <ul className="vamp-intro2-grid" aria-label="Vampiros del nivel">
              {(finalLevel ? ['dracula', 'dragon'] as VampKind[] : roster).map(k => <li key={k} className={k === newcomer ? 'vamp-hub-new' : ''}>
                <ArtCanvas w={240} h={240} draw={(ctx, t) => drawPortrait(ctx, k, gameRef.current, k === 'dragon' ? 148 : k === 'wolf' ? 114 : 118, k === 'dragon' ? 196 : 232, k === 'dragon' ? 33 : k === 'wolf' ? 83 : k === 'giant' ? 78 : 92, t)} />
                <b className="vamp-name2"><TwoLines text={VAMP_NAME[k]} /></b>
                <span className="vamp-hub-hp">❤ {STRENGTH[k]} de vida</span>
                {k === newcomer && <em>Nuevo</em>}
              </li>)}
            </ul>
            <h2>Tus armas{newWeapons.length > 0 && ' (y las nuevas)'}</h2>
            <ul className="vamp-intro2-grid vamp-intro2-weapons" aria-label="Armas del nivel">
              {WEAPONS.filter(w => WEAPON_LEVEL[w] <= level).map(w => <li key={w} className={`${newWeapons.includes(w) ? 'vamp-hub-new' : ''}${isArmor(w) ? ' vamp-hub-armor' : ''}`}>
                <ArtCanvas w={150} h={150} draw={(ctx, t) => { ctx.translate(75, 75); drawWeaponIcon(ctx, w, 138, t, drawSwordIcon); }} />
                <b>{WEAPON_NAME[w]}</b>
                {newWeapons.includes(w) && <em>Nueva</em>}
              </li>)}
            </ul>
            <button type="button" className="vamp-hub-go" ref={focusNoScroll} onClick={begin}>⚔️ ¡A cazar!</button>
          </div>
        </div>}
        {status === 'ready' && <div className="vamp-hub" role="dialog" aria-labelledby="vamp-message" style={{ backgroundImage: `linear-gradient(#0a0508ee, #0a0508f5), url(${fondoOf(def.bg)})` }}>
          <div className="vamp-hub-top">
            <Link className="runner-back" to="/juegos">‹ Juegos</Link>
            <h2 id="vamp-message" className="vamp-title">VAMPYRIUM</h2>
            <div className="vamp-hub-top-right">
              <span className="vamp-hub-record">{VAMP_TEST_MODE && <em className="vamp-test" data-vamp-test>🧪 Modo test</em>} Récord <strong>{recordText}</strong></span>
              <button type="button" className="vamp-hub-go" ref={focusNoScroll} onClick={() => start(level)}>⚔️ Jugar · Nivel {level}</button>
            </div>
          </div>
          <div className="vamp-hub-grid">
            <figure className="vamp-hub-hero" aria-label="Demian, el cazador">
              <ArtCanvas w={330} h={500} draw={(ctx, t) => drawPortrait(ctx, 'hunter', { ...gameRef.current, player: newPlayer(), weapon: 'sword', guardHp: 0, boomer: null }, 160, 482, 172, t)} />
              <figcaption><b>Demian</b><span>❤ {MAX_HP} de vida</span></figcaption>
            </figure>
            <section className="vamp-hub-box vamp-hub-story" aria-label="La historia de Demian">
              <h3>La historia de Demian</h3>
              <p className="vamp-chapter">Nivel {level}/{LEVEL_COUNT} · {def.name}</p>
              <p>{chapter.story}</p>
              <p className="vamp-goalline">🎯 {chapter.goalText}</p>
              <p className="vamp-hub-note">{finalLevel ? 'Drácula te saca 10 de vida con las garras y el dragón 15 con el fuego. Esquivá sus murciélagos, salí de los círculos rojos antes de que caiga el rayo y no te dejes agarrar de cerca: su gancho te tira por el aire.' : 'Al cumplir la meta sube la reja de la puerta de la derecha. Caen cajas con munición y vida, y arriba hay repisas para escalar.'}</p>
            </section>
            <section className="vamp-hub-box vamp-hub-keys" aria-label="Cómo se juega">
              <h3>Cómo se juega</h3>
              <ul className="vamp-keys">
                <li><span><kbd>←</kbd><kbd>→</kbd></span>Moverse</li>
                <li><span><kbd>↑</kbd></span>Saltar · otra vez en el aire: doble salto</li>
                <li><span><kbd>↓</kbd></span>Bajar de una plataforma</li>
                <li><span><kbd>Espacio</kbd></span>Atacar con el arma que tenés</li>
                <li><span><kbd>Espacio</kbd> 2 s</span>Mantenerla: cambiar de arma</li>
                <li><span><kbd>↑</kbd>/<kbd>↓</kbd>+<kbd>Espacio</kbd></span>Tirar arriba o abajo</li>
                <li><span><kbd>P</kbd></span>Pausa</li>
              </ul>
              <h4>Combinaciones (con la espada)</h4>
              <ul className="vamp-keys vamp-combos">
                <li><span><kbd>↑</kbd><kbd>↑</kbd>+<kbd>Espacio</kbd></span>🌀 Giro de 360° en el aire</li>
                <li><span><kbd>→</kbd><kbd>→</kbd>+<kbd>Espacio</kbd></span>⚡ Estocada que atraviesa</li>
                <li><span><kbd>→</kbd><kbd>←</kbd>+<kbd>Espacio</kbd></span>🌪️ Torbellino</li>
                <li><span><kbd>←</kbd><kbd>→</kbd>+<kbd>Espacio</kbd></span>🗡️ Espada bumerán (atrás y atrás)</li>
              </ul>
            </section>
            <section className="vamp-hub-box vamp-hub-rivals" aria-label="Rivales">
              <h3>Rivales del nivel {level}</h3>
              <ul>
                {(finalLevel ? ['dracula', 'dragon'] as VampKind[] : roster).map(k => <li key={k} className={k === newcomer ? 'vamp-hub-new' : ''}>
                  <ArtCanvas w={120} h={120} draw={(ctx, t) => drawPortrait(ctx, k, gameRef.current, k === 'dragon' ? 74 : k === 'wolf' ? 56 : 58, k === 'dragon' ? 98 : 116, k === 'dragon' ? 17 : k === 'wolf' ? 42 : k === 'giant' ? 40 : 46, t)} />
                  <div><b className="vamp-name2"><TwoLines text={VAMP_NAME[k]} /></b>
                  <span className="vamp-hub-hp" aria-label={`Vida ${STRENGTH[k]}`}>❤ {STRENGTH[k]} vida</span>
                  <small>Te saca {DAMAGE[k]}</small></div>
                  {k === newcomer && <em>Nuevo</em>}
                </li>)}
              </ul>
            </section>
            <section className="vamp-hub-box vamp-hub-weapons" aria-label="Armas disponibles">
              <h3>Armas y armaduras</h3>
              <ul>
                {WEAPONS.map(w => { const open = WEAPON_LEVEL[w] <= level; return <li key={w} title={`${WEAPON_NAME[w]}: ${INFO[w].text}`} className={`${open ? '' : 'vamp-hub-locked'}${newWeapons.includes(w) ? ' vamp-hub-new' : ''}${isArmor(w) ? ' vamp-hub-armor' : ''}`}>
                  {open ? <ArtCanvas w={64} h={64} draw={(ctx, t) => { ctx.translate(32, 32); drawWeaponIcon(ctx, w, 56, t, drawSwordIcon); }} /> : <i>🔒</i>}
                  <div><b>{SHORT[w]}</b>{!open && <small>Nivel {WEAPON_LEVEL[w]}</small>}</div>
                  {newWeapons.includes(w) && <em>Nueva</em>}
                </li>; })}
              </ul>
              <p className="vamp-hub-note">Para cambiar de arma mantené apretada la barra espaciadora 2 segundos.</p>
            </section>
            <div className="vamp-hub-play">
              <div className="vamp-levels" role="group" aria-label="Elegir nivel">
                {LEVELS.map(l => <button type="button" key={l.n} disabled={l.n > unlocked} className={`${l.n === level ? 'vamp-lv-on' : ''}${l.n > unlocked ? ' vamp-lv-locked' : ''}`} aria-pressed={l.n === level} title={l.n > unlocked ? `${l.name}: ganá el nivel ${l.n - 1} para abrirlo` : l.name} onClick={() => { if (l.n > unlocked) return; playVampMenuButton(); setLevel(l.n); gameRef.current = makeGame(undefined, l.n); setHud(hudOf(gameRef.current)); }}>
                  <img src={fondoOf(l.bg)} alt="" loading="lazy" /><b>{l.n}</b><small>{l.name}</small>
                </button>)}
              </div>
            </div>
          </div>
        </div>}
        {status !== 'playing' && status !== 'intro' && status !== 'ready' && <div className="runner-overlay vamp-overlay" role="dialog" aria-labelledby="vamp-message">
          <div className="trepa-overlay-card ds-frame">
            {status === 'paused' && <>
              <h2 id="vamp-message">Pausa</h2>
              <div className="vamp-pause-btns">
                <button type="button" onClick={() => { playVampMenuButton(); setStatus('playing'); }} autoFocus>Seguir</button>
                <button type="button" className="vamp-ghost" onClick={() => { playVampMenuButton(); setStatus('ready'); }}>Volver al Menú</button>
              </div>
            </>}
            {status === 'over' && <>
              <EndBanner win={false} id="vamp-message" />
              <p>Mataste <strong>{result.total}</strong> {result.total === 1 ? 'vampiro' : 'vampiros'} en {formatVampTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={() => start(level)} autoFocus>Jugar de nuevo</button>
              <button type="button" className="vamp-ghost" onClick={() => { playVampMenuButton(); setStatus('ready'); }}>Volver al Menú</button>
            </>}
            {status === 'won' && <>
              <EndBanner win id="vamp-message" />
              <p className="end-reason">{level === LEVEL_COUNT ? '¡Terminaste los 10 niveles! Demian llegó hasta Drácula.' : `¡Nivel ${level} superado! ${def.name} quedó atrás.`}</p>
              <ul className="grav-stats">
                <li>Tiempo <strong>{formatVampTime(result.time)}</strong></li>
                <li>{finalLevel ? 'Jefes' : 'Vampiros'} <strong>{result.total}</strong></li>
                <li>Mejor combo <strong>×{Math.max(1, result.combo)}</strong></li>
              </ul>
              {result.newRecord && <p>¡Nuevo récord!</p>}
              {level < LEVEL_COUNT && <p className="runner-tip">Sigue: Nivel {level + 1} · {LEVELS[level].name}</p>}
              {level < LEVEL_COUNT ? <button type="button" onClick={() => { playVampMenuButton(); setLevel(level + 1); gameRef.current = makeGame(undefined, level + 1); setHud(hudOf(gameRef.current)); setStatus('ready'); }} autoFocus>Siguiente nivel ▶</button> : <button type="button" onClick={() => start(1)} autoFocus>Jugar de nuevo</button>}
              <button type="button" className="vamp-ghost" onClick={() => { playVampMenuButton(); setStatus('ready'); }}>Volver al Menú</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side vamp-side" aria-label="Tiempo, vampiros y armas">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="vamp-time">{formatVampTime(hud.time)}</strong></div>
        {finalLevel ? <div className="trepa-stat vamp-kills" aria-label="Drácula">
          <span>Drácula</span><strong data-testid="vamp-total">{bossKind === 'dragon' ? '🐉' : '🧛‍♂️'}</strong>
          <p className="vamp-count">Drácula: <b>{bossKind === 'dracula' ? `${bossHp}/${BOSS_HP}` : `0/${BOSS_HP}`}</b></p>
          <p className="vamp-count">Dragón: <b>{bossKind === 'dragon' ? `${bossHp}/${BOSS_HP}` : bossKind === 'dracula' || bossKind === 'transform' ? `${BOSS_HP}/${BOSS_HP}` : `0/${BOSS_HP}`}</b></p>
        </div> : <div className="trepa-stat vamp-kills" aria-label={`${goalLabel}: ${hud.goal} de ${goal.n}`}>
          <span>{goalLabel}</span><strong data-testid="vamp-total">{goal.type === 'survive' ? `${Math.max(0, goal.n - hud.goal)}s` : hud.goal}<small>{goal.type === 'survive' ? ' faltan' : `/${goal.n}`}</small></strong>
          <i className="vamp-bar"><b style={{ width: `${Math.min(100, hud.goal / goal.n * 100)}%` }} /></i>
          {roster.map((k, i) => <p key={k} className="vamp-count" title={`Aguanta ${STRENGTH[k]} ${STRENGTH[k] === 1 ? 'golpe' : 'golpes'} y saca ${DAMAGE[k]} de vida`}>{KIND_ICON[k]} {k === 'walker' ? 'Vampiros' : k === 'flyer' ? 'Voladores' : VAMP_NAME[k]}: <b data-testid={k === 'walker' ? 'vamp-walkers' : k === 'flyer' ? 'vamp-flyers' : undefined}>{killsOf[i] ?? 0}</b></p>)}
        </div>}
        <div className="trepa-stat vamp-hpstat" aria-label={`Vida: ${hud.hp}`}><span>Vida</span><strong>{hud.hp}<small>/{MAX_HP}</small></strong><i className="vamp-bar vamp-bar--hp"><b style={{ width: `${hud.hp / MAX_HP * 100}%` }} /></i></div>
        <div className="trepa-stat vamp-weapons"><span>Armas</span>
          <ul>
            {WEAPONS.filter(w => WEAPON_LEVEL[w] <= level && !isArmor(w)).map(w => <li key={w} className={hud.weapon === w ? 'vamp-now' : ammoOf(w) === 0 ? 'vamp-empty' : ''} title={`${WEAPON_NAME[w]}: ${WEAPON_DMG[w]} de daño`}>{ICON[w]} {WEAPON_NAME[w]} {w === 'sword' ? <b>∞</b> : <><b data-testid={w === 'crossbow' ? 'vamp-ammo' : undefined}>{ammoOf(w)}</b><small>/{MAX_AMMO[w]}</small></>}</li>)}
          </ul>
          {level >= WEAPON_LEVEL.ice && <div className="vamp-armors" aria-label="Armaduras">
            {WEAPONS.filter(w => isArmor(w) && WEAPON_LEVEL[w] <= level).map(w => <span key={w} title={`${WEAPON_NAME[w]}: ${ammoOf(w)}`} className={hud.weapon === w || (w === 'guard' && hud.guard > 0) ? 'vamp-now' : ammoOf(w) === 0 ? 'vamp-empty' : ''}>{ICON[w]}<b>{ammoOf(w)}</b></span>)}
          </div>}
        </div>
        {level >= WEAPON_LEVEL.cross && <div className={`trepa-stat vamp-power${ready ? ' vamp-ready' : ''}`} aria-label={`Cruz sagrada: ${hud.power} de ${POWER_MAX}`}>
          <span>Cruz ✝</span>
          <i className="vamp-bar vamp-bar--gold"><b style={{ width: `${hud.power / POWER_MAX * 100}%` }} /></i>
          <em>{ready ? `${ammoOf('cross')} lista${ammoOf('cross') > 1 ? 's' : ''} · Espacio 2 s` : `${hud.power}/${POWER_MAX}`}</em>
        </div>}
        {hud.guard > 0 && <div className="trepa-stat vamp-guard" aria-label={`Armadura Protectora: ${hud.guard} de ${GUARD_HP}`}><span>🛡️ Escudo</span><i className="vamp-bar vamp-bar--gold"><b style={{ width: `${hud.guard / GUARD_HP * 100}%` }} /></i><em>{hud.guard}/{GUARD_HP}</em></div>}
        {hud.garlic && <div className="trepa-stat vamp-garlic">🧄 Ajo</div>}
        {hud.door && <div className="trepa-stat vamp-door">🚪 ¡Puerta abierta! ▶</div>}
      </aside>
    </div>
    <GamePad action={{ hold: attackTap, label: 'Atacar' }}
      dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Saltar' }, down: { hold: hold('down'), aria: 'Bajar' } }} />
  </section>;
}
