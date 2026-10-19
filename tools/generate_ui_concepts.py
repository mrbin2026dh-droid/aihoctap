"""
Script tự động sinh 3 bản vẽ giao diện mẫu chuẩn EdTech (Khan Academy, Brilliant, Dual-Tab Workspace)
và dùng Playwright chụp ảnh màn hình lưu vào thư mục Artifacts cho người dùng tham khảo.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path(r"C:\Users\HPZBook\.gemini\antigravity\brain\1472d373-fb6d-4d4f-afc8-358ef1071f2f")
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------
# CONCEPT 1: Chuẩn Khan Academy + Khanmigo (Dual-Pane Focus & Collapsible Drawer)
# -------------------------------------------------------------
HTML_KHAN = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="bg-slate-800/90 border-b border-slate-700/80 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg">
        <i class="fa-solid fa-graduation-cap"></i>
      </div>
      <div>
        <h1 class="font-bold text-sm text-white">Tin học 6 • Chủ đề 1: Máy tính và cộng đồng</h1>
        <p class="text-xs text-slate-400">Bài 1: Thông tin và dữ liệu (Tiết 1/2)</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
        <span class="text-amber-400"><i class="fa-solid fa-fire"></i> Chuỗi tự học: 3 ngày</span>
        <span class="text-slate-500">•</span>
        <span class="text-sky-400"><i class="fa-solid fa-star"></i> 150 điểm</span>
      </div>
      <button class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-600/20">
        <i class="fa-solid fa-robot"></i>
        <span>Gia sư Khanmigo (Bật)</span>
      </button>
    </div>
  </header>

  <!-- Main Body: 2 Phân vùng chuẩn Khan Academy -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Cột trái: Mục lục & Tiến độ bài học (20%) -->
    <aside class="w-64 bg-slate-900/80 border-r border-slate-800 p-4 space-y-4 hidden md:block">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Lộ trình bài học</div>
      <div class="space-y-1">
        <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between">
          <span>1. Đọc: Khái niệm</span>
          <i class="fa-solid fa-check-circle text-emerald-400"></i>
        </div>
        <div class="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-between">
          <span>2. Luyện tập: Trắc nghiệm</span>
          <span class="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
        </div>
        <div class="p-2.5 rounded-lg text-slate-400 hover:bg-slate-800/40 text-xs flex items-center justify-between">
          <span>3. Vận dụng: Xử lý tình huống</span>
          <i class="fa-solid fa-lock text-slate-600"></i>
        </div>
        <div class="p-2.5 rounded-lg text-slate-400 hover:bg-slate-800/40 text-xs flex items-center justify-between">
          <span>4. Ghi nhớ trọng tâm</span>
          <i class="fa-solid fa-lock text-slate-600"></i>
        </div>
      </div>
    </aside>

    <!-- Vùng Trọng Tâm: Trắc nghiệm Từng Câu Rõ Ràng (Focus Canvas - 50%) -->
    <main class="flex-1 p-8 overflow-y-auto max-w-3xl mx-auto flex flex-col justify-center">
      <!-- Progress Bar -->
      <div class="mb-6 space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-400 font-semibold">
          <span>CÂU HỎI 1 TRÊN 4</span>
          <span class="text-indigo-400">Tiến độ 25%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-sky-400 w-1/4 rounded-full"></div>
        </div>
      </div>

      <!-- Question Card -->
      <div class="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-7 shadow-2xl space-y-6">
        <div class="space-y-3">
          <span class="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 text-xs font-bold border border-amber-500/20">
            Khái niệm Dữ liệu & Thông tin
          </span>
          <h2 class="text-lg font-bold text-white leading-relaxed">
            Khi nhìn thấy đèn tín hiệu giao thông chuyển sang màu đỏ, người đi đường dừng lại. Trong tình huống này, "ánh sáng đèn màu đỏ" được gọi là gì?
          </h2>
        </div>

        <!-- 4 Option Cards lớn, dễ bấm -->
        <div class="grid grid-cols-1 gap-3">
          <button class="p-4 rounded-xl border border-rose-500/60 bg-rose-950/20 text-rose-200 text-sm font-medium flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center text-xs">A</span>
              <span>Vật mang tin</span>
            </div>
            <i class="fa-solid fa-circle-xmark text-rose-400 text-lg"></i>
          </button>

          <button class="p-4 rounded-xl border border-slate-700 hover:border-sky-500/60 bg-slate-900/40 text-slate-200 text-sm font-medium flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs">B</span>
              <span>Dữ liệu</span>
            </div>
          </button>

          <button class="p-4 rounded-xl border border-slate-700 hover:border-sky-500/60 bg-slate-900/40 text-slate-200 text-sm font-medium flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-xs">C</span>
              <span>Thông tin</span>
            </div>
          </button>
        </div>

        <!-- Feedback Sư Phạm khi chọn sai -->
        <div class="p-4 rounded-xl bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs space-y-2">
          <div class="font-bold flex items-center gap-2 text-rose-300">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Chưa chính xác rồi em! Đừng nản lòng nhé.</span>
          </div>
          <p class="leading-relaxed">
            Vật mang tin phải là một vật thể hữu hình chứa dữ liệu (như cột đèn sắt, cuốn sổ). Còn ánh sáng đỏ chiếu vào mắt em là tín hiệu thu nhận từ thế giới bên ngoài.
          </p>
          <div class="pt-1 flex items-center justify-between">
            <span class="text-amber-300 italic">👉 Đọc lại Mục 1.a (SGK Trang 6)</span>
            <button class="text-xs text-indigo-300 hover:text-white font-bold flex items-center gap-1">
              <span>Hỏi Gia sư Socrates tại sao sai</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2">
          <button class="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-medium">
            <i class="fa-solid fa-lightbulb text-amber-400"></i>
            <span>Xem gợi ý trong SGK</span>
          </button>
          <button class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2">
            <span>Thử lại câu này</span>
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>
    </main>

    <!-- Cột phải: Gia sư AI Khanmigo (Collapsible Side Drawer - 30%) -->
    <aside class="w-80 bg-slate-950/90 border-l border-slate-800 p-4 flex flex-col justify-between hidden lg:flex">
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <span class="font-bold text-xs text-white">Gia sư Socrates AI</span>
          </div>
          <span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">Chỉ hướng dẫn</span>
        </div>

        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed">
            <p class="font-bold text-sky-400 mb-1">Thầy Socrates:</p>
            <p>Chào em! Thầy thấy em đang chọn câu 1. Hãy nhớ nguyên tắc: Mắt thấy, tai nghe thô sơ là <strong>Dữ liệu</strong>; sau khi suy nghĩ hiểu ra mới là <strong>Thông tin</strong>!</p>
          </div>

          <div class="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-indigo-200 leading-relaxed">
            <p class="font-bold text-indigo-300 mb-1">Gợi ý tư duy:</p>
            <p>Khi đèn đỏ bật lên, nếu mắt em nhắm lại thì em có thấy gì không? Vậy màu đỏ đó từ đâu truyền tới mắt em?</p>
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-4">
        <div class="flex flex-wrap gap-1.5">
          <button class="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-800">
            💡 Cho em ví dụ đời sống?
          </button>
        </div>
        <div class="relative">
          <input type="text" placeholder="Hỏi thầy để hiểu sâu hơn..." class="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none pr-8">
          <button class="absolute right-2 top-2 text-indigo-400 hover:text-white text-xs">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </aside>
  </div>
</body>
</html>
"""

# -------------------------------------------------------------
# CONCEPT 2: Chuẩn Brilliant.org (Bite-Sized Stepped Learning - Học cuốn chiếu theo thẻ)
# -------------------------------------------------------------
HTML_BRILLIANT = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center">
  <!-- Minimal Header -->
  <header class="w-full max-w-4xl px-6 py-4 flex items-center justify-between border-b border-slate-800">
    <div class="flex items-center gap-3">
      <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">BÀI 1 TIN HỌC 6</span>
      <span class="text-slate-600">•</span>
      <span class="text-sm font-bold text-white">Khám phá Thế giới Thông tin</span>
    </div>
    <div class="flex items-center gap-1.5">
      <div class="w-7 h-1.5 rounded-full bg-amber-400"></div>
      <div class="w-7 h-1.5 rounded-full bg-amber-400"></div>
      <div class="w-7 h-1.5 rounded-full bg-slate-800"></div>
      <div class="w-7 h-1.5 rounded-full bg-slate-800"></div>
    </div>
  </header>

  <!-- Central Card Stack (Chuẩn Brilliant.org: 1 Thẻ Lý Thuyết Đi Kèm 1 Thử Thách) -->
  <main class="w-full max-w-3xl flex-1 px-4 py-8 space-y-6">
    <!-- Thẻ 1: Khái niệm tương tác có hình minh họa -->
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-5 shadow-xl">
      <div class="flex items-center gap-3">
        <span class="px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">Bước 1: Quan sát thực tế</span>
        <span class="text-xs text-slate-500">Mục 1 SGK Trang 6</span>
      </div>
      <h2 class="text-xl font-bold text-white leading-tight">
        Làm sao để phân biệt Dữ liệu và Thông tin?
      </h2>
      <p class="text-slate-300 text-sm leading-relaxed">
        Hãy tưởng tượng em thức dậy vào sáng sớm. Em nhìn ra cửa sổ thấy những đám mây đen kịt và nghe tiếng gió rít qua khe cửa sổ.
      </p>

      <!-- Khung so sánh trực quan 2 cột dạng Card -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div class="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-2">
          <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
            👁️
          </div>
          <h3 class="font-bold text-sm text-white">Dữ liệu (Data)</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Là thứ mắt nhìn, tai nghe thô sơ: Mây đen, tiếng sấm đùng đoàng.</p>
        </div>
        <div class="bg-slate-950 p-5 rounded-2xl border border-indigo-500/30 space-y-2">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
            🧠
          </div>
          <h3 class="font-bold text-sm text-white">Thông tin (Information)</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Bộ não hiểu ra: "Trời sắp có mưa to, mình phải mang theo áo mưa!".</p>
        </div>
      </div>
    </div>

    <!-- Thẻ 2: Câu hỏi thử thách tương tác ngay lập tức (Check for Understanding) -->
    <div class="bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-indigo-500/40 rounded-3xl p-8 space-y-5 shadow-2xl">
      <div class="flex items-center justify-between">
        <span class="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">Thử thách nhận thức</span>
        <button class="text-xs text-slate-400 hover:text-white flex items-center gap-1">
          <i class="fa-solid fa-question-circle"></i>
          <span>Hỏi Gia sư Socrates</span>
        </button>
      </div>
      <h3 class="text-base font-bold text-white">
        Bác tài xế lái xe nhìn thấy biển báo cấm rẽ trái cắm ở ngã tư. Bản thân "hình vẽ cấm rẽ trên tấm biển" là gì?
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button class="p-4 rounded-2xl border border-emerald-500 bg-emerald-950/20 text-emerald-200 text-sm font-semibold flex items-center justify-between">
          <span>Dữ liệu hình ảnh</span>
          <i class="fa-solid fa-circle-check text-emerald-400"></i>
        </button>
        <button class="p-4 rounded-2xl border border-slate-800 bg-slate-950 text-slate-300 text-sm font-medium hover:border-slate-700 flex items-center justify-between">
          <span>Quyết định rẽ phải</span>
        </button>
      </div>

      <!-- Nút Tiếp tục bài học phong cách Brilliant -->
      <div class="pt-4 flex items-center justify-between border-t border-slate-800">
        <span class="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
          <i class="fa-solid fa-sparkles"></i>
          <span>Chính xác! Em đã hiểu bản chất Dữ liệu.</span>
        </span>
        <button class="px-7 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-amber-500/20 flex items-center gap-2">
          <span>Mở Khóa Mục 2</span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  </main>
</body>
</html>
"""

# -------------------------------------------------------------
# CONCEPT 3: Chuẩn Dual-Tab Workspace (Đọc SGK & Đấu Trường Thực Hành - Phổ biến trong EdTech)
# -------------------------------------------------------------
HTML_DUALTAB = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-base font-extrabold text-white">Tin học THCS</span>
      <span class="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">Lớp 6 - GDPT 2018</span>
    </div>
    <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
      <button class="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white shadow">
        <i class="fa-solid fa-book-open mr-1.5"></i> Bài học số hóa
      </button>
      <button class="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white">
        <i class="fa-solid fa-list-check mr-1.5"></i> Luyện tập trắc nghiệm
      </button>
      <button class="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white">
        <i class="fa-solid fa-comments mr-1.5"></i> Trò chuyện Socrates
      </button>
    </div>
  </header>

  <!-- 2 Cột Cân Đối (60% SGK Reader, 40% Practice Workspace) -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
    <!-- Cột Trái: Đọc SGK Rộng Rãi, Chuẩn Typography (7 Cột) -->
    <section class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-7 overflow-y-auto space-y-5 h-[85vh]">
      <div class="border-b border-slate-800 pb-4">
        <span class="text-xs font-bold text-sky-400">CHƯƠNG 1 • BÀI 1</span>
        <h2 class="text-xl font-bold text-white mt-1">Thông tin và Dữ liệu trong đời sống</h2>
      </div>

      <div class="space-y-4 text-sm text-slate-300 leading-relaxed">
        <h3 class="text-base font-bold text-white text-indigo-400">1. Khái niệm Thông tin và Dữ liệu</h3>
        <p>Hàng ngày, các em tiếp nhận rất nhiều điều từ thế giới xung quanh: tiếng còi xe, tiếng trống trường, chữ viết trên bảng, màu sắc của bông hoa...</p>
        
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <p><strong class="text-white">• Dữ liệu:</strong> Là các số, văn bản, hình ảnh, âm thanh thu nhận được từ bên ngoài.</p>
          <p><strong class="text-white">• Thông tin:</strong> Là sự hiểu biết của con người sau khi não xử lý dữ liệu.</p>
        </div>

        <blockquote class="border-l-4 border-sky-500 pl-4 py-1 italic text-slate-200">
          "Ví dụ: Nghe tiếng trống trường 'Tùng! Tùng! Tùng!' là Dữ liệu. Biết rằng đã đến giờ vào lớp là Thông tin."
        </blockquote>
      </div>
    </section>

    <!-- Cột Phải: Phân Hệ Thực Hành Tương Tác Đa Năng (5 Cột) -->
    <section class="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[85vh]">
      <!-- Tab Bar -->
      <div class="p-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div class="flex items-center gap-1">
          <button class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Trắc nghiệm</button>
          <button class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium">Hỏi Thầy AI</button>
        </div>
        <span class="text-xs text-amber-400 font-bold">4 câu hỏi</span>
      </div>

      <!-- Question List & Socratic Feedback -->
      <div class="flex-1 p-5 overflow-y-auto space-y-4">
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div class="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>CÂU 1/4</span>
            <span class="text-emerald-400">Đã chọn: B</span>
          </div>
          <p class="text-xs text-slate-200 font-semibold leading-relaxed">
            Ánh sáng đèn giao thông màu đỏ chiếu vào mắt người đi đường được gọi là gì?
          </p>
          <div class="space-y-1.5">
            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">A. Vật mang tin</div>
            <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/60 text-xs text-emerald-300 font-bold">B. Dữ liệu (Chính xác)</div>
            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">C. Thông tin</div>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-slate-800 bg-slate-950">
        <button class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30">
          Chấm điểm & Lưu kết quả
        </button>
      </div>
    </section>
  </main>
</body>
</html>
"""

def generate_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # 1. Capture Khan Academy Concept
        page.set_content(HTML_KHAN)
        out_khan = ARTIFACT_DIR / "ui_concept_khan_academy.png"
        page.screenshot(path=str(out_khan), full_page=True)
        print(f"Captured: {out_khan}")

        # 2. Capture Brilliant Stepped Concept
        page.set_content(HTML_BRILLIANT)
        out_brilliant = ARTIFACT_DIR / "ui_concept_brilliant_stepped.png"
        page.screenshot(path=str(out_brilliant), full_page=True)
        print(f"Captured: {out_brilliant}")

        # 3. Capture Dual-Tab Workspace Concept
        page.set_content(HTML_DUALTAB)
        out_dualtab = ARTIFACT_DIR / "ui_concept_dual_tab_workspace.png"
        page.screenshot(path=str(out_dualtab), full_page=True)
        print(f"Captured: {out_dualtab}")

        browser.close()

if __name__ == "__main__":
    generate_screenshots()
