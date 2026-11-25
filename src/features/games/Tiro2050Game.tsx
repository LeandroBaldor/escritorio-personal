import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { getAmmo, getWave, primaries, primaryVariants, RELOAD_MS, ROUND_MS, scoreImpact, secondaries, TARGET_RISE_MS, TARGET_VISIBLE_MS, WAVE_MS } from './tiro2050';
import { playBolt, playReload, playRifleShot } from './sounds';
import './tiro2050.css';

const assets = import.meta.glob(['./assets/tiro2050/{escenario,operador,variante,alien}-*', './assets/tiro2050/silueta-[2345].png', './assets/tiro2050/cobertura-1[2-7].png', './assets/tiro2050/primera-persona-[34].png', './assets/tiro2050/mano-recarga.png'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const art = (name: string) => assets[`./assets/tiro2050/${name}`];
export const tiro2050Cover = art('escenario-3.jpg');

const scenes = ['Hangar estelar', 'Fábrica robotizada', 'Puente de mando', 'Reactor orbital', 'Laboratorio de contención'];
const operators = ['Atlas', 'Nova', 'Diesel', 'Vega'];
const operatorSuits = ['Blindaje pesado', 'Traje de sigilo', 'Exoesqueleto industrial', 'Armadura de exploración'];
const colors = ['#ffc261', '#d9a9ff', '#ff9270', '#7bf4e6'];
const weaponGraphics = [
  { tip: [.18, .16], light: [51, 37], color: '#ffb854' },
  { tip: [.11, .16], light: [72, 39], color: '#d487ff' },
  { tip: [.10, .16], light: [58, 49], color: '#55daff' },
  { tip: [.037, .075], light: [62, 17], color: '#73f4ff' },
  { tip: [.055, .109], light: [35, 32], color: '#58e4ff' },
];
const primaryTips = [
  [.048, .124], [.048, .165], [.048, .160], [.048, .223], [.044, .309],
  [.048, .123], [.047, .172], [.047, .153], [.047, .201], [.045, .289],
  [.048, .135], [.046, .191], [.046, .189], [.046, .218], [.044, .297],
];
const initialAim = { x: 50, y: 49, aspect: 2.75 };
const initialZoom = { value: 1, x: 50, y: 50 };
const initialLoadout = { operator: 0, primary: 2, variant: 0, secondary: 0 };
const primaryTypes = ['Escopeta', 'Ametralladora', 'Rifle'];
type Loadout = typeof initialLoadout;
type Result = { score: number; shots: number; hits: number; errors: number };
type Impact = { id: number; value: number | null; x: number; y: number; at: number; art: number };
type Casing = { id: number; x: number; y: number; at: number };
const emptyResult = { score: 0, shots: 0, hits: 0, errors: 0 };

export function Tiro2050Game() {
  const [scene, setScene] = useState(0);
  const [players, setPlayers] = useState(1);
  const [loadouts, setLoadouts] = useState<Loadout[]>(() => operators.map((_, operator) => ({ ...initialLoadout, operator })));
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'round' | 'between' | 'results'>('setup');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result>(emptyResult);
  const [results, setResults] = useState<Result[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [casings, setCasings] = useState<Casing[]>([]);
  const [fallen, setFallen] = useState<number[]>([]);
  const [aim, setAim] = useState(initialAim);
  const [zoom, setZoom] = useState(initialZoom);
  const [reloadEnd, setReloadEnd] = useState(0);
  const rangeRef = useRef<HTMLDivElement>(null);
  const ejectPortRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<{ clientX: number; clientY: number } | null>(null);
  const round = useRef({ start: 0, lastShot: -Infinity, reloadUntil: 0, result: emptyResult, fallen: new Set<number>() });
  const loadout = loadouts[turn];
  const primary = primaries[loadout.primary];
  const secondary = secondaries[loadout.secondary];
  const ammo = getAmmo(primary.ammo, secondary.ammo, result.shots);
  const activeSlot = ammo[0].remaining > 0 ? 0 : 1;
  const weapon = [primary, secondary][activeSlot];
  const zoomLimit = weapon.art === 2 ? 4 : weapon.art === 1 ? 2.2 : 1;
  const zoomValue = Math.min(zoomLimit, zoom.value);
  const primaryName = `${primaryTypes[loadout.primary]} ${primaryVariants[loadout.primary][loadout.variant]}`;
  const primaryDesign = loadout.primary * 5 + loadout.variant;
  const weaponImage = activeSlot === 0 ? `variante-${primaryDesign}.png` : `primera-persona-${weapon.art}.png`;
  const graphics = weaponGraphics[weapon.art];
  const tip = activeSlot === 0 ? primaryTips[primaryDesign] : graphics.tip;
  const weaponBottom = activeSlot === 0 ? 2 : -10;
  const weaponX = 55 + (aim.x - 50) * (activeSlot === 0 ? .49 : .68);
  const aimAngle = Math.atan2((aim.x - weaponX) * aim.aspect, Math.max(10, 100 - weaponBottom - aim.y));
  const muzzleAngle = Math.atan2(tip[0] - .5, 1 - tip[1]);
  const rotation = (aimAngle - muzzleAngle) * 180 / Math.PI;
  const reloading = elapsed < reloadEnd;
  const wave = Math.floor(elapsed / WAVE_MS);
  const targetsHiding = elapsed % WAVE_MS >= TARGET_RISE_MS + TARGET_VISIBLE_MS;
  const clock = Math.ceil((ROUND_MS - elapsed) / 1000);
  const tint = colors[loadout.operator];

  useEffect(() => {
    if (phase !== 'round') return;
    let frame = 0;
    const tick = (now: number) => {
      const time = Math.max(0, now - round.current.start);
      if (time >= ROUND_MS) {
        setElapsed(ROUND_MS);
        const completed = round.current.result;
        setResults(previous => [...previous, completed]);
        setPhase(turn + 1 < players ? 'between' : 'results');
        return;
      }
      setElapsed(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, players, turn]);

  function start(player: number) {
    round.current = { start: performance.now(), lastShot: -Infinity, reloadUntil: 0, result: emptyResult, fallen: new Set() };
    setTurn(player);
    setElapsed(0);
    setResult(emptyResult);
    setFallen([]);
    setImpact(null);
    setCasings([]);
    setAim(initialAim);
    setZoom(initialZoom);
    trigger.current = null;
    setReloadEnd(0);
    setPhase('round');
  }

  function configure(player: number, changes: Partial<Loadout>) {
    setLoadouts(previous => previous.map((value, index) => index === player ? { ...value, ...changes } : value));
  }

  function point({clientX, clientY}: { clientX: number; clientY: number }, bounds: DOMRect) {
    return { x: (clientX - bounds.left) / bounds.width * 100, y: (clientY - bounds.top) / bounds.height * 100, aspect: bounds.width / bounds.height };
  }

  function fireAt(clientX: number, clientY: number) {
    const range = rangeRef.current;
    if (!range || phase !== 'round') return;
    const bounds = range.getBoundingClientRect();
    const shot = point({ clientX, clientY }, bounds);
    setAim(shot);
    const live = round.current;
    const now = performance.now();
    const shots = live.result.shots;
    const onPrimary = shots < primary.ammo;
    const activeWeapon = onPrimary ? primary : secondary;
    const time = now - live.start;
    if (time >= ROUND_MS || now < live.reloadUntil || shots >= primary.ammo + secondary.ammo || now - live.lastShot < activeWeapon.cooldown) return;
    live.lastShot = now;
    playRifleShot();
    const ejectPort = ejectPortRef.current?.getBoundingClientRect();
    if (ejectPort) {
      const position = point({ clientX: ejectPort.x, clientY: ejectPort.y }, bounds);
      setCasings(previous => [...previous.filter(casing => time - casing.at < 520), { id: shots, x: position.x, y: position.y, at: time }]);
    }
    const used = (onPrimary ? shots : shots - primary.ammo) + 1;
    if (used < activeWeapon.ammo && used % activeWeapon.magazine === 0) {
      live.reloadUntil = now + RELOAD_MS;
      setReloadEnd(time + RELOAD_MS);
      playReload();
    } else if (activeWeapon.art === 2 && used < activeWeapon.ammo) playBolt();
    if (onPrimary && used === primary.ammo) setZoom(initialZoom);

    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-zone]');
    const id = Number(element?.dataset.target);
    const liveWave = Math.floor((now - live.start) / WAVE_MS);
    const waveTime = (now - live.start) % WAVE_MS;
    const target = liveWave === wave && waveTime >= TARGET_RISE_MS && waveTime < TARGET_RISE_MS + TARGET_VISIBLE_MS
      ? getWave(scene, wave).find(card => card.visible && card.id === id && !live.fallen.has(id))
      : undefined;
    const zone = element?.dataset.zone === 'head' ? 'head' : 'chest';
    const value = target ? scoreImpact(target.kind, zone) : null;
    if (target) {
      live.fallen.add(id);
      setFallen([...live.fallen]);
    }
    live.result = {
      score: live.result.score + (value ?? 0),
      shots: shots + 1,
      hits: live.result.hits + Number(value !== null && value > 0),
      errors: live.result.errors + Number(value === -10),
    };
    setResult(live.result);
    setImpact({ id: shots, value, ...shot, at: time, art: activeWeapon.art });
  }

  function aimAt(event: PointerEvent<HTMLDivElement>) {
    const {clientX, clientY} = event;
    if (trigger.current) trigger.current = {clientX, clientY};
    setAim(point(event, event.currentTarget.getBoundingClientRect()));
  }

  function zoomBy(factor: number, focus = aim) {
    setZoom(previous => {
      const value = Math.min(zoomLimit, Math.max(1, previous.value * factor));
      if (value === 1) return initialZoom;
      const scale = value / previous.value;
      const anchor = (position: number, origin: number) => ((1 - scale) * position + scale * (1 - previous.value) * origin) / (1 - value);
      return { value, x: anchor(focus.x, previous.x), y: anchor(focus.y, previous.y) };
    });
  }

  const repeatShot = useEffectEvent(() => {
    if (weapon.art === 1 && trigger.current) fireAt(trigger.current.clientX, trigger.current.clientY);
  });
  const scrollZoom = useEffectEvent((event: WheelEvent, range: HTMLDivElement) => {
    if (zoomLimit <= 1) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18, point(event, range.getBoundingClientRect()));
  });

  useEffect(() => {
    const range = rangeRef.current;
    if (phase !== 'round' || !range) return;
    const wheel = (event: WheelEvent) => scrollZoom(event, range);
    const release = () => { trigger.current = null; };
    range.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    const timer = window.setInterval(() => repeatShot(), 20);
    return () => {
      window.clearInterval(timer);
      range.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      release();
    };
  }, [phase]);

  const ranking = results.map((stats, index) => ({ ...stats, index })).sort((a, b) => b.score - a.score);
  const recentShot = impact && elapsed - impact.at < 580 ? impact : null;
  const recoil = recentShot && elapsed - recentShot.at < (recentShot.art === 2 ? 215 : 83);

  return <section className={`tiro2050${phase === 'round' ? ' tiro2050--round' : ''}`} style={{ '--tiro-accent': tint } as CSSProperties}>
    <div className="tiro-top">
      <Link to="/juegos">MiniJuegos</Link>
      <h1>Tiro al Blanco <em>2050</em></h1>
      {phase !== 'setup' && <button type="button" onClick={() => setPhase('setup')}>Menú</button>}
    </div>

    {phase === 'setup' && <div className="tiro-setup">
      <fieldset className="tiro-scenes">
        <legend>Escenario</legend>
        {scenes.map((name, i) => <button key={name} type="button" aria-pressed={scene === i} onClick={() => setScene(i)}>
          <img src={art(`escenario-${i}.jpg`)} alt="" />{name}
        </button>)}
      </fieldset>
      <img className="tiro-scene-preview" src={art(`escenario-${scene}.jpg`)} alt={`Vista del escenario: ${scenes[scene]}`} />
      <div className="tiro-brief">
        <p>Rondas de 3 minutos. Alien: cabeza +10 · pecho +5. Rehén o civil −10.</p>
        <label>Jugadores locales <select value={players} onChange={event => setPlayers(Number(event.target.value))}>
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
              {primaries.map((item, i) => <option key={item.name} value={i}>{primaryTypes[i]} · {item.ammo}</option>)}
            </select></label>
            <label>Diseño <select value={selection.variant} onChange={event => configure(index, { variant: Number(event.target.value) })}>
              {primaryVariants[selection.primary].map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select></label>
            <label>Arma de reserva <select value={selection.secondary} onChange={event => configure(index, { secondary: Number(event.target.value) })}>
              {secondaries.map((item, i) => <option key={item.name} value={i}>{item.name} · {item.ammo}</option>)}
            </select></label>
          </div>
          <div className="tiro-armory" aria-hidden="true">
            <img src={art(`variante-${selection.primary * 5 + selection.variant}.png`)} alt="" />
            <img src={art(`primera-persona-${secondaries[selection.secondary].art}.png`)} alt="" />
          </div>
        </fieldset>)}
      </div>
      <button className="tiro-action" type="button" onClick={() => { setResults([]); start(0); }}>Empezar ronda</button>
    </div>}

    {phase === 'round' && <>
      <div className="tiro-hud">
        <span><b>{operators[loadout.operator]}</b> · Jugador {turn + 1}</span>
        <span><b>{result.score}</b> pts</span>
        <time aria-label="Tiempo restante">{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, '0')}</time>
      </div>
      <div className="tiro-ammo" aria-label="Munición disponible y gastada">
        {[primary, secondary].map((item, index) => <div key={item.name} className={index === activeSlot ? 'tiro-ammo-active' : undefined}>
          <span>{index === 0 ? `Principal · ${primaryName}` : `Reserva · ${item.name}`}</span>
          <strong>{ammo[index].remaining}/{ammo[index].used}</strong>
        </div>)}
        <small>Disponibles / gastadas</small>
        {zoomLimit > 1 && <div className="tiro-zoom" aria-label="Zoom de la mira">
          <button type="button" aria-label="Alejar la mira" disabled={zoomValue <= 1} onClick={() => zoomBy(1 / 1.35)}>−</button>
          <output>{zoomValue.toFixed(1)}×</output>
          <button type="button" aria-label="Acercar la mira" disabled={zoomValue >= zoomLimit} onClick={() => zoomBy(1.35)}>+</button>
        </div>}
      </div>
      <div ref={rangeRef} className="tiro-range" aria-label={scenes[scene]} onPointerMove={aimAt} onPointerLeave={() => { trigger.current = null; }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          if (weapon.art === 1) trigger.current = { clientX: event.clientX, clientY: event.clientY };
          fireAt(event.clientX, event.clientY);
        }}>
        {reloading && <strong className="tiro-reload-label" role="status">Recargando…</strong>}
        <div className="tiro-world" style={{ transform: `scale(${zoomValue})`, transformOrigin: `${zoom.x}% ${zoom.y}%` }}>
        <img className="tiro-backdrop" src={art(`escenario-${scene}.jpg`)} alt="" draggable={false} />
        {getWave(scene, wave).map((card, slot) => <div className={`tiro-cover${card.y <= 64 ? ' tiro-cover--far' : card.y >= 90 ? ' tiro-cover--near' : ''}`} key={slot}
          style={{ left: `${card.x}%`, top: `${card.y}%`, width: `${card.width}%` }}>
          {card.visible && <div className="tiro-reveal">
            <div key={card.id} className={`tiro-target${card.kind === 'alien' ? ' tiro-target--alien' : ''}${fallen.includes(card.id) ? ' tiro-target--fallen' : targetsHiding ? ' tiro-target--hide' : ''}`}>
              <img src={art(`${card.kind === 'alien' ? 'alien' : 'silueta'}-${card.art}.png`)} alt={card.kind} draggable={false} />
              <span className="tiro-zone tiro-zone--head" data-zone="head" data-target={card.id} />
              <span className="tiro-zone tiro-zone--chest" data-zone="chest" data-target={card.id} />
            </div>
          </div>}
          <img className="tiro-obstacle" src={art(`cobertura-${card.cover}.png`)} alt="" draggable={false} />
        </div>)}
        </div>
        <div className={`tiro-mira${zoomValue > 1 ? ' tiro-mira--zoom' : ''}`} style={{ left: `${aim.x}%`, top: `${aim.y}%` }} aria-hidden="true" />
        <div className={`tiro-weapon${activeSlot === 0 ? ' tiro-weapon--long' : ''}`} style={{
          left: `${weaponX}%`,
          '--tiro-weapon-bottom': `${weaponBottom}%`,
          '--tiro-weapon-angle': `${rotation}deg`,
          '--tiro-weapon-light': graphics.color,
          '--tiro-tip-x': `${tip[0] * 100}%`,
          '--tiro-tip-y': `${tip[1] * 100}%`,
          '--tiro-light-x': `${graphics.light[0]}%`,
          '--tiro-light-y': `${graphics.light[1]}%`,
          '--tiro-reload-duration': `${RELOAD_MS}ms`,
        } as CSSProperties} aria-hidden="true">
          <div className={reloading ? 'tiro-weapon--reloading' : recoil ? `tiro-weapon--recoil tiro-recoil-${recentShot.art}` : undefined}>
            <img className="tiro-weapon-art" alt="" draggable={false} src={art(weaponImage)} />
            <span ref={ejectPortRef} className="tiro-eject-port" />
            {activeSlot === 1 && <span className="tiro-weapon-lights" />}
            {recentShot && elapsed - recentShot.at < 110 && <span key={recentShot.id} className="tiro-muzzle-flash" />}
            {reloading && <img className="tiro-reload-hand" src={art('mano-recarga.png')} alt="" draggable={false} />}
          </div>
        </div>
        {casings.filter(casing => elapsed - casing.at < 520).map(casing => <span key={casing.id} className="tiro-casing" aria-hidden="true"
          style={{ left: `${casing.x}%`, top: `${casing.y}%`, '--tiro-casing-drift': `${(casing.id % 3 + 2) * 17}px` } as CSSProperties} />)}
        {recentShot && recentShot.value !== null && <span key={`flash-${recentShot.id}`} aria-hidden="true"
          className={`tiro-hit-flash${recentShot.value < 0 ? ' tiro-hit-flash--civil' : ''}`} />}
        {recentShot && <span key={recentShot.id} className="tiro-impact" style={{ left: `${recentShot.x}%`, top: `${recentShot.y}%` }}>
          {recentShot.value === null ? '·' : recentShot.value > 0 ? `+${recentShot.value}` : '−10'}
        </span>}
      </div>
      <p className="tiro-hint">{ammo[activeSlot].remaining === 0 ? 'Munición agotada. La ronda termina al vencer el reloj.' : 'Hacé clic o tocá un blanco para disparar. La reserva se activa al agotar el arma principal.'}</p>
    </>}

    {(phase === 'between' || phase === 'results') && <div className="tiro-results">
      <h2>{phase === 'between' ? 'Cambio de jugador' : 'Resultados'}</h2>
      {phase === 'results' && players > 1 && <p>{ranking[0].score === ranking[1].score ? 'Empate en el primer puesto' : `Ganó el jugador ${ranking[0].index + 1}`}</p>}
      <ol>{ranking.map(entry => <li key={entry.index}>
        <strong>Jugador {entry.index + 1} · {operators[loadouts[entry.index].operator]}</strong>
        <b>{entry.score} pts</b>
        <span>{entry.hits} aciertos · {entry.errors} impactos a inocentes · {entry.shots} tiros</span>
      </li>)}</ol>
      {phase === 'between'
        ? <button type="button" className="tiro-action" onClick={() => start(turn + 1)}>Jugar turno {turn + 2}</button>
        : <button type="button" className="tiro-action" onClick={() => setPhase('setup')}>Nueva partida</button>}
    </div>}
  </section>;
}
