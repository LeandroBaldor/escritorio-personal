/* global process, console, OfflineAudioContext, atob */
import fs from 'node:fs';
import {fileURLToPath,URL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const bytes=fs.readFileSync(process.argv[2]),folder=fileURLToPath(new URL('../src/features/games/assets/land/voices/footsteps/',import.meta.url));fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch();
try{
  const page=await browser.newPage();const info=await page.evaluate(async raw=>{
    const context=new OfflineAudioContext(1,1,22050),buffer=await context.decodeAudioData(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)).buffer),data=buffer.getChannelData(0),levels=[];let peak=0;
    for(let i=0;i<data.length;i+=220){let sum=0;for(let j=i;j<Math.min(i+220,data.length);j++){sum+=data[j]**2;peak=Math.max(peak,Math.abs(data[j]));}levels.push(Math.sqrt(sum/Math.min(220,data.length-i)));}
    const max=Math.max(...levels),candidates=[];for(let i=2;i<levels.length-2;i++){const score=levels[i]-(levels[i-1]+levels[i-2])/2;if(score>max*.04&&levels[i]>=levels[i+1])candidates.push({i,score});}candidates.sort((a,b)=>b.score-a.score);const hits=[];for(const hit of candidates)if(hits.every(i=>Math.abs(i-hit.i)>18)){hits.push(hit.i);if(hits.length>=8)break;}if(!hits.length)hits.push(levels.indexOf(max));
    const steps=hits.sort((a,b)=>a-b).map(i=>{const start=Math.max(0,i*.01-.008),end=Math.min(buffer.duration,start+.15);let sum=0,n=0;for(let j=Math.floor(start*buffer.sampleRate);j<Math.floor(end*buffer.sampleRate);j++){sum+=data[j]**2;n++;}return {start:+start.toFixed(3),duration:+(end-start).toFixed(3),rms:+Math.sqrt(sum/Math.max(1,n)).toFixed(5)};});
    return {duration:+buffer.duration.toFixed(3),peak,rms:steps[0].rms,phrases:[],steps};
  },bytes.toString('base64'));
  fs.writeFileSync(folder+'steps.mp3',bytes);fs.writeFileSync(folder+'cues.json',JSON.stringify({civ:'humano',role:'worker',variant:0,purpose:'foot',hash:createHash('sha256').update(bytes).digest('hex'),file:'footsteps/steps.mp3',source:'SONIDOS/pasos.mp3',...info},null,2)+'\n');console.log(`${info.duration}s; ${info.steps.length} apoyos preparados.`);
}finally{await browser.close();}
