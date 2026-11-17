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
import { formatInvasionTime, readInvasionRecord } from './InvasionGame';
import { formatGravityTime, readGravityRecord } from './GravitySwapGame';
import { readKombatRecord } from './KombatFootballGame';
import { readVoleyRecord } from './KombatVoleyGame';
import { readPenRecord } from './KombatPenaltiesGame';
import { readLandRecord } from './LandGame';
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
            <span>🧱 Quedaste atrapado en el fondo de un Tetris gigante. Las piezas caen sin aviso, entre ellas bombas con la mecha prendida, y cada 30 segundos llueven más rápido. Corré, saltá y trepá por la pila: un segundo de duda y quedás aplastado.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Sobreviví los 10 niveles, de 30 segundos cada uno (5 minutos en total). Si te cae una pieza encima, te explota una bomba o la pila llega hasta arriba, se termina la partida.</span>
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
            <span>🌙 Te propusiste lo imposible: llegar a la Luna saltando. Arrancás en la calle, entre grúas y andamios, y subís por zepelines, una tormenta de relámpagos, torres de neón y asteroides. Cuanto más alto, más traicioneras las plataformas: se mueven, se apagan y se desarman bajo tus pies.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Trepá los 6.000 metros: la ciudad, el cielo, la tormenta (de 2.000 a 3.000 m), la zona tecnológica y el espacio, hasta pararte en la Luna y clavar el banderín. Tenés 3 vidas: perdés una si te quemás, te electrocutás o caés más de 100 metros.</span>
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
            <span>🌋 La ciudad se inunda de lava y sube cada vez más rápido. La única salida es hacia arriba: escaleras, muebles, sogas, ascensores y grúas para trepar; tablones, tirolesas y camas elásticas para saltar de edificio en edificio. Y ojo con los incendios, los cortocircuitos y la gente prendida fuego que corre desesperada.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Un helicóptero de rescate va aterrizando en distintos helipuertos de la cuadra (hay 6), pero espera solo 5 segundos en cada uno. Seguí la flecha, llegá a tiempo y subite mientras está aterrizado. Si la lava te alcanza o te quemás, se terminó.</span>
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
            <span>🤖 Las máquinas ganaron y en la oficina de Skynet el T-800 se aburre: su pasatiempo es tirar humanos en miniatura al tacho de basura. Estirá con el mouse como una gomera y soltá. Cada tiro es más difícil: el tacho se aleja y un ventilador sopla de costado, cada cuarto más fuerte.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Es un partido de 4 cuartos de 2 minutos y el objetivo es batir tu récord. Cada emboque vale de 1 a 9 puntos según la distancia y el viento, y si embocás muchos en una vuelta, sumás un bonus por velocidad.</span>
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
            <span>🦈 Una tormenta inundó la ciudad y las calles se volvieron canales llenos de tiburones: blancos que saltan altísimo, martillos y ballenas gigantes. Sos el héroe que salta por techos, balcones, cables y colectivos para salvar a personas, perros y gatos a la deriva. Para rescatarlos hay que bajar cerca del agua… justo donde muerden. Y cada 30 segundos llega otro tiburón.</span>
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
            <span>👽 Los aliens ya están entre nosotros, disfrazados de vecinos. Desde tu mira ves cada departamento de la cuadra: cada tanto uno deja ver su cara gris, camina por el techo o habla por un intercomunicador extraño. Quieren incendiarlo todo: a los 3 minutos se larga la tormenta y a los 5 llegan los ovnis a destruir la ciudad.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Eliminá a 20 aliens antes de que los ovnis arrasen la ciudad (10 minutos). Tenés 3 vidas: cada persona inocente a la que le disparás te saca una.</span>
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
            <span>🚀 Sos un astronauta perdido en mundos donde la gravedad cambia sola y sin avisar: te puede tirar al piso, al techo, para atrás o en diagonal, y la pantalla gira con ella. Te movés con chorros del oxígeno de tu tanque, esquivando láseres, minas, agujeros negros y un monstruo distinto en cada escenario.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Cruzá el portal del final de los 10 escenarios: de la Ciudad Futurista, pasando por el Planeta Helado, el Volcánico y la Fábrica Robótica, hasta La Luna. Tenés 10 vidas por escenario y, si morís, volvés a la última bandera que pasaste.</span>
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
            <span>☠️ Un torneo de fútbol 5 contra 5 donde vale todo. 16 luchadores al estilo Mortal Kombat se pasan la pelota, patean con efecto y usan cuatro ataques especiales que revientan a los rivales en sangre. Contra la máquina o entre dos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Cada partido lo gana el que mete más goles en dos tiempos de 1:30 (si empatan, gol de oro); con la barra llena, tirá el FATAL GOAL. Para ganar el juego, completá el torneo: subí la escalera venciendo a los 15 rivales, uno por uno, del más fácil al más difícil.</span>
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
            <span>🏐 Los luchadores de Kombat cambian los botines por la red, pero no la violencia: vóley uno contra uno, remates saltando en la red y 16 estadios, cada uno con su propia pelota (meteorito, bomba, rayo…).</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Cada partido es un set a 15 con dos puntos de diferencia: sumás si la pelota pica en la cancha rival, si el rival la tira afuera o la toca más de tres veces. Para ganar el juego, levantá la copa del mundial: octavos, cuartos, semifinal y final.</span>
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
            <span>⚽ La tanda de penales más peligrosa del mundo. Un piedra, papel o tijera decide quién patea primero y después cada uno elige uno de los 6 lugares del arco para patear o tirarse. El árbitro no perdona: si el arquero ataja, le dispara al que pateó; si es gol y el arquero se tiró para el otro lado, el que explota es él. Contra la máquina o entre dos.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Cada partido lo gana el que mete más penales en 5 tiros; si empatan, muerte súbita hasta que alguno erre. Para ganar el juego, salí campeón del mundial: octavos, cuartos, semifinal y final contra rivales sorteados.</span>
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
            <span>Drácula le arrebató la familia a Demian, y ahora el cazador vuelve con una sola misión: venganza. Cruzá el castillo del conde capítulo a capítulo, del puente de las ánimas al salón del trono, entre ríos de ácido, lava, pinches y guadañas. Tenés 100 de vida, cada capítulo es más rápido y en cada uno se suma un arma: ballesta, bomba de ajo, cruz, espada de fuego, armaduras… doce en total.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Superá los 10 capítulos (cada uno se abre al ganar el anterior): matá 50 vampiros en el puente, juntá 20 estrellas en las cloacas, rompé 6 jaulas, resistí 100 segundos en la catedral, vencé a 8 guerreros, destruí 6 ataúdes, liberá 15 almas, derribá 20 vampiros voladores y sobreviví 5 minutos en el cementerio. Al final te espera Drácula: 200 golpes a él y otros 200 a su forma de dragón.</span>
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
            <span>⚔️ Diez civilizaciones y una sola tierra. Elegí la tuya, juntá minerales, levantá tu base y armá un ejército de soldados, máquinas y bestias. Podés enfrentar hasta 9 rivales a la vez, todos contra todos, en cuatro dificultades: cuanto más alta, más rápido crecen y antes atacan.</span>
            <span className="game-card-win"><b>Cómo se gana:</b> Destruí las bases de todas las civilizaciones rivales antes de que destruyan la tuya. Solo queda en pie una.</span>
          </span>
          <span className="game-card-foot">
            {landWins > 0 && <small><b>Victorias</b>🏆 {landWins}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li><Link onClick={playStart} className="game-card" to="/juegos/fabrica">
        <Cover src={factoryCover} />
        <span className="game-card-text"><strong>Fábrica de Pedos</strong><span>💨 Caíste al fondo de una fábrica y un piso de pinches sube detrás tuyo sin parar. Tu único motor: ¡tus pedos! Comé pizza, porotos o hamburguesas para cargar gas y elegí rápido el corredor entre engranajes, láseres, lanzallamas y compuertas.</span><span className="game-card-win"><b>Cómo se gana:</b> Escapá de las 10 fábricas, de la Fundición de hierro al Reactor nuclear, hasta salir por arriba de la Fábrica orbital. Si te alcanzan los pinches o tocás una trampa, volvés a empezar.</span></span><span className="game-card-foot"><span className="game-card-play" aria-hidden="true">Jugar ▶</span></span>
      </Link></li>
    </ul>
  </section>;
}
