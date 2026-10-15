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
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { readSolitaireRecord } from './PixelSolitaire';
import { readTikiRecord } from './TikiTaka';
import { formatTime, readTrepaRecord } from './Trepaluna';
import { readSnakeRecord } from './ReverseSnake';
import { formatLavaTime, readLavaRecord } from './LavaFloor';
import { readPaperRecord } from './PaperBall';
import { formatSharkTime, readSharkRecord } from './SharkCity';
import { formatInvasionTime, readInvasionRecord } from './Invasion';
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
            <span>Caen piezas de Tetris y bombas desde arriba. Corré y saltá para que no te aplasten: las piezas rompen los bloques de su mismo color y las demás se apilan y te sirven de escalones. Las bombas explotan al llegar, y si quedás encerrado tenés 10 segundos para salir.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Superá los 10 niveles de 30 segundos (5 minutos) sin que una pieza te caiga en la cabeza, te explote una bomba, quedes encerrado o la pila llegue arriba.</span>
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
            <span>El solitario de siempre, con cartas del futuro. Ordená las cartas en las columnas alternando colores y llevá cada palo, del as al rey, a su lugar arriba. Mientras más rápido juegues, más puntos sumás.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Completá las cuatro pilas de arriba con todas las cartas. Si lo terminás rápido, ganás puntos extra por tiempo.</span>
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
            <span>Elegí tu equipo, la formación y tu nombre de DT. Seleccioná al jugador al que le querés dar el pase y después, ¡tocá y tocá hasta llegar al área del rival y patear al arco!</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Hacé más goles que el rival antes de que termine el partido. En el Mundial arrancás en octavos: ganá cada partido (si empatás, se define por penales) hasta salir campeón en la final.</span>
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
            <span>Un juego de plataformas, pero para arriba: trepá terrazas, balcones, vigas, escaleras y sogas, usá trampolines y montacargas, y esquivá fuego, bolas de demolición y pájaros. Pasá las nubes, la zona tecnológica y el espacio.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Llegá a la Luna y clavá el banderín. Si te quemás o te caés muy abajo, perdés.</span>
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
            <span>El viborita de siempre, pero vos sos la manzana. Agarrá las bolitas blancas mientras la serpiente te persigue cada vez más rápido, y crece cada vez que se come una manzana verde. Hacela enredarse con su propio cuerpo y usá la tijera y el reloj para frenarla.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sumá la mayor cantidad de puntos posible antes de que la serpiente te atrape y superá tu récord.</span>
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
            <span>¡La lava sube y no para! Subí lo más rápido que puedas para sobrevivir: saltá de edificio en edificio por escaleras caracol, muebles, sogas, ascensores, tirolesas, cables, grúas y puentes rotos de torres altísimas, y esquivá el fuego y los cortocircuitos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Subite al helicóptero antes de que la lava te alcance. Aterriza en uno de los 6 helipuertos, espera solo 5 segundos y a los 30 aterriza en otro: seguí la flecha.</span>
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
            <span>Sos un T-800 en la oficina de Skynet y tirás humanos en miniatura al tacho, solo con el mouse: cerca, a media distancia y lejos, y después con el ventilador soplando para un lado y para el otro.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Hacé la mayor cantidad de puntos en 4 cuartos de 2 minutos. Cada posición vale más que la anterior (de 1 a 9 puntos) y completar el ciclo rápido suma puntos por velocidad. Superá tu récord.</span>
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
            <span>La ciudad se inundó y el agua está llena de tiburones. Sos bombero: saltá por techos, balcones, faroles y autos, metete en los departamentos y esquivá a los tiburones que saltan del agua, a los tiburones voladores y al súper viento.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Rescatá a 20 perritos, gatos y personas que flotan en el agua antes de que pasen los 10 minutos, sin que te coma un tiburón.</span>
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
            <span>Sos francotirador y la ciudad está llena de aliens disfrazados de personas. Recorré la cuadra con las flechas y apuntá con el mouse a cada departamento, local y vereda: cada 30 segundos se les ve la cara de alien por 5 segundos, se te quedan mirando fijo y pasean con bombas rojas. A los 5 minutos se larga una tormenta y a los 7 llegan los ovnis.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Eliminá a 20 aliens antes de que pasen los 10 minutos. Tenés 3 vidas: cada persona a la que le disparás te saca una.</span>
          </span>
          <span className="game-card-foot">
            {invasion.kills > 0 && <small><b>Récord</b>{invasion.time ? `🏆 en ${formatInvasionTime(invasion.time)}` : `${invasion.kills} aliens`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
    </ul>
  </section>;
}
