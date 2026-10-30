// El joystick de las pantallas táctiles: a la izquierda un panel con el botón de acción (lo que hace la barra
// espaciadora) y a la derecha otro panel con la cruz de flechas. Flotan sobre la cancha en las esquinas de abajo.
// Cada juego le pasa su `hold` (aprieta mientras el dedo está apoyado) y qué hace cada flecha.
import type { ReactNode } from 'react';

type Hold = Record<string, unknown>;
type Dir = 'up' | 'down' | 'left' | 'right';
const ARROW: Record<Dir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };

export function GamePad({ action, actionLabel, dirs, extra, className = '' }: {
  action: { hold: Hold; label: string; aria?: string };
  actionLabel?: ReactNode;
  dirs: Partial<Record<Dir, { hold: Hold; aria: string }>>;
  extra?: ReactNode;
  className?: string;
}) {
  return <div className={`runner-pad gpad ${className}`} aria-label="Controles">
    <div className="gpad-panel gpad-panel--left">
      <button type="button" className="runner-jump gpad-a" aria-label={action.aria ?? action.label} {...action.hold}>
        <span>{actionLabel ?? action.label}</span>
      </button>
      {extra}
    </div>
    <div className="gpad-panel gpad-panel--right">
      <div className="gpad-cross">
        {(['up', 'left', 'right', 'down'] as Dir[]).map(d => {
          const b = dirs[d];
          return b
            ? <button key={d} type="button" className={`gpad-dir gpad-dir--${d}`} aria-label={b.aria} {...b.hold}>{ARROW[d]}</button>
            : <i key={d} className={`gpad-dir gpad-dir--${d} gpad-dir--off`} aria-hidden="true" />;
        })}
        <i className="gpad-hub" aria-hidden="true" />
      </div>
    </div>
  </div>;
}
