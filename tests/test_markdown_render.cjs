// Hiển thị nội dung bài học (Markdown) đúng, không còn ký tự lạ: bảng "| :--- |", danh sách lồng, đánh số, *nghiêng*, `mã`,
// công thức $\rightarrow$, liên kết chỉ https, không chạy HTML lạ. Chạy: node tests/test_markdown_render.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{const p=q.url.split('?')[0];if(p==='/t.html'){r.setHeader('content-type','text/html');return r.end('<!doctype html><meta charset=utf-8><div id=c></div>')}const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}r.setHeader('content-type','text/javascript');r.end(fs.readFileSync(f))}).listen(8213);
const MD=`# Bài 3: Thông tin trong giải quyết vấn đề
## 1. Tiêu chí đánh giá
| Tiêu chí | Ý nghĩa | Ví dụ |
| :--- | :---: | ---: |
| **1. Tính mới** | Phản ánh đúng thực tế | Xem văn bản năm mới nhất |
| 2. Tính chính xác | Đúng sự thật \\| số liệu | Lịch thi |
- Mục một với *chữ nghiêng* và \`=SUM(A1:A3)\`
  - Mục con: chọn **Data** $\\rightarrow$ **Sort**
  - Công thức $I = \\frac{U}{R}$, $1.5\\text{V}$, $x^{2}$
- Mục hai
1. Bước một
2. Bước hai
> Ghi nhớ: dòng một
> dòng hai
Xem [trang SGK](https://example.org/sgk) và [lạ](javascript:alert(1)) <img src=x onerror=alert(1)>
---
![Đèn tín hiệu](assets/x.png)`;
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('dialog');d.dismiss()});
 await p.goto('http://localhost:8213/t.html');
 const r=await p.evaluate(async md=>{const m=await import('/dom.js');const c=document.getElementById('c');m.renderMarkdown(c,md);
  return {text:c.textContent,ths:[...c.querySelectorAll('th')].map(x=>x.textContent),align:c.querySelector('th:nth-child(2)').style.textAlign,rows:c.querySelectorAll('tbody tr').length,td:c.querySelector('tbody tr td strong')?.textContent,cell2:c.querySelectorAll('tbody tr')[1].children[1].textContent,
   nested:c.querySelectorAll('ul > li > ul > li').length,ol:c.querySelectorAll('ol > li').length,em:c.querySelector('em')?.textContent,code:c.querySelector('li code')?.textContent,math:[...c.querySelectorAll('.math')].map(x=>x.textContent),
   bq:c.querySelectorAll('blockquote p').length,links:[...c.querySelectorAll('a')].map(a=>a.href),img:c.querySelectorAll('img').length,hr:c.querySelectorAll('hr').length,h:[...c.querySelectorAll('h2,h3')].map(x=>x.tagName)};},MD);
 ok(!/\|\s*:?---/.test(r.text)&&!r.text.includes('| **'),'bảng Markdown hiện thành bảng, không còn "| :--- |"');
 ok(r.ths.join()==='Tiêu chí,Ý nghĩa,Ví dụ'&&r.rows===2&&r.align==='center'&&r.td==='1. Tính mới'&&r.cell2==='Đúng sự thật | số liệu','bảng: tiêu đề, căn giữa theo ":---:", chữ đậm trong ô, dấu "\\|" trong ô');
 ok(r.nested===2&&r.ol===2,'danh sách lồng nhau và danh sách đánh số');
 ok(r.em==='chữ nghiêng'&&r.code==='=SUM(A1:A3)','chữ *nghiêng* và `mã` hiện đúng');
 ok(r.math.join('|')==='→|I = U/R|1.5V|x²','công thức $…$ đổi thành ký tự đọc được (→, phân số, đơn vị, mũ)');
 ok(r.bq===2&&r.hr===1&&r.h.join()==='H2,H2','trích dẫn nhiều dòng, đường kẻ, tiêu đề');
 ok(r.links.length===1&&r.links[0]==='https://example.org/sgk'&&!r.text.includes('javascript')&&r.img===0&&r.text.includes('<img src=x'),'chỉ liên kết https; "javascript:" và thẻ HTML lạ chỉ là chữ, không chạy');
 ok(r.text.includes('(Hình: Đèn tín hiệu)')&&!r.text.includes('$')&&!r.text.includes('\\\\'),'hình thay bằng chú thích; không còn ký tự $ hay \\\\');
 ok(errs.length===0,'không lỗi, không bật hộp thoại lạ '+errs.join('|'));
 console.log('MARKDOWN RENDER OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
