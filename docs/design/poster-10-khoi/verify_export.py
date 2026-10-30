from pathlib import Path
import sys,json,re,unicodedata
import pymupdf as fitz
from PIL import Image
R=Path(__file__).resolve().parent
sys.path.insert(0,str(R/'.verify'))
import zxingcpp
doc=fitz.open(R/'AI-HOC-TAP-A1.pdf');page=doc[0]
actual=page.get_text()
def norm(t):return re.sub(r'\s+','',unicodedata.normalize('NFC',t))
expected=json.loads((R/'noi-dung-da-dan.json').read_text(encoding='utf-8'))
missing=[s for s in expected if norm(s) not in norm(actual)]
print('TEXT ITEMS',len(expected),'MISSING',missing)
assert not missing
assert abs(page.rect.width*25.4/72-594)<.01
assert abs(page.rect.height*25.4/72-841)<.01
pix=page.get_pixmap(matrix=fitz.Matrix(150/72,150/72),alpha=False)
pix.save(R/'AI-HOC-TAP-A1-150dpi.png')
small=page.get_pixmap(matrix=fitz.Matrix(1024/page.rect.width,1024/page.rect.width),alpha=False)
img=Image.frombytes('RGB',(small.width,small.height),small.samples)
preview=Image.new('RGB',(1024,1536),'white');preview.paste(img,((1024-img.width)//2,(1536-img.height)//2))
preview.save(R/'AI-HOC-TAP-preview-1024x1536.png')
for name in ['assets/qr-aihoctap.png','AI-HOC-TAP-preview-1024x1536.png','AI-HOC-TAP-A1-150dpi.png']:
    results=zxingcpp.read_barcodes(Image.open(R/name))
    urls=[b.text for b in results]
    print('QR',name,urls)
    assert 'https://aihoctap.online' in urls
fonts=[f[3] for f in page.get_fonts()]
print('FONTS',fonts)
assert all(any('BeVietnamPro-'+weight in f for f in fonts) for weight in ['Bold','ExtraBold','Regular','SemiBold','Italic'])
(R/'chu-trich-tu-pdf.txt').write_text(actual,encoding='utf-8')
qa={'page_mm':[page.rect.width*25.4/72,page.rect.height*25.4/72], 'preview_size':list(preview.size),'print_png_size':[pix.width,pix.height], 'text_items':len(expected), 'missing_text':missing,'qr_decoded':'https://aihoctap.online','fonts':fonts}
(R/'ket-qua-kiem-tra.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
print('EXPORT VERIFIED')
