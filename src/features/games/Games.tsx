import { readVampyium2Record } from './Vampyium2Game';
import vamp2Cover from './assets/vampyium2/cover.webp';
import factoryCover from './assets/factory/cover.webp';
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
import voleyCover from './assets/portada-voley.webp';
import penalesCover from './assets/portada-penales.webp';
import landCover from './assets/portada-land.webp';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunnerGame';
import { formatTime, readTrepaRecord } from './TrepalunaGame';
import { formatLavaTime, readLavaRecord } from './LavaFloor';
import { readPaperRecord } from './PaperBallGame';
import { formatSharkTime, readSharkRecord } from './SharkCity';
import { invasionRecordPoints, readInvasionRecord } from './InvasionGame';
import { formatGravityTime, readGravityRecord } from './GravitySwapGame';
import { readKombatRecord } from './KombatFootballGame';
import { readVoleyRecord } from './KombatVoleyGame';
import { readPenRecord } from './KombatPenaltiesGame';
import { readLandRecord } from './LandGame';
import { tiro2050Cover } from './Tiro2050Game';
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
  const voley = readVoleyRecord();
  const penales = readPenRecord();
  const vamp2 = readVampyium2Record();
  const landWins = Object.values(readLandRecord()).reduce((a, b) => a + b, 0);
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
            <span>🧱 Quedaste atrapado en el fondo de un Tetris gigante: esquivá las piezas y las bombas que caen cada vez más rápido y trepá por la pila.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sobreviví los 10 niveles de 30 segundos. Si te aplasta una pieza, te explota una bomba o la pila llega arriba, perdés.</span>
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
            <span>🌙 Llegá a la Luna saltando: arrancás en la calle y subís por zepelines, una tormenta, torres de neón y asteroides, sobre plataformas que se mueven y se desarman.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Trepá los 6.000 metros y clavá el banderín en la Luna. Tenés 3 vidas: perdés una si te quemás, te electrocutás o caés más de 100 metros.</span>
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
            <span>🌋 La ciudad se inunda de lava y la única salida es hacia arriba: trepá por escaleras, sogas y ascensores y saltá entre edificios esquivando incendios y cortocircuitos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Subite al helicóptero de rescate: aterriza en uno de los 6 helipuertos y espera solo 5 segundos. Si la lava te alcanza o te quemás, perdés.</span>
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
            <span>🤖 En la oficina de Skynet, el T-800 tira humanos en miniatura al tacho de basura: estirá con el mouse como una gomera y soltá, mientras el tacho se aleja y el ventilador sopla cada vez más fuerte.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Hacé la mayor cantidad de puntos en 4 cuartos de 2 minutos y batí tu récord: cada emboque vale de 1 a 9 puntos, con bonus por velocidad.</span>
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
            <span>🦈 Una tormenta convirtió las calles en canales llenos de tiburones: saltá por techos, cables y colectivos para rescatar a personas y mascotas sin que te muerdan.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Rescatá a 20 antes de que pasen los 10 minutos. Un solo mordisco y es GAME OVER.</span>
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
            <span>👽 Los aliens se mezclan con la gente de la ciudad y los ovnis la destruyen. Con un rifle de francotirador, una ametralladora y una bazooka, apuntá con la mira, desactivá las bombas y no le dispares a la gente.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Resistí los 10 minutos con más humanos que aliens en pie. Cada alien, bomba y ovni suma puntos; cada humano que matás resta 50.</span>
          </span>
          <span className="game-card-foot">
            {invasion.kills > 0 && <small><b>Récord</b>{invasionRecordPoints(invasion)} pts</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--grav" to="/juegos/gravedad">
          <Cover src={gravityCover} />
          <span className="game-card-text">
            <strong>Gravity Swap</strong>
            <span>🚀 Sos un astronauta perdido en mundos donde la gravedad cambia sola: movete con chorros de oxígeno esquivando láseres, minas, agujeros negros y monstruos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Cruzá el portal final de los 10 escenarios, hasta La Luna. Tenés 10 vidas por escenario y, si morís, volvés a la última bandera.</span>
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
            <span>☠️ Fútbol 5 contra 5 donde vale todo: 16 luchadores al estilo Mortal Kombat con ataques especiales que revientan a los rivales. Contra la máquina o entre dos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Ganá cada partido metiendo más goles en dos tiempos de 1:30 y completá el torneo venciendo a los 15 rivales, del más fácil al más difícil.</span>
          </span>
          <span className="game-card-foot">
            {kombat.wins + kombat.losses > 0 && <small><b>Récord</b>{kombat.cups ? `🏆 ${kombat.cups} · ` : ''}{kombat.wins}G {kombat.losses}P</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--kf" to="/juegos/voley">
          <Cover src={voleyCover} />
          <span className="game-card-text">
            <strong>Kombat Voley</strong>
            <span>🏐 Los luchadores de Kombat juegan vóley uno contra uno, con remates en la red y 16 estadios, cada uno con su propia pelota (meteorito, bomba, rayo…).</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Ganá cada set a 15 con dos puntos de diferencia y levantá la copa del mundial: octavos, cuartos, semifinal y final.</span>
          </span>
          <span className="game-card-foot">
            {voley.wins + voley.losses > 0 && <small><b>Récord</b>{voley.cups ? `🏆 ${voley.cups} · ` : ''}{voley.wins}G {voley.losses}P</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--kf" to="/juegos/penales">
          <Cover src={penalesCover} />
          <span className="game-card-text">
            <strong>Kombat Penales</strong>
            <span>⚽ La tanda de penales más peligrosa del mundo: elegí uno de los 6 lugares del arco para patear o tirarte, y el árbitro le dispara al que pierde cada duelo. Contra la máquina o entre dos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Ganá cada partido metiendo más penales en 5 tiros (si empatan, muerte súbita) y salí campeón del mundial.</span>
          </span>
          <span className="game-card-foot">
            {penales.wins + penales.losses > 0 && <small><b>Récord</b>{penales.cups ? `🏆 ${penales.cups} · ` : ''}{penales.wins}G {penales.losses}P</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link onClick={playStart} className="game-card game-card--vamp game-card--vamp2" to="/juegos/vampyium2">
          <span className="game-card-cover"><Cover src={vamp2Cover} /></span>
          <span className="game-card-text">
            <strong>Vampyrium</strong>
            <span>Drácula le arrebató la familia a Demian y el cazador vuelve por venganza: cruzá el castillo capítulo a capítulo, sumando un arma nueva en cada uno.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Superá los 10 capítulos, cada uno con su objetivo, y al final vencé a Drácula y a su forma de dragón.</span>
          </span>
          <span className="game-card-foot">
            {vamp2.kills > 0 && <small><b>Récord</b>{vamp2.time ? `🏆 en ${formatVampTime(vamp2.time)}` : `${vamp2.kills} vampiros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--land" to="/juegos/land">
          <span className="game-card-cover"><Cover src={landCover} /></span>
          <span className="game-card-text">
            <strong>Land of Warriors</strong>
            <span>⚔️ Diez civilizaciones y una sola tierra: juntá minerales, levantá tu base y armá un ejército para enfrentar hasta 9 rivales a la vez.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Destruí las bases de todas las civilizaciones rivales antes de que destruyan la tuya.</span>
          </span>
          <span className="game-card-foot">
            {landWins > 0 && <small><b>Victorias</b>🏆 {landWins}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li><Link onClick={playStart} className="game-card" to="/juegos/fabrica">
        <Cover src={factoryCover} />
        <span className="game-card-text"><strong>Fábrica de Pedos</strong><span>💨 Caíste al fondo de una fábrica y un piso de pinches sube sin parar: comé pizza, porotos o hamburguesas para cargar gas y subí con tus pedos entre engranajes, láseres y lanzallamas.</span><span className="game-card-win"><b>Cómo se gana:</b> Escapá de las 10 fábricas hasta salir por arriba de la Fábrica orbital. Si te alcanzan los pinches o tocás una trampa, volvés a empezar.</span></span><span className="game-card-foot"><span className="game-card-play" aria-hidden="true">Jugar ▶</span></span>
      </Link></li>
      <li>
        <Link onClick={playStart} className="game-card" to="/juegos/tiro-al-blanco-2050">
          <Cover src={tiro2050Cover} />
          <span className="game-card-text">
            <strong>Tiro al Blanco 2050</strong>
            <span>🎯 Entrenamiento de tiro del año 2050 para 1 a 4 jugadores: elegí tu soldado y tus armas y pasá tres pruebas: Aliens, Platos y Target.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sumá la mayor cantidad de puntos en las tres pruebas: Aliens y Platos duran 3 minutos y Target 40 segundos. Al final te dan una calificación, de Muy malo a Excelente.</span>
          </span>
          <span className="game-card-foot">
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
    </ul>
  </section>;
}
