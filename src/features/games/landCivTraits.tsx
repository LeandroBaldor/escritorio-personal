import type {CivId} from './landCivs';
export const CIV_TRAITS:Record<CivId,{strength:string;weakness:string}>={
 humano:{strength:'Tiradores resistentes, apoyo médico y tanques de alcance medio.',weakness:'Reclutas frágiles en el cuerpo a cuerpo; tanques lentos.'},
 zergano:{strength:'Infantería barata y veloz; permite reunir ejércitos numerosos.',weakness:'Criaturas frágiles y tiradores de alcance reducido.'},
 elfos:{strength:'Arqueras de gran alcance, movilidad y curación.',weakness:'Infantería y arqueras con poca resistencia; sufren si las rodean.'},
 enanos:{strength:'Guerreros resistentes y artillería de largo alcance.',weakness:'Velocidad baja: les cuesta perseguir o retirarse.'},
 nomuerta:{strength:'Curación potente, tropas económicas y abominaciones resistentes.',weakness:'Apoyos lentos y poco alcance de los tiradores.'},
 sauriano:{strength:'Bestias con mucha vida y élites de gran fuerza.',weakness:'Sus criaturas pesadas necesitan acercarse; tiradores de menor alcance.'},
 infernal:{strength:'Daño elevado y hechizos de área contra grupos.',weakness:'Guerreros y hechiceros frágiles; necesitan protección.'},
 mecanico:{strength:'Francotiradores de alcance extremo y tanques resistentes.',weakness:'Tiradores caros y lentos; menor cadencia de disparo.'},
 orcos:{strength:'Guerreros fuertes, resistentes y económicos en combate cercano.',weakness:'Tiradores débiles y de poco alcance: deben cerrar la distancia.'},
 abisal:{strength:'Medusas con ataques de área amplios y guerreros móviles.',weakness:'Infantería menos resistente y hechizos de cadencia lenta.'},
};
export function CivTraits({civ}:{civ:CivId}){const t=CIV_TRAITS[civ];return <div className="land-civ-traits"><p><b>Fortaleza:</b> {t.strength}</p><p><b>Debilidad:</b> {t.weakness}</p></div>;}
