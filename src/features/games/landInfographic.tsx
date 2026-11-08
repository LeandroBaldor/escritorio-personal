import { BKINDS, BUILD_STATS, ROLES, ROLE_STATS } from './land';
import { BUILD_TEXT, CIVS, POWER_TEXT, TRAINING_ROLE, attackText, type CivId } from './landCivs';
import { roleIdx } from './landArt';
import { BuildingSprite, Sprite } from './landSprite';
import {LEVEL_HEALTH,LEVEL_DAMAGE} from './landBalance';
import leaders1 from './assets/land/leaders-1.webp';
import leaders2 from './assets/land/leaders-2.webp';
const PORTRAITS:Record<CivId,[number,number]>={humano:[0,0],zergano:[0,1],elfos:[0,2],enanos:[0,3],nomuerta:[0,4],sauriano:[1,0],infernal:[1,1],mecanico:[1,2],orcos:[1,3],abisal:[1,4]};
export function LeaderPortrait({civ}:{civ:CivId}) {
  const [sheet,cell]=PORTRAITS[civ];return <div className="land-leader-portrait" role="img" aria-label={`Líder de ${CIVS[civ].name}`}><svg viewBox={`${cell%3*512} ${Math.floor(cell/3)*512} 512 512`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href={sheet?leaders2:leaders1} x="0" y="0" width="1536" height="1024"/></svg></div>;
}
export function LandInfographic({civ}:{civ:CivId}){
  const c=CIVS[civ];
  return <section className="land-infographic" aria-label={`${c.name}: unidades, construcciones y máquinas`} style={{['--civ' as string]:c.color}}>
    <header className="land-info-header"><LeaderPortrait civ={civ}/><div><small>INFORME DE CIVILIZACIÓN</small><h2>{c.name}</h2><p>{c.motto}</p><p>{c.style}</p></div></header>
    <section className="land-info-units"><h3>UNIDADES Y MÁQUINAS</h3><div className="land-info-grid">{ROLES.map(r=>{
      const s={...ROLE_STATS[r],...c.mod[r]};return <article key={r}><Sprite civ={civ} idx={roleIdx(r)} w={180} h={180} level={1}/><h4>{c.units[r]} Nivel 1</h4><p>{attackText(civ,r,s.range)}</p><small>Vida {Math.round(s.hp*LEVEL_HEALTH[1])} · Daño {Math.round(s.dmg*LEVEL_DAMAGE[1])}</small></article>;
    })}</div></section>
    <section className="land-info-buildings"><h3>CUARTELES, CONSTRUCCIONES Y DEFENSAS</h3><div className="land-info-grid">{BKINDS.map(k=><article key={k}><BuildingSprite civ={civ} kind={k} w={190} h={150}/><h4>{c.buildings[k]}</h4><p>{TRAINING_ROLE[k]?`Entrena exclusivamente: ${c.units[TRAINING_ROLE[k]!]}.`:BUILD_TEXT[k]}</p><small>{BUILD_STATS[k].cost.stone} minerales{BUILD_STATS[k].cost.gem?` · ${BUILD_STATS[k].cost.gem} diamantes`:''}</small></article>)}</div></section>
    <section className="land-info-footer"><article><h3>RECURSOS Y COMIDA</h3><p>Azules: entrenamiento y construcción. Dorados: tropas avanzadas. Verdes: evoluciones y élite. Piedras: estructuras y fortificación. Asigná trabajadores a cosechas de 60 s y entregá el alimento en el Almacén: sin comida, las tropas se detienen.</p></article><article><h3>{c.power.name}</h3><p>{POWER_TEXT[c.power.kind]}</p></article><article><h3>CUATRO NIVELES</h3><p>Cada personaje empieza en Nivel 1 y puede alcanzar el Nivel 4. Investigá las mejoras en su cuartel: benefician a las tropas actuales y futuras sin encarecer su entrenamiento. Desde la base mejorás Producción y Fortificación.</p></article></section>
  </section>;
}
