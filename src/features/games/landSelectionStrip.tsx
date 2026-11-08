import {useState} from 'react';
import type {LandGame,Unit} from './land';
import {unitLabel,evolutionLevel} from './landBalance';
import {Sprite} from './landSprite';
import {roleIdx} from './landArt';
export function LandSelectionStrip({game,units,onSelect}:{game:LandGame;units:Unit[];onSelect:(ids:number[])=>void}){const [page,setPage]=useState(0),pages=Math.max(1,Math.ceil(units.length/10)),current=Math.min(page,pages-1);return <div className="land-selection-roster"><ul className="land-group">{units.slice(current*10,current*10+10).map(u=><li key={u.id}><button type="button" onClick={()=>onSelect([u.id])} title={unitLabel(game,u.owner,u.role)}><Sprite civ={game.sides[u.owner].civ} idx={roleIdx(u.role)} level={evolutionLevel(game,u.owner,u.role)} w={66} h={60} portrait/><i style={{width:u.hp/u.maxHp*100+'%'}}/></button></li>)}</ul>{pages>1&&<nav aria-label="Páginas de unidades seleccionadas"><button type="button" disabled={!current} onClick={()=>setPage(current-1)}>‹</button><span>{current+1}/{pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>›</button></nav>}</div>;}
