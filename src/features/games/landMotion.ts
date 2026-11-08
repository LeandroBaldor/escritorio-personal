// Media zancada: 34 unidades del mundo. Los pies alternan al llegar a ±π/2.
export const STEP_DISTANCE=34;
export const walkingPhase=(distance:number)=>distance*Math.PI/STEP_DISTANCE;
export const footContact=(distance:number)=>Math.floor(distance/STEP_DISTANCE+.5);
export function walkPose(phase:number,strength=1){
  const limb=(p:number)=>({hip:Math.sin(p)*.23*strength,knee:Math.max(0,-Math.cos(p))*.42*strength,lift:Math.max(0,-Math.cos(p))*.022*strength,arm:(-Math.sin(p)*.29-Math.sin(p*2)*.045)*strength,elbow:(.12+Math.max(0,Math.cos(p-.4))*.25)*strength,wrist:Math.sin(p-.55)*.08*strength});
  return {left:limb(phase),right:limb(phase+Math.PI),torso:-Math.sin(phase)*.022*strength};
}
export function motionKind(civ:string,idx:number){
  if((civ==='humano'||civ==='mecanico'||civ==='enanos')&&idx===4)return 'treads';
  if((civ==='elfos'||civ==='nomuerta')&&idx===5||civ==='nomuerta'&&idx===2)return 'fly';
  if(civ==='zergano'||civ==='abisal'||idx>=4&&!(idx===5&&(civ==='humano'||civ==='mecanico'||civ==='enanos'))&&!(idx===4&&(civ==='orcos'||civ==='infernal'||civ==='nomuerta'||civ==='elfos')))return 'crawl';
  return 'biped';
}
