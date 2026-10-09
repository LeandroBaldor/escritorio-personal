import { useEffect, useState } from 'react';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// La fecha de hoy al lado del reloj: una tira de papel cuadriculado, rota en los bordes y pegada con cinta, con
// la fecha escrita a mano, el número del día encerrado en un círculo rojo y el mes subrayado. Se actualiza sola
// al pasar la medianoche.
export function HeaderDate() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => { setToday(new Date()); schedule(); }, next.getTime() - now.getTime() + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return <time className="paper-date" dateTime={iso}>
    <span className="paper-date-text">{DAYS[today.getDay()]} <span className="paper-date-day">{today.getDate()}<svg className="paper-date-circle" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M58 6C30 2 6 12 5 30s24 27 48 26 43-9 42-27S70 3 44 7" /></svg></span> de <span className="paper-date-month">{MONTHS[today.getMonth()]}<svg className="paper-date-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6c20-3 45-4 70-3s20 1 26 2" /></svg></span> {today.getFullYear()}</span>
  </time>;
}
