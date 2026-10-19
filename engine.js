export const mm = v => Math.round(Number(v) * 10);
export const cm = v => Number((v / 10).toFixed(1));
export function validateDrawer(d) {
  return ['width','depth','height'].every(k => Number.isInteger(d[k]) && d[k] >= 10 && d[k] <= 3000);
}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.d&&a.y+a.d>b.y;
export function pack(drawer, items, margin=0, gap=0) {
  if(!validateDrawer(drawer)) throw Error('请填写完整有效的抽屉尺寸');
  const W=drawer.width-2*margin,D=drawer.depth-2*margin;
  const invalid=[],eligible=[];
  for(const item of items){
    if(![item.w,item.d,item.h].every(n=>Number.isInteger(n)&&n>0)) throw Error('商品尺寸无效');
    if(item.h>drawer.height) invalid.push({...item,reason:'height'});
    else if(!((item.w<=W&&item.d<=D)||(item.rotate!==false&&item.d<=W&&item.w<=D))) invalid.push({...item,reason:'footprint'});
    else eligible.push(item);
  }
  const sorts=[(a,b)=>b.w*b.d-a.w*a.d,(a,b)=>Math.max(b.w,b.d)-Math.max(a.w,a.d),(a,b)=>b.w-a.w,(a,b)=>b.d-a.d];
  let best={placed:[],unplaced:eligible};
  for(const sort of sorts){
    const placed=[],unplaced=[];
    for(const item of [...eligible].sort((a,b)=>sort(a,b)||a.id.localeCompare(b.id))){
      const xs=[margin,...placed.map(p=>p.x+p.w+gap)],ys=[margin,...placed.map(p=>p.y+p.d+gap)];
      let candidate=null;
      for(const y of [...new Set(ys)].sort((a,b)=>a-b)) for(const x of [...new Set(xs)].sort((a,b)=>a-b)){
        const orientations=[[item.w,item.d,false]];
        if(item.rotate!==false&&item.w!==item.d)orientations.push([item.d,item.w,true]);
        for(const [w,d,rotated] of orientations){
          const p={...item,x,y,w,d,rotated};
          if(x+w>drawer.width-margin||y+d>drawer.depth-margin)continue;
          if(placed.some(b=>overlap({...p,w:w+gap,d:d+gap},{...b,w:b.w+gap,d:b.d+gap})))continue;
          if(!candidate||y<candidate.y||(y===candidate.y&&x<candidate.x))candidate=p;
        }
      }
      if(candidate)placed.push(candidate);else unplaced.push({...item,reason:'search'});
    }
    if(placed.length>best.placed.length||(placed.length===best.placed.length&&placed.reduce((a,p)=>a+p.w*p.d,0)>best.placed.reduce((a,p)=>a+p.w*p.d,0)))best={placed,unplaced};
  }
  const area=items.reduce((a,p)=>a+p.w*p.d,0), areaImpossible=area>Math.max(0,W)*Math.max(0,D);
  const unplaced=[...invalid,...best.unplaced];
  const touching=best.placed.some(p=>p.x===0||p.y===0||p.x+p.w===drawer.width||p.y+p.d===drawer.depth)||best.placed.some((p,i)=>best.placed.some((q,j)=>i!==j&&(p.x+p.w===q.x||p.y+p.d===q.y)&&overlap({...p,w:p.w+1,d:p.d+1},q)));
  return {placed:best.placed,unplaced,complete:unplaced.length===0&&items.length>0,areaImpossible,touching,headroom:best.placed.length?drawer.height-Math.max(...best.placed.map(p=>p.h)):null,algorithm:'stable-candidate-packing-v1'};
}
export function recommendations(drawer,{count=4,margin=10,gap=10,top=20,mode='all',placed=[]}={}){
  if(!validateDrawer(drawer)||!Number.isInteger(count)||count<1||count>50||[margin,gap,top].some(v=>!Number.isInteger(v)||v<0)||top>=drawer.height)return [];
  if(mode==='remaining'){
    const xs=[margin,...placed.map(p=>p.x+p.w+gap)],ys=[margin,...placed.map(p=>p.y+p.d+gap)];
    const candidates=[];
    for(const x of xs)for(const y of ys){
      for(const right of [drawer.width-margin,...placed.filter(p=>p.x>x).map(p=>p.x-gap)])for(const back of [drawer.depth-margin,...placed.filter(p=>p.y>y).map(p=>p.y-gap)]){
        const p={x,y,w:right-x,d:back-y};
        if(p.w<10||p.d<10||x<margin||y<margin||right>drawer.width-margin||back>drawer.depth-margin)continue;
        if(placed.some(b=>overlap({...p,w:p.w+gap,d:p.d+gap},{...b,w:b.w+gap,d:b.d+gap})))continue;
        candidates.push({...p,h:drawer.height-top,count:1,mode:'remaining'});
      }
    }
    return candidates.sort((a,b)=>b.w*b.d-a.w*a.d).filter((p,i,a)=>a.findIndex(q=>q.w===p.w&&q.d===p.d)===i).slice(0,3);
  }
  const results=[];
  for(let cols=1;cols<=count;cols++){
    const rows=Math.ceil(count/cols),w=Math.floor((drawer.width-2*margin-(cols-1)*gap)/cols),d=Math.floor((drawer.depth-2*margin-(rows-1)*gap)/rows);
    if(w<10||d<10)continue;
    const boxes=Array.from({length:count},(_,i)=>({id:`suggest-${i}`,name:'建议尺寸',sku:'custom',w,d,h:drawer.height-top,rotate:true}));
    const result=pack(drawer,boxes,margin,gap);
    if(result.complete)results.push({w,d,h:drawer.height-top,count,cols,rows,result,mode:'all'});
  }
  return results.sort((a,b)=>b.w*b.d-a.w*a.d||Math.abs(a.w-a.d)-Math.abs(b.w-b.d)).slice(0,3);
}
export function assertLayout(drawer,result,total){
  if(result.placed.length+result.unplaced.length!==total)throw Error('数量不守恒');
  result.placed.forEach((p,i)=>{if(p.x<0||p.y<0||p.x+p.w>drawer.width||p.y+p.d>drawer.depth||p.h>drawer.height)throw Error('越界');if(result.placed.slice(i+1).some(q=>overlap(p,q)))throw Error('重叠');});
}
export function bestCombination(drawer,catalog,limit=50){
  if(!validateDrawer(drawer))throw Error('请先填写有效抽屉尺寸');
  const eligible=catalog.filter(s=>s.h<=drawer.height&&((s.w<=drawer.width&&s.d<=drawer.depth)||(s.rotate!==false&&s.d<=drawer.width&&s.w<=drawer.depth)));
  const strategies=[(a,b)=>b.w*b.d-a.w*a.d,(a,b)=>Math.max(b.w,b.d)-Math.max(a.w,a.d),(a,b)=>a.w*a.d-b.w*b.d,...eligible.map(s=>(a,b)=>(b.id===s.id)-(a.id===s.id)||b.w*b.d-a.w*a.d)];
  let best=[];
  for(const strategy of strategies){
    const order=[...eligible].sort((a,b)=>strategy(a,b)||a.id.localeCompare(b.id)),placed=[],counts={};
    while(placed.length<limit){
      const xs=[0,...placed.map(p=>p.x+p.w)],ys=[0,...placed.map(p=>p.y+p.d)];let next=null;
      for(const y of [...new Set(ys)].sort((a,b)=>a-b)){
        for(const x of [...new Set(xs)].sort((a,b)=>a-b)){
          for(const s of order){const orientations=[[s.w,s.d,false],...(s.rotate===false||s.w===s.d?[]:[[s.d,s.w,true]])];
            for(const [w,d,rotated] of orientations){const p={...s,sku:s.id,x,y,w,d,rotated};if(x+w>drawer.width||y+d>drawer.depth||placed.some(q=>overlap(p,q)))continue;next=p;break;}if(next)break;
          }if(next)break;
        }if(next)break;
      }
      if(!next)break;counts[next.sku]=(counts[next.sku]||0)+1;next.id=`${next.sku}-${String(counts[next.sku]).padStart(2,'0')}`;placed.push(next);
    }
    const area=placed.reduce((n,p)=>n+p.w*p.d,0),bestArea=best.reduce((n,p)=>n+p.w*p.d,0);
    if(area>bestArea||(area===bestArea&&placed.length<best.length))best=placed;
  }
  const quantities=Object.fromEntries(catalog.map(s=>[s.id,0]));best.forEach(p=>quantities[p.sku]++);
  const area=best.reduce((n,p)=>n+p.w*p.d,0);
  return {quantities,placed:best,area,utilization:area/(drawer.width*drawer.depth),strategies:strategies.length,limited:best.length===limit};
}
export function moveBox(drawer,placed,id,x,y,tolerance=5){
 const p=placed.find(p=>p.id===id);if(!p)throw Error('未找到盒子');
 const clamp=(n,max)=>Math.max(0,Math.min(max,Math.round(n)));
 const raw={x:clamp(x,drawer.width-p.w),y:clamp(y,drawer.depth-p.d)};
 const others=placed.filter(q=>q.id!==id);
 const snap=(v,values)=>values.filter(n=>Math.abs(n-v)<=tolerance).sort((a,b)=>Math.abs(a-v)-Math.abs(b-v)||a-b)[0]??v;
 const sx=snap(raw.x,[0,drawer.width-p.w,...others.flatMap(q=>[q.x,q.x+q.w,q.x-p.w,q.x+q.w-p.w])]);
 const sy=snap(raw.y,[0,drawer.depth-p.d,...others.flatMap(q=>[q.y,q.y+q.d,q.y-p.d,q.y+q.d-p.d])]);
 const proposed={...p,x:clamp(sx,drawer.width-p.w),y:clamp(sy,drawer.depth-p.d)};
 if(!others.some(q=>overlap(proposed,q)))return {box:proposed,valid:true,snapped:proposed.x!==raw.x||proposed.y!==raw.y};
 const fallback={...p,...raw};
 if(!others.some(q=>overlap(fallback,q)))return {box:fallback,valid:true,snapped:false};
 return {box:proposed,valid:false,snapped:false};
}
export function rotateBox(drawer,placed,id){
 const p=placed.find(p=>p.id===id);if(!p)throw Error('未找到盒子');
 if(p.rotate===false)return {valid:false,reason:'该盒型不允许旋转'};
 const rotated={...p,w:p.d,d:p.w,rotated:!p.rotated};
 if(rotated.w>drawer.width||rotated.d>drawer.depth)return {valid:false,reason:'旋转后会超出抽屉'};
 const replaced=placed.map(q=>q.id===id?rotated:q);
 for(const [x,y] of [[p.x+(p.w-rotated.w)/2,p.y+(p.d-rotated.d)/2],[p.x,p.y]]){
  const r=moveBox(drawer,replaced,id,x,y,0);if(r.valid)return r;
 }
 return {valid:false,reason:'旋转后会与其他盒子重叠，请先移到空位'};
}
