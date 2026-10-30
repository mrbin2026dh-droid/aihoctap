"""Dàn trang tài liệu poster; không sửa mã ứng dụng. Chữ giữ nguyên bản người dùng."""
from pathlib import Path
import sys, math, json, html, re
ROOT=Path(__file__).resolve().parent
AS=ROOT/'assets'
sys.path.append(r'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1029-1117-0_26.1029.1117.0_x64__3k8sg7r9htsxt/dependencies/python/Lib/site-packages')
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, toColor
from reportlab.lib.utils import ImageReader
from PIL import Image
import qrcode

W,H=1200,1699
MM=72/25.4
S=594*MM/W
NAVY='#0A1E6E'; TEAL='#0F766E'; INK='#10292C'; GOLD='#F5C451'
LAV='#EFEDFF'; PEACH='#F9ECE7'; PALE='#E9F7F3'; BORDER='#BBD8DF'
for weight in ['Regular','SemiBold','Bold','ExtraBold','Italic']:
    pdfmetrics.registerFont(TTFont(weight,str(AS/f'BeVietnamPro-{weight}.ttf')))
OUT=ROOT/'AI-HOC-TAP-A1.pdf'
c=canvas.Canvas(str(OUT),pagesize=(594*MM,841*MM))
c.setTitle('AI HỌC TẬP'); c.setAuthor('Poster AI HỌC TẬP')
c.scale(S,S)
TEXT=[]; BOUNDS=[]

def fill(v): c.setFillColor(toColor(v))
def stroke(v): c.setStrokeColor(toColor(v))
def rect(x,y,w,h,color='white',edge=None,r=10,lw=.7):
    fill(color); stroke(edge or color); c.setLineWidth(lw)
    c.roundRect(x,H-y-h,w,h,r,stroke=bool(edge),fill=1)
def line(x1,y1,x2,y2,color=BORDER,lw=1):
    stroke(color); c.setLineWidth(lw); c.line(x1,H-y1,x2,H-y2)
def circle(x,y,r,color,edge=None,lw=1):
    fill(color); stroke(edge or color); c.setLineWidth(lw)
    c.circle(x,H-y,r,stroke=bool(edge),fill=1)
def text(t,x,y,size=12,font='Regular',color=INK,align='left',record=True):
    if record: TEXT.append(t)
    fill(color); c.setFont(font,size)
    fn={'left':c.drawString,'center':c.drawCentredString,'right':c.drawRightString}[align]
    fn(x,H-y-size*.82,t)
def wrap(t,width,size,font='Regular'):
    lines=[]
    for paragraph in t.split('\n'):
        result=''
        for word in paragraph.split(' '):
            nxt=result+' '+word if result else word
            if pdfmetrics.stringWidth(nxt,font,size)>width and result:
                lines.append(result); result=word
            else: result=nxt
        lines.append(result)
    return lines
def para(t,x,y,w,size=12,font='Regular',color=INK,leading=None,align='left',maxh=None):
    TEXT.append(t); leading=leading or size*1.28
    ls=wrap(t,w,size,font)
    if maxh and len(ls)*leading>maxh: raise ValueError(f'Overflow {t}: {len(ls)*leading}>{maxh}')
    for i,s in enumerate(ls):
        text(s,x if align=='left' else x+w/2,y+i*leading,size,font,color,align,False)
    BOUNDS.append([t,x,y,w,len(ls)*leading,size])
    return len(ls)*leading
def image(path,x,y,w,h,cover=False):
    im=Image.open(path); iw,ih=im.size
    factor=max(w/iw,h/ih) if cover else min(w/iw,h/ih)
    dw,dh=iw*factor,ih*factor
    c.saveState(); p=c.beginPath();p.roundRect(x,H-y-h,w,h,8);c.clipPath(p,stroke=0,fill=0)
    c.drawImage(ImageReader(im),x+(w-dw)/2,H-y-h+(h-dh)/2,dw,dh,mask='auto')
    c.restoreState()
def icon(kind,x,y,s=22,color=NAVY,bg=None):
    if bg: circle(x,y,s*.68,bg)
    c.saveState();stroke(color);fill(color);c.setLineWidth(s*.065)
    def ln(a,b,d,e):line(x+a*s,y+b*s,x+d*s,y+e*s,color,s*.065)
    def ring(a,b,r):
        stroke(color);c.circle(x+a*s,H-y-b*s,r*s,fill=0,stroke=1)
    if kind=='book':
        for a in [-.45,.03]:
            c.roundRect(x+a*s,H-y-.3*s,.42*s,.65*s,.04*s,fill=0,stroke=1)
        ln(0,-.3,0,.4)
    elif kind in ['bulb','question']:
        ring(0,-.12,.31);ln(-.15,.21,-.15,.36);ln(.15,.21,.15,.36);ln(-.15,.36,.15,.36);ln(-.1,.46,.1,.46)
        text('?',x,y-.32*s,s*.42,'Bold',color,'center',False)
        if kind=='bulb':
            for a in [-2.6,-1.57,-.5]:
                ln(math.cos(a)*.42,math.sin(a)*.42-.1,math.cos(a)*.56,math.sin(a)*.56-.1)
    elif kind in ['brain','cloud']:
        for a,b,r in [(-.25,0,.22),(0,-.14,.28),(.28,0,.23),(0,.15,.25)]:ring(a,b,r)
        if kind=='brain':ln(0,-.32,0,.37);ln(-.25,.03,-.06,.03);ln(.05,.12,.25,.12)
    elif kind=='database':
        c.ellipse(x-.38*s,H-y-.02*s,x+.38*s,H-y+.22*s,stroke=1,fill=0)
        c.ellipse(x-.38*s,H-y-.35*s,x+.38*s,H-y-.11*s,stroke=1,fill=0)
        ln(-.38,-.1,-.38,.27);ln(.38,-.1,.38,.27)
    elif kind in ['chart','target']:
        for i,v in enumerate([.2,.48,.72]):
            rect(x+(-.39+i*.29)*s,y+(.36-v)*s,.18*s,v*s,color,r=.03*s)
        ln(-.5,.42,.5,.42)
    elif kind=='shield':
        p=c.beginPath();p.moveTo(x-.36*s,H-y+.3*s);p.lineTo(x,H-y+.44*s);p.lineTo(x+.36*s,H-y+.3*s);p.lineTo(x+.29*s,H-y-.17*s);p.lineTo(x,H-y-.43*s);p.lineTo(x-.29*s,H-y-.17*s);p.close();c.drawPath(p,stroke=1,fill=0)
        ln(-.16,.01,-.02,.16);ln(-.02,.16,.22,-.15)
    elif kind in ['people','person']:
        ring(0,-.22,.16);ring(-.3,-.1,.11);ring(.3,-.1,.11)
        for a,b,w,h in [(-.18,.03,.36,.32),(-.48,.08,.22,.28),(.26,.08,.22,.28)]:
            rect(x+a*s,y+b*s,w*s,h*s,color,r=.08*s)
    elif kind=='check':ln(-.3,0,-.08,.25);ln(-.08,.25,.35,-.27)
    elif kind=='lock':
        c.roundRect(x-.3*s,H-y-.35*s,.6*s,.45*s,.06*s,fill=0,stroke=1);ring(0,-.12,.22)
    elif kind=='device':
        c.roundRect(x-.4*s,H-y-.2*s,.56*s,.48*s,.035*s,fill=0,stroke=1)
        c.roundRect(x+.23*s,H-y-.32*s,.22*s,.47*s,.035*s,fill=0,stroke=1);ln(-.2,.33,-.05,.33)
    elif kind=='trophy':
        ln(-.3,-.36,-.2,.1);ln(-.2,.1,0,.22);ln(0,.22,.2,.1);ln(.2,.1,.3,-.36);ln(-.3,-.36,.3,-.36);ln(0,.22,0,.4);ln(-.22,.43,.22,.43)
        ring(-.35,-.1,.17);ring(.35,-.1,.17)
    else:
        c.roundRect(x-.32*s,H-y-.32*s,.64*s,.64*s,.09*s,fill=0,stroke=1);ln(-.15,0,.15,0);ln(0,-.15,0,.15)
    c.restoreState()
def heading(title,x,y,w,kind='book',size=19):
    tabw=min(w-18,pdfmetrics.stringWidth(title,'Bold',size)+64)
    rect(x+10,y-1,tabw,32,NAVY,r=9)
    icon(kind,x+30,y+14,20,'white')
    text(title,x+49,y+6,size,'Bold','white')
def placeholder(caption,x,y,w,h):
    rect(x,y,w,h,'#FFFFFF',BORDER,6)
    para(caption,x+7,y+(h-13)/2,w-14,9.7,'Regular',TEAL,align='center',maxh=h)
def square_bullet(t,x,y,w,size=11.2):
    rect(x,y+2,15,15,'white','#C9DFDA',4);icon('check',x+7.5,y+9.5,9,TEAL)
    para(t,x+22,y,w-22,size,leading=14,maxh=31)
def speech(t,x,y,w,h,size=11):
    rect(x,y,w,h,'white','#A9C7D6',9)
    para(t,x+6,y+7,w-12,size,'Italic',NAVY,align='center',leading=size*1.15,maxh=h-10)

# Background, header and very subtle circuit tracery.
rect(0,0,W,H,'white',r=0)
rect(0,0,W,204,NAVY,r=0)
for i in range(10):
    x=i*133-80; yy=35+(i%4)*20
    line(x,yy,x+74,yy,'#1F4388',.7);line(x+74,yy,x+104,yy+30,'#1F4388',.7)
    circle(x+106,yy+32,2,'#478DA2')
for x in [420,543,666]:rect(x,10,110,25,NAVY,'#5974AC',5)
icon('bulb',306,92,48,GOLD);icon('book',306,130,45,'#B8E8E1')
text('AI HỌC TẬP',625,45,66,'ExtraBold','white','center')
para('Hỏi để hiểu –\nkhông hỏi để chép',25,88,225,17,'Italic','white',align='center')
para('AI thấy chỗ\nem còn nhầm',955,88,215,17,'Italic','white',align='center')
text('Gia sư AI và lớp học số môn Tin học THCS – gợi mở, không chép đáp án',600,143,16,'SemiBold','white','center')
rect(18,174,1164,25,'#15377D','#47659D',7)
text('Giáo viên thực hiện: [HỌTÊN] | Đơn vị: [TRƯỜNG] | Lĩnh vực: Tin học 6–9 – Bảng B (THCS)',600,181,12,'SemiBold','white','center')

# Context and goals.
for x in [18,604]:rect(x,216,578,207,'white',BORDER,12)
heading('BỐI CẢNH & VẤN ĐỀ',18,213,578,'question')
heading('MỤC TIÊU',604,213,578,'target')
problems=[
'Học sinh hỏi AI thường nhận sẵn đáp án, không tự nghĩ; AI còn trả lời ngoài sách.',
'Giáo viên mất nhiều giờ chấm, tổng hợp; khó biết em nào chưa nắm bài, sai vì sao.',
'Trò chơi câu hỏi, lấy ý kiến có kết quả nhưng không kịp phân tích trong tiết.',
'Thi thực hành phòng máy dễ nhìn bài nhau, khó lưu minh chứng.']
for i,t in enumerate(problems):
    yy=254+i*39
    circle(43,yy+10,13,PALE);text(f'{i+1:02}',43,yy+1,12,'Bold',TEAL,'center')
    para(t,65,yy,369,11.2,leading=14,maxh=36)
image(AS/'hoc-sinh.png',442,289,145,128)
rect(513,258,5,83,'#C8AE79',r=1)
for i,t in enumerate(['Hỏi AI?','Chép đáp án?','Tự nghĩ?']):
    rect(451,252+i*22,130,20,'#FBF2D9',r=4);text(t,516,256+i*22,10.3,'SemiBold',NAVY,'center')
goals=[
'Học sinh tự hiểu bài nhờ Gia sư AI gợi mở theo đúng sách giáo khoa.',
'Giáo viên có trợ lý AI phân tích lớp, thấy ngay hiểu lầm và em cần hỗ trợ.',
'Hoạt động trên lớp và thi có dữ liệu, minh chứng, công bằng.']
for i,t in enumerate(goals):
    yy=259+i*51
    circle(630,yy+10,13,PALE);text(f'{i+1:02}',630,yy+1,12,'Bold',TEAL,'center')
    para(t,651,yy,351,11.7,leading=15,maxh=42)
speech('Thấy rõ từng em',1022,249,148,34,10.5)
image(AS/'giao-vien.png',1013,285,159,133)

# Two integrated subsystems.
rect(18,438,1164,324,'white',BORDER,12)
heading('GIẢI PHÁP: MỘT ỨNG DỤNG, HAI PHÂN HỆ',18,434,1164,'device',19)
rect(28,478,464,274,PALE,r=10);rect(708,478,464,274,LAV,r=10)
rect(145,481,333,29,TEAL,r=8);text('PHÂN HỆ HỌC SINH',311.5,488,15,'Bold','white','center')
rect(722,481,334,29,NAVY,r=8);text('PHÂN HỆ GIÁO VIÊN',889,488,15,'Bold','white','center')
speech('Hiểu bài –\nkhông chép bài',33,522,109,45,10.5)
image(AS/'hoc-sinh.png',30,578,114,143)
speech('Dạy đúng chỗ\nem còn yếu',1058,522,108,45,10.3)
rect(1061,576,83,42,'white','#C8CCE5',5)
icon('chart',1102,597,32,TEAL)
image(AS/'giao-vien.png',1063,578,104,144)
students=[
'Đăng nhập bằng mã học sinh + mã PIN',
'Đọc bài Tin học 6–9, lưu tiến độ đọc',
'Gia sư AI gợi mở, không đưa đáp án',
'Luyện tập theo bài + Bản đồ năng lực',
'Luyện tập trực tiếp trên lớp, bục vinh danh',
'Bảng thi đua tháng: top 10 + hạng của em',
'Thảo luận: đám mây từ, bình chọn, hỏi đáp ẩn danh',
'Thi thử / Thi thật: đảo câu từng em, nộp file thực hành']
teachers=[
'Bộ não AI: báo cáo 7 mục mỗi lớp',
'AI phân tích lớp hiểu bài sau Luyện tập',
'AI tổng hợp ý kiến Thảo luận',
'Tổng quan lớp: câu sai nhiều, em cần hỗ trợ',
'AI soạn đề, agent tự giải kiểm lại (giáo viên duyệt)',
'AI gợi ý chấm tự luận (giáo viên duyệt)',
'Theo dõi ca thi, minh chứng Google Drive',
'Bảng thi đua, tài khoản từ Google Sheet']
for i,t in enumerate(students):square_bullet(t,149,519+i*28,332,10.7)
for i,t in enumerate(teachers):square_bullet(t,721,519+i*28,334,10.7)
icon('cloud',599,525,62,TEAL);icon('database',599,542,30,NAVY)
for xx,sgn in [(508,-1),(692,1)]:
    line(xx-sgn*23,543,xx,543,TEAL,2);line(xx,543,xx-sgn*7,537,TEAL,2);line(xx,543,xx-sgn*7,549,TEAL,2)
para('Firebase thời gian thực + Gemini AI qua máy chủ riêng',509,579,182,12.4,'Bold',NAVY,align='center',leading=17,maxh=70)
for i,t in enumerate(['Đồng bộ tức thì','Ẩn danh khi gửi AI','Mọi thiết bị, cài như app']):
    circle(521,665+i*29,9,TEAL);icon('check',521,665+i*29,12,'white')
    para(t,538,657+i*29,158,10.2,'SemiBold',TEAL,leading=12,maxh=26)

# Three AI highlights: intentionally strongest color contrast and gold framing.
rect(18,775,1164,246,PEACH,'#ECC4AF',13,1.3)
heading('BA ĐIỂM NHẤN AI',18,772,1164,'brain',20)
highlights=[
('GIA SƯ AI GỢI MỞ','question',[
'Giải thích theo đúng bài học',
'Hỏi gợi mở, không đưa đáp án',
'Biết chỗ em còn nhầm để hỏi đúng chỗ'], '[Ảnh: Gia sư từ chối đưa đáp án]'),
('BỘ NÃO AI: TRỢ LÝ THỨ HAI CỦA THẦY CÔ','brain',[
'Mỗi tối tự phân tích từng lớp',
'Báo cáo 7 mục: hiểu lầm, câu cần xem lại, em cần chú ý, việc tuần tới',
'Máy tính số, AI viết lời; tên em thành HS1, HS2'], '[Ảnh: Báo cáo Bộ não AI]'),
('AI PHÂN TÍCH NGAY SAU MỖI BUỔI','chart',[
'Luyện tập: mức hiểu, hiểu lầm, gợi ý dạy lại 5–10 phút',
'Thảo luận: gom ý kiến thành 2–4 nhóm ý chính',
'Đọc 40 ý kiến trong 1 phút'], '[Ảnh: AI tổng hợp ý kiến Thảo luận]')]
for i,(title,kind,bullets,cap) in enumerate(highlights):
    x=29+i*385
    rect(x,815,374,174,'white','#E7BC7B',10,1)
    circle(x+24,838,16,GOLD);text(str(i+1),x+24,827,19,'ExtraBold',NAVY,'center')
    icon(kind,x+350,839,25,TEAL)
    para(title,x+50,824,278,12.5,'Bold',NAVY,leading=15,maxh=47)
    yy=866
    for t in bullets:
        text('–',x+12,yy,10.4,'SemiBold',TEAL)
        hh=para(t,x+26,yy,334,10.4,leading=12.8,maxh=40)
        yy+=hh+3
    # Caption itself is the entire empty screenshot placeholder.
    placeholder(cap,x+9,947,356,39)

# Closed loop strip, four numbered circles with actual loop-return arrow.
flow=['Học sinh học, luyện tập, thảo luận','AI phân tích sau buổi','Bộ não AI tổng hợp mỗi tối','Gia sư và thầy cô dạy đúng chỗ em nhầm']
for i,t in enumerate(flow):
    x=42+i*288
    circle(x+5,1006,8,PALE,TEAL,.8)
    icon(['people','chart','brain','bulb'][i],x+5,1006,10,TEAL)
    para(t,x+18,996,241,9.2,'SemiBold',NAVY,leading=10.8,maxh=23)
    if i<3:
        line(x+261,1006,x+277,1006,TEAL,1.1);line(x+277,1006,x+273,1002,TEAL,1.1);line(x+277,1006,x+273,1010,TEAL,1.1)
line(1169,1010,1169,1019,TEAL,.6);line(1169,1019,29,1019,TEAL,.6)
line(29,1019,29,1006,TEAL,.6);line(29,1006,35,1006,TEAL,.6)
line(35,1006,32,1003,TEAL,.6);line(35,1006,32,1009,TEAL,.6)

# Responsible AI.
rect(18,1034,1164,88,'white',BORDER,12)
heading('AI CÓ TRÁCH NHIỆM',18,1030,1164,'shield',17)
labels=[('people','Ẩn danh học sinh'),('chart','Máy tính số, AI không bịa'),('book','Chỉ theo bài học'),('brain','AI kiểm chéo AI'),('shield','Giáo viên duyệt'),('lock','Đề thi không gửi đáp án')]
for i,(kind,t) in enumerate(labels):
    x=42+i*159
    icon(kind,x+19,1083,25,TEAL,PALE)
    para(t,x+46,1069,105,10.1,'SemiBold',INK,leading=12,maxh=42)
circle(1102,1073,48,GOLD,'#D49B25',1.8)
text('24/24',1102,1041,23,'ExtraBold',NAVY,'center')
para('câu thử phá – không lộ đáp án',1061,1071,82,9.5,'Bold',NAVY,align='center',leading=12,maxh=40)

# Technology row.
rect(18,1133,1164,74,'white',BORDER,12)
heading('CÔNG NGHỆ SỬ DỤNG',18,1130,1164,'database',16)
tech=[('Gemini AI','Gia sư, phân tích, báo cáo','bulb'),('Bộ não AI (Python)','Đa agent trên máy chủ riêng','brain'),('Firebase','Dữ liệu thời gian thực','database'),('Cloudflare Worker','Giữ khóa AI, hạn mức','cloud'),('Google Sheets + Drive','Danh sách, chấm thi, minh chứng','book'),('Ứng dụng web (PWA)','Cài như app, chạy máy cũ','device')]
for i,(name,desc,kind) in enumerate(tech):
    x=26+i*193
    if i:line(x-5,1170,x-5,1199,BORDER,.6)
    icon(kind,x+10,1183,20,TEAL)
    text(name,x+27,1168,9.4,'Bold',NAVY)
    para(desc,x+27,1183,155,9.1,leading=11,maxh=25)
    # Keep separator semantics as supplied for literal-text audit.

# Actual classroom evidence, no invented statistics.
rect(18,1220,1164,225,'white',BORDER,12)
heading('TRIỂN KHAI THỰC TẾ',18,1216,1164,'chart',19)
for i in range(4):rect(29+i*289,1258,277,35,PALE if i==0 else '#F7FAFB',r=7)
text('[135]',43,1260,23,'ExtraBold',TEAL)
para('học sinh có tài khoản ([4] lớp)',116,1264,183,10.5,'SemiBold',TEAL,leading=13,maxh=27)
for i in range(3):
    x=29+i*385
    rect(x,1301,374,131,'#EAF4F5',r=8)
    image(AS/f'thuc-te-{i+1}.jpg',x+2,1303,370,127,cover=True)

# Three footer columns.
for x,w in [(18,442),(468,442),(918,264)]:rect(x,1459,w,180,'white',BORDER,12)
heading('KẾT QUẢ & TÁC ĐỘNG',18,1455,442,'trophy',16)
heading('ĐỊNH HƯỚNG PHÁT TRIỂN',468,1455,442,'chart',15)
heading('SẢN PHẨM',918,1455,264,'device',16)
for i,t in enumerate(['[100 HÀI_LÒNG] học sinh hài lòng','AI phát hiện hiểu lầm:']):
    yy=1513+i*43
    circle(44,yy+8,10,TEAL);icon('check',44,yy+8,13,'white')
    para(t,64,yy-1,375,12,'SemiBold',INK,leading=16,maxh=36)
futures=[('book','Mở rộng môn học'),('people','Nhân rộng trường khác (1 Google Sheet)'),('chart','Báo cáo tiến bộ học kỳ'),('shield','Phụ huynh theo dõi (có đồng ý)')]
for i,(kind,t) in enumerate(futures):
    xx=486+(i%2)*207; yy=1509+(i//2)*61
    icon(kind,xx+12,yy+15,26,TEAL,PALE)
    para(t,xx+37,yy,159,10.7,'Regular',INK,leading=14,maxh=48)

qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,box_size=20,border=4)
qr.add_data('https://aihoctap.online');qr.make(fit=True)
qr.make_image(fill_color=NAVY,back_color='white').save(AS/'qr-aihoctap.png')
image(AS/'qr-aihoctap.png',981,1494,139,129)
c.linkURL('https://aihoctap.online',(981,H-1623,1120,H-1494),relative=0,thickness=0)
text('https://aihoctap.online',1050,1623,11.2,'SemiBold',TEAL,'center')

# Footer slogan.
rect(0,1650,1200,49,PALE,r=0)
text('AI gợi mở – Em tự hiểu – Thầy cô thấy rõ',600,1662,26,'Italic',NAVY,'center')
c.showPage();c.save()
(ROOT/'noi-dung-da-dan.json').write_text(json.dumps(TEXT,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'vi-tri-chu.json').write_text(json.dumps(BOUNDS,ensure_ascii=False,indent=2),encoding='utf-8')
print('Created',OUT)
