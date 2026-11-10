import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FACTORIES, FACTORY_HEIGHT, FOODS, factoryLevel, newFactoryGame, stepFactory } from './fartFactory';
import { drawFactory, drawFactoryMenu, loadFactoryArt } from './factoryScene';
import { FactorySound } from './factorySound';
import './fartFactory.css';

const RECORD = 'minijuegos:factory-record';
function readBest() { try { return Math.min(10, Math.max(0, Number(localStorage.getItem(RECORD)) || 0)); } catch { return 0; } }
const emptyInput = () => ({ left: false, right: false, boost: false });

export function FartFactory() {
  const canvas = useRef<HTMLCanvasElement>(null), game = useRef(newFactoryGame());
  const input = useRef(emptyInput()), sounds = useRef<FactorySound | null>(null);
  const pausedRef = useRef(false), mutedRef = useRef(false);
  const [paused, setPaused] = useState(false), [muted, setMuted] = useState(false);
  const [art, setArt] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hud, setHud] = useState({ energy: 100, level: 0, food: 0, state: 'ready', reason: '', completed: 0 });
  const [best, setBest] = useState(readBest), lastRecord = useRef(best);
  const [fullscreen, setFullscreen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const release = () => { input.current = emptyInput(); };
  const leave = () => { sounds.current?.stop(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  const pause = (value: boolean) => { pausedRef.current = value; setPaused(value); release(); if (value) sounds.current?.stop(); else sounds.current?.unlock(); };
  const start = (retry = false) => {
    game.current = newFactoryGame(retry ? factoryLevel(game.current.highest) : 0);
    game.current.state = 'playing'; pause(false); setShowGuide(false);
    sounds.current?.unlock(); sounds.current?.mute(mutedRef.current); sounds.current?.stop();
    canvas.current?.focus();
  };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* The canvas already fills browsers without Fullscreen API. */ }
    canvas.current?.focus();
  };
  useEffect(() => {
    let disposed = false;
    const sound = new FactorySound(); sounds.current = sound;
    void Promise.all([loadFactoryArt(), sound.prepare()]).then(() => { if (!disposed) setArt('ready'); }).catch(() => { if (!disposed) setArt('error'); });
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (['KeyP', 'Escape'].includes(e.code) && !e.repeat && game.current.state === 'playing') {
        pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); input.current = emptyInput(); sounds.current?.stop(); return;
      }
      if (game.current.state !== 'playing' || pausedRef.current || (e.target as HTMLElement)?.closest('button, a')) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) e.preventDefault();
      if (['ArrowLeft', 'KeyA'].includes(e.code)) input.current.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) input.current.right = true;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.current.boost = true;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) input.current.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) input.current.right = false;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.current.boost = false;
    };
    const blur = () => { input.current = emptyInput(); sounds.current?.stop(); if (game.current.state === 'playing') { pausedRef.current = true; setPaused(true); } };
    const visibility = () => { if (document.hidden) blur(); };
    const full = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', full);
    let frame = 0, previous = 0, accumulator = 0, uiTime = 0;
    const draw = (now: number) => {
      const dt = previous ? Math.min(0.1, (now - previous) / 1000) : 0; previous = now;
      const g = game.current, before = g.state;
      if (!pausedRef.current && g.state === 'playing') {
        accumulator += dt;
        while (accumulator >= 1 / 120) {
          stepFactory(g, input.current, 1 / 120);
          if (g.event === 'boost') sounds.current?.play(g.boostFood);
          else if (g.event === 'bomb') sounds.current?.explode();
          g.event = ''; accumulator -= 1 / 120;
        }
      } else accumulator = 0;
      if (before === 'playing' && g.state !== 'playing') { input.current = emptyInput(); sounds.current?.stop(); }
      const el = canvas.current;
      if (el) {
        const rect = el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
        if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
        const c = el.getContext('2d'); if (c) { c.setTransform(dpr, 0, 0, dpr, 0, 0); if (g.state === 'ready') drawFactoryMenu(c, rect.width, rect.height, now / 1000); else drawFactory(c, g, rect.width, rect.height); }
      }
      const completed = g.state === 'won' ? 10 : Math.min(9, Math.floor(g.highest / FACTORY_HEIGHT));
      if (completed > lastRecord.current) { lastRecord.current = completed; setBest(completed); try { localStorage.setItem(RECORD, String(completed)); } catch { /* Optional browser storage. */ } }
      if (now - uiTime > 80) { setHud({ energy: g.energy, level: factoryLevel(g.y), food: g.food, state: g.state, reason: g.reason, completed }); uiTime = now; }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true; cancelAnimationFrame(frame); sounds.current?.dispose(); sounds.current = null;
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', full);
    };
  }, []);
  const hold = (key: 'left' | 'right' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; }, onPointerCancel: () => { input.current[key] = false; }, onLostPointerCapture: () => { input.current[key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const food = FOODS[hud.food], theme = FACTORIES[hud.level], overlay = hud.state !== 'playing' || paused;
  return <section className={`factory-game${hud.state === 'ready' ? ' factory-game--menu' : ''}`} style={{ '--factory-accent': theme.color } as React.CSSProperties} aria-label="Fábrica de Pedos">
    <div className="factory-stage">
      <canvas ref={canvas} tabIndex={0} aria-label="Fábrica vertical: flechas para elegir camino y Espacio para impulsarse" />
      <div className="factory-toolbar"><Link to="/juegos" onClick={leave} aria-label="Volver a MiniJuegos">← MiniJuegos</Link><strong>FÁBRICA <span>DE PEDOS</span></strong><div>
        <button onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); sounds.current?.mute(mutedRef.current); canvas.current?.focus(); }} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>{muted ? '♫ ×' : '♫'}</button>
        <button onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>⛶</button>
        <button disabled={hud.state !== 'playing'} onClick={() => { pause(!pausedRef.current); if (!pausedRef.current) canvas.current?.focus(); }}>{paused ? 'Seguir' : 'Pausa'}</button>
      </div></div>
      <div className="factory-hud"><div className="factory-energy"><b>ENERGÍA DE PEDOS</b><div role="progressbar" aria-label="Energía de pedos" aria-valuenow={Math.round(hud.energy)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${hud.energy}%` }} /></div><small>{Math.round(hud.energy)}% · {food.icon} {food.name} · {food.effect}</small></div><div className="factory-sector"><b>NIVEL {hud.level + 1}<span>/10</span></b><small>{theme.name}</small><div className="factory-levels" aria-label={`${hud.completed} niveles completados`}>{FACTORIES.map((f, i) => <i key={f.name} className={i < hud.completed ? 'done' : i === hud.level ? 'active' : ''} />)}</div></div></div>
      {!overlay && <div className="factory-route-hint">← Elegí tu camino →<small>Comé para recargar · Espacio / ↑ para dar gas</small></div>}
      {hud.state === 'ready' && <div className="factory-main-menu" role="dialog" aria-modal="true" aria-label="Menú principal">
        <div className="factory-menu-sidebar"><p className="factory-kicker">MINIJUEGOS · BY YEYO</p><h1>FÁBRICA<span>DE PEDOS</span><i aria-hidden="true">≋</i></h1><p className="factory-menu-tagline">Encontrá tu camino.<br />Escapá a pura presión.</p>
          <nav aria-label="Menú del juego"><button className="factory-primary" disabled={art !== 'ready'} onClick={() => start()}>{art === 'loading' ? 'Cargando…' : art === 'error' ? 'No se pudo cargar' : 'Jugar'}</button>
            <button className="factory-guide-toggle" aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Ocultar alimentos' : 'Alimentos y controles'}</button>
            <button onClick={toggleFullscreen}>Pantalla completa</button><button onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); sounds.current?.mute(mutedRef.current); }}>Sonido: {muted ? 'desactivado' : 'activado'}</button>
            <Link to="/juegos" className="factory-menu-exit" onClick={leave} aria-label="Salir del juego">Salir <span>↗</span></Link>
          </nav>
          {art === 'error' && <button onClick={() => { setArt('loading'); sounds.current?.dispose(); sounds.current = new FactorySound(); void Promise.all([loadFactoryArt(), sounds.current.prepare()]).then(() => setArt('ready')).catch(() => setArt('error')); }}>Reintentar carga</button>}
          <small>Récord: {best}/10 fábricas</small>
        </div><div className="factory-menu-caption"><b>10 LABERINTOS INDUSTRIALES</b><span>Buscá las aberturas. Elegí otro corredor.<br />El piso de pinches no espera.</span></div>
        {showGuide && <div className="factory-menu-guide"><button onClick={() => setShowGuide(false)} aria-label="Cerrar alimentos y controles">×</button><h2>Comé. Elegí. Despegá.</h2><p>← → / A D: mover · Espacio / ↑: pedo · P: pausa.<br />Las paredes son sólidas: subí por los huecos entre corredores. Si activás una bomba, alejate antes de que llegue a cero.</p><div className="factory-foods">{FOODS.map(f => <span key={f.name}>{f.icon}<b>{f.name}</b><small>{f.effect} · +{f.energy}%</small></span>)}</div></div>}
      </div>}
      {overlay && hud.state !== 'ready' && <div className="factory-overlay"><div className="factory-dialog" role="dialog" aria-modal="true" aria-label={paused ? 'Juego en pausa' : hud.reason}>
        <p className="factory-kicker">{paused ? 'TOMATE UN RESPIRO' : hud.state === 'won' ? 'MISIÓN CUMPLIDA' : hud.state === 'dead' ? 'VOLVÉ A DARLE GAS' : 'DIEZ FÁBRICAS · CINCO CAMINOS · UN MOTOR'}</p>
        <h1>{paused ? 'Pausa' : hud.state === 'ready' ? 'Un escape a pura presión.' : hud.state === 'won' ? '¡Diez de diez!' : '¡Otra oportunidad!'}</h1>
        <p>{paused ? 'La fábrica te espera. Podés consultar los alimentos antes de seguir.' : hud.state === 'ready' ? 'Elegí tu camino, comé y usá tus pedos para escalar. El piso de pinches sube sin parar. Ganás al salir de la décima fábrica.' : hud.reason}</p>
        <div className="factory-controls-guide"><span><b>← → / A D</b>Elegí el camino</span><span><b>Espacio / ↑</b>Impulsate</span><span><b>Soltá el gas</b>Aterrizá y comé</span></div>
        <button className="factory-primary" disabled={art !== 'ready'} onClick={() => { if (paused) { pause(false); canvas.current?.focus(); } else start(hud.state === 'dead'); }}>{art === 'loading' ? 'Preparando la fábrica…' : art === 'error' ? 'No se pudieron cargar las imágenes' : paused ? 'Seguir jugando' : hud.state === 'ready' ? 'Entrar a la fábrica →' : hud.state === 'won' ? 'Jugar de nuevo' : `Reintentar nivel ${hud.completed + 1}`}</button>
        {art === 'error' && <button onClick={() => { setArt('loading'); sounds.current?.dispose(); sounds.current = new FactorySound(); void Promise.all([loadFactoryArt(), sounds.current.prepare()]).then(() => setArt('ready')).catch(() => setArt('error')); }}>Reintentar carga</button>}
        <button className="factory-guide-toggle" aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Ocultar alimentos' : 'Ver los 10 alimentos y sus impulsos'}</button>
        {showGuide && <div className="factory-foods">{FOODS.map(f => <span key={f.name}>{f.icon}<b>{f.name}</b><small>{f.effect} · recarga +{f.energy}% · consume {f.cost}%</small></span>)}</div>}
        {hud.state === 'dead' && <button onClick={() => start()}>Empezar desde el nivel 1</button>}
        <Link className="factory-exit" to="/juegos" onClick={leave}>Salir del juego</Link>
        <small>Récord: {best}/10 fábricas · P: pausa · Controles táctiles en pantalla</small>
      </div></div>}
      {!overlay && <div className="factory-touch" aria-label="Controles táctiles"><div><button aria-label="Mover a la izquierda" {...hold('left')}>◀</button><button aria-label="Mover a la derecha" {...hold('right')}>▶</button></div><button className="factory-boost" aria-label="Impulsarse con un pedo" {...hold('boost')}>💨<span>GAS</span></button></div>}
    </div>
  </section>;
}
