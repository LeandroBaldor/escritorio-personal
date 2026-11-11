import type { ReactNode } from 'react';

export function Vampyium2Decision({ defeated, portrait, onContinue, onRetry, onMenu }: {
  defeated: boolean; portrait?: ReactNode; onContinue: () => void; onRetry: () => void; onMenu: () => void;
}) {
  return <div className="vamp-decision-panel">
    <i className="vamp-rivet vamp-rivet--tl" aria-hidden="true" /><i className="vamp-rivet vamp-rivet--tr" aria-hidden="true" />
    <i className="vamp-rivet vamp-rivet--bl" aria-hidden="true" /><i className="vamp-rivet vamp-rivet--br" aria-hidden="true" />
    <h2 id="vamp-message">{defeated ? 'Fin del intento' : 'Pausa'}</h2>
    {portrait && <figure className="vamp-defeat-portrait" aria-label="Demian, herido">{portrait}</figure>}
    <div className="vamp-decision-actions">
      <button type="button" className="vamp-decision-primary" onClick={defeated ? onRetry : onContinue} autoFocus>{defeated ? 'Volver a intentar' : 'Seguir'}</button>
      <button type="button" className="vamp-decision-menu" onClick={onMenu}>Volver al Menú</button>
    </div>
  </div>;
}
