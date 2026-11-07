/* global process, console, OfflineAudioContext, atob */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const source=process.argv[2];if(!source)throw new Error('Indicá la carpeta SONIDOS.');
const output=fileURLToPath(new URL('../src/features/games/assets/land/voices/combat/',import.meta.url));
const names={acid:'disparo_acido',machine:'disparo_ametralladora',gun:'disparo_arma',cannon:'disparo_cañon',arrow:'disparo_flecha_lanza',fire:'disparo_fuego',laser:'disparo_laser',building:'golpe_construccion',death:'muere_personaje'};
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch();const clips={};
try{
  const page=await browser.newPage();
  for(const [key,name] of Object.entries(names)){
    const bytes=fs.readFileSync(path.join(source,name+'.mp3'));
    const info=await page.evaluate(async({raw,key})=>{
      const ctx=new OfflineAudioContext(1,1,22050),b=await ctx.decodeAudioData(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)).buffer),data=b.getChannelData(0),rate=b.sampleRate;
      const levels=[];let peak=0;for(let i=0;i<data.length;i+=220){let sum=0;for(let j=i;j<Math.min(i+220,data.length);j++){sum+=data[j]**2;peak=Math.max(peak,Math.abs(data[j]));}levels.push(Math.sqrt(sum/Math.min(220,data.length-i)));}
      const threshold=Math.max(.002,Math.max(...levels)*.09),first=levels.findIndex(v=>v>threshold),start=Math.max(0,first*.01-.025),limit=key==='death'?1.8:key==='cannon'?1.3:key==='machine'?.65:.8;
      let end=Math.min(b.duration,start+limit);const lo=Math.floor((start+limit*.65)*100),hi=Math.min(levels.length,Math.floor(end*100));
      if(hi>lo){let best=lo;for(let i=lo+1;i<hi;i++)if(levels[i]<levels[best])best=i;end=Math.min(end,best*.01+.025);}
      let energy=0,n=0;for(let i=Math.floor(start*rate);i<Math.floor(end*rate);i++){energy+=data[i]**2;n++;}
      const cue={start:+start.toFixed(3),duration:+(end-start).toFixed(3),rms:+Math.sqrt(energy/Math.max(1,n)).toFixed(5)};
      return {duration:+b.duration.toFixed(3),peak,rms:cue.rms,phrases:[cue],steps:[]};
    },{raw:bytes.toString('base64'),key});
    fs.writeFileSync(path.join(output,key+'.mp3'),bytes);
    clips[key]={civ:'humano',role:'acid',variant:0,purpose:'effect',hash:createHash('sha256').update(bytes).digest('hex'),file:`combat/${key}.mp3`,source:`SONIDOS/${name}.mp3`,...info};
    console.log(`${key}: ${info.duration}s; fragmento ${info.phrases[0].duration}s`);
  }
  fs.writeFileSync(path.join(output,'cues.json'),JSON.stringify(clips,null,2)+'\n');
}finally{await browser.close();}
