// El cartel grande del final de cualquier juego: "GANASTE!!!" o "GAME OVER" (es el título del cartel final).
export function EndBanner({ win, id }: { win: boolean; id?: string }) {
  return <h2 id={id} className={`end-banner end-banner--${win ? 'win' : 'over'}`}>{win ? 'GANASTE!!!' : 'GAME OVER'}</h2>;
}
