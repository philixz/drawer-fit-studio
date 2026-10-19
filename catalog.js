export function validateCatalog(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>20)throw Error('盒型需为1–20种');
 const ids=new Set();
 return rows.map((r,i)=>{
  const id=String(r.id??r.skuId??r.sku_id??`import-${i+1}`).trim();
  const name=String(r.name??r.sku_name??'').trim();
  const w=Number(r.w??r.widthMm??r.width_mm),d=Number(r.d??r.depthMm??r.depth_mm),h=Number(r.h??r.heightMm??r.height_mm);
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(id))throw Error(`第${i+1}行：ID只能包含字母、数字、下划线和短横线`);
  if(ids.has(id))throw Error(`第${i+1}行：ID ${id} 重复`);ids.add(id);
  if(!name||name.length>50)throw Error(`第${i+1}行：名称需为1–50字`);
  if(![w,d,h].every(v=>Number.isInteger(v)&&v>=10&&v<=3000))throw Error(`第${i+1}行：尺寸需为10–3000的整数毫米`);
  const rotate=r.rotate??r.rotatable90??r.rotatable_90??true;
  if(![true,false,'true','false'].includes(rotate))throw Error(`第${i+1}行：rotatable_90需为true或false`);
  const colors=['#b6c9aa','#b5d3e2','#d1bedb','#dfc4b0','#c7d7ae'];
  return {id,name,w,d,h,rotate:rotate!==false&&rotate!=='false',color:/^#[a-f\d]{6}$/i.test(r.color||'')?r.color:colors[i%colors.length]};
 });
}
export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV引号未闭合');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV需包含表头和至少一条盒型');
 const headers=rows.shift().map(v=>v.trim().replace(/^\uFEFF/,''));
 if(new Set(headers).size!==headers.length)throw Error('CSV存在重复表头');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`第${i+2}行列数与表头不一致`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
export function parseCatalog(text,filename){
 if(text.length>262144)throw Error('文件需小于256KB');
 const raw=filename.toLowerCase().endsWith('.csv')?parseCSV(text):JSON.parse(text.replace(/^\uFEFF/,''));
 return validateCatalog(Array.isArray(raw)?raw:raw.skus);
}
