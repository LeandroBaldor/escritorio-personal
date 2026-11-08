/* global process, console, OfflineAudioContext, atob */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,URL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const source=process.argv[2],output=fileURLToPath(new URL('../src/features/games/assets/land/voices/events/',import.meta.url));
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const names={burn:'fire.mp3',built:'construccion.mp3',trained:'personaje_creado.mp3'},clips={};
fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch();
try{const page=await browser.newPage();for(const [key,name] of Object.entries(names)){
  const actual=fs.readdirSync(source).find(file=>normalize(file)===name);if(!actual)throw new Error(`Falta ${name}`);const bytes=fs.readFileSync(path.join(source,actual));
  const info=await page.evaluate(async({raw,key})=>{const ctx=new OfflineAudioContext(1,1,22050),b=await ctx.decodeAudioData(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)).buffer),data=b.getChannelData(0),rate=b.sampleRate;let first=0;while(first<data.length&&Math.abs(data[first])<.004)first++;const start=Math.max(0,first/rate-.02),length=Math.min(key==='burn'?2.4:3.5,b.duration-start);let sum=0,peak=0;for(let i=Math.floor(start*rate);i<Math.floor((start+length)*rate);i++){sum+=data[i]**2;peak=Math.max(peak,Math.abs(data[i]));}const rms=Math.sqrt(sum/Math.max(1,length*rate));return {duration:+b.duration.toFixed(3),peak,rms,phrases:[{start:+start.toFixed(3),duration:+length.toFixed(3),rms}],steps:[]};},{raw:bytes.toString('base64'),key});
  fs.writeFileSync(path.join(output,key+'.mp3'),bytes);clips[key]={civ:'humano',role:'acid',variant:0,purpose:'effect',hash:createHash('sha256').update(bytes).digest('hex'),file:`events/${key}.mp3`,source:`SONIDOS/${actual}`,...info};console.log(`${key}: ${info.duration}s; fragmento ${info.phrases[0].duration}s`);
}fs.writeFileSync(path.join(output,'cues.json'),JSON.stringify(clips,null,2)+'\n');}finally{await browser.close();}
