/* global process,console,Image,document */
import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {fileURLToPath,URL} from 'node:url';
import {chromium} from 'playwright';
// node scripts/prepare-land-evolutions.mjs manifest.json
// [{civ:"humano",path:".../generated_images/...png"}, ...]
const sources=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),browser=await chromium.launch();
try{const page=await browser.newPage();for(const {civ,path} of sources){
  if(!/^(humano|zergano|elfos|enanos|nomuerta|sauriano|infernal|mecanico|orcos|abisal)$/.test(civ))throw new Error('Civilización inválida');
  const result=await page.evaluate(async raw=>{const image=new Image();image.src='data:image/png;base64,'+raw;await image.decode();if(image.width!==1024||image.height!==1536)throw new Error('Se espera un atlas de 4 × 6 celdas cuadradas, 1024 × 1536');const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let transparent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<16)transparent++;if(transparent<pixels.length/4*.15)throw new Error('El atlas debe conservar transparencia real');for(let row=0;row<6;row++)for(let col=0;col<4;col++){let count=0;for(let y=row*256;y<(row+1)*256;y++)for(let x=col*256;x<(col+1)*256;x++)if(pixels[(y*1024+x)*4+3]>64)count++;if(count<500)throw new Error('Celda vacía: '+row+','+col);}return canvas.toDataURL('image/webp',.94).split(',')[1];},fs.readFileSync(path).toString('base64'));
  const output=fileURLToPath(new URL(`../src/features/games/assets/land/evolutions-${civ}.webp`,import.meta.url));fs.writeFileSync(output,Buffer.from(result,'base64'));console.log(output);
}}finally{await browser.close();}
