/* global process, console, Image, document */
import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {fileURLToPath,URL} from 'node:url';
import {chromium} from 'playwright';
const browser=await chromium.launch();try{const page=await browser.newPage();for(let i=0;i<2;i++){const raw=fs.readFileSync(process.argv[i+2]).toString('base64'),encoded=await page.evaluate(async raw=>{const image=new Image();image.src='data:image/png;base64,'+raw;await image.decode();if(image.naturalWidth!==1536||image.naturalHeight!==1024)throw new Error('El atlas debe tener 1536 × 1024 píxeles');const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/webp',.94).split(',')[1];},raw),output=fileURLToPath(new URL(`../src/features/games/assets/land/leaders-${i+1}.webp`,import.meta.url));fs.writeFileSync(output,Buffer.from(encoded,'base64'));console.log(output);}}finally{await browser.close();}
