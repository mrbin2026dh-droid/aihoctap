// Ghép chính xác tư liệu gốc sau bản chỉnh imagegen, khóa toàn bộ chữ ngoài vùng sửa.
const fs=require('fs');
const path=require('path');
const sharp=require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1029-1117-0_26.1029.1117.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/sharp');
const dir=__dirname;
const src='C:/Users/HPZBook/Downloads/AI Học Tập_ Gợi Mở, Tự Hiểu (1).png';
const h2='C:/Users/HPZBook/Desktop/THI AI/1793348784088_2143738277388278586_8848293082619688753_f16de8ff19c15da2826dd009668c5f81.jpg';
const h3='C:/Users/HPZBook/Desktop/THI AI/1793348784553_2143738277388278586_8848293082619688753_744bc19fd3bcf0f7cbf411c457f0c3d6.jpg';
const regions=[{left:306,top:1168,width:320,height:144},{left:639,top:1168,width:354,height:144},{left:880,top:1344,width:104,height:104}];
async function photo(file,w,h,position){
  const mask=Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="6" fill="white"/></svg>`);
  return await sharp(file).resize(w,h,{fit:'cover',position,kernel:'lanczos3'}).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
}
(async()=>{
 const candidate=path.join(dir,'imagegen-edit.png');
 const candidateMeta=await sharp(candidate).metadata();
 const normalized=await sharp(candidate).resize(1024,1536,{fit:'fill'}).png().toBuffer();
 // Generated photo edge pixels are retained only inside the permitted photo rectangles.
 // The complete source, including every Vietnamese glyph, is the immutable base.
 const ops=[];
 for(const r of regions.slice(0,2)){
   ops.push({input:await sharp(normalized).extract(r).png().toBuffer(),left:r.left,top:r.top});
 }
 ops.push({input:await photo(h2,320,144,'centre'),left:306,top:1168});
 ops.push({input:await photo(h3,354,144,'south'),left:639,top:1168});
 const qr=await sharp(path.join(dir,'qr-dung-url.png')).resize(99,99,{kernel:'nearest'}).png().toBuffer();
 const qrPatch=await sharp({create:{width:104,height:104,channels:3,background:'#ffffff'}}).composite([{input:qr,left:2,top:2}]).png().toBuffer();
 ops.push({input:qrPatch,left:880,top:1344});
 const out=path.join(dir,'AI-HOC-TAP-thay-anh-sua-QR.png');
 await sharp(src).composite(ops).png({compressionLevel:9,palette:false}).toFile(out);
 const a=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(out).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let inside=0,outside=0;
 for(let y=0;y<1536;y++)for(let x=0;x<1024;x++){
   const k=(y*1024+x)*3;
   if(a.data[k]!==b.data[k]||a.data[k+1]!==b.data[k+1]||a.data[k+2]!==b.data[k+2]){
     if(regions.some(r=>x>=r.left&&x<r.left+r.width&&y>=r.top&&y<r.top+r.height))inside++;else outside++;
   }
 }
 const result={source:src,output:out,dimensions:[b.info.width,b.info.height],changed_pixels_inside:inside,changed_pixels_outside:outside,regions,candidate_dimensions:[candidateMeta.width,candidateMeta.height],url:'https://aihoctap.online'};
 fs.writeFileSync(path.join(dir,'kiem-tra-pixel.json'),JSON.stringify(result,null,2));
 if(outside!==0)throw new Error('Outside pixels changed: '+outside);
 console.log(JSON.stringify(result));
})();
