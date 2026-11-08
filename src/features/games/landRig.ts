import {walkPose} from './landMotion';
type Point={x:number;y:number};
type Frame={sx:number;sy:number;sw:number;sh:number};
const cache=new Map<string,HTMLCanvasElement>();
let cachePixels=0;
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const rotate=(p:Point,pivot:Point,angle:number)=>({x:pivot.x+(p.x-pivot.x)*Math.cos(angle)-(p.y-pivot.y)*Math.sin(angle),y:pivot.y+(p.x-pivot.x)*Math.sin(angle)+(p.y-pivot.y)*Math.cos(angle)});
export function rigPoint(x:number,y:number,phase:number,walking:boolean,attack:number,kneel=0,work=0):Point{
  const pose=walkPose(phase,walking?1:0),p={x,y};
  const leg=(left:boolean)=>{const limb=left?pose.left:pose.right,hip={x:left?.29:.70,y:.58},knee={x:hip.x,y:.79};const bend=mix(p,rotate(p,knee,limb.knee),smooth(.74,.84,y));const result=rotate(bend,hip,limb.hip);result.y-=limb.lift;return result;};
  let result=mix(p,mix(leg(true),leg(false),smooth(.43,.57,x)),smooth(.55,.64,y));
  const arm=(left:boolean)=>{const limb=left?pose.left:pose.right,shoulder={x:left?.21:.79,y:.23},elbow={x:shoulder.x,y:.4},wrist={x:shoulder.x,y:.51},stroke=kneel*Math.sin(work+(left?0:.65));const hand=mix(p,rotate(p,wrist,limb.wrist-attack*.08),smooth(.46,.54,y));const bend=mix(hand,rotate(hand,elbow,limb.elbow+attack*.28+stroke*.18),smooth(.36,.46,y));return rotate(bend,shoulder,limb.arm-attack*.19-stroke*.12);};
  const armY=smooth(.16,.25,y)*(1-smooth(.53,.62,y));
  result=mix(result,arm(true),(1-smooth(.16,.30,x))*armY);result=mix(result,arm(false),smooth(.70,.84,x)*armY);
  result=mix(result,rotate(result,{x:.5,y:.57},pose.torso),1-smooth(.50,.63,y));
  if(kneel){
    const upper={x:x+.04+Math.max(0,.58-y)*.08,y:y+.17};
    const joint=(left:boolean)=>{const first=y<=.79,t=Math.max(0,Math.min(1,first?(y-.58)/.21:(y-.79)/.21)),hip={x:.04,y:.17},knee={x:left?-.04:.20,y:left?.16:.03},foot={x:left?-.14:.17,y:0},offset=mix(first?hip:knee,first?knee:foot,t);return {x:x+offset.x,y:y+offset.y};};
    let crouched=mix(upper,mix(joint(true),joint(false),smooth(.43,.57,x)),smooth(.54,.64,y));
    const reach=armY*smooth(.30,.48,y),stroke=Math.sin(work+(x<.5?0:.65));crouched={x:crouched.x+reach*(.055+stroke*.035),y:crouched.y+reach*(.045+Math.cos(work)*.025)};result=mix(result,crouched,kneel);
  }
  return result;
}
export function drawRig(ctx:CanvasRenderingContext2D,image:CanvasImageSource,frame:Frame,key:string,dw:number,dh:number,phase:number,attack:number,kneel=0,work=0){
  const walking=phase!==0,step=walking?Math.round(phase*16/Math.PI):0,hit=Math.round(attack*12),crouch=Math.round(kneel*4),workStep=crouch?Math.round(work*4/Math.PI)%8:0,id=`${key}:${walking?((step%32)+32)%32:'idle'}:${hit}:${crouch}:${workStep}`;
  let pose=cache.get(id);
  if(!pose){
    const h=256,w=h*frame.sw/frame.sh,pad=Math.ceil(h*.16),canvas=document.createElement('canvas');canvas.width=Math.ceil(w+pad*2);canvas.height=h+pad*2;const c=canvas.getContext('2d')!;const cols=10,rows=18,points:Point[][]=[];
    for(let j=0;j<=rows;j++){const row:Point[]=[];for(let i=0;i<=cols;i++){const p=rigPoint(i/cols,j/rows,step*Math.PI/16,walking,hit/12,crouch/4,workStep*Math.PI/4);row.push({x:p.x*w+pad,y:p.y*h+pad});}points.push(row);}
    const triangle=(uv:Point[],to:Point[])=>{
      const from=uv.map(p=>({x:p.x*frame.sw,y:p.y*frame.sh})),[a,b,d]=from,[p,q,r]=to;
      const det=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y),aa=((q.x-p.x)*(d.y-a.y)-(r.x-p.x)*(b.y-a.y))/det,bb=((q.y-p.y)*(d.y-a.y)-(r.y-p.y)*(b.y-a.y))/det,cc=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(d.x-a.x))/det,dd=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(d.x-a.x))/det;
      c.save();c.beginPath();const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};to.forEach((v,i)=>{const length=Math.hypot(v.x-center.x,v.y-center.y),x=v.x+(v.x-center.x)*.35/length,y=v.y+(v.y-center.y)*.35/length;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.closePath();c.clip();c.transform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);c.drawImage(image,frame.sx,frame.sy,frame.sw,frame.sh,0,0,frame.sw,frame.sh);c.restore();
    };
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a={x:i/cols,y:j/rows},b={x:(i+1)/cols,y:j/rows},d={x:(i+1)/cols,y:(j+1)/rows},e={x:i/cols,y:(j+1)/rows};triangle([a,b,d],[points[j][i],points[j][i+1],points[j+1][i+1]]);triangle([a,d,e],[points[j][i],points[j+1][i+1],points[j+1][i]]);}
    pose=canvas;const budget=typeof window!=='undefined'&&window.innerWidth<1101?8e6:24e6;while(cache.size&&(cachePixels+canvas.width*canvas.height>budget||cache.size>=256)){const oldest=cache.keys().next().value!,removed=cache.get(oldest)!;cachePixels-=removed.width*removed.height;cache.delete(oldest);}cachePixels+=canvas.width*canvas.height;cache.set(id,pose);
  }else{cache.delete(id);cache.set(id,pose);}
  const k=dh/256,pad=Math.ceil(256*.16);ctx.drawImage(pose,-dw/2-pad*k,-dh-pad*k,pose.width*k,pose.height*k);
}
