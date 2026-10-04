import { KeyboardEvent, PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Operator = '+' | '−' | '×' | '÷';
type Position = { x: number; y: number };

const MAX_DIGITS = 15;
// Redondea para esconder errores de coma flotante (0,1 + 0,2 = 0,3).
const formatNumber = (value: number) => String(parseFloat(value.toPrecision(12)));
const showNumber = (value: string) => value.replace('.', ',');
const compute = (left: number, right: number, operator: Operator) => {
  if (operator === '+') return left + right;
  if (operator === '−') return left - right;
  if (operator === '×') return left * right;
  return right === 0 ? NaN : left / right;
};
const keyOperators: Record<string, Operator> = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷' };

// Mantiene la calculadora entera dentro de la ventana.
const clamp = (position: Position, panel: HTMLElement | null): Position => {
  const width = panel?.offsetWidth ?? 0, height = panel?.offsetHeight ?? 0;
  return {
    x: Math.max(0, Math.min(position.x, window.innerWidth - width)),
    y: Math.max(0, Math.min(position.y, window.innerHeight - height)),
  };
};

function CalculatorPanel({ position, onMove, onClose }: { position: Position | null; onMove: (position: Position) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [fresh, setFresh] = useState(true);
  const error = display === 'Error';

  // La primera vez que se abre aparece en el medio de la pantalla; después, donde se dejó.
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    onMove(clamp(position ?? { x: (window.innerWidth - element.offsetWidth) / 2, y: (window.innerHeight - element.offsetHeight) / 2 }, element));
    element.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const keepInside = () => { if (position) onMove(clamp(position, panel.current)); };
    window.addEventListener('resize', keepInside);
    return () => window.removeEventListener('resize', keepInside);
  }, [position, onMove]);

  const setResult = (value: number) => setDisplay(Number.isFinite(value) ? formatNumber(value) : 'Error');
  const digit = (value: string) => {
    if (fresh || error) { setDisplay(value); setFresh(false); return; }
    if (display.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
    setDisplay(display === '0' ? value : display + value);
  };
  const decimal = () => {
    if (fresh || error) { setDisplay('0.'); setFresh(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const chooseOperator = (next: Operator) => {
    if (error) return;
    const current = Number(display);
    if (stored !== null && operator && !fresh) {
      const result = compute(stored, current, operator);
      setResult(result);
      setStored(Number.isFinite(result) ? Number(formatNumber(result)) : null);
      setOperator(Number.isFinite(result) ? next : null);
    } else {
      setStored(current);
      setOperator(next);
    }
    setFresh(true);
  };
  const equals = () => {
    if (error || stored === null || !operator) return;
    setResult(compute(stored, Number(display), operator));
    setStored(null); setOperator(null); setFresh(true);
  };
  const clear = () => { setDisplay('0'); setStored(null); setOperator(null); setFresh(true); };
  const backspace = () => {
    if (fresh || error) return;
    const next = display.slice(0, -1);
    setDisplay(next === '' || next === '-' ? '0' : next);
  };
  const percent = () => { if (!error) { setResult(Number(display) / 100); setFresh(true); } };
  const toggleSign = () => { if (!error && display !== '0') setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display); };

  const onKeyDown = (event: KeyboardEvent) => {
    const { key } = event;
    if (/^\d$/.test(key)) digit(key);
    else if (key === ',' || key === '.') decimal();
    else if (keyOperators[key]) chooseOperator(keyOperators[key]);
    else if (key === 'Enter' || key === '=') equals();
    else if (key === 'Backspace') backspace();
    else if (key === 'Delete') clear();
    else if (key === '%') percent();
    else if (key === 'Escape') onClose();
    else return;
    event.preventDefault();
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button') || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    onMove(clamp({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, panel.current));
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; };

  const keys: [string, () => void, string?][] = [
    ['C', clear, 'pocket-calc-key--clear'], ['±', toggleSign], ['%', percent], ['÷', () => chooseOperator('÷'), 'pocket-calc-key--op'],
    ['7', () => digit('7')], ['8', () => digit('8')], ['9', () => digit('9')], ['×', () => chooseOperator('×'), 'pocket-calc-key--op'],
    ['4', () => digit('4')], ['5', () => digit('5')], ['6', () => digit('6')], ['−', () => chooseOperator('−'), 'pocket-calc-key--op'],
    ['1', () => digit('1')], ['2', () => digit('2')], ['3', () => digit('3')], ['+', () => chooseOperator('+'), 'pocket-calc-key--op'],
    ['⌫', backspace], ['0', () => digit('0')], [',', decimal], ['=', equals, 'pocket-calc-key--equals'],
  ];
  const keyLabels: Record<string, string> = { C: 'Borrar todo', '±': 'Cambiar signo', '%': 'Porcentaje', '÷': 'Dividir', '×': 'Multiplicar', '−': 'Restar', '+': 'Sumar', '=': 'Igual', '⌫': 'Borrar último dígito', ',': 'Coma decimal' };

  return createPortal(
    <div ref={panel} className="pocket-calc" role="dialog" aria-label="Calculadora" tabIndex={-1} onKeyDown={onKeyDown}
      style={position ? { left: position.x, top: position.y } : { visibility: 'hidden' }}>
      <div className="pocket-calc-bar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} title="Arrastrá para mover la calculadora">
        <span>Calculadora</span>
        <button type="button" className="pocket-calc-close" onClick={onClose} aria-label="Cerrar calculadora">×</button>
      </div>
      <div className="pocket-calc-screen">
        <small>{stored !== null && operator ? `${showNumber(formatNumber(stored))} ${operator}` : ' '}</small>
        <output aria-live="polite">{showNumber(display)}</output>
      </div>
      <div className="pocket-calc-keys">
        {keys.map(([label, action, className]) => <button type="button" key={label} className={`pocket-calc-key${className ? ` ${className}` : ''}`} aria-label={keyLabels[label]} onClick={action}>{label}</button>)}
      </div>
    </div>,
    document.body,
  );
}

// Ícono que abre una calculadora flotante que se puede arrastrar por la pantalla.
export function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  return <>
    <button type="button" className="pocket-calc-toggle" aria-expanded={open} title="Abrir o cerrar la calculadora" onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 48 64" aria-hidden="true"><rect x="2" y="2" width="44" height="60" rx="7" fill="#f2efe6" stroke="#7d6a55" strokeWidth="2.5"/><rect x="8" y="8" width="32" height="13" rx="2.5" fill="#9fc3a0"/><g fill="#e07a3f"><rect x="8" y="27" width="8" height="7" rx="2"/><rect x="20" y="27" width="8" height="7" rx="2"/></g><rect x="32" y="27" width="8" height="7" rx="2" fill="#1f6fe0"/><g fill="#b8ab98"><rect x="8" y="38" width="8" height="7" rx="2"/><rect x="20" y="38" width="8" height="7" rx="2"/><rect x="8" y="49" width="8" height="7" rx="2"/><rect x="20" y="49" width="8" height="7" rx="2"/></g><rect x="32" y="38" width="8" height="18" rx="2" fill="#1f6fe0"/></svg>
      <span>Calculadora</span>
    </button>
    {open && <CalculatorPanel position={position} onMove={setPosition} onClose={() => setOpen(false)} />}
  </>;
}
