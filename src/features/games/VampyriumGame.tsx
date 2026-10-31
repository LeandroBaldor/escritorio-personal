// Vampyrium: el componente (pantalla, teclado, panel de la derecha y carteles). La lógica está en vampyrium.ts
// y el dibujo en vampyriumArt.ts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TouchGrips } from './TouchGrips';
import { GamePad } from './GamePad';
import { pixelRatio, useFitScreen } from './fitScreen';
import { EndBanner } from './EndBanner';
import { GOAL, MAX_HP, MAX_STAKES, POWER_MAX, WEAPONS, WEAPON_NAME, castHoly, chooseWeapon, closeMenu, formatVampTime, menuMove, newGame, pressAttack, step, takeEvents, type Game, type Input, type Weapon } from './vampyrium';
import { drawGame, setBackdrop } from './vampyriumArt';
import fondoNivel1 from './assets/vampyrium/fondo-nivel-1.webp';
import {
  playFootstep, playGameOver, playJump, playKfPickup, playStart, playThunder, playVampBell, playVampBones, playVampCombo, playVampCrate, playVampDeath, playVampDive,
  playVampFall, playVampHiss, playVampHoly, playVampHurt, playVampMenu, playVampSlash, playVampSpikes, playVampStakeHit, playVampSwing, playVampThrow, playDoor,
  playFlame, playWinFanfare, setVampAmbient,
} from './sounds';

const RECORD_KEY = 'escritorio-personal-juegos:vampyrium-record';
export interface VampRecord { kills: number; time: number | null }
export const readVampyriumRecord = (): VampRecord => { try { const r = JSON.parse(localStorage.getItem(RECORD_KEY) ?? 'null'); return { kills: Number(r?.kills) || 0, time: Number(r?.time) || null }; } catch { return { kills: 0, time: null }; } };
const saveRecord = (r: VampRecord) => { try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* sin almacenamiento: dura esta partida */ } };

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';
interface Hud { time: number; walker: number; flyer: number; total: number; hp: number; ammo: number; weapon: Weapon; power: number; menu: boolean; sel: number; combo: number; garlic: boolean; door: boolean }
const hudOf = (g: Game): Hud => ({ time: Math.floor(g.time), walker: g.kills.walker, flyer: g.kills.flyer, total: g.total, hp: g.player.hp, ammo: g.ammo, weapon: g.weapon, power: g.power, menu: g.phase === 'menu', sel: g.menu.sel, combo: g.combo.t > 0 ? g.combo.n : 0, garlic: g.garlicT > 0, door: g.door.open });
const sameHud = (a: Hud, b: Hud) => (Object.keys(a) as (keyof Hud)[]).every(k => a[k] === b[k]);
const ICON: Record<Weapon, string> = { sword: '🗡️', stakes: '🪵' };

export function Vampyrium() {
  const fit = useFitScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [firstGame] = useState(() => newGame());
  const gameRef = useRef<Game>(firstGame);
  const input = useRef<Input>({ left: false, right: false, up: false, down: false });
  const [status, setStatus] = useState<Status>('ready');
  const [hud, setHud] = useState<Hud>(() => hudOf(firstGame));
  const [record, setRecord] = useState(readVampyriumRecord);
  const [result, setResult] = useState({ time: 0, total: 0, walker: 0, flyer: 0, combo: 0, falls: 0, newRecord: false });
  const [toast, setToast] = useState<{ text: string; id: number; big?: boolean; bad?: boolean } | null>(null);
  const statusRef = useRef(status);
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
    drawGame(ctx, gameRef.current, w, h, performance.now() / 1000);
  }, []);

  useLayoutEffect(() => {
    setBackdrop(fondoNivel1, () => paint());
    paint();
    const stage = stageRef.current; if (!stage) return;
    const observer = new ResizeObserver(paint); observer.observe(stage);
    return () => observer.disconnect();
  }, [paint]);

  const start = useCallback(() => {
    playStart(); playVampBell(0.2);
    gameRef.current = newGame();
    input.current = { left: false, right: false, up: false, down: false };
    setHud(hudOf(gameRef.current));
    setToast({ text: `Nivel 1 · El puente del castillo: matá ${GOAL} vampiros y se abre la puerta ▶`, id: performance.now(), big: true });
    setStatus('playing');
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
          case 'slash': playVampSlash(); break;
          case 'throw': playVampThrow(); break;
          case 'stakeHit': playVampStakeHit(); break;
          case 'empty': setToast({ text: 'Sin estacas: vuelve la espada 🗡️ (buscá cajas que caen del cielo)', id: now, bad: true }); break;
          case 'kill': playVampDeath(); if (e.how === 'void') playVampFall(); if (e.how === 'trap') setToast({ text: '¡Lo agarró una trampa! 💀', id: now }); break;
          case 'bones': playVampBones(); break;
          case 'hurt': playVampHurt(); break;
          case 'fall': playVampFall(); setToast({ text: e.hp > 0 ? '¡Te caíste al vacío! −1 ♥' : '¡Te caíste al vacío!', id: now, bad: true }); break;
          case 'jump': playJump(e.double ? 0.22 : 0.3); break;
          case 'step': playFootstep(); break;
          case 'crate': playVampCrate(); setToast({ text: '📦 ¡Cayó una caja del cielo!', id: now }); break;
          case 'pickup': playKfPickup(); setToast({ text: e.kind === 'stakes' ? `+${e.amount} estacas 🪵` : e.kind === 'heart' ? `+${e.amount} ♥` : '🧄 ¡Ajo! Los vampiros te tienen miedo por 8 segundos', id: now, big: e.kind === 'garlic' }); break;
          case 'door': playDoor(true); playVampBell(0.3); setToast({ text: `¡${GOAL} vampiros! Se abrió la puerta de la derecha ▶`, id: now, big: true }); break;
          case 'spikes': playVampSpikes(); break;
          case 'fire': playFlame(0.6); break;
          case 'swing': playVampSwing(); break;
          case 'combo': playVampCombo(e.n); break;
          case 'holy': playVampHoly(); setToast({ text: `✝ ¡LUZ SAGRADA! ${e.count} vampiros hechos polvo`, id: now, big: true }); break;
          case 'powerReady': playVampBell(0.2); setToast({ text: '✝ La cruz está cargada: tocá C (o ↓ + Espacio)', id: now, big: true }); break;
          case 'wave': setToast({ text: `Oleada ${e.n}: vienen más vampiros 🦇`, id: now }); break;
          case 'bloodMoon': playThunder(1); setToast({ text: '🌕 ¡LUNA DE SANGRE! Los vampiros se ponen más rápidos', id: now, big: true, bad: true }); break;
          case 'menu': playVampMenu(e.open); break;
          case 'choose': setToast({ text: `${ICON[e.weapon]} ${WEAPON_NAME[e.weapon]}`, id: now }); break;
          case 'hiss': playVampHiss(0.6); break;
          case 'dive': playVampDive(); break;
          case 'emerge': playVampHiss(0.4); break;
          case 'won': break;
        }
      }
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
        e.preventDefault(); if (e.repeat) return;
        if (input.current.down && g.phase === 'play' && castHoly(g)) return; // ↓ + Espacio: la cruz
        pressAttack(g); return;
      }
      if ((e.key === 'c' || e.key === 'C') && !e.repeat) { castHoly(g); return; }
      if (e.key === '1' || e.key === '2') { const w = WEAPONS[Number(e.key) - 1]; if (w === 'sword' || g.ammo > 0) chooseWeapon(g, w); return; }
      const k = keys[e.key]; if (!k) return;
      e.preventDefault(); input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = keys[e.key]; if (k) input.current[k] = false; };
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
  const attackTap = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); if (statusRef.current === 'playing') pressAttack(gameRef.current); }, onContextMenu: noMenu };
  const holyTap = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); if (statusRef.current === 'playing') castHoly(gameRef.current); }, onContextMenu: noMenu };
  const ready = hud.power >= POWER_MAX;
  const crossBtn = <button type="button" className={`kf-cast vamp-cross${ready ? ' kf-cast--fatal' : ' kf-cast--off'}`} aria-label={`Cruz sagrada ${hud.power} de ${POWER_MAX}`} {...holyTap}>✝</button>;
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
        <canvas ref={canvasRef} role="img" aria-label="El puente del castillo de los vampiros" />
        {status === 'playing' && toast && <div key={toast.id} className={`${toast.big ? 'trepa-record' : 'trepa-toast'}${toast.bad ? ' vamp-bad' : ''}`} role="status">{toast.text}</div>}
        {status === 'playing' && hud.combo >= 2 && <div key={`c${hud.combo}`} className="vamp-combo" aria-live="polite">COMBO ×{hud.combo}</div>}
        {status === 'playing' && hud.menu && <div className="vamp-arsenal" role="dialog" aria-label="Armas">
          <h2>⚔️ Tus armas</h2>
          <ul>
            {WEAPONS.map((w, i) => {
              const off = w === 'stakes' && hud.ammo <= 0;
              return <li key={w}><button type="button" disabled={off} className={`${hud.sel === i ? 'vamp-sel' : ''}${hud.weapon === w ? ' vamp-now' : ''}`} onPointerDown={e => { e.preventDefault(); if (!off) chooseWeapon(gameRef.current, w); }} onClick={() => { if (!off && gameRef.current.phase === 'menu') chooseWeapon(gameRef.current, w); }}>
                <span className="vamp-ico">{ICON[w]}</span><b>{WEAPON_NAME[w]}</b><em>{w === 'sword' ? '∞' : `× ${hud.ammo}`}</em>
              </button></li>;
            })}
          </ul>
          <p>↑ ↓ elegir · Espacio confirmar · Esc cerrar</p>
        </div>}
        {status !== 'playing' && <div className="runner-overlay vamp-overlay" role="dialog" aria-labelledby="vamp-message">
          <div className="trepa-overlay-card">
            {status === 'ready' && <>
              <h2 id="vamp-message" className="vamp-title">VAMPYRIUM</h2>
              <p className="runner-keys"><kbd>←</kbd> <kbd>→</kbd> moverse · <kbd>↑</kbd> saltar (otra vez en el aire: doble salto) · <kbd>↓</kbd> bajar de una plataforma · <kbd>Espacio</kbd> atacar · <kbd>Espacio</kbd><kbd>Espacio</kbd> armas · <kbd>C</kbd> cruz sagrada · <kbd>P</kbd> pausa</p>
              <p className="runner-tip">🧛 Matá {GOAL} vampiros y se abre la puerta de la derecha. La espada es ilimitada; las estacas se tiran y se terminan: del cielo caen cajas con más (y a veces corazones o ajo). Cada 10 vampiros se carga la cruz: su luz los revienta a todos. Ojo con los huecos al vacío, los pinches, el péndulo y el brasero… ¡a los vampiros también los matan!</p>
              <button type="button" onClick={start} autoFocus>Jugar</button>
            </>}
            {status === 'paused' && <>
              <h2 id="vamp-message">Pausa</h2>
              <button type="button" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
            </>}
            {status === 'over' && <>
              <EndBanner win={false} id="vamp-message" />
              <p>Mataste <strong>{result.total}</strong> vampiros ({result.walker} 🧛 y {result.flyer} 🦇) en {formatVampTime(result.time)}.{result.newRecord && ' ¡Nuevo récord!'}</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
            {status === 'won' && <>
              <EndBanner win id="vamp-message" />
              <p className="end-reason">¡Nivel 1 superado! Cruzaste la puerta del castillo.</p>
              <ul className="grav-stats">
                <li>Tiempo <strong>{formatVampTime(result.time)}</strong></li>
                <li>Vampiros <strong>{result.walker}</strong></li>
                <li>Voladores <strong>{result.flyer}</strong></li>
                <li>Mejor combo <strong>×{Math.max(1, result.combo)}</strong></li>
              </ul>
              {result.newRecord && <p>¡Nuevo récord!</p>}
              <p className="runner-tip">El nivel 2 viene pronto…</p>
              <button type="button" onClick={start} autoFocus>Jugar de nuevo</button>
            </>}
          </div>
        </div>}
      </div>
      <aside className="trepa-side vamp-side" aria-label="Tiempo, vampiros y armas">
        <div className="trepa-stat"><span>Tiempo</span><strong data-testid="vamp-time">{formatVampTime(hud.time)}</strong></div>
        <div className="trepa-stat vamp-kills" aria-label={`Vampiros: ${hud.total} de ${GOAL}`}>
          <span>Vampiros</span><strong data-testid="vamp-total">{hud.total}<small>/{GOAL}</small></strong>
          <i className="vamp-bar"><b style={{ width: `${Math.min(100, hud.total / GOAL * 100)}%` }} /></i>
          <em>🧛 <b data-testid="vamp-walkers">{hud.walker}</b> · 🦇 <b data-testid="vamp-flyers">{hud.flyer}</b></em>
        </div>
        <div className="trepa-stat" aria-label={`Vida: ${hud.hp}`}><span>Vida</span><strong className="trepa-lives">{Array.from({ length: MAX_HP }, (_, i) => <b key={i} className={i < hud.hp ? '' : 'trepa-lost'}>♥</b>)}</strong></div>
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
