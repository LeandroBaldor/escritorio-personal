import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FACTORIES, FACTORY_HEIGHT, FOODS, factoryLevel, newFactoryGame, stepFactory } from './fartFactory';
import { drawFactory } from './factoryArt';
import './fartFactory.css';

const RECORD = 'minijuegos:factory-record';
function readBest() { try { return Math.min(10, Math.max(0, Number(localStorage.getItem(RECORD)) || 0)); } catch { return 0; } }

export function FartFactory() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef(newFactoryGame());
  const input = useRef({ left: false, right: false, boost: false });
  const [hud, setHud] = useState({ energy: 100, level: 0, food: 0, state: 'ready', reason: '', completed: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [best, setBest] = useState(readBest);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const lastRecord = useRef(best);
  const release = () => { input.current = { left: false, right: false, boost: false }; };
  const sound = (event: string) => {
    if (mutedRef.current || !audio.current) return;
    const a = audio.current;
    const o = a.createOscillator(), v = a.createGain();
    const now = a.currentTime;
    o.type = event === 'boost' ? 'sawtooth' : 'sine';
    o.frequency.setValueAtTime(event === 'boost' ? 100 + game.current.food * 25 : event === 'eat' ? 650 : 880, now);
    o.frequency.exponentialRampToValueAtTime(event === 'boost' ? 32 : 1100, now + 0.17);
    v.gain.setValueAtTime(0.045, now); v.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(v); v.connect(a.destination); o.start(); o.stop(now + 0.22);
  };
  const start = (retry = false) => {
    const level = retry ? factoryLevel(game.current.highest) : 0;
    game.current = newFactoryGame(level); game.current.state = 'playing';
    pausedRef.current = false; setPaused(false); release();
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume().catch(() => {});
  };
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); release(); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('button, a, input')) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyP', 'Escape'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.current.right = true;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.current.boost = true;
      if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape') && game.current.state === 'playing') {
        pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); input.current = { left: false, right: false, boost: false };
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.current.right = false;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.current.boost = false;
    };
    const blur = () => { input.current = { left: false, right: false, boost: false }; if (game.current.state === 'playing') { pausedRef.current = true; setPaused(true); } };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    let frame = 0, previous = 0, accumulator = 0, uiTime = 0;
    const draw = (now: number) => {
      const dt = previous ? Math.min(0.1, (now - previous) / 1000) : 0; previous = now;
      if (!pausedRef.current) {
        accumulator += dt;
        while (accumulator >= 1 / 120) { stepFactory(game.current, input.current, 1 / 120); if (game.current.event) { sound(game.current.event); game.current.event = ''; } accumulator -= 1 / 120; }
      } else accumulator = 0;
      const el = canvas.current, g = game.current;
      if (el) {
        const rect = el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
        if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
        const c = el.getContext('2d');
        if (c) { c.setTransform(dpr, 0, 0, dpr, 0, 0); drawFactory(c, g, rect.width, rect.height); }
      }
      const completed = g.state === 'won' ? 10 : Math.min(9, Math.floor(g.highest / FACTORY_HEIGHT));
      if (completed > lastRecord.current) { lastRecord.current = completed; setBest(completed); try { localStorage.setItem(RECORD, String(completed)); } catch { /* Storage may be unavailable. */ } }
      if (now - uiTime > 80) { setHud({ energy: g.energy, level: factoryLevel(g.y), food: g.food, state: g.state, reason: g.reason, completed }); uiTime = now; }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); void audio.current?.close(); audio.current = null; };
    // The simulation, input and audio settings are read from refs by the animation loop.
  }, []);
  const hold = (key: 'left' | 'right' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
    onLostPointerCapture: () => { input.current[key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const food = FOODS[hud.food], theme = FACTORIES[hud.level];
  return <section className="factory-game" style={{ '--factory-accent': theme.color } as React.CSSProperties} aria-label="Fábrica de Pedos">
    <div className="factory-header" role="banner"><Link to="/juegos" aria-label="Volver a MiniJuegos">← MiniJuegos</Link><strong>FÁBRICA <span>DE PEDOS</span></strong><div><button onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>{muted ? 'Sonido: no' : 'Sonido: sí'}</button><button disabled={hud.state !== 'playing'} onClick={togglePause}>{paused ? 'Seguir' : 'Pausa'}</button></div></div>
    <div className="factory-layout"><aside className="factory-sidebar"><p className="factory-kicker">ASCENSO INDUSTRIAL</p><h1>El escape<br />más gaseoso.</h1><p>Diez fábricas. Un solo motor.</p><ol>{FACTORIES.map((f, i) => <li key={f.name} className={i === hud.level ? 'current' : i < hud.completed ? 'complete' : ''}><span>{i < hud.completed ? '✓' : String(i + 1).padStart(2, '0')}</span>{f.name}</li>)}</ol><small>Récord: {best}/10 fábricas superadas</small></aside>
      <div className="factory-stage"><canvas ref={canvas} aria-label="Fábrica vertical: movete con flechas y usá espacio para impulsarte con pedos" /><div className="factory-hud"><div className="factory-energy"><b>ENERGÍA DE PEDOS</b><div role="progressbar" aria-label="Energía de pedos" aria-valuenow={Math.round(hud.energy)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${hud.energy}%` }} /></div><small>{Math.round(hud.energy)}% · {food.icon} {food.effect}</small></div><div className="factory-sector"><b>NIVEL {hud.level + 1}<span>/10</span></b><small>{theme.name}</small></div></div>
        {(hud.state !== 'playing' || paused) && <div className="factory-overlay"><div className="factory-dialog" role="dialog" aria-modal="true" aria-label={paused ? 'Juego en pausa' : hud.state === 'ready' ? 'Cómo jugar' : hud.reason}><p className="factory-kicker">{paused ? 'RESPIRÁ UN POCO' : hud.state === 'won' ? 'MISIÓN CUMPLIDA' : hud.state === 'dead' ? 'SE TERMINÓ EL GAS' : 'UN ESCAPE A PURA PRESIÓN'}</p><h2>{paused ? 'Pausa' : hud.state === 'ready' ? '¡Dale gas!' : hud.state === 'won' ? '¡Diez de diez!' : '¡Otra oportunidad!'}</h2><p>{paused ? 'La fábrica te espera.' : hud.state === 'ready' ? 'Escalá las 10 fábricas antes de que te alcance el piso de pinches. Tu único impulso son los pedos: comé para recargar.' : hud.reason}</p>{hud.state === 'ready' && <div className="factory-foods">{FOODS.map(f => <span key={f.name}>{f.icon} <b>{f.name}</b><small>{f.effect} · +{f.energy}%</small></span>)}</div>}
          <button className="factory-primary" onClick={() => paused ? togglePause() : start(hud.state === 'dead')}>{paused ? 'Seguir jugando' : hud.state === 'ready' ? 'Entrar a la fábrica →' : hud.state === 'won' ? 'Jugar de nuevo' : `Reintentar nivel ${hud.completed + 1}`}</button>{hud.state === 'dead' && <button onClick={() => start()}>Empezar desde el nivel 1</button>}<small>← → / A D: mover · Espacio / ↑: pedo · P: pausa</small></div></div>}
        {hud.state === 'playing' && !paused && <div className="factory-touch"><button aria-label="Mover a la izquierda" {...hold('left')}>◀</button><button aria-label="Mover a la derecha" {...hold('right')}>▶</button><button className="factory-boost" aria-label="Impulsarse con un pedo" {...hold('boost')}>💨 GAS</button></div>}
      </div><aside className="factory-notes"><p className="factory-kicker">MANUAL DEL ESCAPISTA</p><h2>Comé.<br />Apuntá.<br /><em>Despegá.</em></h2><p>Mantené Espacio para encadenar impulsos. Soltalo para aterrizar y recoger comida.</p><div className="factory-tip">⚠<p>Las luces amarillas avisan. Las rojas indican peligro. Esperá el momento para pasar.</p></div><p>Engranajes, compuertas, láseres, fuego y pinches: mirá antes de acelerar.</p><small>Solo ganás al llegar a la salida del nivel 10.</small></aside></div>
  </section>;
}
