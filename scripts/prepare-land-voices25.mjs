/* global console, OfflineAudioContext, atob */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root='C:/Users/T-800/OneDrive/YEYO/MINIJUEGOS/LAND OF WARRIORS',out='src/features/games/assets/land/voices';
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 for(const [source,file,leader] of [['CIVILIZACIONES/03_Elfos_de_Yldran/voz_elfos.mp3','elfos/voice.mp3',false],['SONIDOS/lider_radio.mp3','events/leader.mp3',true]]){
  const bytes=fs.readFileSync(path.join(root,source));fs.writeFileSync(path.join(out,file),bytes);
  const info=await page.evaluate(async({raw,leader})=>{
   const c=new OfflineAudioContext(1,1,22050),b=await c.decodeAudioData(Uint8Array.from(atob(raw),x=>x.charCodeAt(0)).buffer),a=b.getChannelData(0),rate=b.sampleRate,levels=[];let peak=0,sum=0;
   for(let i=0;i<a.length;i++){sum+=a[i]**2;peak=Math.max(peak,Math.abs(a[i]));}
   for(let i=0;i<a.length;i+=Math.floor(rate*.01)){let energy=0,n=0;for(let j=i;j<Math.min(a.length,i+Math.floor(rate*.01));j++){energy+=a[j]**2;n++;}levels.push(Math.sqrt(energy/n));}
   const cue=(start,end)=>{start=Math.max(0,start);end=Math.min(b.duration,end);let energy=0,n=0;for(let i=Math.floor(start*rate);i<Math.floor(end*rate);i++){energy+=a[i]**2;n++;}return {start:+start.toFixed(3),duration:+(end-start).toFixed(3),rms:+Math.sqrt(energy/Math.max(1,n)).toFixed(5)};};
   const phrases=[];if(leader)phrases.push(cue(0,Math.min(1.2,b.duration)));else {
    const threshold=Math.max(...levels)*.06;let at=0;
    while(at<b.duration-.35&&phrases.length<16){while(at<b.duration-.35&&(levels[Math.floor(at*100)]??0)<threshold)at+=.01;if(at>=b.duration-.35)break;const lo=Math.floor((at+.65)*100),hi=Math.min(levels.length-1,Math.floor((at+1.65)*100));let best=lo;for(let k=lo;k<=hi;k++)if(levels[k]<levels[best])best=k;const end=Math.min(b.duration,Math.max(at+.65,best*.01));phrases.push(cue(at,end));at=end+.03;}
   }
   return {duration:+b.duration.toFixed(3),peak:+peak.toFixed(5),rms:+Math.sqrt(sum/a.length).toFixed(5),phrases,steps:[]};
  },{raw:bytes.toString('base64'),leader});
  const data={hash:createHash('sha256').update(bytes).digest('hex'),file,source,...info};
  if(leader){const p=path.join(out,'events/cues.json'),all=JSON.parse(fs.readFileSync(p,'utf8'));all.leader={civ:'humano',role:'worker',variant:0,purpose:'effect',...data};fs.writeFileSync(p,JSON.stringify(all,null,2)+'\n');}
  else {const p=path.join(out,'cues.json'),all=JSON.parse(fs.readFileSync(p,'utf8'));all.clips=all.clips.map(clip=>clip.civ==='elfos'&&clip.purpose==='call'?{...clip,...data}:clip);fs.writeFileSync(p,JSON.stringify(all,null,2)+'\n');}
  console.log(JSON.stringify({file,duration:info.duration,phrases:info.phrases}));
 }
}finally{await browser.close();}
