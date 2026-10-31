import { Link } from 'react-router-dom';
import { playStart } from './sounds';
import blocksCover from './assets/portada-bloques.webp';
import lavaCover from './assets/portada-lava.webp';
import trepaCover from './assets/portada-trepaluna.webp';
import sharkCover from './assets/tiburon-portada.webp';
import terminatorCover from './assets/terminator-portada.webp';
import invasionCover from './assets/portada-invasion.webp';
import gravityCover from './assets/portada-gravedad.webp';
import kombatCover from './assets/portada-kombat.webp';
import vampCover from './assets/portada-vampyrium.webp';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunnerGame';
import { formatTime, readTrepaRecord } from './TrepalunaGame';
import { formatLavaTime, readLavaRecord } from './LavaFloor';
import { readPaperRecord } from './PaperBallGame';
import { formatSharkTime, readSharkRecord } from './SharkCity';
import { formatInvasionTime, readInvasionRecord } from './InvasionGame';
import { formatGravityTime, readGravityRecord } from './GravitySwapGame';
import { readKombatRecord } from './KombatFootballGame';
import { readVampyriumRecord } from './VampyriumGame';
import { formatVampTime } from './vampyrium';
import memeJigsaw from '../../assets/images/meme-jigsaw.jpg';

// Portadas de las tarjetas: una captura de cada juego en plena acción.
function Cover({ src }: { src: string }) {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <image href={src} x="0" y="0" width="160" height="100" preserveAspectRatio="xMidYMid slice" />
  </svg>;
}

export function Games() {
  const record = readRecord();
  const trepa = readTrepaRecord();
  const lava = readLavaRecord();
  const shark = readSharkRecord();
  const paper = readPaperRecord();
  const invasion = readInvasionRecord();
  const gravity = readGravityRecord();
  const kombat = readKombatRecord();
  const vamp = readVampyriumRecord();
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
      <li>
        <Link onClick={playStart} className="game-card game-card--kf" to="/juegos/kombat">
          <Cover src={kombatCover} />
          <span className="game-card-text">
            <strong>Kombat Football</strong>
            <span>☠️ Fútbol 1 contra 1 al estilo Mortal Kombat: patadas, poderes de fuego, hielo, veneno, rayo y oscuridad, y escenarios llenos de peligros.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Meté más goles que el rival en dos tiempos de 1:30 (si empatan, gol de oro). Con la barra llena tirá el FATAL GOAL. En el torneo, subí la escalera ganándole a los 15 rivales, uno por uno.</span>
          </span>
          <span className="game-card-foot">
            {kombat.wins + kombat.losses > 0 && <small><b>Récord</b>{kombat.cups ? `🏆 ${kombat.cups} · ` : ''}{kombat.wins}G {kombat.losses}P</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--vamp" to="/juegos/vampyrium">
          <Cover src={vampCover} />
          <span className="game-card-text">
            <strong>Vampyrium</strong>
            <span>🧛 Sos un cazador de vampiros en el puente de un castillo maldito: espada, estacas y una cruz sagrada contra vampiros que caminan, trepan del vacío y vuelan en picada.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Matá 50 vampiros sin quedarte sin vida y cruzá la puerta que se abre a la derecha. Cuidado con los huecos al vacío y las trampas.</span>
          </span>
          <span className="game-card-foot">
            {vamp.kills > 0 && <small><b>Récord</b>{vamp.time ? `🏆 en ${formatVampTime(vamp.time)}` : `${vamp.kills} vampiros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
    </ul>
  </section>;
}
