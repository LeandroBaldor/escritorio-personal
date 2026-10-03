import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Accesos a otras secciones dibujados como objetos del escritorio.
export function SectionObjects({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return <nav className={large ? 'section-objects section-objects--large' : 'section-objects'} aria-label="Ir a otras secciones">{children}</nav>;
}

export function DeskLink() {
  return <Link className="desk-object" to="/" aria-label="Mi Escritorio" title="Mi Escritorio"><svg viewBox="0 0 120 84" aria-hidden="true"><path d="M30 14h4l9 20h-4z" fill="#3a2a20"/><path d="M22 10h18l-3 7H25z" fill="#f4bd58"/><rect x="58" y="18" width="34" height="16" rx="2" fill="#fff4dc" transform="rotate(-6 75 26)"/><rect x="4" y="34" width="112" height="10" rx="3" fill="#8c5738"/><rect x="4" y="34" width="112" height="3" rx="1.5" fill="#b07a52"/><rect x="10" y="44" width="7" height="38" fill="#603c29"/><rect x="103" y="44" width="7" height="38" fill="#603c29"/><rect x="66" y="44" width="40" height="26" fill="#75452d"/><rect x="70" y="48" width="32" height="8" rx="1.5" fill="#8c5738"/><rect x="70" y="59" width="32" height="8" rx="1.5" fill="#8c5738"/><circle cx="86" cy="52" r="1.6" fill="#f4bd58"/><circle cx="86" cy="63" r="1.6" fill="#f4bd58"/></svg><strong>Escritorio</strong></Link>;
}

export function CalculatorLink() {
  return <Link className="calc-object" to="/gastos" aria-label="Gastos" title="Gastos"><span aria-hidden="true">7 8 9<br />4 5 6<br />1 2 3</span><strong>Gastos</strong></Link>;
}

export function NotebookLink() {
  return <Link className="notebook" to="/diario" aria-label="Mi diario" title="Mi diario"><span className="notebook-binding" aria-hidden="true" /><span>Mi diario</span></Link>;
}
