// El control para pantallas táctiles en horizontal (como una consola portátil): el juego queda en el medio y a
// los costados dos agarraderas. Izquierda: un solo botón grande (lo que hace la barra espaciadora; en los menús
// elige la opción marcada: Jugar, el luchador, el escenario). Derecha: la cruz de flechas (en los menús mueve
// entre opciones), Pausa y Salir. Los botones "aprietan" las mismas teclas del teclado, así cada juego funciona
// igual que en la computadora. Se dibuja fuera del juego (no se achica con él).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { gripWidth } from './fitScreen';

const KEYS = { space: [' ', 'Space'], up: ['ArrowUp', 'ArrowUp'], down: ['ArrowDown', 'ArrowDown'], left: ['ArrowLeft', 'ArrowLeft'], right: ['ArrowRight', 'ArrowRight'], pause: ['p', 'KeyP'] } as const;
type K = keyof typeof KEYS;
type Dir = 'up' | 'down' | 'left' | 'right';
const ARROW: Record<Dir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
const LABEL: Record<Dir, string> = { up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha' };
const send = (type: 'keydown' | 'keyup', k: K) => { const [key, code] = KEYS[k]; const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }); document.dispatchEvent(ev); return ev; };

// El menú que está a la vista (pantalla de inicio, pausa, resultado, elegir luchador o escenario), si hay.
function openMenu(): HTMLElement | null {
  const list = document.querySelectorAll<HTMLElement>('.runner .runner-overlay, .runner .kf-select');
  for (const el of list) if (el.offsetParent !== null || getComputedStyle(el).position === 'fixed') return el;
  return null;
}
const buttons = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button:not([disabled]), a[href]')].filter(b => b.offsetParent !== null);
function choose(menu: HTMLElement) {
  const f = document.activeElement as HTMLElement | null;
  if (f && menu.contains(f) && (f.tagName === 'BUTTON' || f.tagName === 'A')) { f.click(); return; }
  const main = buttons(menu).filter(b => !b.classList.contains('kf-secondary') && !b.closest('.kf-grid, .kf-stagegrid'));
  (main[main.length - 1] ?? buttons(menu)[0])?.click();
}
function moveFocus(menu: HTMLElement, step: number) {
  const list = buttons(menu); if (!list.length) return;
  const i = list.indexOf(document.activeElement as HTMLButtonElement);
  const next = i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
  list[next].focus();
}

export function TouchGrips({ actionLabel = 'Acción', extra }: { actionLabel?: ReactNode; extra?: ReactNode }) {
  const [g, setG] = useState(gripWidth);
  useEffect(() => { const on = () => setG(gripWidth()); window.addEventListener('resize', on); window.addEventListener('orientationchange', on); return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); }; }, []);
  // La cruz es una sola superficie: el dedo puede deslizarse de una flecha a otra sin levantarse (y en diagonal
  // aprieta las dos). El centro no aprieta nada.
  const [on, setOn] = useState<Dir[]>([]);
  const pressed = useRef<Dir[]>([]);
  const setDirs = (next: Dir[]) => {
    const prev = pressed.current; if (prev.length === next.length && prev.every(d => next.includes(d))) return;
    for (const d of prev) if (!next.includes(d)) send('keyup', d);
    for (const d of next) if (!prev.includes(d)) {
      const menu = openMenu(); const ev = send('keydown', d);
      if (menu && !ev.defaultPrevented) moveFocus(menu, d === 'up' || d === 'left' ? -1 : 1); // el menú no usa flechas: mueve entre opciones
    }
    pressed.current = next; setOn(next);
  };
  const dirsAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = (e.clientX - r.left - r.width / 2) / (r.width / 2), ny = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const out: Dir[] = [], dead = 0.2;
    if (Math.abs(nx) > dead && Math.abs(nx) > Math.abs(ny) * 0.45) out.push(nx < 0 ? 'left' : 'right');
    if (Math.abs(ny) > dead && Math.abs(ny) > Math.abs(nx) * 0.45) out.push(ny < 0 ? 'up' : 'down');
    return out;
  };
  useEffect(() => () => { for (const d of pressed.current) send('keyup', d); }, []); // (si se cierra con una flecha apretada)
  const cross = {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDirs(dirsAt(e)); },
    onPointerMove: (e: React.PointerEvent) => { if (pressed.current.length || e.buttons) setDirs(dirsAt(e)); },
    onPointerUp: () => setDirs([]), onPointerCancel: () => setDirs([]), onLostPointerCapture: () => setDirs([]),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  if (!g || typeof document === 'undefined') return null;
  const hold = (k: K, menuStep = 0) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const menu = openMenu();
      if (k === 'space' && menu) { choose(menu); return; } // en un menú: elige
      const ev = send('keydown', k);
      if (menuStep && menu && !ev.defaultPrevented) moveFocus(menu, menuStep); // el menú no usa flechas: mueve entre opciones
    },
    onPointerUp: () => { send('keyup', k); }, onPointerCancel: () => { send('keyup', k); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const click = (sel: string) => () => (document.querySelector<HTMLElement>(sel))?.click();
  const style = { ['--grip' as string]: `${g}px` };
  return createPortal(<>
    <div className="grip grip--left" style={style} aria-label="Control: acción">
      <button type="button" className="grip-a" aria-label="Acción (barra espaciadora)" {...hold('space')}><span>{actionLabel}</span></button>
      {extra && <div className="grip-extra">{extra}</div>}
    </div>
    <div className="grip grip--right" style={style} aria-label="Control: flechas, pausa y salir">
      <div className="grip-cross" {...cross}>
        {(['up', 'left', 'right', 'down'] as Dir[]).map(d => <button key={d} type="button" tabIndex={-1} className={`grip-dir grip-dir--${d}${on.includes(d) ? ' grip-dir--on' : ''}`} aria-label={LABEL[d]}>{ARROW[d]}</button>)}
        <i className="grip-hub" aria-hidden="true" />
      </div>
      <div className="grip-small">
        <button type="button" className="grip-mini" aria-label="Pausa" onPointerDown={e => { e.preventDefault(); send('keydown', 'pause'); send('keyup', 'pause'); }}><span>⏸</span><small>Pausa</small></button>
        <button type="button" className="grip-mini" aria-label="Salir" onClick={click('.runner .runner-back')}><span>✕</span><small>Salir</small></button>
      </div>
    </div>
  </>, document.body);
}
