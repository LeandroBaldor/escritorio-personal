// Trim transparent padding and isolated specks without scaling or recoloring the artwork.
export function spriteBounds(pixels:Uint8ClampedArray,width:number,x0:number,y0:number,x1:number,y1:number){
 const w=x1-x0,h=y1-y0,visited=new Uint8Array(w*h),queue=new Int32Array(w*h),parts:{left:number;right:number;top:number;bottom:number;area:number}[]=[];
 const opaque=(index:number)=>pixels[((y0+Math.floor(index/w))*width+x0+index%w)*4+3]>100;
 for(let start=0;start<w*h;start++){if(visited[start])continue;visited[start]=1;if(!opaque(start))continue;let head=0,tail=1;queue[0]=start;const part={left:w,right:0,top:h,bottom:0,area:0};
  while(head<tail){const index=queue[head++],x=index%w,y=Math.floor(index/w);part.area++;part.left=Math.min(part.left,x);part.right=Math.max(part.right,x);part.top=Math.min(part.top,y);part.bottom=Math.max(part.bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const next=ny*w+nx;if(visited[next])continue;visited[next]=1;if(opaque(next))queue[tail++]=next;}
  }parts.push(part);
 }
 const largest=Math.max(0,...parts.map(p=>p.area)),keep=parts.filter(p=>p.area>=Math.max(8,largest*.02));
 if(!keep.length)return {sx:x0,sy:y0,sw:w,sh:h};
 const left=Math.min(...keep.map(p=>p.left)),right=Math.max(...keep.map(p=>p.right)),top=Math.min(...keep.map(p=>p.top)),bottom=Math.max(...keep.map(p=>p.bottom));
 return {sx:x0+left,sy:y0+top,sw:right-left+1,sh:bottom-top+1};
}
