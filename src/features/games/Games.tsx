import { Link } from 'react-router-dom';
import { playStart } from './sounds';
import blocksCover from './assets/portada-bloques.webp';
import soccerCover from './assets/portada-futbol.webp';
import lavaCover from './assets/portada-lava.webp';
import snakeCover from './assets/portada-serpiente.webp';
import solitaireCover from './assets/portada-solitario.webp';
import trepaCover from './assets/portada-trepaluna.webp';
import sharkCover from './assets/tiburon-portada.webp';
import terminatorCover from './assets/terminator-portada.webp';
import invasionCover from './assets/portada-invasion.webp';
import gravityCover from './assets/portada-gravedad.webp';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunnerGame';
import { readSolitaireRecord } from './PixelSolitaire';
import { readTikiRecord } from './TikiTakaGame';
import { formatTime, readTrepaRecord } from './TrepalunaGame';
import { readSnakeRecord } from './ReverseSnakeGame';
import { formatLavaTime, readLavaRecord } from './LavaFloor';
import { readPaperRecord } from './PaperBallGame';
import { formatSharkTime, readSharkRecord } from './SharkCity';
import { formatInvasionTime, readInvasionRecord } from './InvasionGame';
import { formatGravityTime, readGravityRecord } from './GravitySwapGame';
import memeJigsaw from '../../assets/images/meme-jigsaw.jpg';

// Portadas de las tarjetas: una captura de cada juego en plena acción.
function Cover({ src }: { src: string }) {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <image href={src} x="0" y="0" width="160" height="100" preserveAspectRatio="xMidYMid slice" />
  </svg>;
}

export function Games() {
  const record = readRecord();
  const solitaire = readSolitaireRecord();
  const tiki = readTikiRecord();
  const trepa = readTrepaRecord();
  const snake = readSnakeRecord();
  const lava = readLavaRecord();
  const shark = readSharkRecord();
  const paper = readPaperRecord();
  const invasion = readInvasionRecord();
  const gravity = readGravityRecord();
  return <section className="games-page">
    <div className="section-title games-title">
      <div className="games-heading"><p className="eyebrow">Para cortar un rato</p><h1>MiniJuegos</h1><p className="games-byline">By YEYO</p></div>
      <div className="games-art" aria-hidden="true"><img src={memeJigsaw} alt="" width={1200} height={666} draggable={false} /></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /><CalendarLink /></SectionObjects>
    </div>
    <ul className="games-list">
      <li>
        <Link onClick={playStart} className="game-card" to="/juegos/bloques">
          <Cover src={blocksCover} />
          <span className="game-card-text">
            <strong>¡Cuidado, bloques!</strong>
            <span>🧱 Caen piezas de Tetris y bombas: corré y saltá para que no te aplasten.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Superá los 10 niveles (5 minutos) sin que te caiga una pieza encima, te explote una bomba o la pila llegue arriba.</span>
          </span>
          {/* El récord va siempre en el mismo lugar: abajo, a la izquierda de Jugar. */}
          <span className="game-card-foot">
            {record > 0 && <small><b>Récord</b>{record} puntos</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--fut" to="/juegos/solitario">
          <Cover src={solitaireCover} />
          <span className="game-card-text">
            <strong>Solitario 3.000</strong>
            <span>🃏 El solitario de siempre, con cartas del futuro.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Llevá las cuatro pilas completas arriba, del as al rey. Cuanto más rápido, más puntos.</span>
          </span>
          <span className="game-card-foot">
            {solitaire && <small><b>Récord</b>{solitaire.score !== undefined ? `${solitaire.score} puntos` : `${Math.floor(solitaire.seconds / 60)}:${String(solitaire.seconds % 60).padStart(2, '0')}`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--tt" to="/juegos/futbol">
          <Cover src={soccerCover} />
          <span className="game-card-text">
            <strong>Tiki-Taka</strong>
            <span>⚽ Armá tu equipo y tocá para pasar la pelota hasta llegar al área y patear al arco.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Meté más goles que el rival. En el Mundial, encadená victorias (los empates van a penales) hasta salir campeón.</span>
          </span>
          <span className="game-card-foot">
            {tiki.played > 0 && <small><b>Campaña</b>{tiki.won}G {tiki.drawn}E {tiki.lost}P{tiki.cups ? ` · 🏆 ${tiki.cups}` : ''}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--trepa" to="/juegos/trepaluna">
          <Cover src={trepaCover} />
          <span className="game-card-text">
            <strong>Trepaluna</strong>
            <span>🌙 Un juego de plataformas para arriba: trepá y esquivá obstáculos hasta cruzar las nubes y el espacio.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Llegá a la Luna y clavá el banderín sin quemarte ni caerte.</span>
          </span>
          <span className="game-card-foot">
            {trepa.height > 0 && <small><b>Récord</b>{trepa.time !== null ? `Luna en ${formatTime(trepa.time)}` : `${trepa.height.toLocaleString('es-AR')} metros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--snk" to="/juegos/serpiente">
          <Cover src={snakeCover} />
          <span className="game-card-text">
            <strong>¡Huye de la serpiente!</strong>
            <span>🐍 El viborita de siempre, pero vos sos la manzana: esquivá a la serpiente mientras juntás bolitas.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sumá la mayor cantidad de puntos posible antes de que la serpiente te atrape.</span>
          </span>
          <span className="game-card-foot">
            {snake > 0 && <small><b>Récord</b>{snake} puntos</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--lava" to="/juegos/lava">
          <Cover src={lavaCover} />
          <span className="game-card-text">
            <strong>¡El piso es de lava!</strong>
            <span>🌋 La lava sube sin parar: subí de edificio en edificio lo más rápido que puedas.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Subite al helicóptero antes de que te alcance: seguí la flecha a los 6 helipuertos.</span>
          </span>
          <span className="game-card-foot">
            {lava.height > 0 && <small><b>Récord</b>{lava.time !== null ? `🚁 en ${formatLavaTime(lava.time)}` : `${lava.height} metros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--bol" to="/juegos/cesto">
          <Cover src={terminatorCover} />
          <span className="game-card-text">
            <strong>SkynetBall</strong>
            <span>🤖 Sos un T-800 tirando humanos en miniatura al tacho, con el mouse y cada vez desde más lejos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sumá la mayor cantidad de puntos en 4 cuartos de 2 minutos.</span>
          </span>
          <span className="game-card-foot">
            {paper > 0 && <small><b>Récord</b>{paper} puntos</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--tib" to="/juegos/tiburon">
          <Cover src={sharkCover} />
          <span className="game-card-text">
            <strong>Ciudad Tiburón</strong>
            <span>🦈 La ciudad se inundó y está llena de tiburones. Sos el héroe que rescata a las personas, perros y gatos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Rescatá a 20 que flotan en el agua antes de los 10 minutos, sin que te coma un tiburón.</span>
          </span>
          <span className="game-card-foot">
            {shark.saved > 0 && <small><b>Récord</b>{shark.time !== null ? `🏆 en ${formatSharkTime(shark.time)}` : `${shark.saved} rescatados`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--inv" to="/juegos/invasion">
          <Cover src={invasionCover} />
          <span className="game-card-text">
            <strong>Invasión</strong>
            <span>👽 Sos francotirador en una ciudad invadida por aliens disfrazados de personas: recorré la cuadra y apuntá bien.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Eliminá a 20 aliens antes de los 10 minutos. Tenés solo 3 vidas: no le dispares a una persona.</span>
          </span>
          <span className="game-card-foot">
            {invasion.kills > 0 && <small><b>Récord</b>{invasion.time ? `🏆 en ${formatInvasionTime(invasion.time)}` : `${invasion.kills} aliens`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--grav" to="/juegos/gravedad">
          <Cover src={gravityCover} />
          <span className="game-card-text">
            <strong>Gravity Swap</strong>
            <span>🚀 Sos un astronauta que flota por 10 escenarios llenos de trampas. La gravedad gira sola (y la pantalla con ella), y te movés con chorros del oxígeno de tu tanque.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Llegá al portal del final de cada escenario hasta completar la Luna. Tenés 3 vidas por escenario.</span>
          </span>
          <span className="game-card-foot">
            {(gravity.unlocked > 1 || gravity.time !== null) && <small><b>Récord</b>{gravity.time !== null ? `🏆 en ${formatGravityTime(gravity.time)}` : `Escenario ${gravity.unlocked}/10`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
    </ul>
  </section>;
}
