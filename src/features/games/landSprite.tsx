import { useEffect, useRef } from 'react';
import { bIdx, drawSprite,drawPortrait, roleIdx } from './landArt';
import { TRAINING_ROLE, type CivId } from './landCivs';
import type { BKind } from './land';
export function BuildingSprite({civ,kind,w,h}:{civ:CivId;kind:BKind;w:number;h:number}){
  const role=TRAINING_ROLE[kind],badge=Math.max(18,Math.min(44,w*.26));
  return <span className="land-building-sprite" style={{width:w,height:h}} aria-hidden="true"><Sprite civ={civ} idx={bIdx(kind)} w={w} h={h}/>{role&&<span className="land-recruit-badge" style={{width:badge,height:badge*1.2}}><Sprite civ={civ} idx={roleIdx(role)} w={badge} h={badge*1.2}/></span>}</span>;
}
export function Sprite({ civ, idx, w, h, portrait = false,level=0 }: { civ: CivId; idx: number; w: number; h: number; portrait?: boolean;level?:number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const c = ref.current; if (!c) return;
      const k = Math.min(2, window.devicePixelRatio || 1); c.width = w * k; c.height = h * k;
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, w, h);
      if (!(portrait?drawPortrait(ctx,civ,idx,w,h,level):drawSprite(ctx,civ,idx,w/2,h-2,h-4,false,w-4,0,0,0,level))) frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [civ, idx, w, h, portrait,level]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}
