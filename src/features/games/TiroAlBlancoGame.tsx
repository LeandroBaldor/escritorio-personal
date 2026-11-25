import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './tiroAlBlanco.css';
import {
  accuracy, aimAt, CHARS, charOf, chooseSidearm, H, magSize, newGame, PRIMARIES, PTS, readTiroRecord, reload, ROUND, saveTiroRecord, SCENES, sceneOf,
  setTrigger, SIDEARMS, specOf, spreadOf, step, switchWeapon, takeEvents, timeLeft, W, WEAPONS, weaponOf,
  type CharId, type Game, type PrimaryId, type SceneId, type SidearmId, type Stats, type WeaponId,
} from './tiroAlBlanco';
import {
  drawBack, drawCountdown, drawFx, drawGun, drawPortrait, drawReticle, drawRowCover, drawSampleBoard, drawSceneFx, drawTarget, drawWeaponIcon, gunBase, GUN_SCALE,
  sceneLayers, type Fx,
} from './tiroAlBlancoArt';
import {
  playTiroAmmo, playTiroCount, playTiroDry, playTiroEnd, playTiroEscape, playTiroFlip, playTiroHit, playTiroPenalty, playTiroPop, playTiroReload,
  playTiroShot, playTiroStreak, playTiroSwitch, unlockTiroAudio,
} from './tiroAlBlancoSound';

export { readTiroRecord } from './tiroAlBlanco';
export const TIRO_TITLE = 'Tiro al Blanco 2.050';

type Status = 'menu' | 'setup' | 'turn' | 'playing' | 'paused' | 'roundEnd' | 'results';
interface Player { char: CharId; primary: PrimaryId; score?: number; stats?: Stats; sidearm?: SidearmId }
interface Hud { time: number; score: number; mag: number; max: number; reserve: number; weapon: WeaponId; reloading: boolean; needSidearm: boolean; streak: number; hasSidearm: boolean }
const clock = (s: number) => { const n = Math.ceil(s); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const randomScene = () => SCENES[Math.floor(Math.random() * SCENES.length)].id;
const label = (players: Player[], i: number) => players.length > 1 ? `JUGADOR ${i + 1}` : 'VOS';

// Un canvas chico que se dibuja una vez (retratos, armas y carteles de los menús).
function Pic({ draw, w, h, className }: { draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k; ctx.setTransform(k, 0, 0, k, 0, 0); draw(ctx, w, h);
  }, [draw, w, h]);
  return <canvas ref={ref} className={className} style={{ width: w, height: h }} aria-hidden="true" />;
}

export function TiroAlBlanco() {
  const [status, setStatus] = useState<Status>('menu');
  const [count, setCount] = useState(1);
  const [scene, setScene] = useState<SceneId | 'azar'>('azar');
  const [players, setPlayers] = useState<Player[]>([]);
  const [pick, setPick] = useState<{ i: number; char: CharId | null; stage: 'char' | 'weapon' }>({ i: 0, char: null, stage: 'char' });
  const [turn, setTurn] = useState(0);
  const [played, setPlayed] = useState<SceneId>('banco');
  const [hud, setHud] = useState<Hud | null>(null);
  const [record, setRecord] = useState(readTiroRecord);
  const [newRecord, setNewRecord] = useState(false);
  const statusRef = useRef(status);
  const gameRef = useRef<Game | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<Fx[]>([]);
  const gunRef = useRef({ x: W / 2, y: H + 100, kick: 0, muzzle: { x: W / 2, y: H - 300 } });
  const flashRef = useRef({ red: 0, shake: 0 });
  const playersRef = useRef(players);
  const turnRef = useRef(turn);
  useLayoutEffect(() => { statusRef.current = status; playersRef.current = players; turnRef.current = turn; }, [status, players, turn]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __tiro: () => Game | null }).__tiro = () => gameRef.current; }, []);

  // ───── Menú y elecciones ─────
  const goSetup = () => { unlockTiroAudio(); setPlayers([]); setPick({ i: 0, char: null, stage: 'char' }); setStatus('setup'); };
  const chooseChar = (id: CharId) => { playTiroSwitch(); setPick(p => ({ ...p, char: id, stage: 'weapon' })); };
  const chooseWeapon = (w: PrimaryId) => {
    playTiroReload();
    const list = [...players, { char: pick.char!, primary: w }];
    setPlayers(list);
    if (list.length < count) setPick({ i: list.length, char: null, stage: 'char' });
    else { setPlayed(scene === 'azar' ? randomScene() : scene); setTurn(0); setStatus('turn'); }
  };

  // ───── Partida ─────
  const startTurn = useCallback(() => {
    unlockTiroAudio();
    const p = playersRef.current[turnRef.current];
    gameRef.current = newGame(played, p.char, p.primary);
    fxRef.current = []; flashRef.current = { red: 0, shake: 0 };
    setNewRecord(false);
    playTiroCount(false);
    setStatus('playing');
  }, [played]);

  const finishTurn = useCallback((g: Game) => {
    const list = playersRef.current.map((p, i) => i === turnRef.current ? { ...p, score: g.score, stats: { ...g.stats }, sidearm: g.sidearm?.id as SidearmId | undefined } : p);
    setPlayers(list);
    const prev = readTiroRecord();
    if (g.score > prev.score) { const r = { score: g.score, heads: g.stats.heads }; saveTiroRecord(r); setRecord(r); setNewRecord(prev.score > 0 || g.score > 0); }
    playTiroEnd();
    setStatus('roundEnd');
  }, []);

  const paint = useCallback(() => {
    const c = canvasRef.current, g = gameRef.current, ctx = c?.getContext('2d');
    if (!c || !ctx || !g) return;
    const k = c.width / W, layers = sceneLayers(g.scene, k > 1.2 ? 1.5 : 1), fl = flashRef.current, gun = gunRef.current;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    if (fl.shake > 0) ctx.translate((Math.random() - 0.5) * fl.shake * 14, (Math.random() - 0.5) * fl.shake * 14);
    drawBack(ctx, layers);
    drawSceneFx(ctx, g.scene, g.time);
    g.scene.rows.forEach((_, ri) => {
      for (const t of g.targets) if (t.row === ri) drawTarget(ctx, t, g.time);
      drawRowCover(ctx, layers, ri);
    });
    drawFx(ctx, fxRef.current, g.time);
    const id = weaponOf(g).id;
    gun.muzzle = drawGun(ctx, id, { x: gun.x, y: gun.y, ang: 0, kick: gun.kick }, g.char, g.aim, GUN_SCALE);
    ctx.restore();
    const rl = g.reloading > 0 ? 1 - g.reloading / (specOf(g).reload * (g.char.id === 'kira' ? 0.7 : 1)) : 0;
    if (statusRef.current === 'playing' && !g.needSidearm) drawReticle(ctx, g.aim.x, g.aim.y, spreadOf(g), id, rl);
    if (fl.red > 0) { ctx.fillStyle = `rgba(220,20,40,${fl.red * 0.35})`; ctx.fillRect(0, 0, W, H); }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); v.addColorStop(0, '#0000'); v.addColorStop(1, '#000a');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (statusRef.current === 'playing' || statusRef.current === 'paused') drawCountdown(ctx, g.time);
  }, []);

  // En la pantalla del turno ya se ve el escenario de fondo.
  useEffect(() => {
    if (status !== 'turn') return;
    const p = playersRef.current[turnRef.current];
    if (p) { gameRef.current = newGame(played, p.char, p.primary); fxRef.current = []; paint(); }
  }, [status, played, paint]);

  // El canvas ocupa lo más que puede del escenario, siempre 16:9.
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current, c = canvasRef.current;
      if (!st || !c) return;
      const r = st.getBoundingClientRect(), w = Math.min(r.width, r.height * (W / H)), h = w * (H / W);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      const k = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(w * k); c.height = Math.round(h * k);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit); if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [paint, status]);

  useEffect(() => {
    if (status !== 'playing') return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(g, dt);
      const gun = gunRef.current, fx = fxRef.current, fl = flashRef.current;
      for (const e of takeEvents(g)) {
        if (e.type === 'count') playTiroCount(false);
        if (e.type === 'go') playTiroCount(true);
        if (e.type === 'shot') {
          playTiroShot(e.weapon);
          gun.kick = Math.min(1, gun.kick + (e.weapon === 'ametralladora' ? 0.25 : e.weapon === 'pistola' ? 0.45 : 0.85));
          if (e.weapon === 'escopeta' || e.weapon === 'rifle' || e.weapon === 'revolver') fl.shake = Math.max(fl.shake, e.weapon === 'escopeta' ? 0.9 : 0.5);
          const c = WEAPONS[e.weapon].color;
          fx.push({ kind: 'flash', x: gun.muzzle.x, y: gun.muzzle.y, at: g.time, color: c });
          for (const p of e.impacts) { fx.push({ kind: 'tracer', x: gun.muzzle.x, y: gun.muzzle.y, x2: p.x, y2: p.y, at: g.time, color: c }); fx.push({ kind: 'spark', x: p.x, y: p.y, at: g.time, color: c }); }
        }
        if (e.type === 'hit') { playTiroHit(e.zone === 'head'); playTiroFlip(); fx.push({ kind: 'pop', x: e.x, y: e.y - 30, at: g.time, color: e.zone === 'head' ? '#facc15' : '#4ade80', text: `+${e.points}${e.zone === 'head' ? ' ¡CABEZA!' : ''}`, big: e.zone === 'head' }); }
        if (e.type === 'penalty') { playTiroPenalty(); playTiroFlip(); fl.red = 1; fx.push({ kind: 'pop', x: e.x, y: e.y - 30, at: g.time, color: '#f43f5e', text: `${e.points} ¡${e.kind === 'rehen' ? 'REHÉN' : 'INOCENTE'}!`, big: true }); }
        if (e.type === 'escape') { playTiroEscape(); fx.push({ kind: 'pop', x: e.x, y: e.y, at: g.time, color: '#fb923c', text: `${e.points} SE ESCONDIÓ` }); }
        if (e.type === 'ammo') { playTiroAmmo(); playTiroFlip(); fx.push({ kind: 'pop', x: e.x, y: e.y - 30, at: g.time, color: '#4ade80', text: '+MUNICIÓN', big: true }); }
        if (e.type === 'streak') { playTiroStreak(); fx.push({ kind: 'pop', x: W / 2, y: 190, at: g.time, color: '#38bdf8', text: `RACHA ×${e.count}  +${e.bonus}`, big: true }); }
        if (e.type === 'pop') playTiroPop();
        if (e.type === 'reload') playTiroReload();
        if (e.type === 'dry') playTiroDry();
        if (e.type === 'switch') playTiroSwitch();
        if (e.type === 'empty') playTiroDry();
      }
      fxRef.current = fx.filter(f => g.time - f.at < 1.2).slice(-120);
      // el arma sigue a la mira por todo el mapa
      const base = gunBase(g.aim.x, g.aim.y), follow = 1 - Math.exp(-dt * 14);
      gun.x += (base.x - gun.x) * follow; gun.y += (base.y - gun.y) * follow;
      gun.kick = Math.max(0, gun.kick - dt * 6);
      fl.red = Math.max(0, fl.red - dt * 2.2); fl.shake = Math.max(0, fl.shake - dt * 5);
      paint();
      const w = weaponOf(g), n: Hud = {
        time: Math.ceil(timeLeft(g)), score: g.score, mag: w.mag, max: magSize(g, w), reserve: w.reserve, weapon: w.id, reloading: g.reloading > 0,
        needSidearm: g.needSidearm, streak: g.streak, hasSidearm: !!g.sidearm,
      };
      setHud(p => p && (Object.keys(n) as (keyof Hud)[]).every(key => p[key] === n[key]) ? p : n);
      if (g.over) { finishTurn(g); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setStatus('paused'); };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', hide); };
  }, [status, paint, finishTurn]);

  // Teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current, st = statusRef.current;
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (st === 'playing' || st === 'paused')) { e.preventDefault(); setStatus(s => s === 'playing' ? 'paused' : 'playing'); return; }
      if (st !== 'playing' || !g) return;
      if (g.needSidearm && (e.key === '1' || e.key === '2')) { chooseSidearm(g, e.key === '1' ? 'pistola' : 'revolver'); return; }
      if (e.key === 'r' || e.key === 'R') reload(g);
      if (e.key === 'q' || e.key === 'Q') switchWeapon(g);
      if (e.code === 'Space') { e.preventDefault(); setTrigger(g, true); }
    };
    const up = (e: KeyboardEvent) => { const g = gameRef.current; if (g && e.code === 'Space') setTrigger(g, false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const toGame = (e: React.PointerEvent) => {
    const c = canvasRef.current, g = gameRef.current;
    if (!c || !g) return;
    const r = c.getBoundingClientRect();
    aimAt(g, ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  const onDown = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (statusRef.current !== 'playing' || !g || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    toGame(e); setTrigger(g, true);
  };
  const onUp = () => { const g = gameRef.current; if (g) setTrigger(g, false); };

  const nextAfterRound = () => {
    if (turn + 1 < players.length) { setTurn(turn + 1); setStatus('turn'); } else setStatus('results');
  };
  const rematch = () => { setPlayers(ps => ps.map(p => ({ char: p.char, primary: p.primary }))); setTurn(0); setStatus('turn'); };

  const me = players[turn];
  const doReload = () => { const g = gameRef.current; if (g) reload(g); };
  const doSwitch = () => { const g = gameRef.current; if (g) switchWeapon(g); };
  const doSidearm = (id: SidearmId) => { const g = gameRef.current; if (g) chooseSidearm(g, id); };
  const taken = players.map(p => p.char);
  const showGame = status === 'playing' || status === 'paused' || status === 'roundEnd' || status === 'turn';
  const ranking = players.map((p, i) => ({ ...p, i })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return <section className={`tiro${status === 'playing' ? ' tiro--playing' : ''}`} aria-label={TIRO_TITLE}>
    <header className="tiro-bar">
      <Link className="tiro-back" to="/juegos">‹ Juegos</Link>
      <h1>TIRO AL BLANCO <span>2.050</span></h1>
      {(status === 'playing' || status === 'paused') && <button type="button" onClick={() => setStatus(s => s === 'playing' ? 'paused' : 'playing')}>{status === 'playing' ? 'Pausa' : 'Seguir'}</button>}
    </header>
    <div className="tiro-stage" ref={stageRef}>
      <canvas ref={canvasRef} className={showGame ? '' : 'tiro-canvas--hidden'} role="img" aria-label="Campo de tiro: carteles con malos, rehenes e inocentes"
        onPointerDown={onDown} onPointerMove={toGame} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={e => e.preventDefault()} />

      {(status === 'playing' || status === 'paused') && hud && <div className="tiro-hud">
        <div className="tiro-hud-player"><b>{label(players, turn)}</b><span>{me && charOf(me.char).name}</span></div>
        <div className={`tiro-hud-time${hud.time <= 15 ? ' tiro-hurry' : ''}`}><span>Tiempo</span><strong data-testid="tiro-time">{clock(hud.time)}</strong></div>
        <div className="tiro-hud-score"><span>Puntos</span><strong data-testid="tiro-score">{hud.score}</strong>{hud.streak >= 2 && <small>Racha ×{hud.streak}</small>}</div>
        <div className="tiro-hud-ammo">
          <span>{WEAPONS[hud.weapon].name} · {WEAPONS[hud.weapon].model}</span>
          <strong data-testid="tiro-ammo">{hud.reloading ? 'RECARGANDO…' : `${hud.mag} / ${hud.reserve === Infinity ? '∞' : hud.reserve}`}</strong>
          <i className="tiro-mag">{Array.from({ length: Math.min(hud.max, 40) }, (_, i) => <b key={i} className={i < hud.mag ? 'on' : ''} />)}</i>
        </div>
        <div className="tiro-hud-buttons">
          <button type="button" onPointerDown={e => e.stopPropagation()} onClick={doReload}>⟳ Recargar <kbd>R</kbd></button>
          {hud.hasSidearm && <button type="button" onPointerDown={e => e.stopPropagation()} onClick={doSwitch}>⇄ Cambiar <kbd>Q</kbd></button>}
        </div>
      </div>}

      {status === 'playing' && hud?.needSidearm && <div className="tiro-sidearm" role="dialog" aria-labelledby="tiro-sidearm-title">
        <h2 id="tiro-sidearm-title">¡Sin balas! Elegí tu arma corta</h2>
        <p>El reloj sigue corriendo…</p>
        <div>{SIDEARMS.map((id, i) => <button key={id} type="button" onClick={() => doSidearm(id)}>
          <Pic draw={(ctx, w, h) => drawWeaponIcon(ctx, id, w, h)} w={180} h={80} />
          <b>{i + 1} · {WEAPONS[id].name}</b><small>{WEAPONS[id].model}</small><small>{WEAPONS[id].blurb}</small>
        </button>)}</div>
      </div>}

      {status === 'menu' && <div className="tiro-panel tiro-menu" role="dialog" aria-labelledby="tiro-title">
        <div className="tiro-menu-head">
          <Pic className="tiro-sample" draw={(ctx, w, h) => drawSampleBoard(ctx, 'malo', 0.31, w, h)} w={92} h={180} />
          <div>
            <p className="tiro-kicker">Simulador de entrenamiento · Fuerza Táctica 2050</p>
            <h2 id="tiro-title">TIRO AL BLANCO <span>2.050</span></h2>
            <p>Tomas de rehenes en escenarios futuristas. Los carteles saltan desde detrás de las coberturas: bajá a los que tienen <b>pasamontañas</b> y no le dispares a los <b>rehenes</b> ni a los <b>inocentes</b>. Cada ronda dura <b>3 minutos</b>.</p>
          </div>
          <Pic className="tiro-sample" draw={(ctx, w, h) => drawSampleBoard(ctx, 'rehen', 0.62, w, h)} w={92} h={180} />
        </div>
        <div className="tiro-group" role="group" aria-label="Jugadores">
          <span>Jugadores</span>
          {[1, 2, 3, 4].map(n => <button key={n} type="button" className={count === n ? 'on' : ''} aria-pressed={count === n} onClick={() => setCount(n)}>{n === 1 ? 'Solo' : `${n} jugadores`}</button>)}
        </div>
        <div className="tiro-group tiro-scenes" role="group" aria-label="Escenario">
          <span>Escenario</span>
          <button type="button" className={scene === 'azar' ? 'on' : ''} aria-pressed={scene === 'azar'} onClick={() => setScene('azar')}>🎲 Al azar</button>
          {SCENES.map(s => <button key={s.id} type="button" className={scene === s.id ? 'on' : ''} aria-pressed={scene === s.id} onClick={() => setScene(s.id)} title={s.brief}>{s.name}</button>)}
        </div>
        <ul className="tiro-points">
          <li><b>+{PTS.body}</b> malo en el cuerpo</li><li><b>+{PTS.head}</b> malo en la cabeza</li><li><b>+{PTS.hostageHead}</b> malo con rehén (solo a la cabeza)</li>
          <li><b className="neg">{PTS.innocent}</b> rehén o inocente</li><li><b className="neg">{PTS.escape}</b> malo que se esconde</li><li><b>+{PTS.streakBonus}</b> cada {PTS.streakEvery} malos seguidos</li>
        </ul>
        <p className="tiro-keys">🖱️ Mové la mira y hacé clic para disparar · <kbd>R</kbd> recargar · <kbd>Q</kbd> cambiar de arma · <kbd>P</kbd> pausa</p>
        {record.score > 0 && <p className="tiro-record">Récord: <b>{record.score}</b> puntos</p>}
        <button type="button" className="tiro-primary" onClick={goSetup} autoFocus>Siguiente ▶</button>
      </div>}

      {status === 'setup' && <div className="tiro-panel tiro-setup" role="dialog" aria-labelledby="tiro-setup-title">
        <p className="tiro-kicker">{count > 1 ? `Jugador ${pick.i + 1} de ${count}` : 'Preparate'}</p>
        {pick.stage === 'char' ? <>
          <h2 id="tiro-setup-title">{count > 1 ? `JUGADOR ${pick.i + 1}: ` : ''}ELEGÍ TU PERSONAJE</h2>
          <div className="tiro-chars" role="group" aria-label="Personajes">
            {CHARS.map(c => <button key={c.id} type="button" disabled={taken.includes(c.id)} onClick={() => chooseChar(c.id)} style={{ ['--c' as string]: c.color }}>
              <Pic draw={(ctx, w, h) => drawPortrait(ctx, c, w, h)} w={150} h={150} />
              <b>{c.name}</b><small>{c.role}</small><em>{c.perk}</em>
              {taken.includes(c.id) && <i>Ya lo eligió J{taken.indexOf(c.id) + 1}</i>}
            </button>)}
          </div>
        </> : <>
          <h2 id="tiro-setup-title">{charOf(pick.char!).name}: ELEGÍ TU ARMA GRANDE</h2>
          <div className="tiro-weapons" role="group" aria-label="Armas">
            {PRIMARIES.map(id => { const s = WEAPONS[id]; return <button key={id} type="button" onClick={() => chooseWeapon(id)} style={{ ['--c' as string]: s.color }}>
              <Pic draw={(ctx, w, h) => drawWeaponIcon(ctx, id, w, h)} w={240} h={100} />
              <b>{s.name}</b><small>{s.model}</small>
              <span>{s.mag} por cargador · {s.reserve} de reserva{s.auto ? ' · automática' : ''}</span>
              <em>{s.blurb}</em>
            </button>; })}
          </div>
          <p className="tiro-note">Cuando se te terminen las balas vas a elegir una pistola o un revólver (con balas sin fin). Disparale a la caja de <b>MUNICIÓN</b> para recargar el arma grande.</p>
          <button type="button" className="tiro-link" onClick={() => setPick(p => ({ ...p, stage: 'char', char: null }))}>‹ Cambiar personaje</button>
        </>}
      </div>}

      {status === 'turn' && me && <div className="tiro-panel tiro-turn" role="dialog" aria-labelledby="tiro-turn-title">
        <p className="tiro-kicker">{sceneOf(played).place}</p>
        <h2 id="tiro-turn-title">{players.length > 1 ? `TURNO DE JUGADOR ${turn + 1}` : '¡A ENTRENAR!'}</h2>
        <div className="tiro-turn-card">
          <Pic draw={(ctx, w, h) => drawPortrait(ctx, charOf(me.char), w, h)} w={120} h={120} />
          <div><b>{charOf(me.char).name}</b><span>{WEAPONS[me.primary].name} · {WEAPONS[me.primary].model}</span><em>{charOf(me.char).perk}</em></div>
        </div>
        <h3>{sceneOf(played).name}</h3>
        <p>{sceneOf(played).brief}</p>
        <button type="button" className="tiro-primary" onClick={startTurn} autoFocus>¡Listo! ▶</button>
      </div>}

      {status === 'paused' && <div className="tiro-panel" role="dialog" aria-labelledby="tiro-pause"><h2 id="tiro-pause">Pausa</h2>
        <button type="button" className="tiro-primary" onClick={() => setStatus('playing')} autoFocus>Seguir</button>
        <button type="button" className="tiro-link" onClick={() => setStatus('menu')}>Salir al menú</button></div>}

      {status === 'roundEnd' && me?.stats && <div className="tiro-panel tiro-end" role="dialog" aria-labelledby="tiro-end-title">
        <p className="tiro-kicker">Fin de la ronda · {clock(ROUND)}</p>
        <h2 id="tiro-end-title">{players.length > 1 ? `JUGADOR ${turn + 1}` : 'RESULTADO'}</h2>
        <p className="tiro-big" data-testid="tiro-final">{me.score} <span>puntos</span></p>
        {newRecord && <p className="tiro-record">¡Nuevo récord!</p>}
        <dl className="tiro-stats">
          <div><dt>Malos abatidos</dt><dd>{me.stats.bad}</dd></div><div><dt>Tiros en la cabeza</dt><dd>{me.stats.heads}</dd></div>
          <div><dt>Inocentes heridos</dt><dd>{me.stats.innocents}</dd></div><div><dt>Malos que se escondieron</dt><dd>{me.stats.escaped}</dd></div>
          <div><dt>Disparos</dt><dd>{me.stats.shots}</dd></div><div><dt>Puntería</dt><dd>{accuracy(me.stats)}%</dd></div>
        </dl>
        {players.length > 1
          ? <button type="button" className="tiro-primary" onClick={nextAfterRound} autoFocus>{turn + 1 < players.length ? `Turno de JUGADOR ${turn + 2} ▶` : 'Ver resultados ▶'}</button>
          : <><button type="button" className="tiro-primary" onClick={rematch} autoFocus>Jugar de nuevo</button><button type="button" className="tiro-link" onClick={() => setStatus('menu')}>Menú</button></>}
      </div>}

      {status === 'results' && <div className="tiro-panel tiro-results" role="dialog" aria-labelledby="tiro-results-title">
        <p className="tiro-kicker">{sceneOf(played).name}</p>
        <h2 id="tiro-results-title">🏆 GANÓ {label(players, ranking[0].i)} 🏆</h2>
        <ol>{ranking.map((p, k) => <li key={p.i} className={k === 0 ? 'win' : ''}>
          <Pic draw={(ctx, w, h) => drawPortrait(ctx, charOf(p.char), w, h)} w={56} h={56} />
          <span><b>{label(players, p.i)} · {charOf(p.char).name}</b><small>{WEAPONS[p.primary].name}{p.sidearm ? ` + ${WEAPONS[p.sidearm].name}` : ''} · {p.stats?.heads ?? 0} en la cabeza · {p.stats?.innocents ?? 0} inocentes</small></span>
          <strong>{p.score ?? 0}</strong>
        </li>)}</ol>
        <button type="button" className="tiro-primary" onClick={rematch} autoFocus>Revancha</button>
        <button type="button" className="tiro-link" onClick={() => setStatus('menu')}>Menú</button>
      </div>}
    </div>
  </section>;
}
