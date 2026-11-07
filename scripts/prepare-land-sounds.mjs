/* global process, console, OfflineAudioContext, atob, btoa */
// node scripts/prepare-land-sounds.mjs <carpeta-CIVILIZACIONES>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright';
const source=process.argv[2];if(!source)throw new Error('Indicá la carpeta CIVILIZACIONES.');
const output=fileURLToPath(new URL('../src/features/games/assets/land/voices/',import.meta.url));
const factions=[
  ['humano','01_Imperio_Humano',{worker:'ingeniero',melee:'recluta',ranged:'fusilero_pesado',special:'medico',heavy:'tanque_bastion',elite:'exoelite'}],
  ['zergano','02_Enjambre_Zergano',{worker:'Larva_Obrera',melee:'Zangano_Guerrero',ranged:'Acechador',special:'Escupidor_Acido',heavy:'Coloso_Quitinoso',elite:'Reina_Colmena',acid:'acido'}],
  ['elfos','03_Elfos_de_Yldran',{worker:'sabio',melee:'espadachin_lunar',ranged:'arquera_del_viento',special:'druida',heavy:'guardian_arboreo',elite:'dragon_elfico'}],
  ['enanos','04_Clanes_Enanos',{worker:'minero',melee:'guerrero_enano',ranged:'arcabucero',special:'sacerdote_rúnico',heavy:'cañon_de_asedio',elite:'golem_de_acero'}],
  ['nomuerta','05_Legion_No_Muerta',{worker:'acolito',melee:'esqueleto_guerrero',ranged:'banshee',special:'nigromante',heavy:'abominacion',elite:'dragon_espectral'}],
  ['sauriano','06_Imperio_Sauriano',{worker:'saurling',melee:'guerrero_saurino',ranged:'cazador_acechador',special:'chaman_saurino',heavy:'triceratops_de_asalto',elite:'t-rex_primordial'}],
  ['infernal','07_Legion_Infernal',{worker:'diablillo',melee:'legionario_infernal',ranged:'hechicero_infernal',special:'sucubo',heavy:'bruto_del_caos',elite:'señor_infernal'}],
  ['abisal','08_Dominio_Abisal',{worker:'siervo_abisal',melee:'guerrero_abisal',ranged:'acosador_profundo',special:'medusa_psionica',heavy:'kraken_de_guerra',elite:'hidra_abisal'}],
  ['mecanico','09_Sindicato_Mecanico',{worker:'oron',melee:'infante_automata',ranged:'francotirador_laser',special:'ingeniero_mecanico',heavy:'tanque_pesado',elite:'mech_de_asalto'}],
  ['orcos','10_Clanes_Orcos',{worker:'orco_peon',melee:'guerrero_orco',ranged:'cazador_de_fieras',special:'brujo_orco',heavy:'trol_de_combate',elite:'drakko_salvaje'}],
];
const browser=await chromium.launch();const clips=[];
try{
  const page=await browser.newPage();
  for(const [civ,folder,roles] of factions){
    fs.mkdirSync(path.join(output,civ),{recursive:true});
    for(const [role,stem] of Object.entries(roles)){
      const files=fs.readdirSync(path.join(source,folder)).filter(f=>f===stem+'.mp3'||f.startsWith(stem+'_')&&f.endsWith('.mp3')).sort();
      if(!files.length)throw new Error(`Falta ${folder}/${stem}.mp3`);
      for(const [variant,file] of files.entries()){
        const bytes=fs.readFileSync(path.join(source,folder,file)),name=`${civ}/${role}${variant?'-'+(variant+1):''}.mp3`;
        const info=await page.evaluate(async({raw,melodic})=>{
          const decoder=new OfflineAudioContext(1,1,22050),buffer=await decoder.decodeAudioData(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)).buffer);
          const rate=buffer.sampleRate,data=buffer.getChannelData(0),size=Math.round(rate*.01),levels=[];let peak=0,total=0;
          for(let p=0;p<data.length;p+=size){let energy=0;const end=Math.min(data.length,p+size);for(let j=p;j<end;j++){energy+=data[j]*data[j];peak=Math.max(peak,Math.abs(data[j]));}levels.push(Math.sqrt(energy/(end-p)));total+=energy;}
          const max=Math.max(...levels),threshold=Math.max(.0015,max*.065),limit=melodic?4:2.1;
          const cue=(start,end)=>{start=Math.max(0,start);end=Math.min(buffer.duration,end);let sum=0,n=0;for(let i=Math.floor(start*rate);i<Math.floor(end*rate);i++){sum+=data[i]*data[i];n++;}return {start:+start.toFixed(3),duration:+(end-start).toFixed(3),rms:+Math.sqrt(sum/Math.max(1,n)).toFixed(5)};};
          const phrases=[];let begin=-1,quiet=0;
          for(let i=0;i<=levels.length;i++){
            const loud=(levels[i]??0)>threshold;if(loud){if(begin<0)begin=i;quiet=0;}else quiet++;
            if(begin>=0&&(quiet>=18||i===levels.length)){
              const end=(i-quiet+1)*.01;
              if(end-begin*.01>=.3){let at=Math.max(0,begin*.01-.025);while(end-at>.3&&phrases.length<12){
                let cut=end;
                if(end-at>limit){const lo=Math.floor((at+limit*.68)*100),hi=Math.min(levels.length,Math.floor((at+limit)*100));let best=lo;for(let k=lo;k<hi;k++)if(levels[k]<levels[best])best=k;cut=best*.01;}
                phrases.push(cue(at,cut+.025));at=cut+.025;
              }}begin=-1;quiet=0;
            }
          }
          if(!phrases.length)phrases.push(cue(0,Math.min(buffer.duration,limit)));
          if(melodic&&phrases.some(c=>c.duration>=1.2))for(let i=phrases.length-1;i>=0;i--)if(phrases[i].duration<1.2)phrases.splice(i,1);
          const candidates=[];
          for(let i=2;i<levels.length-3;i++){const previous=(levels[i-1]+levels[i-2])*.5,score=levels[i]-previous;if(score>max*.04&&levels[i]>=levels[i+1])candidates.push({i,score});}
          candidates.sort((a,b)=>b.score-a.score);const hits=[];
          for(const hit of candidates)if(hits.every(h=>Math.abs(h-hit.i)>18)){hits.push(hit.i);if(hits.length===8)break;}
          if(!hits.length)hits.push(levels.indexOf(max));
          const steps=hits.sort((a,b)=>a-b).map(i=>cue(i*.01-.012,i*.01+.19)).filter(c=>c.duration>.05);
          await decoder.close?.();return {duration:+buffer.duration.toFixed(3),peak:+peak.toFixed(5),rms:+Math.sqrt(total/data.length).toFixed(5),phrases,steps};
        },{raw:bytes.toString('base64'),melodic:civ==='elfos'});
        const purpose=role==='acid'?'effect':civ==='humano'?(role==='heavy'?'call':role==='elite'?(variant===1?'foot':'call'):(variant===0?'foot':'call')):civ==='elfos'&&role==='heavy'&&variant===0?'effect':civ==='enanos'&&files.length>1&&variant===0&&info.duration>8?'foot':'call';
        fs.writeFileSync(path.join(output,name),bytes);clips.push({civ,role,variant,purpose,hash:createHash('sha256').update(bytes).digest('hex'),file:name,source:`${folder}/${file}`,...info});
        console.log(`${name}: ${info.duration}s; ${info.phrases.length} frases; ${info.steps.length} ataques cortos`);
      }
    }
  }
  fs.writeFileSync(path.join(output,'cues.json'),JSON.stringify({missing:[],aliases:[{source:'09_Sindicato_Mecanico/oron.mp3',name:'Dron',civ:'mecanico',role:'worker'}],clips},null,2)+'\n');
  const demos=[['pasos',[{file:'humano/worker.mp3',steps:true}]],['elfos',[{file:'elfos/worker.mp3'},{file:'elfos/ranged.mp3'},{file:'elfos/special.mp3'}]]];
  for(const [name,items] of demos){
    const entries=items.map(item=>{const clip=clips.find(c=>c.file===item.file);return {raw:fs.readFileSync(path.join(output,item.file)).toString('base64'),cues:item.steps?clip.steps.slice(0,8):clip.phrases.slice(0,1),steps:!!item.steps};});
    const pcm=await page.evaluate(async entries=>{
      const rate=22050,span=entries[0].steps?4:entries.reduce((n,e)=>n+e.cues[0].duration+.5,0),ctx=new OfflineAudioContext(1,Math.ceil(rate*span),rate);let at=0;
      for(const e of entries){const b=await ctx.decodeAudioData(Uint8Array.from(atob(e.raw),c=>c.charCodeAt(0)).buffer);
        for(const cue of e.cues){const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=b;const level=(e.steps?.24:.45)*Math.min(2,Math.max(.35,.12/Math.max(.015,cue.rms))),fade=Math.min(e.steps?.018:.12,cue.duration/3);
          gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+fade);gain.gain.setValueAtTime(level,at+cue.duration-fade);gain.gain.linearRampToValueAtTime(0,at+cue.duration);src.connect(gain).connect(ctx.destination);src.start(at,cue.start,cue.duration);at+=e.steps?34/82:cue.duration+.5;
        }
      }
      const rendered=await ctx.startRendering(),samples=rendered.getChannelData(0),bytes=new Uint8Array(44+samples.length*2),view=new DataView(bytes.buffer);
      const text=(p,s)=>{for(let i=0;i<s.length;i++)bytes[p+i]=s.charCodeAt(i);};text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
      for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    },entries);
    fs.writeFileSync(fileURLToPath(new URL(`../docs/land-sonidos-${name}.wav`,import.meta.url)),Buffer.from(pcm,'base64'));
  }
  console.log(`${clips.length} audios preparados; 10 civilizaciones; 60 personajes con audio propio.`);
}finally{await browser.close();}
