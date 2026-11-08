export type LandScreen='title'|'pick'|'sheet'|'scenario'|'playing'|'paused'|'won'|'lost';
export function previousLandMenu(screen:LandScreen,scenarioFrom:'pick'|'sheet'='pick'):LandScreen{return screen==='sheet'?'pick':screen==='scenario'?scenarioFrom:'title';}
