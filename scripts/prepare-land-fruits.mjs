/* global process,console,Image,document */
import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {chromium} from 'playwright';
// Convierte el PNG original a WebP y conserva el canal alfa.
const browser=await chromium.launch();
try{const page=await browser.newPage(),result=await page.evaluate(async raw=>{const image=new Image();image.src='data:image/png;base64,'+raw;await image.decode();const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*image.height/image.width);const c=canvas.getContext('2d');c.drawImage(image,0,0,canvas.width,canvas.height);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let clear=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<16)clear++;if(clear<pixels.length/4*.15)throw new Error('Falta transparencia real');return canvas.toDataURL('image/webp',.95).split(',')[1];},fs.readFileSync(process.argv[2]).toString('base64'));const out='src/features/games/assets/land/harvest-fruits.webp';fs.writeFileSync(out,Buffer.from(result,'base64'));console.log(out);}finally{await browser.close();}
