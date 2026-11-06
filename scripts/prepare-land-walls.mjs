/* global process, console, Buffer, Image, document */
// node scripts/prepare-land-walls.mjs <atlas-png-2x5>
import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
if(!process.argv[2])throw new Error('Indicá el atlas de diez muros en dos columnas y cinco filas.');
const raw=fs.readFileSync(process.argv[2]).toString('base64');
const browser=await chromium.launch();
try{
  const page=await browser.newPage();
  const encoded=await page.evaluate(async raw=>{
    const image=new Image();image.src='data:image/png;base64,'+raw;await image.decode();
    const cv=document.createElement('canvas');cv.width=image.naturalWidth;cv.height=image.naturalHeight;
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const p=ctx.getImageData(0,0,cv.width,cv.height),histogram=new Uint32Array(256);
    for(let i=3;i<p.data.length;i+=4)histogram[p.data[i]]++;
    let peak=255;for(let a=232;a<=255;a++)if(histogram[a]>histogram[peak])peak=a;
    for(let i=3;i<p.data.length;i+=4)p.data[i]=Math.max(0,Math.min(255,(p.data[i]-peak+12)*255/9));
    ctx.putImageData(p,0,0);return cv.toDataURL('image/webp',.96).split(',')[1];
  },raw);
  const output=fileURLToPath(new URL('../src/features/games/assets/land/walls.webp',import.meta.url));
  fs.writeFileSync(output,Buffer.from(encoded,'base64'));console.log(output);
}finally{await browser.close();}
