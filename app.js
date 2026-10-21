import {validateCatalog,parseCatalog} from './catalog.js';
import {pack,recommendations,validateDrawer,cm,mm,bestCombination,moveBox,rotateBox} from './engine.js';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultCatalog=[{id:'A',name:'A款 · 大盒',w:180,d:260,h:80,color:'#b6c9aa'},{id:'B',name:'B款 · 小盒',w:180,d:130,h:80,color:'#b5d3e2'},{id:'H',name:'B款 · 高盒',w:180,d:130,h:110,color:'#d1bedb'},{id:'C',name:'C款 · 超大盒',w:420,d:320,h:80,color:'#dfc4b0'}];
let catalog=structuredClone(defaultCatalog);
let combinationResult=null;
let deletedBox=null;
let selectedBox=null,moveControls=false;
const initial={drawer:{width:'',depth:'',height:''},quantities:{A:0,B:0,H:0,C:0},active:'drawer'};
let state=structuredClone(initial), custom=null,original=null,result=null,lastValid=null,mode='all',candidates=[];
try{const saved=JSON.parse(localStorage.getItem('drawer-fit-v1'));if(saved?.version===1){if(saved.catalog)catalog=saved.catalog.length?validateCatalog(saved.catalog):[];state={...initial,drawer:{...initial.drawer,...saved.drawer},quantities:{...initial.quantities,...saved.quantities}};for(const k of Object.keys(state.quantities))if(!Number.isInteger(state.quantities[k])||state.quantities[k]<0||state.quantities[k]>50)state.quantities[k]=0;}}catch{}
try{const shared=new URLSearchParams(location.hash.slice(1)).get('catalog');if(shared){catalog=validateCatalog(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(shared),c=>c.charCodeAt(0)))));state.quantities={};}}catch{setTimeout(()=>notify('分享目录格式无效，已保留本地盒型'),0);}
state.quantities=Object.fromEntries(catalog.map(s=>[s.id,state.quantities[s.id]||0]));
const dims=i=>`${cm(i.w)} × ${cm(i.d)} × ${cm(i.h)} cm`;
const drawer=()=>Object.fromEntries(Object.entries(state.drawer).map(([k,v])=>[k,mm(v)]));
const total=()=>Object.values(state.quantities).reduce((a,n)=>a+Number(n||0),0);
function items(){return catalog.flatMap(s=>Array.from({length:Math.max(0,Math.min(50,Number(state.quantities[s.id])||0))},(_,i)=>({...s,id:`${s.id}-${String(i+1).padStart(2,'0')}`,sku:s.id,rotate:s.rotate!==false})));}
function inputStatus(){const values=Object.values(state.drawer);if(values.some(v=>v===''))return 'unconfigured';return validateDrawer(drawer())&&values.every(v=>Math.abs(Number(v)*10-Math.round(Number(v)*10))<1e-7)?'configured':'error';}
const badge=(status)=>`<span class="badge ${status==='configured'?'good':status==='error'?'bad':''}">${{configured:'✓ 已配置',error:'! 错误配置',unconfigured:'未配置'}[status]}</span>`;
function save(){try{localStorage.setItem('drawer-fit-v1',JSON.stringify({version:1,drawer:state.drawer,quantities:state.quantities,catalog}));}catch{}}
function compute(){
  const valid=inputStatus()==='configured'&&total()<=50;
  if(valid){result=custom?.result||combinationResult||pack(drawer(),items());if(total()>0||custom)lastValid={drawer:drawer(),result};}else result=null;
  save();
}
function panel(key,num,title,status,summary,body){const active=state.active===key;return `<section class="accordion ${active?'active':''}"><button class="panel-head" data-panel="${key}" aria-expanded="${active}" aria-controls="body-${key}"><span class="step">0${num}</span><span class="panel-title">${title}</span>${badge(status)}<span class="chevron">${active?'⌃':'⌄'}</span></button><div id="body-${key}" ${active?'':'hidden'}>${active?`<div class="panel-content">${body}</div>`:''}</div>${!active?`<div class="panel-summary">${summary}</div>`:''}</section>`;}
function renderSidebar(){
  const status=inputStatus(),d=drawer(),rows=items(),allCount=custom?custom.result.placed.length+custom.result.unplaced.length:total();
  const bads=new Set(result?.unplaced.filter(p=>p.reason!=='search').map(p=>p.sku)||[]);
  const productStatus=total()>50?'error':custom?'configured':!total()?'unconfigured':bads.size?'error':'configured';
  const summaryStatus=status==='unconfigured'||(!total()&&!custom)?'unconfigured':!result||!result.complete?'error':'configured';
  const drawerBody=['width','depth','height'].map((k,i)=>`<div class="field"><label for="drawer-${k}">${['宽度','深度','可用高'][i]}</label><div class="input-unit"><input id="drawer-${k}" data-drawer="${k}" type="number" min="1" max="300" step="0.1" inputmode="decimal" placeholder="${['如 40','如 30','如 10'][i]}" value="${esc(state.drawer[k])}"><span>cm</span></div></div>`).join('')+(status==='error'?'<p class="error">尺寸需为 1–300 cm，精确到 0.1 cm。</p>':'')+`<details class="measure"><summary>ⓘ 尺寸怎么量？</summary><p>宽度指左右，深度指前后。测量抽屉内部最小可用空间；可用高需确保抽屉能闭合，避开滑轨和突出部分。</p></details><button class="text-button wide" data-action="example">使用示例尺寸与商品</button>`;
  const productBody=custom?`<div class="notice">当前是自定义尺寸建议，非真实商品。</div>${custom.items.map(p=>`<div class="summary-row">${dims(p)}<b>× ${p.count}</b></div>`).join('')}<button class="wide" data-action="restore">返回原商品方案</button>`:catalog.map(s=>`<div class="sku"><div class="sku-top"><span class="sku-name"><i class="swatch" style="background:${s.color}"></i>${esc(s.name)}</span><div class="counter"><button data-qty="${s.id}" data-delta="-1" aria-label="减少${esc(s.name)}">−</button><input aria-label="${esc(s.name)}数量" data-count="${s.id}" type="number" min="0" max="50" value="${state.quantities[s.id]}"><button data-qty="${s.id}" data-delta="1" aria-label="增加${esc(s.name)}">+</button></div></div><div class="sku-dim">${dims(s)} · 外部最大尺寸 <button class="sku-edit text-button" data-edit="${esc(s.id)}" aria-label="修改${esc(s.name)}">修改</button><button class="sku-delete text-button" data-delete="${esc(s.id)}" aria-label="删除${esc(s.name)}">删除</button></div>${bads.has(s.id)?`<div class="height-error">${s.h>d.height?`高度 <b>${cm(s.h)} cm</b> · 超出可用高 ${cm(s.h-d.height)} cm`:'该规格两种方向均无法放入'}<br>请减少数量或选择其他规格。</div>`:''}</div>`).join('')+`<p class="small muted">本地盒型可修改、可导入。共选 ${total()} 个，最多 50 个。</p>${total()>50?'<p class="error">总数量超过50个，请减少。</p>':''}`;
  const catalogTools=`<div class="catalog-tools"><button class="primary" data-action="best" ${status!=='configured'?'disabled':''}>✧ 一键最佳组合</button><div><button data-action="new-box">＋ 新增盒型</button><button data-action="import-boxes">⇧ 导入盒型</button></div><p class="small muted">按利用率选择盒型与数量，生成后由你确认。</p>${deletedBox?'<button class="text-button" data-action="undo-delete">撤销上次删除</button>':''}</div>`;
  const summaryBody=(custom?custom.items.map(p=>`<div class="summary-row"><div>自定义建议<small>${dims(p)}</small></div><b>×${p.count}</b></div>`).join(''):catalog.filter(s=>state.quantities[s.id]>0).map(s=>`<div class="summary-row"><div>${esc(s.name)}<small>${dims(s)}</small></div><b>×${state.quantities[s.id]}</b></div>`).join(''))||'<p class="muted small">选好商品数量后，清单会显示在这里。</p>';
  $('#sidebar').innerHTML=panel('drawer',1,'抽屉尺寸',status,status==='configured'?`${cm(d.width)} × ${cm(d.depth)} × ${cm(d.height)} cm`:'请填写内部可用尺寸',drawerBody)+panel('products',2,'收纳盒',productStatus,custom?'自定义尺寸方案':`${catalog.filter(s=>state.quantities[s.id]>0).length} 种规格 · 共 ${total()} 个${bads.size?' · 有尺寸问题':''}`,catalogTools+productBody)+panel('summary',3,'组合清单',summaryStatus,result?`已排入 ${result.placed.length} / ${allCount}${result.unplaced.length?' · 有盒子未排入':''}`:'等待有效配置',summaryBody+`<button class="primary wide" data-action="export" ${!result||!allCount?'disabled':''}>导出尺寸方案</button>`)+`<p class="aside-note">ⓘ 一次只展开当前编辑项。<button class="text-button" data-action="reset">重置</button></p>`;
}
function svg(d,r,diagnostic=false){
 const W=d.width,D=d.depth,pad=76,scale=Math.min(590/W,390/D),w=W*scale,h=D*scale,x=pad,y=44;
 const rects=r.placed.map(p=>`<g data-box="${esc(p.id)}" tabindex="0" role="button" aria-label="移动盒子${esc(p.id)}，拖动或使用方向键" class="movable-box"><rect x="${x+p.x*scale}" y="${y+(D-p.y-p.d)*scale}" width="${p.w*scale}" height="${p.d*scale}" rx="5" fill="${p.color||'#b6c9aa'}" stroke="#fff" stroke-width="3"/><text x="${x+(p.x+p.w/2)*scale}" y="${y+(D-p.y-p.d/2)*scale-6}" text-anchor="middle" font-size="${Math.max(8,Math.min(14,p.w*scale/6))}" fill="#304334">${esc(p.id)}</text><text x="${x+(p.x+p.w/2)*scale}" y="${y+(D-p.y-p.d/2)*scale+13}" text-anchor="middle" font-size="${Math.max(7,Math.min(11,p.w*scale/8))}" fill="#405344">${cm(p.w)} × ${cm(p.d)} cm</text></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="抽屉宽${cm(W)}深${cm(D)}厘米，已排入${r.placed.length}个收纳盒" data-mm-scale="${scale}" viewBox="0 0 ${w+pad*2} ${h+110}"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e9ece4" stroke-width=".6"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="#7c8879" stroke-width="2"/></marker></defs><rect x="${x-10}" y="${y-10}" width="${w+20}" height="${h+20}" rx="9" fill="#eee9df" stroke="#c9c8b9"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#f8f9f4" stroke="#b0b9a6"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#grid)"/>${rects}<path d="M${x} ${y-25}H${x+w}" stroke="#7c8879" marker-start="url(#arrow)" marker-end="url(#arrow)"/><text x="${x+w/2}" y="${y-34}" text-anchor="middle" font-size="13" fill="#5d6c58">宽 ${cm(W)} cm</text><path d="M${x-30} ${y}V${y+h}" stroke="#7c8879" marker-start="url(#arrow)" marker-end="url(#arrow)"/><text x="${x-39}" y="${y+h/2}" transform="rotate(-90 ${x-39} ${y+h/2})" text-anchor="middle" font-size="13" fill="#5d6c58">深 ${cm(D)} cm</text><text x="${x+w/2}" y="${y+h+42}" text-anchor="middle" font-size="11" fill="#8b9485">${diagnostic?'示例数据 · 不是你的配置':'可拖动微调 · 自动吸附 · 不改变尺寸'}</text></svg>`;
}
function renderPreview(){
 const valid=inputStatus()==='configured'&&total()<=50, has=valid&&(total()>0||custom), d=drawer();
 if(!has){$('#canvas').classList.add('noninteractive');const exd={width:400,depth:300,height:100},exr=pack(exd,[{...catalog[0],id:'A-01'}, {...catalog[1],id:'B-01'},{...catalog[1],id:'B-02'}]);const stale=lastValid&&inputStatus()!=='configured';$('#canvas').innerHTML=`<span class="example-pill">${stale?'尚未更新 · 上次有效结果':'示例画面'}</span>${stale?svg(lastValid.drawer,lastValid.result):svg(exd,exr,true)}`;$('#result-status').innerHTML=`<div class="status neutral"><span>ⓘ</span><div>${inputStatus()==='error'?'请修正左侧尺寸':inputStatus()==='unconfigured'?'填写抽屉尺寸，查看实际结果':'选择商品规格与数量，开始自动排布'}<small>当前画面不代表这次配置的适配结论。</small></div></div>`;$('#unplaced').innerHTML='';$('#preview-actions').innerHTML='';selectedBox=null;renderBoxControls();return;}
 $('#canvas').classList.remove('noninteractive');$('#preview-title').textContent=custom?'尺寸建议预览':'组合预览';$('#canvas').innerHTML=svg(d,result);
 const height=result.unplaced.filter(p=>p.reason==='height'),foot=result.unplaced.filter(p=>p.reason==='footprint');
 let title='根据当前参数，未见尺寸冲突',detail=`已排入 ${result.placed.length} 个 · 高度余量 ${cm(result.headroom||0)} cm`,cls='';
 if(height.length){title=`${height.length} 个盒子高度超出`;detail=`商品高 ${cm(height[0].h)} cm，抽屉可用高 ${cm(d.height)} cm，超出 ${cm(height[0].h-d.height)} cm。请切换规格。`;cls='bad';}
 else if(foot.length){title='部分规格在两种方向均无法放入';detail='请对照商品外部尺寸，选择更小规格。';cls='bad';}
 else if(result.areaImpossible){title='所选盒子的总底面积超过抽屉可用面积';detail='需要减少数量或选择更小规格。';cls='bad';}
 else if(!result.complete){title='当前未找到完整排布';detail='不代表一定放不下。可减少数量、换规格，或推荐适配尺寸。';cls='warn';}
 else if(result.touching){title='几何尺寸可容纳，部分边缘无余量';detail=`高度余量 ${cm(result.headroom||0)} cm。请复核实际尺寸与制造公差。`;cls='warn';}
 if(custom)detail+=' · 自定义建议，尚未匹配实际商品。';
 $('#result-status').innerHTML=`<div class="status ${cls}"><span>${cls==='bad'?'!':cls==='warn'?'!':'✓'}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`;
 $('#unplaced').innerHTML=result.unplaced.length?`<div class="unplaced"><b>待排入 ${result.unplaced.length} 个</b>${result.unplaced.map(p=>`<span>${esc(p.id)} · ${dims(p)} · ${{height:'超高',footprint:'底面超界',search:'未找到位置'}[p.reason]}</span>`).join('')}</div>`:'';
 $('#preview-actions').innerHTML=`<div class="preview-actions">${custom?'<button data-action="restore">返回原方案</button>':''}<button data-action="export">导出方案</button><button class="primary" data-action="recommend">${result.complete?'探索其他尺寸':'推荐适配尺寸'} →</button></div>`;
}
function render(){$('#catalog-label').textContent='演示 / 本地盒型 · 无库存信息';compute();renderSidebar();renderPreview();renderBoxControls();}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function example(){catalog=structuredClone(defaultCatalog);combinationResult=null;custom=null;original=null;state.drawer={width:'40',depth:'30',height:'10'};state.quantities={A:1,B:2,H:0,C:0};state.active='products';render();}
function restore(){if(original){state=structuredClone(original);original=null;}custom=null;render();}
function openRecommend(){if(!result)return;mode='all';$('#rec-count').value=Math.min(50,Math.max(1,total()||4));$$('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('#rec-count').disabled=false;$('#recommend').showModal();renderCandidates();}
const $$=s=>[...document.querySelectorAll(s)];
function recSettings(){return {count:Number($('#rec-count').value),margin:mm($('#rec-margin').value),gap:mm($('#rec-gap').value),top:mm($('#rec-top').value),mode,placed:result?.placed||[]};}
function renderCandidates(){const settings=recSettings();candidates=recommendations(drawer(),settings);$('#candidates').innerHTML=candidates.length?candidates.map((p,i)=>`<article class="candidate"><div class="candidate-main"><span class="eyebrow">候选 0${i+1}</span><p><strong>${dims(p)}</strong> × ${p.count}</p><p>${mode==='all'?`${p.cols} 列 × ${p.rows} 行，末行可能有空位`:'保留现有位置，补 1 个盒子'} · 最大外尺寸建议</p></div><button class="primary" data-adopt="${i}">采用方案</button></article>`).join(''):'<div class="notice">当前条件下没有可用建议。请检查数量、边距、间隙和顶部余量；保留模式只推荐现有布局中的一个空位。</div>';}
function adopt(i){const p=candidates[i];if(!p)return;const settings=recSettings();if(!original)original=structuredClone(state);const additions=Array.from({length:p.count},(_,j)=>({id:`建议-${j+1}`,sku:'custom',name:'建议尺寸',w:p.w,d:p.d,h:p.h,color:'#abc5aa',rotate:true}));const r=mode==='all'?p.result:{...result,placed:[...result.placed,{...additions[0],x:p.x,y:p.y}],unplaced:[],complete:true,touching:false,headroom:Math.min(result.headroom??drawer().height,drawer().height-p.h)};custom={result:r,items:[...(mode==='remaining'?catalog.filter(s=>r.placed.some(b=>b.sku===s.id)).map(s=>({...s,count:r.placed.filter(b=>b.sku===s.id).length})):[]),{...p}],settings};state.active='summary';$('#recommend').close();render();notify('已采用尺寸建议，原商品方案已保留');}
function openExport(){if(!result||inputStatus()!=='configured')return;$('#export-description').textContent=`${custom?'自定义尺寸建议':'模拟商品组合'} · 抽屉 ${cm(drawer().width)} × ${cm(drawer().depth)} × ${cm(drawer().height)} cm · ${result.complete?'已完整排入':'未完整排入，仅供诊断'}`;$('#export-feedback').textContent='';$('#export-dialog').showModal();}
const reason=p=>({height:'高度超出',footprint:'底面超界',search:'未找到位置'}[p.reason]||'已排入');
function exportText(){const d=drawer();return `抽屉收纳尺寸方案\n类型：${custom?'自定义建议（非真实商品）':'模拟商品目录 demo-2026-10-19'}\n抽屉：${cm(d.width)} × ${cm(d.depth)} × ${cm(d.height)} cm\n状态：${result.complete?'按输入尺寸已排入':'未完整排入，仅供诊断'}\n${[...result.placed,...result.unplaced].map(p=>`${p.id}：${dims(p)}，${reason(p)}`).join('\n')}\n边距：${custom?cm(custom.settings.margin):0} cm，间隙：${custom?cm(custom.settings.gap):0} cm\n仅供尺寸沟通，不含可打印模型；实际需复核测量与工艺。`;}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function csvExport(){const d=drawer(),lines=[['类型',custom?'自定义建议':'模拟目录'],['目录版本','demo-2026-10-19'],['抽屉宽cm',cm(d.width),'深cm',cm(d.depth),'可用高cm',cm(d.height)],['布局状态',result.complete?'已完整排入':'未完整排入，仅供诊断'],['边距cm',custom?cm(custom.settings.margin):0,'间隙cm',custom?cm(custom.settings.gap):0],['实例','规格','外宽cm','外深cm','外高cm','状态'],...[...result.placed,...result.unplaced].map(p=>[p.id,p.sku,cm(p.rotated?p.d:p.w),cm(p.rotated?p.w:p.d),cm(p.h),reason(p)]),['说明','仅为尺寸清单，不包含可打印模型']];download(new Blob(['\uFEFF'+lines.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'收纳尺寸清单.csv');$('#export-feedback').textContent='CSV 已生成';}
async function pngExport(){const source=$('#canvas svg');if(!source)return;const image=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)],{type:'image/svg+xml'}));try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1100;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1400,1100);ctx.fillStyle='#26382d';ctx.font='bold 30px sans-serif';ctx.fillText('抽屉收纳尺寸方案'+(custom?' · 自定义建议':''),50,55);ctx.drawImage(image,50,80,1300,720);ctx.font='19px sans-serif';const lines=exportText().split('\n').filter((s,i)=>i<4||s.startsWith('边距')||s.startsWith('仅供'));if(result.unplaced.length)lines.push('待排入：'+result.unplaced.map(p=>`${p.id} ${dims(p)} ${reason(p)}`).join('；'));lines.forEach((s,i)=>ctx.fillText(s,50,825+i*33,1300));canvas.toBlob(b=>{if(b)download(b,'收纳布局图.png');},'image/png');$('#export-feedback').textContent='PNG 已生成';}catch{$('#export-feedback').textContent='图片导出失败，请重试或先导出CSV。';}finally{URL.revokeObjectURL(url);}}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.matches('.close')){b.closest('dialog').close();return;}
 if(b.dataset.panel){state.active=state.active===b.dataset.panel?null:b.dataset.panel;renderSidebar();return;}
 if(b.dataset.qty){const id=b.dataset.qty;state.quantities[id]=Math.max(0,Math.min(50,Number(state.quantities[id])+Number(b.dataset.delta)));custom=null;original=null;combinationResult=null;render();return;}
 if(b.dataset.mode){mode=b.dataset.mode;$$('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));$('#rec-count').disabled=mode==='remaining';renderCandidates();return;}
 if(b.dataset.adopt!==undefined){adopt(Number(b.dataset.adopt));return;}
 const action=b.dataset.action;if(action==='example')example();if(action==='restore')restore();if(action==='recommend')openRecommend();if(action==='export')openExport();if(action==='reset'&&confirm('重置抽屉与所选数量？商品目录会保留。')){state=structuredClone(initial);custom=null;original=null;combinationResult=null;lastValid=null;state.quantities=Object.fromEntries(catalog.map(s=>[s.id,0]));render();}
 if(b.id==='help')$('#welcome').showModal();if(b.id==='start'){$('#welcome').close();state.active='drawer';renderSidebar();$('#drawer-width')?.focus();}
 if(b.id==='share'){const url=new URL(location.href);url.search='';url.hash=new URLSearchParams({catalog:btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(catalog))))}).toString();notify(await copyText(url.href)?'已复制商品目录链接（不含个人布局）':'复制失败，请从地址栏分享此页面');}
 if(b.id==='csv')csvExport();if(b.id==='png')await pngExport();if(b.id==='copy'){$('#export-feedback').textContent=await copyText(exportText())?'尺寸已复制，可发给商家询问。':'浏览器未允许复制，请导出CSV尺寸清单。';}
});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.drawer){state.drawer[t.dataset.drawer]=t.value;custom=null;original=null;combinationResult=null;render();}if(t.dataset.count){const n=Number(t.value);if(!Number.isInteger(n)||n<0||n>50){notify('数量需为0–50的整数');t.value=state.quantities[t.dataset.count];return;}state.quantities[t.dataset.count]=n;custom=null;original=null;combinationResult=null;render();}if(t.closest('.recommend-settings'))renderCandidates();});
$('#welcome').addEventListener('close',()=>{try{localStorage.setItem('drawer-fit-guide','seen');}catch{}});
let editingId=null,importedCatalog=null,bestCandidate=null;
document.body.insertAdjacentHTML('beforeend',`
<dialog id="box-editor"><button class="close" aria-label="关闭盒型修改">×</button><span class="eyebrow">本地盒型</span><h2 id="editor-title">修改盒型</h2><p class="muted small">修改会影响该盒型的全部实例，并重新排布。原始商品参数请与商家核实。</p><form id="box-form"><label>盒型名称<input id="box-name" maxlength="50" required></label><div class="recommend-settings"><label>外宽 cm<input id="box-w" type="number" min="1" max="300" step="0.1" required></label><label>外深 cm<input id="box-d" type="number" min="1" max="300" step="0.1" required></label><label>外高 cm<input id="box-h" type="number" min="1" max="300" step="0.1" required></label></div><label class="rotate-check"><input id="box-rotate" type="checkbox" checked> 允许底面旋转90°</label><p id="box-error" class="error" role="alert"></p><button class="primary wide" type="submit">保存并重新排布</button></form></dialog>
<dialog id="catalog-import"><button class="close" aria-label="关闭盒型导入">×</button><span class="eyebrow">批量添加</span><h2>一键导入盒型</h2><p class="muted small">支持CSV、JSON，最多20种盒型、文件不超过256KB。CSV使用整数毫米；请先下载模板。</p><button id="import-template">下载CSV模板</button><label class="file-label">选择文件<input id="catalog-file" type="file" accept=".csv,.json,text/csv,application/json"></label><p class="small muted">导入采用合并方式：相同ID更新尺寸与名称，保留原数量；新ID数量为0。未出现在文件中的盒型保留。</p><div id="import-preview" aria-live="polite"></div><button id="import-confirm" class="primary wide" disabled>确认导入并重新排布</button></dialog>
<dialog id="best-dialog"><button class="close" aria-label="关闭组合建议">×</button><span class="eyebrow">从现有盒型中搭配</span><h2>一键最佳组合</h2><p class="muted small">优先填满抽屉底面；同利用率优先更少盒子。忽略当前数量，假设盒型可重复选用，最多50个，不代表库存。</p><div id="best-result" aria-live="polite"></div><div class="notice">这是有限候选中利用率最高的方案，不保证全局最优。默认边距与间隙为0，购买前请核实公差。</div><button id="apply-best" class="primary wide" disabled>采用组合并更新数量</button></dialog>`);
function editBox(id){
 editingId=id||null;const s=catalog.find(s=>s.id===id);
 $('#editor-title').textContent=s?'修改盒型':'新增盒型';$('#box-name').value=s?.name||'';
 for(const k of ['w','d','h'])$('#box-'+k).value=s?cm(s[k]):'';
 $('#box-rotate').checked=s?.rotate!==false;$('#box-error').textContent='';$('#box-editor').showModal();
}
function invalidateLayout(){custom=null;original=null;combinationResult=null;lastValid=null;}
$('#box-form').addEventListener('submit',e=>{
 e.preventDefault();try{
  if(['w','d','h'].some(k=>Math.abs(Number($('#box-'+k).value)*10-Math.round(Number($('#box-'+k).value)*10))>1e-7))throw Error('尺寸请精确到0.1cm');
  const old=catalog.find(s=>s.id===editingId);const row={id:editingId||'local-'+Date.now(),name:$('#box-name').value.trim(),w:mm($('#box-w').value),d:mm($('#box-d').value),h:mm($('#box-h').value),rotate:$('#box-rotate').checked,color:old?.color};
  const next=validateCatalog(old?catalog.map(s=>s.id===editingId?row:s):[...catalog,row]);
  catalog=next;if(!old)state.quantities[row.id]=0;invalidateLayout();state.active='products';$('#box-editor').close();render();notify('盒型已保存，相关实例已重新排布');
 }catch(err){$('#box-error').textContent=err.message;}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.edit){editBox(b.dataset.edit);return;}
 if(b.dataset.action==='new-box')editBox();
 if(b.dataset.action==='import-boxes'){importedCatalog=null;$('#catalog-file').value='';$('#import-preview').innerHTML='';$('#import-confirm').disabled=true;$('#catalog-import').showModal();}
 if(b.id==='import-template')download(new Blob(['\uFEFFsku_id,sku_name,width_mm,depth_mm,height_mm,rotatable_90\r\nA,A款大盒,180,260,80,true\r\nB,B款小盒,180,130,80,true\r\n'],{type:'text/csv;charset=utf-8'}),'盒型导入模板.csv');
 if(b.id==='import-confirm'&&importedCatalog){const ids=new Set(catalog.map(s=>s.id));catalog=validateCatalog([...catalog.map(s=>importedCatalog.find(r=>r.id===s.id)||s),...importedCatalog.filter(r=>!ids.has(r.id))]);catalog.forEach(s=>{state.quantities[s.id]??=0;});invalidateLayout();state.active='products';$('#catalog-import').close();render();notify('盒型已导入，原数量保留');}
 if(b.dataset.action==='best'){
  if(inputStatus()!=='configured'){notify('请先填写抽屉尺寸');return;}
  $('#best-dialog').showModal();$('#best-result').innerHTML='<p>正在比较盒型组合…</p>';$('#apply-best').disabled=true;
  setTimeout(()=>{try{bestCandidate=bestCombination(drawer(),catalog);$('#best-result').innerHTML=bestCandidate.placed.length?`<div class="best-utilization"><strong>${(bestCandidate.utilization*100).toFixed(1)}<small>%</small></strong><span>底面积利用率 · 共${bestCandidate.placed.length}个</span></div>${catalog.filter(s=>bestCandidate.quantities[s.id]>0).map(s=>`<div class="summary-row"><div>${esc(s.name)}<small>${dims(s)}</small></div><b>×${bestCandidate.quantities[s.id]}</b></div>`).join('')}<p class="small muted">比较${bestCandidate.strategies}种候选策略${bestCandidate.limited?'，已达到50个上限':''}。采用前不会改动当前方案。</p>`:'<p class="error">没有能放入的盒型，请修改盒型尺寸或导入其他盒型。</p>';$('#apply-best').disabled=!bestCandidate.placed.length;}catch(err){$('#best-result').textContent=err.message;}},30);
 }
 if(b.id==='apply-best'&&bestCandidate?.placed.length){invalidateLayout();state.quantities={...bestCandidate.quantities};combinationResult={placed:bestCandidate.placed,unplaced:[],complete:true,touching:true,headroom:drawer().height-Math.max(...bestCandidate.placed.map(s=>s.h)),areaImpossible:false};state.active='products';$('#best-dialog').close();render();notify('已更新盒型数量与排布');}
});
$('#catalog-file').addEventListener('change',async e=>{
 importedCatalog=null;$('#import-confirm').disabled=true;const f=e.target.files[0];if(!f)return;
 try{if(f.size>262144)throw Error('文件需小于256KB');const rows=parseCatalog(await f.text(),f.name);const ids=new Set(catalog.map(s=>s.id));const merged=[...catalog.filter(s=>!rows.some(r=>r.id===s.id)),...rows];validateCatalog(merged);importedCatalog=rows;$('#import-preview').innerHTML=`<p>读取到 ${rows.length} 种盒型：更新 ${rows.filter(s=>ids.has(s.id)).length} 种，新增 ${rows.filter(s=>!ids.has(s.id)).length} 种。</p>${rows.map(s=>`<div class="summary-row"><div>${esc(s.name)}<small>ID: ${esc(s.id)}</small></div><span>${dims(s)}</span></div>`).join('')}`;$('#import-confirm').disabled=false;}catch(err){$('#import-preview').textContent='导入失败：'+err.message;}
});
document.body.insertAdjacentHTML('beforeend',`<dialog id="delete-box"><button class="close" aria-label="取消删除盒型">×</button><h2>删除盒型？</h2><p id="delete-description"></p><p class="small muted">该盒型的所有实例会从抽屉中移除，其他盒型重新排布。可撤销本次删除。</p><button id="confirm-delete" class="primary wide">确认删除</button></dialog>`);
let deletingId=null;
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.delete){deletingId=b.dataset.delete;const s=catalog.find(s=>s.id===deletingId);$('#delete-description').textContent=`${s.name} · ${dims(s)}，当前数量 ${state.quantities[s.id]||0} 个。`;$('#delete-box').showModal();}
 if(b.id==='confirm-delete'){
  const index=catalog.findIndex(s=>s.id===deletingId);if(index<0)return;
  deletedBox={box:structuredClone(catalog[index]),index,count:state.quantities[deletingId]||0};catalog.splice(index,1);delete state.quantities[deletingId];invalidateLayout();state.active='products';$('#delete-box').close();render();notify('盒型已删除，可在左侧撤销');
 }
 if(b.dataset.action==='undo-delete'&&deletedBox){
  if(catalog.some(s=>s.id===deletedBox.box.id)||catalog.length>=20){notify('盒型ID已存在或数量达上限，无法撤销');return;}
  catalog.splice(Math.min(deletedBox.index,catalog.length),0,deletedBox.box);state.quantities[deletedBox.box.id]=deletedBox.count;deletedBox=null;invalidateLayout();render();notify('已恢复盒型及原数量');
 }
});
function commitMove(id,moved){
 if(!result)return;const next={...result,placed:result.placed.map(p=>p.id===id?{...p,...moved}:p),manual:true};
 next.touching=next.placed.some(p=>p.x===0||p.y===0||p.x+p.w===drawer().width||p.y+p.d===drawer().depth)||next.placed.some((p,i)=>next.placed.some((q,j)=>i!==j&&((p.x+p.w===q.x||q.x+q.w===p.x)&&p.y<q.y+q.d&&p.y+p.d>q.y||(p.y+p.d===q.y||q.y+q.d===p.y)&&p.x<q.x+q.w&&p.x+p.w>q.x)));
 if(custom){custom.result=next;custom.settings={...custom.settings,margin:0,gap:0,manual:true};}else combinationResult=next;
 render();
}
let dragging=null;
const canvas=$('#canvas');
function pointInSvg(svg,e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
canvas.addEventListener('pointerdown',e=>{
 const group=e.target.closest('[data-box]');if(!group||canvas.classList.contains('noninteractive')||!result||e.button!==0)return;
 const box=result.placed.find(p=>p.id===group.dataset.box);if(!box)return;
 selectedBox=box.id;renderBoxControls();
 const svg=group.ownerSVGElement,scale=Number(svg.dataset.mmScale),point=pointInSvg(svg,e);
 dragging={id:box.id,group,svg,scale,point,box:{...box},pointerId:e.pointerId,moved:false};canvas.setPointerCapture(e.pointerId);group.classList.add('dragging');group.focus();e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
 if(!dragging||dragging.pointerId!==e.pointerId)return;
 const a=dragging,p=pointInSvg(a.svg,e),x=a.box.x+(p.x-a.point.x)/a.scale,y=a.box.y-(p.y-a.point.y)/a.scale;
 const ctm=a.svg.getScreenCTM(),tolerance=8/(a.scale*Math.hypot(ctm.a,ctm.b));
 const moved=moveBox(drawer(),result.placed,a.id,x,y,tolerance);a.next=moved;a.moved=a.moved||Math.abs(p.x-a.point.x)+Math.abs(p.y-a.point.y)>2;
 a.group.setAttribute('transform',`translate(${(moved.box.x-a.box.x)*a.scale},${-(moved.box.y-a.box.y)*a.scale})`);a.group.classList.toggle('drag-invalid',!moved.valid);e.preventDefault();
});
function finishDrag(e,cancel=false){
 if(!dragging||dragging.pointerId!==e.pointerId)return;const a=dragging;dragging=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 if(!cancel&&a.moved&&a.next?.valid){commitMove(a.id,a.next.box);notify(a.next.snapped?'已吸附到边缘':'位置已更新，尺寸保持不变');}else{a.group.removeAttribute('transform');a.group.classList.remove('dragging','drag-invalid');if(a.moved&&!cancel)notify('此位置与其他盒子重叠，已回到原位');}
}
canvas.addEventListener('pointerup',e=>finishDrag(e));canvas.addEventListener('pointercancel',e=>finishDrag(e,true));
canvas.addEventListener('keydown',e=>{
 const group=e.target.closest('[data-box]');if(!group||canvas.classList.contains('noninteractive')||!result||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();const box=result.placed.find(p=>p.id===group.dataset.box),step=e.shiftKey?10:1;
 const moved=moveBox(drawer(),result.placed,box.id,box.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),box.y+(e.key==='ArrowDown'?-step:e.key==='ArrowUp'?step:0),0);
 if(moved.valid){commitMove(box.id,moved.box);[...canvas.querySelectorAll('[data-box]')].find(g=>g.dataset.box===box.id)?.focus();}else notify('该方向被其他盒子挡住');
});

const boxControls=document.createElement('div');boxControls.id='box-controls';$('#canvas').after(boxControls);
function renderBoxControls(){
 const p=result?.placed.find(p=>p.id===selectedBox);
 for(const g of document.querySelectorAll('[data-box]'))g.classList.toggle('selected-box',g.dataset.box===selectedBox);
 if(!p||$('#canvas').classList.contains('noninteractive')){boxControls.innerHTML='<p class="small muted">点击盒子，可旋转或移动；拖动时自动吸附。</p>';return;}
 boxControls.innerHTML=`<div class="box-toolbar"><span><b>${esc(p.id)}</b> · ${cm(p.w)} × ${cm(p.d)} cm</span><button data-box-action="rotate" ${p.rotate===false?'disabled':''} title="旋转90度">↻ 旋转90°</button><button data-box-action="move" aria-pressed="${moveControls}">✥ 位移</button></div>${moveControls?'<div class="nudge-controls"><span>每次移动1cm</span><button data-nudge="left" aria-label="左移1厘米">←</button><button data-nudge="up" aria-label="上移1厘米">↑</button><button data-nudge="down" aria-label="下移1厘米">↓</button><button data-nudge="right" aria-label="右移1厘米">→</button><small>也可直接拖动盒子</small></div>':''}`;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.boxAction==='move'){moveControls=!moveControls;renderBoxControls();}
 if(b.dataset.boxAction==='rotate'){
  const rotated=rotateBox(drawer(),result.placed,selectedBox);
  if(rotated.valid){commitMove(selectedBox,rotated.box);notify('已旋转90°，盒型尺寸不变');}else notify(rotated.reason);
 }
 if(b.dataset.nudge){const p=result?.placed.find(p=>p.id===selectedBox);if(!p)return;const direction=b.dataset.nudge;
  const moved=moveBox(drawer(),result.placed,p.id,p.x+(direction==='left'?-10:direction==='right'?10:0),p.y+(direction==='up'?10:direction==='down'?-10:0),0);
  if(moved.valid)commitMove(p.id,moved.box);else notify('移动后会重叠，位置未改变');
 }
});
render();try{if(!localStorage.getItem('drawer-fit-guide'))$('#welcome').showModal();}catch{}

// Screenshot sample import: prefilled data only; no image recognition service.
document.body.insertAdjacentHTML('beforeend',`<dialog id="shot-import"><button class="close" aria-label="关闭截图导入">×</button><span class="eyebrow">截图导入 · 预置示例</span><h2>核对商品规格</h2><p class="small muted">使用已核对的商品截图与预填数据演示导入，不会自动识别其他图片。</p><div class="shot-review"><a href="screenshot-sample.jpg" target="_blank" rel="noopener"><img src="screenshot-sample.jpg" alt="三款收纳盒商品尺寸截图，点击查看原图"></a><div id="shot-rows"></div></div><div class="notice">大号图中的5cm、3.2cm是隔间标注，未作为外尺寸。请核对外部最大尺寸；单位cm。</div><label class="rotate-check"><input type="checkbox" id="shot-verified"> 我已核对外尺寸与单位</label><p class="small muted">导入会合并盒型：相同示例ID更新规格并保留数量，新盒型数量为0。导入后选择数量或使用最佳组合。</p><p id="shot-error" class="error" role="alert"></p><button id="shot-apply" class="primary wide">确认导入所选盒型</button></dialog>`);
const shotSamples=[{id:'shot-lid',name:'台面带盖款',w:260,d:95,h:55},{id:'shot-large',name:'抽屉款·大号',w:260,d:172,h:57},{id:'shot-small',name:'基础款·小号',w:260,d:90,h:57}];
const shotEntry=document.createElement('button');shotEntry.id='shot-open';shotEntry.className='primary wide';shotEntry.textContent='▧ 截图导入 · 试用预置示例';$('#catalog-import h2').after(shotEntry);
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='shot-open'){
  $('#catalog-import').close();$('#shot-verified').checked=false;$('#shot-error').textContent='';
  $('#shot-rows').innerHTML=shotSamples.map((s,i)=>`<div class="shot-row"><label><input type="checkbox" data-shot-pick="${i}" checked> ${esc(s.name)}</label><div class="shot-dims">${[['w','长'],['d','宽'],['h','高']].map(([k,label])=>`<label>${label}<input aria-label="${esc(s.name)}外${label}" data-shot-row="${i}" data-shot-dim="${k}" type="number" min="1" max="300" step="0.1" value="${cm(s[k])}"></label>`).join('')}</div></div>`).join('');$('#shot-import').showModal();
 }
 if(b.id==='shot-apply')try{
  if(!$('#shot-verified').checked)throw Error('请先核对外尺寸与单位并勾选确认');
  const picks=[...document.querySelectorAll('[data-shot-pick]:checked')];if(!picks.length)throw Error('请至少选择一个盒型');
  const rows=validateCatalog(picks.map(p=>{const i=Number(p.dataset.shotPick),s={...shotSamples[i],rotate:true};for(const input of document.querySelectorAll(`[data-shot-row="${i}"]`)){if(!input.checkValidity())throw Error('尺寸需为1–300cm，精确到0.1cm');s[input.dataset.shotDim]=mm(input.value);}return s;}));
  const ids=new Set(catalog.map(s=>s.id));const next=validateCatalog([...catalog.map(s=>rows.find(r=>r.id===s.id)||s),...rows.filter(s=>!ids.has(s.id))]);
  catalog=next;rows.forEach(s=>{state.quantities[s.id]??=0;});invalidateLayout();state.active='products';$('#shot-import').close();render();notify(`已导入${rows.length}种盒型，请选择数量`);
 }catch(err){$('#shot-error').textContent=err.message;}
});


