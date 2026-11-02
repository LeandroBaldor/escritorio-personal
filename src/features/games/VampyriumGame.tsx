// Vampyrium: el componente (pantalla, teclado, panel de la derecha y carteles). La lógica está en vampyrium.ts
// y el dibujo en vampyriumArt.ts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { pixelRatio, useFitScreen } from './fitScreen';
import { EndBanner } from './EndBanner';
import { BODY, DAMAGE, GOAL, HOLD_MENU, LEVELS, LEVEL_COUNT, MAX_HP, STRENGTH, VAMP_NAME, isBoss, rosterOf, type VampKind, MAX_STAKES, POWER_MAX, WEAPONS, WEAPON_NAME, castHoly, chooseWeapon, closeMenu, formatVampTime, menuMove, newGame, pressAttack, step, takeEvents, type Game, type Input, type Weapon } from './vampyrium';
import { drawGame, drawPortrait, drawStakeIcon, drawSwordIcon, setBackdrop } from './vampyriumArt';
import { setNoGrain } from './gravityMonsters';
// Los fondos de los 10 niveles (fondo-nivel-N.webp)
const FONDOS = import.meta.glob('./assets/vampyrium/fondo-nivel-*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const fondoOf = (bg: string) => FONDOS[`./assets/vampyrium/${bg}.webp`];
import {
  playGameOver, playKfPickup, playStart, playThunder, playVampBell, playVampBones, playVampCombo, playVampCrate, playVampDeath, playVampDive,
  playVampFall, playVampHurt, playVampMenu, playVampSpikes, playVampStakeHit, playVampSwing, playVampThrow, playDoor,
  playWinFanfare, playVampDeep, playVampHammer, playVampStaff, playVampFlame, setVampAmbient, setVampWings, preloadVampSounds, playVampStep, playVampVoice, playVampCross, playVampSword, playVampJumpSound, playVampBurn, playVampExplosion,
} from './sounds';

const RECORD_KEY = 'escritorio-personal-juegos:vampyrium-record';
export interface VampRecord { kills: number; time: number | null }
export const readVampyriumRecord = (): VampRecord => { try { const r = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return { kills: Number(r?.kills) || 0, time: Number(r?.time) || null }; } catch { return { kills: 0, time: null }; } };
const saveRecord = (r: VampRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento: dura esta partida */ } };

type Status = 'ready' | 'intro' | 'playing' | 'paused' | 'over' | 'won';
interface Hud { time: number; walker: number; flyer: number; total: number; hp: number; kills: string; boss: string; ammo: number; weapon: Weapon; power: number; menu: boolean; sel: number; combo: number; garlic: boolean; door: boolean; hold: number }
const bossOf = (g: Game) => { const b = g.vamps.find(v => isBoss(v.kind)); return b ? `${b.kind}:${Math.max(0, b.hp ?? 0)}` : g.transformT > 0 ? 'transform:0' : ''; };
const hudOf = (g: Game): Hud => ({ time: Math.floor(g.time), walker: g.kills.walker, flyer: g.kills.flyer, total: g.total, hp: g.player.hp, kills: rosterOf(g.level).map(k => g.kills[k]).join(','), boss: bossOf(g), ammo: g.ammo, weapon: g.weapon, power: g.power, menu: g.phase === 'menu', sel: g.menu.sel, combo: g.combo.t > 0 ? g.combo.n : 0, garlic: g.garlicT > 0, door: g.door.open, hold: g.phase === 'play' && g.holdT > 0.35 ? Math.round(g.holdT / HOLD_MENU * 20) / 20 : 0 });
const sameHud = (a: Hud, b: Hud) => (Object.keys(a) as (keyof Hud)[]).every(k => a[k] === b[k]);
const ICON: Record<Weapon, string> = { sword: '🗡️', stakes: '🪵' };
const KIND_ICON: Record<VampKind, string> = { walker: '🧛', flyer: '🦇', giant: '👹', mage: '🔮', hammer: '🔨', warrior: '🛡️', wolf: '🐺', dracula: '🧛‍♂️', dragon: '🐉' };
// El enemigo nuevo de cada nivel (el que se presenta en el cartel del nivel).
const newcomerOf = (level: number): VampKind | null => level >= LEVEL_COUNT ? 'dracula' : level >= 2 && level <= 6 ? rosterOf(level).at(-1)! : null;
const SPAWN_TEXT: Partial<Record<VampKind, string>> = { giant: '👹 ¡Un vampiro gigante! Aguanta 3 golpes', mage: '🔮 ¡Un vampiro mago! Tira bolas de fuego (cortalas con la espada)', hammer: '🔨 ¡Vampiro martillo! Cuidado cuando lo levanta', warrior: '🛡️ ¡Vampiro guerrero! Su escudo ataja las estacas', wolf: '🐺 ¡Un hombre lobo! Salta encima tuyo' };

const LOCKED = ['Agua bendita', 'Ballesta', 'Hacha', 'Antorcha', 'Látigo', 'Bomba de ajo'];
const INFO: Record<Weapon, { text: string; stats: [string, string][] }> = {
  sword: { text: 'Hoja de plata bendecida. Corta en arco a los vampiros que tenés adelante, en el piso o en el aire.', stats: [['Daño', 'Un golpe, un vampiro'], ['Alcance', 'Corto'], ['Cantidad', 'Ilimitada']] },
  stakes: { text: 'Estacas de fresno afiladas. Se tiran lejos y atraviesan el corazón del primer vampiro que tocan.', stats: [['Daño', 'Un tiro, un vampiro'], ['Alcance', 'Largo'], ['Cantidad', '']] },
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

export function Vampyrium() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [firstGame] = useState(() => newGame());
  const gameRef = useRef<Game>(firstGame);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const [status, setStatus] = useState<Status>('ready');
  const [level, setLevel] = useState(1);
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
    playStart(); playVampBell(0.2); preloadVampSounds();
    setLevel(n);
    gameRef.current = newGame(undefined, n); seenRef.current = new Set();
    input.current = { left: false, right: false, up: false, down: false };
    setHud(hudOf(gameRef.current));
    setToast(null);
    setStatus('intro'); // primero el cartel con el objetivo del nivel
  }, []);

  // El bucle del juego
  useEffect(() => {
    if (status !== 'playing') { setVampAmbient(false); paint(); return; }
    setVampAmbient(true);
    let frame = 0, last = performance.now(), bellT = 14;
    const tick = (now: number) => {
      const g = gameRef.current, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      // pasos fijos chicos: la física no depende de los cuadros por segundo
      let left = dt; while (left > 0) { const d = Math.min(1 / 60, left); step(g, input.current, d); left -= d; }
      bellT -= dt; if (bellT <= 0 && g.phase === 'play') { playVampBell(0.12); bellT = 18 + Math.random() * 10; }
      for (const e of takeEvents(g)) {
        switch (e.type) {
          case 'slash': playVampSword(); break;
          case 'throw': playVampThrow(); break;
          case 'stakeHit': playVampStakeHit(); break;
          case 'empty': setToast({ text: 'Sin estacas: vuelve la espada 🗡️ (buscá cajas que caen del cielo)', id: now, bad: true }); break;
          case 'kill': playVampDeath(); if (STRENGTH[e.kind] >= 3) playVampDeep(0.65, 0.7); break;
          case 'vampHurt': playVampVoice(0.5); break;
          case 'bones': playVampExplosion(); playVampBones(); break;
          case 'hurt': playVampHurt(); break;
          case 'fall': playVampFall(); setToast({ text: '¡Te caíste al vacío! −10 de vida', id: now, bad: true }); break;
          case 'vampHit': if (STRENGTH[e.kind] >= 3) playVampDeep(isBoss(e.kind) ? 0.6 : 0.75, 0.5); playVampStakeHit(); break;
          case 'block': playVampStakeHit(); setToast({ text: '🛡️ ¡Lo atajó con el escudo! Usá la espada (o tirale cuando ataca)', id: now }); break;
          case 'slam': playVampHammer(); break;
          case 'cast': playVampStaff(); break;
          case 'bats': playVampDive(); break;
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
          case 'pickup': playKfPickup(); setToast({ text: e.kind === 'stakes' ? `+${e.amount} estacas 🪵` : e.kind === 'heart' ? `+${e.amount} de vida ♥` : '🧄 ¡Ajo! Los vampiros te tienen miedo por 8 segundos', id: now, big: e.kind === 'garlic' }); break;
          case 'door': playDoor(true); playVampBell(0.3); setToast({ text: `¡${GOAL} vampiros! Se abrió la puerta de la derecha ▶`, id: now, big: true }); break;
          case 'spikes': playVampSpikes(); break;
          case 'fire': playVampBurn(); break;
          case 'swing': playVampSwing(); break;
          case 'combo': playVampCombo(e.n); break;
          case 'holy': playVampCross(); setToast({ text: `✝ ¡LUZ SAGRADA! ${e.count} vampiros hechos polvo`, id: now, big: true }); break;
          case 'powerReady': playVampBell(0.2); setToast({ text: '✝ La cruz está cargada: tocá C (o ↓ + Espacio)', id: now, big: true }); break;
          case 'wave': setToast({ text: `Oleada ${e.n}: vienen más vampiros 🦇`, id: now }); break;
          case 'bloodMoon': playThunder(1); setToast({ text: '🌕 ¡LUNA DE SANGRE! Los vampiros se ponen más rápidos', id: now, big: true, bad: true }); break;
          case 'menu': playVampMenu(e.open); break;
          case 'choose': setToast({ text: `${ICON[e.weapon]} ${WEAPON_NAME[e.weapon]}`, id: now }); break;
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
        if (won) playWinFanfare(); else playGameOver();
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

  // Teclado: flechas para moverse y saltar, Espacio ataca (dos veces rápido: las armas), C la cruz, P pausa.
  useEffect(() => {
    const keys: Record<string, keyof Input> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (e: KeyboardEvent) => {
      const s = statusRef.current, g = gameRef.current;
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (s === 'playing' || s === 'paused')) {
        if (e.key === 'Escape' && g.phase === 'menu') { closeMenu(g); return; }
        setStatus(s === 'playing' ? 'paused' : 'playing'); return;
      }
      if (s !== 'playing') return;
      if (g.phase === 'menu') {
        if (e.key.startsWith('Arrow')) { e.preventDefault(); menuMove(g, e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1); return; }
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); input.current.attack = true; if (e.repeat) return;
        if (input.current.down && g.phase === 'play' && castHoly(g)) return; // ↓ + Espacio: la cruz
        pressAttack(g); return;
      }
      if ((e.key === 'c' || e.key === 'C') && !e.repeat) { castHoly(g); return; }
      if (e.key === '1' || e.key === '2') { const w = WEAPONS[Number(e.key) - 1]; if (w === 'sword' || g.ammo > 0) chooseWeapon(g, w); return; }
      const k = keys[e.key]; if (!k) return;
      e.preventDefault(); input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.code === 'Space') input.current.attack = false; const k = keys[e.key]; if (k) input.current[k] = false; };
    const blur = () => { input.current = { left: false, right: false, up: false, down: false }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; }, onPointerLeave: () => { input.current[k] = false; }, onPointerCancel: () => { input.current[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const noMenu = (e: React.MouseEvent) => e.preventDefault();
  const attackTap = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current.attack = true; if (statusRef.current === 'playing') pressAttack(gameRef.current); }, onPointerUp: () => { input.current.attack = false; }, onPointerLeave: () => { input.current.attack = false; }, onPointerCancel: () => { input.current.attack = false; }, onContextMenu: noMenu };
  const holyTap = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); if (statusRef.current === 'playing') castHoly(gameRef.current); }, onContextMenu: noMenu };
  const ready = hud.power >= POWER_MAX;
  const crossBtn = <button type="button" className={`kf-cast vamp-cross${ready ? ' kf-cast--fatal' : ' kf-cast--off'}`} aria-label={`Cruz sagrada ${hud.power} de ${POWER_MAX}`} {...holyTap}>✝</button>;
  const [bossKindRaw, bossHpRaw] = hud.boss.split(':'), bossKind = (bossKindRaw || null) as VampKind | 'transform' | null, bossHp = Number(bossHpRaw) || 0;
  const roster = rosterOf(level), newcomer = newcomerOf(level), finalLevel = level >= LEVEL_COUNT;
  const killsOf = hud.kills.split(',').map(Number);
  const recordText = record.time ? `🏆 ${formatVampTime(record.time)}` : `${record.kills} 🧛`;

  return <section className="runner trepa vamp" style={fit} aria-label="Vampyrium">
    <TouchGrips actionLabel={hud.menu ? 'Elegir' : 'Atacar'} extra={status === 'playing' ? crossBtn : undefined} />
    <div className="runner-bar">
      <Link className="runner-back" to="/juegos">‹ Juegos</Link>
      <h1 className="vamp-logo">Vampyrium</h1>
      <div className="runner-scores"><span>Récord <strong>{recordText}</strong></span></div>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </div>
    <div className="trepa-main">
      <div className="runner-stage" ref={stageRef}>
        <canvas ref={canvasRef} role="img" aria-label={`Nivel ${level}: ${def.name}`} />
        {(status === 'playing' || status === 'paused') && <div className={`vamp-life${hud.hp <= 25 ? ' vamp-life--low' : ''}`} aria-label={`Vida ${hud.hp} de ${MAX_HP}`}>
          <span>❤ Vida</span><i><b style={{ width: `${hud.hp / MAX_HP * 100}%` }} /></i><em data-testid="vamp-hp">{hud.hp}/{MAX_HP}</em>
        </div>}
        {(status === 'playing' || status === 'paused') && bossKind && <div className={`vamp-boss${bossKind === 'transform' ? ' vamp-boss--transform' : ''}`} aria-label={bossKind === 'transform' ? 'Drácula se transforma' : `${VAMP_NAME[bossKind]}: ${bossHp} de 50`}>
          <span>{bossKind === 'transform' ? '🐉 Drácula se transforma…' : `${KIND_ICON[bossKind]} ${VAMP_NAME[bossKind]}`}</span><i><b style={{ width: `${bossHp / 50 * 100}%` }} /></i><em data-testid="vamp-boss-hp">{bossHp}/50</em>
        </div>}
        {status === 'playing' && toast && <div key={toast.id} className={`${toast.big ? 'trepa-record' : 'trepa-toast'}${toast.bad ? ' vamp-bad' : ''}`} role="status">{toast.text}</div>}
        {status === 'playing' && hud.combo >= 2 && <div key={`c${hud.combo}`} className="vamp-combo" aria-live="polite">COMBO ×{hud.combo}</div>}
        {status === 'playing' && hud.hold > 0 && !hud.menu && <div className="vamp-hold" role="status"><span>Mantené para abrir las armas</span><i><b style={{ width: `${hud.hold * 100}%` }} /></i></div>}
        {status === 'playing' && hud.menu && <div className="vamp-arsenal ds-frame" role="dialog" aria-label="Armas">
          <div className="ds-plate"><span className="vamp-paused">⏸ Juego en pausa</span><h2>Arsenal del cazador</h2></div>
          <div className="ds-body">
            <div className="ds-hero">
              <ArtCanvas w={120} h={150} draw={(ctx, t) => drawPortrait(ctx, 'hunter', gameRef.current, 52, 142, 64, t)} />
              <b>Cazador</b>
              <div className="ds-bar ds-bar--hp" aria-label={`Vida ${hud.hp} de ${MAX_HP}`}><i style={{ width: `${hud.hp / MAX_HP * 100}%` }} /><span>Vida {hud.hp}/{MAX_HP}</span></div>
              <div className="ds-bar ds-bar--holy" aria-label={`Cruz ${hud.power} de ${POWER_MAX}`}><i style={{ width: `${hud.power / POWER_MAX * 100}%` }} /><span>Cruz {hud.power}/{POWER_MAX}</span></div>
            </div>
            <div className="ds-inv">
              <ul className="ds-grid">
                {WEAPONS.map((w, i) => {
                  const off = w === 'stakes' && hud.ammo <= 0;
                  return <li key={w}><button type="button" disabled={off} aria-label={WEAPON_NAME[w]} className={`ds-slot${hud.sel === i ? ' ds-sel' : ''}${hud.weapon === w ? ' ds-now' : ''}`}
                    onPointerDown={e => { e.preventDefault(); if (!off) chooseWeapon(gameRef.current, w); }} onClick={() => { if (!off && gameRef.current.phase === 'menu') chooseWeapon(gameRef.current, w); }}>
                    <ArtCanvas w={56} h={56} draw={ctx => { ctx.translate(28, 28); ctx.rotate(0.75); ctx.scale(0.95, 0.95); if (w === 'sword') { ctx.translate(0, 18); drawSwordIcon(ctx); } else { ctx.translate(-5, 10); drawStakeIcon(ctx, 30); ctx.translate(10, 4); drawStakeIcon(ctx, 30); } }} />
                    <em>{w === 'sword' ? '∞' : hud.ammo}</em>
                  </button></li>;
                })}
                {LOCKED.map(l => <li key={l}><span className="ds-slot ds-locked" title={`${l}: próximamente`}>🔒</span></li>)}
              </ul>
              <div className="ds-info">
                <h3>{WEAPON_NAME[WEAPONS[hud.sel]]}{hud.weapon === WEAPONS[hud.sel] && <small> · en la mano</small>}</h3>
                <p>{INFO[WEAPONS[hud.sel]].text}</p>
                <dl>{INFO[WEAPONS[hud.sel]].stats.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{k === 'Cantidad' && WEAPONS[hud.sel] === 'stakes' ? `${hud.ammo} / ${MAX_STAKES}` : val}</dd></div>)}</dl>
              </div>
            </div>
          </div>
          <p className="ds-keys">← → elegir · Espacio confirmar · Esc cerrar</p>
        </div>}
        {status === 'intro' && <div className="runner-overlay vamp-overlay" role="dialog" aria-labelledby="vamp-intro">
          <div className="ds-frame vamp-intro">
            <div className="ds-plate"><span className="vamp-paused">Nivel {level} de {LEVEL_COUNT}</span><h2 id="vamp-intro">{def.name}</h2></div>
            <p className="ds-story">{def.tagline}</p>
            {finalLevel ? <>
              <p className="ds-goal">Drácula te espera en su trono. Pegale <b>50 golpes</b> y se va a convertir en dragón: <b>50 golpes más</b> y se termina su reinado.</p>
              <p className="ds-story">Te saca 10 de vida con las garras y 15 con el fuego de dragón. Esquivá sus murciélagos.</p>
            </> : <>
              <p className="ds-goal">{level === 1 ? 'Para poder entrar al castillo de Drácula' : 'Para abrir la puerta y seguir avanzando'} tendrás que matar a <b>{GOAL} vampiros</b>.</p>
              <p className="ds-story">Cuando caiga el último, la reja de la puerta de la derecha se va a abrir. Cuidado con las trampas.</p>
            </>}
            {newcomer && <div className="vamp-newcomer">
              <ArtCanvas w={120} h={130} draw={(ctx, t) => drawPortrait(ctx, newcomer, gameRef.current, 58, 122, 112 / (BODY[newcomer].k * 2.3), t)} />
              <div><small>{finalLevel ? 'El jefe final' : 'Enemigo nuevo'}</small><b>{VAMP_NAME[newcomer]}</b>
                <p>Aguanta <strong>{STRENGTH[newcomer]} golpes</strong> y te saca <strong>{DAMAGE[newcomer]} de vida</strong>.</p></div>
            </div>}
            <button type="button" onClick={() => { playVampBell(0.25); setStatus('playing'); }} autoFocus>⚔️ ¡A cazar!</button>
          </div>
        </div>}
        {status !== 'playing' && status !== 'intro' && <div className="runner-overlay vamp-overlay" role="dialog" aria-labelledby="vamp-message">
          <div className="trepa-overlay-card ds-frame">
            {status === 'ready' && <>
              <h2 id="vamp-message" className="vamp-title">VAMPYRIUM</h2>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> saltar (otra vez en el aire: doble salto) · <kbd>↓</kbd> bajar de una plataforma · <kbd>Espacio</kbd> atacar (mantenelo 3 segundos: armas) · <kbd>C</kbd> cruz sagrada · <kbd>P</kbd> pausa</p>
              <button type="button" onClick={() => start(level)} autoFocus>Jugar · Nivel {level}</button>
              <div className="vamp-levels" role="group" aria-label="Elegir nivel">
                {LEVELS.map(l => <button type="button" key={l.n} className={l.n === level ? 'vamp-lv-on' : ''} aria-pressed={l.n === level} title={l.name} onClick={() => { setLevel(l.n); gameRef.current = newGame(undefined, l.n); setHud(hudOf(gameRef.current)); }}>
                  <img src={fondoOf(l.bg)} alt="" loading="lazy" /><b>{l.n}</b><small>{l.name}</small>
                </button>)}
              </div>
            </>}
            {status === 'paused' && <>
              <h2 id="vamp-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={false} id="vamp-message" />
              <p>Mataste <strong>{result.total}</strong> {result.total === 1 ? 'vampiro' : 'vampiros'} en {formatVampTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={() => start(level)} autoFocus>Jugar de nuevo</button>
              <button type="button" className="vamp-ghost" onClick={() => setStatus('ready')}>Elegir nivel</button>
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
              {level < LEVEL_COUNT ? <button type="button" onClick={() => start(level + 1)} autoFocus>Siguiente nivel ▶</button> : <button type="button" onClick={() => start(1)} autoFocus>Jugar de nuevo</button>}
              <button type="button" className="vamp-ghost" onClick={() => setStatus('ready')}>Elegir nivel</button>
            </>}
          </div>
          {status === 'ready' && <section className="vamp-story" aria-label="La historia del cazador">
            <ArtCanvas w={150} h={220} draw={(ctx, t) => drawPortrait(ctx, 'hunter', gameRef.current, 62, 212, 96, t)} />
            <div>
              <h3>La historia de Demian</h3>
              <p>Tras perder a su familia por culpa de Drácula, Demian se volvió un cazador de vampiros. Su venganza comienza en la entrada del castillo de Drácula, donde deberá matar a {GOAL} vampiros para poder abrir las puertas del castillo.</p>
              <h4>Tips</h4>
              <ul>
                <li>Apretando la barra espaciadora por tres segundos podés seleccionar el arma.</li>
                <li>Usá las flechas para moverte y saltar.</li>
                <li>Caen cajas que te van a ayudar a completar cada nivel.</li>
                <li>Tenés 100 de vida: cada vampiro te saca según lo fuerte que es, y los fuertes aguantan varios golpes.</li>
              </ul>
            </div>
          </section>}
        </div>}
      </div>
      <aside className="trepa-side vamp-side" aria-label="Tiempo, vampiros y armas">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="vamp-time">{formatVampTime(hud.time)}</strong></div>
        {finalLevel ? <div className="trepa-stat vamp-kills" aria-label="Drácula">
          <span>Drácula</span><strong data-testid="vamp-total">{bossKind === 'dragon' ? '🐉' : '🧛‍♂️'}</strong>
          <p className="vamp-count">Drácula: <b>{bossKind === 'dracula' ? `${bossHp}/50` : '0/50'}</b></p>
          <p className="vamp-count">Dragón: <b>{bossKind === 'dragon' ? `${bossHp}/50` : bossKind === 'dracula' || bossKind === 'transform' ? '50/50' : '0/50'}</b></p>
        </div> : <div className="trepa-stat vamp-kills" aria-label={`Vampiros: ${hud.total} de ${GOAL}`}>
          <span>Vampiros</span><strong data-testid="vamp-total">{hud.total}<small>/{GOAL}</small></strong>
          <i className="vamp-bar"><b style={{ width: `${Math.min(100, hud.total / GOAL * 100)}%` }} /></i>
          {roster.map((k, i) => <p key={k} className="vamp-count" title={`Aguanta ${STRENGTH[k]} ${STRENGTH[k] === 1 ? 'golpe' : 'golpes'} y saca ${DAMAGE[k]} de vida`}>{KIND_ICON[k]} {k === 'walker' ? 'Vampiros' : k === 'flyer' ? 'Voladores' : VAMP_NAME[k]}: <b data-testid={k === 'walker' ? 'vamp-walkers' : k === 'flyer' ? 'vamp-flyers' : undefined}>{killsOf[i] ?? 0}</b></p>)}
        </div>}
        <div className="trepa-stat vamp-hpstat" aria-label={`Vida: ${hud.hp}`}><span>Vida</span><strong>{hud.hp}<small>/{MAX_HP}</small></strong><i className="vamp-bar vamp-bar--hp"><b style={{ width: `${hud.hp / MAX_HP * 100}%` }} /></i></div>
        <div className="trepa-stat vamp-weapons"><span>Armas</span>
          <ul>
            <li className={hud.weapon === 'sword' ? 'vamp-now' : ''}>🗡️ Espada <b>∞</b></li>
            <li className={hud.weapon === 'stakes' ? 'vamp-now' : ''}>🪵 Estacas <b data-testid="vamp-ammo">{hud.ammo}</b><small>/{MAX_STAKES}</small></li>
          </ul>
        </div>
        <div className={`trepa-stat vamp-power${ready ? ' vamp-ready' : ''}`} aria-label={`Cruz sagrada: ${hud.power} de ${POWER_MAX}`}>
          <span>Cruz ✝</span>
          <i className="vamp-bar vamp-bar--gold"><b style={{ width: `${hud.power / POWER_MAX * 100}%` }} /></i>
          <em>{ready ? '¡Lista! Tecla C' : `${hud.power}/${POWER_MAX}`}</em>
        </div>
        {hud.garlic && <div className="trepa-stat vamp-garlic">🧄 Ajo</div>}
        {hud.door && <div className="trepa-stat vamp-door">🚪 ¡Puerta abierta! ▶</div>}
      </aside>
    </div>
    <GamePad action={{ hold: attackTap, label: 'Atacar' }} extra={status === 'playing' ? crossBtn : undefined}
      dirs={{ left: { hold: hold('left'), aria: 'Izquierda' }, right: { hold: hold('right'), aria: 'Derecha' }, up: { hold: hold('up'), aria: 'Saltar' }, down: { hold: hold('down'), aria: 'Bajar' } }} />
  </section>;
}
