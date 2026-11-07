import { BKINDS, BUILD_STATS, ROLES, ROLE_STATS } from './land';
import { BUILD_TEXT, CIVS, POWER_TEXT, TRAINING_ROLE, attackText, type CivId } from './landCivs';
import { roleIdx } from './landArt';
import { BuildingSprite, Sprite } from './landSprite';
const LAMINAS=import.meta.glob('./assets/land/lamina-*.webp',{eager:true,import:'default'}) as Record<string,string>;
export function LeaderPortrait({civ}:{civ:CivId}) {
  return <div className="land-leader-portrait" role="img" aria-label={`Líder de ${CIVS[civ].name}`} style={{backgroundImage:`url("${LAMINAS[`./assets/land/lamina-${civ}.webp`]}")`}}/>;
}
export function LandInfographic({civ}:{civ:CivId}){
  const c=CIVS[civ];
  return <section className="land-infographic" aria-label={`${c.name}: unidades, construcciones y máquinas`} style={{['--civ' as string]:c.color}}>
    <header className="land-info-header"><LeaderPortrait civ={civ}/><div><small>INFORME DE CIVILIZACIÓN</small><h2>{c.name}</h2><p>{c.motto}</p><p>{c.style}</p></div></header>
    <section className="land-info-units"><h3>UNIDADES Y MÁQUINAS</h3><div className="land-info-grid">{ROLES.map(r=>{
      const s={...ROLE_STATS[r],...c.mod[r]};return <article key={r}><Sprite civ={civ} idx={roleIdx(r)} w={180} h={180}/><h4>{c.units[r]}</h4><p>{attackText(civ,r,s.range)}</p><small>Vida {s.hp} · Daño {s.dmg}</small></article>;
    })}</div></section>
    <section className="land-info-buildings"><h3>CUARTELES, CONSTRUCCIONES Y DEFENSAS</h3><div className="land-info-grid">{BKINDS.map(k=><article key={k}><BuildingSprite civ={civ} kind={k} w={190} h={150}/><h4>{c.buildings[k]}</h4><p>{TRAINING_ROLE[k]?`Entrena exclusivamente: ${c.units[TRAINING_ROLE[k]!]}.`:BUILD_TEXT[k]}</p><small>{BUILD_STATS[k].cost.stone} minerales{BUILD_STATS[k].cost.gem?` · ${BUILD_STATS[k].cost.gem} diamantes`:''}</small></article>)}</div></section>
    <section className="land-info-footer"><article><h3>RECURSOS</h3><p>Azules: construcción y entrenamiento. Dorados: tropas avanzadas. Verdes: investigaciones y unidades élite.</p></article><article><h3>{c.power.name}</h3><p>{POWER_TEXT[c.power.kind]}</p></article><article><h3>MEJORAS</h3><p>Investigá ataque, vida y velocidad en tu centro de mando. Construí depósitos para ampliar la población.</p></article></section>
  </section>;
}
