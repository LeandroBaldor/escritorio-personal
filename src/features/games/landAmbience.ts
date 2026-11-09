// El índice coincide con BIOMES de landMap: cada pista pertenece a un escenario.
const tracks=import.meta.glob('./assets/land/ambience/map-*.mp3',{eager:true,import:'default'}) as Record<string,string>;
let audio:HTMLAudioElement|null=null,currentMap=-1;
export function setLandAmbience(map:number,on:boolean){
 if(!on){audio?.pause();return;}
 const source=tracks[`./assets/land/ambience/map-${map}.mp3`];
 if(!source||typeof Audio==='undefined'){resetLandAmbience();return;}
 if(currentMap!==map||!audio){resetLandAmbience();audio=new Audio(source);currentMap=map;audio.preload='auto';audio.loop=true;audio.volume=.22;}
 if(audio.paused)void audio.play().catch(()=>{/* El próximo gesto del usuario vuelve a intentar. */});
}
export function resetLandAmbience(){if(audio){audio.pause();audio.currentTime=0;}audio=null;currentMap=-1;}
