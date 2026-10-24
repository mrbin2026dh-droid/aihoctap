"""
Script tạo bản thiết kế chuẩn Giáo dục Ánh sáng (Educational Light Theme)
Tuân thủ tuyệt đối tâm lý học màu sắc EdTech (Khan Academy, Google Classroom, Duolingo)
và chụp ảnh màn hình lưu vào Artifacts.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path(r"~\.gemini\antigravity\brain\1472d373-fb6d-4d4f-afc8-358ef1071f2f")

HTML_EDUCATION_LIGHT = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
    body { font-family: 'Be Vietnam Pro', 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col antialiased">

  <!-- Header Giáo dục: Trắng sáng, viền tinh tế, chuẩn Google Classroom / Khan Academy -->
  <header class="bg-white border-b border-slate-200/90 px-7 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
        <i class="fa-solid fa-book-bookmark"></i>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="font-bold text-base text-slate-900 tracking-tight">Tin học 6 • Bài 1: Thông tin và dữ liệu</h1>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">GDPT 2018</span>
        </div>
        <p class="text-xs text-slate-500 font-medium mt-0.5">Chủ đề A: Máy tính và cộng đồng • Tiết 1</p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2.5 bg-slate-100/80 px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700">
        <span class="text-amber-600 flex items-center gap-1.5"><i class="fa-solid fa-fire text-amber-500"></i> Chuỗi tự học: 3 ngày</span>
        <span class="text-slate-300">•</span>
        <span class="text-emerald-600 flex items-center gap-1.5"><i class="fa-solid fa-medal text-emerald-500"></i> 150 điểm</span>
      </div>
      <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>Gia sư Socrates AI</span>
      </button>
    </div>
  </header>

  <!-- Khung Thân Sân Khấu (3 Phân Vùng Cân Đối Trên Nền Sáng Ấm) -->
  <div class="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">

    <!-- Cột Trái: Mục lục Lộ trình Bài học (Sidebar 22%) -->
    <aside class="w-64 bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm hidden md:flex flex-col">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <i class="fa-solid fa-bars-staggered text-slate-400"></i>
        <span>Lộ trình bài học</span>
      </div>

      <div class="space-y-1.5 flex-1">
        <div class="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <i class="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
            <span>1. Khái niệm cơ bản</span>
          </div>
          <span class="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold">Đã đọc</span>
        </div>

        <div class="p-3 rounded-xl bg-blue-50 border-2 border-blue-600 text-blue-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>2. Luyện tập nhận thức</span>
          </div>
          <span class="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-bold">Đang làm</span>
        </div>

        <div class="p-3 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center justify-between transition-colors">
          <div class="flex items-center gap-2.5">
            <i class="fa-solid fa-lock text-slate-300 text-xs"></i>
            <span>3. Xử lý tình huống</span>
          </div>
        </div>

        <div class="p-3 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center justify-between transition-colors">
          <div class="flex items-center gap-2.5">
            <i class="fa-solid fa-lock text-slate-300 text-xs"></i>
            <span>4. Ghi nhớ cốt lõi</span>
          </div>
        </div>
      </div>

      <!-- Thẻ mẹo học tập -->
      <div class="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-[11px] leading-relaxed">
        <strong class="flex items-center gap-1.5 text-amber-800 mb-1">
          <i class="fa-solid fa-lightbulb text-amber-600"></i> Mẹo tự học:
        </strong>
        Đừng ngại chọn sai nhé! Mỗi lần sai, thầy Socrates sẽ gợi ý để em hiểu sâu hơn bản chất bài học.
      </div>
    </aside>

    <!-- Vùng Trọng Tâm: Thẻ Câu Hỏi Lớn Chuẩn Giáo Dục (Main Focus Canvas - 50%) -->
    <main class="flex-1 flex flex-col justify-center max-w-2xl mx-auto space-y-5">
      <!-- Progress Bar Thanh Tiến Độ Học Tập -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-500 font-bold tracking-wide">
          <span class="flex items-center gap-2 text-slate-700">
            <span class="w-2 h-2 rounded-full bg-blue-600"></span>
            CÂU HỎI 1 / 4
          </span>
          <span class="text-blue-600 font-extrabold">25% HOÀN THÀNH</span>
        </div>
        <div class="w-full h-2.5 rounded-full bg-slate-200/90 overflow-hidden p-0.5">
          <div class="h-full bg-blue-600 rounded-full w-1/4 transition-all duration-500"></div>
        </div>
      </div>

      <!-- Card Câu Hỏi Chính: Nền trắng, viền thanh lịch, chữ đen đậm tương phản cao -->
      <div class="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-sm space-y-6">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200/80">
              Nhận biết Dữ liệu
            </span>
            <span class="text-xs text-slate-400">• SGK Mục 1 Trang 6</span>
          </div>
          <h2 class="text-lg font-extrabold text-slate-900 leading-relaxed">
            Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Trong tình huống này, "ánh sáng đèn màu đỏ" được gọi là gì?
          </h2>
        </div>

        <!-- 4 Lựa chọn To Rõ Ràng, Điểm chạm >= 48px -->
        <div class="space-y-3">
          <!-- Phương án A (Đang chọn - Báo màu Cam ấm chữa bài, không dùng màu đỏ trừng phạt) -->
          <div class="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/40 text-slate-900 text-sm font-semibold flex items-center justify-between cursor-pointer transition-all shadow-xs">
            <div class="flex items-center gap-3.5">
              <span class="w-8 h-8 rounded-lg bg-amber-500 text-white font-extrabold flex items-center justify-center text-xs">
                A
              </span>
              <span>Vật mang tin</span>
            </div>
            <span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">Em đã chọn</span>
          </div>

          <!-- Phương án B (Đáp án đúng chưa chọn) -->
          <div class="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50/80 bg-white text-slate-800 text-sm font-medium flex items-center justify-between cursor-pointer transition-all">
            <div class="flex items-center gap-3.5">
              <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                B
              </span>
              <span>Dữ liệu</span>
            </div>
          </div>

          <!-- Phương án C -->
          <div class="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50/80 bg-white text-slate-800 text-sm font-medium flex items-center justify-between cursor-pointer transition-all">
            <div class="flex items-center gap-3.5">
              <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                C
              </span>
              <span>Thông tin</span>
            </div>
          </div>
        </div>

        <!-- Khung Hướng Dẫn Sư Phạm Gợi Mở (Dùng nền Cam Pastel nhẹ nhàng, không dọa nạt) -->
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 text-xs space-y-2.5">
          <div class="font-bold flex items-center gap-2 text-amber-800 text-xs">
            <i class="fa-solid fa-circle-question text-amber-600 text-sm"></i>
            <span>Chưa chính xác rồi em! Hãy cùng suy nghĩ thêm một chút nhé:</span>
          </div>
          <p class="leading-relaxed text-slate-700">
            Vật mang tin là <strong>vật thể hữu hình</strong> chứa dữ liệu (như cột đèn sắt, biển báo bằng tôn). Còn <em>ánh sáng màu đỏ</em> truyền thẳng vào mắt em khi chưa qua bộ não suy nghĩ thì được gọi là gì?
          </p>
          <div class="pt-1 flex items-center justify-between border-t border-amber-200/60">
            <span class="text-amber-800 font-bold">👉 Xem lại Mục 1.a (SGK Trang 6)</span>
            <button class="text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1.5 transition-colors">
              <span>Nhờ Thầy Socrates giải thích thêm</span>
              <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Thanh hành động -->
        <div class="flex items-center justify-between pt-2">
          <button class="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1.5">
            <i class="fa-solid fa-book-open text-blue-600"></i>
            <span>Mở lại trang sách số 6</span>
          </button>
          <button class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-2">
            <span>Thử chọn lại câu này</span>
            <i class="fa-solid fa-rotate-right text-xs"></i>
          </button>
        </div>
      </div>
    </main>

    <!-- Cột Phải: Gia Sư Socrates Đồng Hành (Drawer 28% Nhẹ Nhàng Thân Thiện) -->
    <aside class="w-80 bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm hidden lg:flex">
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-xs font-bold">
              <i class="fa-solid fa-robot"></i>
            </div>
            <div>
              <h3 class="font-bold text-xs text-slate-900">Gia sư Socrates</h3>
              <p class="text-[10px] text-slate-400">Trợ lý Tin học THCS</p>
            </div>
          </div>
          <span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
            Chỉ gợi mở
          </span>
        </div>

        <div class="space-y-3 text-xs leading-relaxed">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
            <p class="font-bold text-blue-700 mb-1 flex items-center gap-1">
              <span>👋</span> Thầy chào em!
            </p>
            <p>Em đừng lo khi làm sai câu 1 nhé. Trong Tin học, phân biệt <strong>Dữ liệu</strong> và <strong>Vật mang tin</strong> là bước đầu tiên rất thú vị!</p>
          </div>

          <div class="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-950">
            <p class="font-bold text-blue-800 mb-1 flex items-center gap-1">
              <i class="fa-solid fa-lightbulb text-amber-500"></i> Câu hỏi tư duy cho em:
            </p>
            <p>Nếu thầy cầm một cuốn sách giáo khoa và mở ra cho em đọc chữ, thì cuốn sách là gì, còn chữ in trên giấy là gì nào?</p>
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-4 border-t border-slate-100">
        <div class="flex flex-wrap gap-1.5">
          <button class="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium transition-colors">
            💡 Cho em thêm 1 ví dụ?
          </button>
        </div>
        <div class="relative flex items-center">
          <input type="text" placeholder="Hỏi thầy bất kỳ thắc mắc nào..." class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none pr-9 transition-all">
          <button class="absolute right-2.5 text-blue-600 hover:text-blue-700 text-sm">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </aside>

  </div>

</body>
</html>
"""

def generate_light_education_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_content(HTML_EDUCATION_LIGHT)
        out_path = ARTIFACT_DIR / "ui_concept_education_light.png"
        page.screenshot(path=str(out_path), full_page=True)
        print(f"Captured: {out_path}")
        browser.close()

if __name__ == "__main__":
    generate_light_education_screenshot()
