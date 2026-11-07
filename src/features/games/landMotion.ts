// Media zancada: 34 unidades del mundo. Los pies alternan al llegar a ±π/2.
export const STEP_DISTANCE=34;
export const walkingPhase=(distance:number)=>distance*Math.PI/STEP_DISTANCE;
export const footContact=(distance:number)=>Math.floor(distance/STEP_DISTANCE+.5);
