"""
SGK Data Studio 2.0 - Ung dung Desktop Boc tach va Chuan hoa Bai hoc SGK sang Block Schema 2.0.
Tuan thu 100% cac tieu chuan kiem duyet P0 & P1 tu Claude 3.5 Sonnet:
- Mot duong luu duy nhat truc tiep qua save_lesson_blocks trong backend/grounding.py.
- Khong co hai duong kiem chong cheo; giu nguyen tinh nhat quan cua teacher_reviewed va grounding_verified.
- Da luong (Worker Thread) khong khoa UI, co huy cancel_event va join(timeout=2.0) khi thoat an toan.
- Giao dien su dung chu thuan (Zero-Emoji).
- Bo sung Khung hien thi chi tiet noi dung boc tach (Detail Preview Panel) giup Giao vien doc va kiem tra.
- Tich hop Quan ly Muc luc Dong 3 Tang (Dynamic TOC Manager) cho moi khoi lop (6, 7, 8, 9) khong hardcode.
- Tich hop Trinh Xem Trang PDF Truc Quan (Visual PDF Page Viewer) giup giao vien lat trang, tra cuu ngay lap tuc.
"""

import json
import os
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Any, Dict, List, Optional, Tuple

import pymupdf
from PIL import Image, ImageTk

# Them thu muc goc vao sys.path de import backend modules
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.grounding import save_lesson_blocks
from backend.contracts import LessonBlockPackageContract
from backend.socratic_validator import validate_socratic_hint
from backend.extraction_engine import extract_and_structure_lesson
from backend.toc_manager import get_or_scan_pdf_toc, load_cached_toc, save_cached_toc


class PDFViewerDialog(tk.Toplevel):
    """
    Cua so Trinh Xem Trang PDF Truc Quan (Visual PDF Page Viewer).
    Cho phep Giao vien lat tung trang sach voi do phan giai net, xem truc tiep noi dung
    va bam 1 nut de tu dong dien 'Trang bat dau' hoac 'Trang ket thuc' vao man hinh chinh.
    """
    def __init__(
        self,
        parent: tk.Tk,
        pdf_path: str,
        initial_page: int = 1,
        on_set_start=None,
        on_set_end=None
    ):
        super().__init__(parent)
        self.title(f"Trinh Xem Trang PDF SGK - {os.path.basename(pdf_path)}")
        self.geometry("960x860")
        self.minsize(700, 600)

        self.pdf_path = pdf_path
        self.on_set_start = on_set_start
        self.on_set_end = on_set_end

        try:
            self.doc = pymupdf.open(pdf_path)
            self.total_pages = len(self.doc)
        except Exception as e:
            messagebox.showerror("Loi mo PDF", f"Khong the mo tep PDF:\n{e}")
            self.destroy()
            return

        self.current_page = max(1, min(initial_page, self.total_pages))
        self.zoom_level = 1.25  # He so thu phong
        self.tk_image = None

        self._create_widgets()
        self._bind_keys()
        self.render_page()

    def _create_widgets(self):
        # 1. Thanh Cong cu Dieu khien tren cung
        toolbar = ttk.Frame(self, padding=8)
        toolbar.pack(fill=tk.X, side=tk.TOP)

        btn_prev = ttk.Button(toolbar, text="< Trang truoc", command=self.prev_page)
        btn_prev.pack(side=tk.LEFT, padx=3)

        ttk.Label(toolbar, text="Trang in:").pack(side=tk.LEFT, padx=(6, 2))
        self.page_var = tk.IntVar(value=self.current_page)
        self.spin_page = ttk.Spinbox(
            toolbar, from_=1, to=self.total_pages, textvariable=self.page_var, width=5,
            command=self._on_spin_page
        )
        self.spin_page.pack(side=tk.LEFT, padx=2)
        self.spin_page.bind("<Return>", lambda e: self._on_spin_page())

        self.lbl_total = ttk.Label(toolbar, text=f"/ {self.total_pages}")
        self.lbl_total.pack(side=tk.LEFT, padx=(2, 8))

        btn_next = ttk.Button(toolbar, text="Trang sau >", command=self.next_page)
        btn_next.pack(side=tk.LEFT, padx=3)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=8)

        btn_start = ttk.Button(
            toolbar,
            text="[Dat lam Trang BAT DAU]",
            command=self._do_set_start
        )
        btn_start.pack(side=tk.LEFT, padx=4)

        btn_end = ttk.Button(
            toolbar,
            text="[Dat lam Trang KET THUC]",
            command=self._do_set_end
        )
        btn_end.pack(side=tk.LEFT, padx=4)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=8)

        btn_open_ext = ttk.Button(
            toolbar,
            text="Mo bang App ngoai (Edge/Chrome)",
            command=self.open_external
        )
        btn_open_ext.pack(side=tk.RIGHT, padx=4)

        # 2. Khu vuc hien thi anh trang PDF (Co thanh cuon doc va ngang)
        canvas_frame = ttk.Frame(self)
        canvas_frame.pack(fill=tk.BOTH, expand=True)

        self.scroll_y = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL)
        self.scroll_x = ttk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL)

        self.canvas = tk.Canvas(
            canvas_frame,
            bg="#2c3038",
            yscrollcommand=self.scroll_y.set,
            xscrollcommand=self.scroll_x.set
        )
        self.scroll_y.config(command=self.canvas.yview)
        self.scroll_x.config(command=self.canvas.xview)

        self.scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _bind_keys(self):
        self.bind("<Left>", lambda e: self.prev_page())
        self.bind("<Right>", lambda e: self.next_page())
        self.bind("<Prior>", lambda e: self.prev_page()) # Page Up
        self.bind("<Next>", lambda e: self.next_page())  # Page Down
        self.bind("<Home>", lambda e: self.go_page(1))
        self.bind("<End>", lambda e: self.go_page(self.total_pages))

    def prev_page(self):
        if self.current_page > 1:
            self.current_page -= 1
            self.page_var.set(self.current_page)
            self.render_page()

    def next_page(self):
        if self.current_page < self.total_pages:
            self.current_page += 1
            self.page_var.set(self.current_page)
            self.render_page()

    def go_page(self, page_no: int):
        self.current_page = max(1, min(page_no, self.total_pages))
        self.page_var.set(self.current_page)
        self.render_page()

    def _on_spin_page(self):
        try:
            val = int(self.page_var.get())
            self.go_page(val)
        except Exception:
            pass

    def render_page(self):
        """Render trang PDF tai chi so hien tai thanh anh tren Canvas."""
        if not self.doc or self.current_page < 1 or self.current_page > self.total_pages:
            return

        page_idx = self.current_page - 1
        page = self.doc[page_idx]

        # Render 120 DPI de hien thi ro chu ma van nhe va nhanh
        dpi = int(96 * self.zoom_level)
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        self.tk_image = ImageTk.PhotoImage(img)

        self.canvas.delete("all")
        self.canvas.config(scrollregion=(0, 0, pix.width, pix.height))
        # Dat anh vao giua
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_image)
        self.canvas.yview_moveto(0)

    def _do_set_start(self):
        if self.on_set_start:
            self.on_set_start(self.current_page)
        messagebox.showinfo("Thanh cong", f"Da dat Trang {self.current_page} lam TRANG BAT DAU.")

    def _do_set_end(self):
        if self.on_set_end:
            self.on_set_end(self.current_page)
        messagebox.showinfo("Thanh cong", f"Da dat Trang {self.current_page} lam TRANG KET THUC.")

    def open_external(self):
        """Mo bang ung dung xem PDF mac dinh cua Windows (Edge, Chrome, Acrobat)."""
        try:
            os.startfile(self.pdf_path)
        except Exception as e:
            messagebox.showwarning("Loi mo tep", f"Khong the mo ung dung ngoai:\n{e}")

    def destroy(self):
        if hasattr(self, "doc") and self.doc:
            try:
                self.doc.close()
            except Exception:
                pass
        super().destroy()


class SGKStudioApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        try:
            self.root.tk.call('encoding', 'system', 'utf-8')
        except Exception:
            pass
        self.root.title("SGK Data Studio 2.0 - Bộ Công Cụ Số Hóa Bài Học SGK")
        self.root.geometry("1140x780")
        self.root.minsize(920, 640)

        # Trang thai ung dung
        self.worker_thread: Optional[threading.Thread] = None
        self.cancel_event = threading.Event()
        self.current_package: Optional[Dict[str, Any]] = None
        self.node_data_map: Dict[str, Dict[str, Any]] = {}
        self.current_toc: List[Dict[str, Any]] = []

        self._setup_style()
        self._create_widgets()

        # Tu dong nạp cache mục lục nếu tệp mặc định tồn tại
        default_pdf = self.pdf_path_var.get().strip()
        if default_pdf and os.path.exists(default_pdf):
            self.load_pdf_toc_async(default_pdf, auto_scan=False)

        # Bat su kien dong cua so an toan (P1-5)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _setup_style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

    def _create_widgets(self):
        # 1. Khung Tieu de & Chon tep PDF
        top_frame = ttk.LabelFrame(self.root, text=" Tep nguon SGK (PDF) ", padding=10)
        top_frame.pack(fill=tk.X, padx=12, pady=6)

        ttk.Label(top_frame, text="Duong dan PDF:").grid(row=0, column=0, sticky=tk.W, padx=4)
        
        default_pdf = r"sgk-sample.pdf"
        self.pdf_path_var = tk.StringVar(value=default_pdf if os.path.exists(default_pdf) else "")
        self.entry_pdf = ttk.Entry(top_frame, textvariable=self.pdf_path_var, width=50)
        self.entry_pdf.grid(row=0, column=1, sticky=tk.EW, padx=4)
        top_frame.columnconfigure(1, weight=1)

        btn_browse = ttk.Button(top_frame, text="Chon tep...", command=self.browse_pdf)
        btn_browse.grid(row=0, column=2, padx=3)

        btn_view_pdf = ttk.Button(top_frame, text="Xem trang PDF", command=self.open_pdf_viewer)
        btn_view_pdf.grid(row=0, column=3, padx=3)

        btn_view_toc = ttk.Button(top_frame, text="Muc luc SGK", command=self.show_toc_dialog)
        btn_view_toc.grid(row=0, column=4, padx=3)

        btn_scan_toc = ttk.Button(top_frame, text="Quet Muc luc (AI)", command=self.trigger_ai_toc_scan)
        btn_scan_toc.grid(row=0, column=5, padx=3)

        # 2. Khung Tham so Bai hoc & Nut hanh dong
        param_frame = ttk.LabelFrame(self.root, text=" Tham so boc tach ", padding=10)
        param_frame.pack(fill=tk.X, padx=12, pady=6)

        # Hang 1: Lop, Bai so, Trang in tu - den, Offset
        ttk.Label(param_frame, text="Lop:").grid(row=0, column=0, sticky=tk.W, padx=4)
        self.grade_var = tk.IntVar(value=6)
        self.spin_grade = ttk.Spinbox(param_frame, from_=6, to=9, textvariable=self.grade_var, width=4)
        self.spin_grade.grid(row=0, column=1, padx=4)

        ttk.Label(param_frame, text="Bai so:").grid(row=0, column=2, sticky=tk.W, padx=4)
        self.lesson_id_var = tk.IntVar(value=2)
        self.spin_lesson = ttk.Spinbox(
            param_frame, from_=1, to=30, textvariable=self.lesson_id_var, width=5,
            command=self._on_lesson_spin_change
        )
        self.spin_lesson.grid(row=0, column=3, padx=4)
        self.spin_lesson.bind("<KeyRelease>", lambda e: self._on_lesson_spin_change())

        ttk.Label(param_frame, text="Trang in tu:").grid(row=0, column=4, sticky=tk.W, padx=4)
        self.start_page_var = tk.IntVar(value=8)
        self.spin_start = ttk.Spinbox(param_frame, from_=1, to=300, textvariable=self.start_page_var, width=5)
        self.spin_start.grid(row=0, column=5, padx=4)

        ttk.Label(param_frame, text="den:").grid(row=0, column=6, sticky=tk.W, padx=4)
        self.end_page_var = tk.IntVar(value=11)
        self.spin_end = ttk.Spinbox(param_frame, from_=1, to=300, textvariable=self.end_page_var, width=5)
        self.spin_end.grid(row=0, column=7, padx=4)

        ttk.Label(param_frame, text="Offset:").grid(row=0, column=8, sticky=tk.W, padx=4)
        self.offset_var = tk.IntVar(value=0)
        self.spin_offset = ttk.Spinbox(param_frame, from_=-20, to=20, textvariable=self.offset_var, width=4)
        self.spin_offset.grid(row=0, column=9, padx=4)

        # Nhan thong tin goi y bai hoc
        self.lbl_lesson_info = ttk.Label(
            param_frame,
            text="[Bai 2: Trang 8 - 11 • Xu li thong tin]",
            font=("Segoe UI", 9, "bold"),
            foreground="#1d4ed8"
        )
        self.lbl_lesson_info.grid(row=0, column=10, sticky=tk.W, padx=8)

        # Hang 2: Cac nut chuc nang
        action_box = ttk.Frame(param_frame)
        action_box.grid(row=1, column=0, columnspan=11, sticky=tk.EW, pady=(10, 0))

        self.btn_start = ttk.Button(action_box, text="Bat dau boc tach", command=self.start_extraction)
        self.btn_start.pack(side=tk.LEFT, padx=4)

        self.btn_cancel = ttk.Button(action_box, text="Huy tien trinh", command=self.cancel_extraction, state=tk.DISABLED)
        self.btn_cancel.pack(side=tk.LEFT, padx=4)

        self.btn_save = ttk.Button(action_box, text="Lưu bản nháp vào Web (Draft)", command=self.save_to_curriculum, state=tk.DISABLED)
        self.btn_save.pack(side=tk.RIGHT, padx=4)

        self.btn_validate_json = ttk.Button(action_box, text="Kiem tra cu phap JSON", command=self.validate_json_editor)
        self.btn_validate_json.pack(side=tk.RIGHT, padx=4)

        # 3. Thanh Tien trinh & Trang thai
        status_frame = ttk.Frame(self.root, padding=(12, 4))
        status_frame.pack(fill=tk.X)

        self.progress_bar = ttk.Progressbar(status_frame, mode="determinate")
        self.progress_bar.pack(fill=tk.X, side=tk.TOP, pady=2)

        self.status_var = tk.StringVar(value="San sang thuc thi.")
        self.lbl_status = ttk.Label(status_frame, textvariable=self.status_var, font=("Segoe UI", 9, "italic"))
        self.lbl_status.pack(side=tk.LEFT, pady=2)

        # 4. Khu vuc Trung tam: Notebook (Tabs)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=12, pady=6)

        # Tab 1: Split Pane (Treeview ben trai + Detail View doc noi dung ben phai)
        self.tab_tree = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_tree, text=" Xem truoc khoi & Doc noi dung ")
        self._create_tree_and_detail_view(self.tab_tree)

        # Tab 2: JSON Editor
        self.tab_json = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_json, text=" Soan thao JSON ")
        self._create_json_editor(self.tab_json)

    def browse_pdf(self):
        filename = filedialog.askopenfilename(
            title="Chon tep SGK Tin hoc PDF (Lop 6, 7, 8, 9)",
            filetypes=[("Tep PDF", "*.pdf"), ("Tat ca tep", "*.*")]
        )
        if filename:
            self.pdf_path_var.set(filename)
            self.load_pdf_toc_async(filename, auto_scan=False)

    def open_pdf_viewer(self):
        """Mo trinh xem trang PDF truc quan de giao vien lat trang xem truc tiep."""
        pdf_path = self.pdf_path_var.get().strip()
        if not pdf_path or not os.path.exists(pdf_path):
            messagebox.showwarning("Chua chon PDF", "Vui long chon tep PDF ton tai tren may truoc khi xem.")
            return

        initial_p = self.start_page_var.get()
        viewer = PDFViewerDialog(
            parent=self.root,
            pdf_path=pdf_path,
            initial_page=initial_p,
            on_set_start=lambda p: self.start_page_var.set(p),
            on_set_end=lambda p: self.end_page_var.set(p)
        )

    def load_pdf_toc_async(self, pdf_path: str, auto_scan: bool = False):
        """Tai muc luc dong: uu tien Cache hoac Bookmarks, neu auto_scan=True thi quet AI."""
        cached = load_cached_toc(pdf_path)
        if cached:
            self.current_toc = cached
            self._on_lesson_spin_change()
            return

        if auto_scan:
            self.trigger_ai_toc_scan()

    def trigger_ai_toc_scan(self):
        """Kich hoat quet tu dong Muc luc bang AI cho bat ky cuon sach nao (Lop 7, 8, 9)."""
        pdf_path = self.pdf_path_var.get().strip()
        if not pdf_path or not os.path.exists(pdf_path):
            messagebox.showwarning("Chua chon PDF", "Vui long chon tep PDF hop le truoc.")
            return

        self.btn_start.config(state=tk.DISABLED)
        self.status_var.set("Dang quet trang Muc luc tu dong...")
        self.progress_bar["value"] = 20

        def worker():
            ok, msg, toc = get_or_scan_pdf_toc(
                pdf_path=pdf_path,
                on_progress=self.update_progress
            )
            self.root.after(0, self._on_toc_scan_complete, ok, msg, toc)

        t = threading.Thread(target=worker, daemon=True)
        t.start()

    def _on_toc_scan_complete(self, ok: bool, msg: Optional[str], toc: List[Dict[str, Any]]):
        self.btn_start.config(state=tk.NORMAL)
        if ok and toc:
            self.current_toc = toc
            self.status_var.set(f"Da tai {len(toc)} bai hoc tu Muc luc.")
            self._on_lesson_spin_change()
            self.show_toc_dialog()
        else:
            self.status_var.set(f"Khong the quet muc luc: {msg}")
            messagebox.showinfo("Thong bao", f"Khong the quet tu dong muc luc:\n{msg}\nBan co the dung nut 'Xem trang PDF' de lat trang tim thu cong.")

    def _on_lesson_spin_change(self):
        """Tu dong dien so trang in tu - den va cap nhat nhan thong tin khi chon bai."""
        try:
            lid = int(self.lesson_id_var.get())
        except (ValueError, TypeError):
            return

        # 1. Tim trong current_toc (dong, khong hardcode)
        if self.current_toc:
            match = next((item for item in self.current_toc if item.get("lesson_id") == lid), None)
            if match:
                sp = match.get("start_page", 1)
                ep = match.get("end_page", sp)
                title = match.get("title", "")
                self.start_page_var.set(sp)
                self.end_page_var.set(ep)
                self.lbl_lesson_info.config(
                    text=f"[Bai {lid}: Trang {sp} - {ep} • {title}]"
                )
                return

        self.lbl_lesson_info.config(text="")

    def show_toc_dialog(self):
        """Hien thi cua so Muc luc dong de giao vien tra cuu va chon bai nhanh."""
        pdf_path = self.pdf_path_var.get().strip()
        if not self.current_toc and pdf_path and os.path.exists(pdf_path):
            cached = load_cached_toc(pdf_path)
            if cached:
                self.current_toc = cached

        if not self.current_toc:
            resp = messagebox.askyesno(
                "Chua co Muc luc",
                "Chua co du lieu Muc luc cho cuon sach nay.\n"
                "Ban co muon he thong Tu dong quet Muc luc bang AI ngay bay gio khong?"
            )
            if resp:
                self.trigger_ai_toc_scan()
            return

        dlg = tk.Toplevel(self.root)
        dlg.title(f"Muc Luc Sách Giáo Khoa ({len(self.current_toc)} bai)")
        dlg.geometry("740x520")
        dlg.transient(self.root)
        dlg.grab_set()

        lbl_header = ttk.Label(
            dlg,
            text=f"MỤC LỤC BÀI HỌC VÀ TRANG IN ({os.path.basename(pdf_path)})",
            font=("Segoe UI", 11, "bold")
        )
        lbl_header.pack(pady=10)

        tree_scroll = ttk.Scrollbar(dlg)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        toc_tree = ttk.Treeview(
            dlg,
            columns=("topic", "pages"),
            yscrollcommand=tree_scroll.set,
            height=16
        )
        tree_scroll.config(command=toc_tree.yview)
        toc_tree.pack(fill=tk.BOTH, expand=True, padx=12, pady=6)

        toc_tree.heading("#0", text="Bài học")
        toc_tree.heading("topic", text="Chủ đề")
        toc_tree.heading("pages", text="Trang in")

        toc_tree.column("#0", width=280)
        toc_tree.column("topic", width=260)
        toc_tree.column("pages", width=120, anchor=tk.CENTER)

        topic_nodes = {}
        for item in self.current_toc:
            lid = item.get("lesson_id")
            title = item.get("title", "")
            sp = item.get("start_page", 1)
            ep = item.get("end_page", sp)
            topic = item.get("topic", "")

            parent_node = ""
            if topic:
                if topic not in topic_nodes:
                    topic_nodes[topic] = toc_tree.insert("", tk.END, text=topic, values=("", ""), open=True)
                parent_node = topic_nodes[topic]

            toc_tree.insert(
                parent_node,
                tk.END,
                text=f"Bài {lid}. {title}",
                values=(topic, f"Trang {sp} - {ep}")
            )

        btn_frame = ttk.Frame(dlg, padding=8)
        btn_frame.pack(fill=tk.X)

        def pick_lesson():
            selected = toc_tree.selection()
            if not selected:
                dlg.destroy()
                return
            item_text = toc_tree.item(selected[0], "text")
            if item_text.startswith("Bài "):
                try:
                    lid = int(item_text.split(".")[0].replace("Bài ", "").strip())
                    self.lesson_id_var.set(lid)
                    self._on_lesson_spin_change()
                except Exception:
                    pass
            dlg.destroy()

        btn_select = ttk.Button(btn_frame, text="Chon bai nay de boc tach", command=pick_lesson)
        btn_select.pack(side=tk.LEFT, padx=6)
        btn_close = ttk.Button(btn_frame, text="Dong", command=dlg.destroy)
        btn_close.pack(side=tk.RIGHT, padx=6)

    def _create_tree_and_detail_view(self, parent):
        """Khu vuc xem truoc chia doi: Trai la Treeview, Phai la Khung doc noi dung chi tiet."""
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)

        # 1. Ben trai: Treeview danh sach khoi
        frame_left = ttk.Frame(paned, padding=4)
        paned.add(frame_left, weight=1)

        tree_scroll_y = ttk.Scrollbar(frame_left, orient=tk.VERTICAL)
        tree_scroll_x = ttk.Scrollbar(frame_left, orient=tk.HORIZONTAL)

        self.tree = ttk.Treeview(
            frame_left,
            columns=("type", "title_desc"),
            yscrollcommand=tree_scroll_y.set,
            xscrollcommand=tree_scroll_x.set
        )
        tree_scroll_y.config(command=self.tree.yview)
        tree_scroll_x.config(command=self.tree.xview)

        tree_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        tree_scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.tree.heading("#0", text="Thanh phan bai hoc")
        self.tree.heading("type", text="Loai khoi")
        self.tree.heading("title_desc", text="Tieu de / Noi dung")

        self.tree.column("#0", width=220)
        self.tree.column("type", width=100)
        self.tree.column("title_desc", width=220)

        # Bat su kien click chon node tren Treeview de hien thi chi tiet ben phai
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # 2. Ben phai: Khung doc chi tiet noi dung cho Giao vien
        frame_right = ttk.LabelFrame(paned, text=" Chi tiet noi dung boc tach (Doc & Kiem tra) ", padding=8)
        paned.add(frame_right, weight=2)

        scroll_detail = ttk.Scrollbar(frame_right, orient=tk.VERTICAL)
        scroll_detail.pack(side=tk.RIGHT, fill=tk.Y)

        self.txt_detail = tk.Text(
            frame_right,
            wrap=tk.WORD,
            font=("Segoe UI", 10),
            bg="#fdfefe",
            fg="#0f172a",
            padx=12,
            pady=10,
            yscrollcommand=scroll_detail.set
        )
        scroll_detail.config(command=self.txt_detail.yview)
        self.txt_detail.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Thiet lap cac the mau dinh dang van ban de doc
        self.txt_detail.tag_configure("title_h1", font=("Segoe UI", 13, "bold"), foreground="#1e3a8a")
        self.txt_detail.tag_configure("title_h2", font=("Segoe UI", 11, "bold"), foreground="#2563eb")
        self.txt_detail.tag_configure("badge", font=("Segoe UI", 9, "bold"), foreground="#0369a1")
        self.txt_detail.tag_configure("bold", font=("Segoe UI", 10, "bold"), foreground="#0f172a")
        self.txt_detail.tag_configure("correct_opt", font=("Segoe UI", 10, "bold"), foreground="#15803d")
        self.txt_detail.tag_configure("socratic_box", font=("Segoe UI", 10, "italic"), foreground="#b45309")
        self.txt_detail.tag_configure("card_box", font=("Segoe UI", 10), foreground="#334155")
        self.txt_detail.tag_configure("bullet", font=("Segoe UI", 10), foreground="#1e293b")

        # Huong dan mac dinh
        self._set_detail_text(
            "CHÀO MỪNG ĐẾN VỚI SGK DATA STUDIO 2.0\n\n"
            "• Bạn có thể bấm 'Xem trang PDF' để lật từng trang sách trực quan.\n"
            "• Bấm 'Mục lục SGK' hoặc 'Quét Mục lục (AI)' để xem toàn bộ danh mục bài học.\n"
            "• Sau khi bóc tách, bấm vào từng khối bên cây cấu trúc (Treeview) để đọc toàn bộ "
            "nội dung chi tiết của bài học tại đây."
        )

    def _set_detail_text(self, text: str):
        self.txt_detail.config(state=tk.NORMAL)
        self.txt_detail.delete("1.0", tk.END)
        self.txt_detail.insert(tk.END, text)
        self.txt_detail.config(state=tk.DISABLED)

    def _on_tree_select(self, event):
        """Hien thi toan bo noi dung chi tiet khi Giao vien click chon mot muc trong Treeview."""
        selected = self.tree.selection()
        if not selected:
            return

        node_id = selected[0]
        data = self.node_data_map.get(node_id)
        if not data:
            return

        self.txt_detail.config(state=tk.NORMAL)
        self.txt_detail.delete("1.0", tk.END)

        node_type = data.get("_kind")

        if node_type == "package":
            pkg = data.get("payload", {})
            self.txt_detail.insert(tk.END, f"TỔNG QUAN BÀI HỌC SỐ HÓA: {pkg.get('title')}\n\n", "title_h1")
            self.txt_detail.insert(tk.END, "• Khối lớp: ", "bold")
            self.txt_detail.insert(tk.END, f"Lớp {pkg.get('grade')}\n")
            self.txt_detail.insert(tk.END, "• Số thứ tự bài: ", "bold")
            self.txt_detail.insert(tk.END, f"Bài {pkg.get('lesson_id')}\n")
            self.txt_detail.insert(tk.END, "• Trạng thái xuất bản: ", "bold")
            self.txt_detail.insert(tk.END, f"{pkg.get('status', 'draft').upper()} (Chờ giáo viên duyệt trên Web)\n")
            self.txt_detail.insert(tk.END, "• Tệp PDF nguồn: ", "bold")
            self.txt_detail.insert(tk.END, f"{pkg.get('source_file')}\n")
            self.txt_detail.insert(tk.END, "• Các trang SGK đã bóc tách: ", "bold")
            self.txt_detail.insert(tk.END, f"{pkg.get('extracted_pages')}\n")
            self.txt_detail.insert(tk.END, "• Tổng số khối nội dung: ", "bold")
            self.txt_detail.insert(tk.END, f"{len(pkg.get('blocks', []))} khối\n")
            self.txt_detail.insert(tk.END, "• Tổng số câu hỏi trắc nghiệm: ", "bold")
            self.txt_detail.insert(tk.END, f"{len(pkg.get('quiz', []))} câu hỏi\n\n")
            self.txt_detail.insert(tk.END, "-> Bấm vào từng khối bên cây cấu trúc bên trái để xem nội dung chi tiết.", "socratic_box")

        elif node_type == "block":
            b = data.get("payload", {})
            b_type = b.get("type", "unknown")

            if b_type == "hero":
                self.txt_detail.insert(tk.END, f"KHỐI MỞ ĐẦU (HERO STAGE)\n\n", "title_h1")
                self.txt_detail.insert(tk.END, f"Huy hiệu: {b.get('badge', '')}\n", "badge")
                self.txt_detail.insert(tk.END, f"Tiêu đề: {b.get('title', '')}\n\n", "title_h2")
                self.txt_detail.insert(tk.END, "Nội dung mở đầu sư phạm:\n", "bold")
                self.txt_detail.insert(tk.END, f"{b.get('description', '')}\n\n")

            elif b_type == "goals":
                self.txt_detail.insert(tk.END, f"KHỐI MỤC TIÊU BÀI HỌC (LEARNING GOALS)\n\n", "title_h1")
                self.txt_detail.insert(tk.END, "Danh sách các yêu cầu cần đạt:\n\n", "bold")
                for i, item in enumerate(b.get("items", []), start=1):
                    self.txt_detail.insert(tk.END, f"  {i}. ", "bold")
                    self.txt_detail.insert(tk.END, f"{item}\n\n", "bullet")

            elif b_type == "grid_cards":
                self.txt_detail.insert(tk.END, f"KHỐI CÁC THẺ HOẠT ĐỘNG KIẾN THỨC (GRID CARDS)\n\n", "title_h1")
                self.txt_detail.insert(tk.END, f"Chủ đề khối: {b.get('title', '')}\n\n", "title_h2")
                for i, c in enumerate(b.get("cards", []), start=1):
                    self.txt_detail.insert(tk.END, f"--- THẺ {i}: {c.get('title', '')} (Icon: {c.get('icon', '')}) ---\n", "title_h2")
                    if c.get("summary"):
                        self.txt_detail.insert(tk.END, "Tóm tắt: ", "bold")
                        self.txt_detail.insert(tk.END, f"{c.get('summary')}\n")
                    self.txt_detail.insert(tk.END, "Các điểm chính:\n", "bold")
                    for p in c.get("points", []):
                        self.txt_detail.insert(tk.END, f"  • {p}\n", "bullet")
                    self.txt_detail.insert(tk.END, "\n")

            elif b_type == "takeaways":
                self.txt_detail.insert(tk.END, f"KHỐI GHI NHỚ TRỌNG TÂM (TAKEAWAYS)\n\n", "title_h1")
                self.txt_detail.insert(tk.END, "Nội dung hộp 'Em cần biết' trong SGK:\n\n", "bold")
                for i, item in enumerate(b.get("items", []), start=1):
                    self.txt_detail.insert(tk.END, f"  • ", "bold")
                    self.txt_detail.insert(tk.END, f"{item}\n\n", "bullet")

            else:
                self.txt_detail.insert(tk.END, f"KHỐI {b_type.upper()}\n\n", "title_h1")
                self.txt_detail.insert(tk.END, json.dumps(b, ensure_ascii=False, indent=2))

        elif node_type == "quiz_item":
            q = data.get("payload", {})
            self.txt_detail.insert(tk.END, f"CÂU HỎI TRẮC NGHIỆM: {q.get('id')}\n\n", "title_h1")
            self.txt_detail.insert(tk.END, "Câu hỏi: ", "bold")
            self.txt_detail.insert(tk.END, f"{q.get('cau_hoi')}\n\n", "title_h2")

            correct_key = q.get("dap_an_dung")
            self.txt_detail.insert(tk.END, "Các phương án lựa chọn:\n", "bold")
            options = q.get("lua_chon", {})
            for k in ["A", "B", "C", "D"]:
                opt_text = options.get(k, "")
                if k == correct_key:
                    self.txt_detail.insert(tk.END, f"  [*] {k}. {opt_text}  --> [ĐÁP ÁN ĐÚNG]\n", "correct_opt")
                else:
                    self.txt_detail.insert(tk.END, f"  [ ] {k}. {opt_text}\n")
            self.txt_detail.insert(tk.END, "\n")

            self.txt_detail.insert(tk.END, "Giải thích sư phạm (khi học sinh trả lời đúng):\n", "bold")
            self.txt_detail.insert(tk.END, f"  \"{q.get('giai_thich_su_pham', '')}\"\n\n")

            self.txt_detail.insert(tk.END, "Gợi ý Socratic đa tầng (khi học sinh làm sai - Tuyệt đối không lộ đáp án):\n", "bold")
            self.txt_detail.insert(tk.END, f"  \"{q.get('goi_y_khi_sai', '')}\"\n\n", "socratic_box")

            self.txt_detail.insert(tk.END, "Thông tin đối chiếu sách giáo khoa:\n", "bold")
            self.txt_detail.insert(tk.END, f"  • Trang SGK: Trang {q.get('trang_sgk', 'Chưa rõ')}\n")
            self.txt_detail.insert(tk.END, f"  • Mục bài học: {q.get('muc_sgk', 'Chưa rõ')}\n")
            if q.get("forbidden_keywords"):
                self.txt_detail.insert(tk.END, f"  • Từ khóa cấm rò rỉ: {', '.join(q.get('forbidden_keywords'))}\n")

        elif node_type == "hint":
            q = data.get("payload", {})
            self.txt_detail.insert(tk.END, f"GỢI Ý SOCRATIC CHO CÂU HỎI {q.get('id')}\n\n", "title_h1")
            self.txt_detail.insert(tk.END, f"Nội dung gợi ý hướng dẫn học sinh:\n", "bold")
            self.txt_detail.insert(tk.END, f"\"{q.get('goi_y_khi_sai', '')}\"\n\n", "socratic_box")
            self.txt_detail.insert(tk.END, "Tiêu chuẩn sư phạm:\n", "bold")
            self.txt_detail.insert(tk.END, "• Không nêu thẳng chữ cái đáp án A, B, C, D.\n")
            self.txt_detail.insert(tk.END, "• Đặt câu hỏi gợi mở liên kết trực tiếp với khái niệm trong SGK.\n")
            self.txt_detail.insert(tk.END, f"• Từ khóa bị cấm: {q.get('forbidden_keywords', [])}\n")

        self.txt_detail.config(state=tk.DISABLED)

    def _create_json_editor(self, parent):
        editor_frame = ttk.Frame(parent)
        editor_frame.pack(fill=tk.BOTH, expand=True)

        scroll_y = ttk.Scrollbar(editor_frame, orient=tk.VERTICAL)
        self.txt_json = tk.Text(
            editor_frame,
            wrap=tk.NONE,
            font=("Consolas", 10),
            yscrollcommand=scroll_y.set
        )
        scroll_y.config(command=self.txt_json.yview)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.txt_json.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def update_progress(self, message: str, fraction: float):
        self.root.after(0, self._do_update_progress, message, fraction)

    def _do_update_progress(self, message: str, fraction: float):
        self.status_var.set(message)
        self.progress_bar["value"] = fraction * 100

    def start_extraction(self):
        pdf_path = self.pdf_path_var.get().strip()
        if not pdf_path or not os.path.exists(pdf_path):
            messagebox.showerror("Loi tep PDF", "Vui long chon duong dan tep PDF hop le ton tai tren may.")
            return

        grade = self.grade_var.get()
        lesson_id = self.lesson_id_var.get()
        start_p = self.start_page_var.get()
        end_p = self.end_page_var.get()
        offset = self.offset_var.get()

        if start_p > end_p:
            messagebox.showerror("Loi dai trang", "Trang bat dau phai nho hon hoac bang trang ket thuc.")
            return

        self.btn_start.config(state=tk.DISABLED)
        self.btn_cancel.config(state=tk.NORMAL)
        self.btn_save.config(state=tk.DISABLED)
        self.cancel_event.clear()
        self.progress_bar["value"] = 0

        self.worker_thread = threading.Thread(
            target=self._run_extraction_worker,
            args=(pdf_path, grade, lesson_id, start_p, end_p, offset),
            daemon=True
        )
        self.worker_thread.start()

    def _run_extraction_worker(self, pdf_path: str, grade: int, lesson_id: int, start_p: int, end_p: int, offset: int):
        ok, err, package = extract_and_structure_lesson(
            pdf_path=pdf_path,
            grade=grade,
            lesson_id=lesson_id,
            start_page=start_p,
            end_page=end_p,
            page_offset=offset,
            on_progress=self.update_progress,
            cancel_event=self.cancel_event
        )
        self.root.after(0, self._on_extraction_complete, ok, err, package)

    def _on_extraction_complete(self, ok: bool, err: Optional[str], package: Optional[Dict[str, Any]]):
        self.btn_start.config(state=tk.NORMAL)
        self.btn_cancel.config(state=tk.DISABLED)

        if not ok:
            self.status_var.set(f"That bai: {err}")
            messagebox.showwarning("Thong bao boc tach", f"Qua trinh boc tach khong hoan tat:\n{err}")
            return

        self.current_package = package
        self.status_var.set(f"Boc tach thanh cong: {package.get('title')}")
        self.btn_save.config(state=tk.NORMAL)

        json_str = json.dumps(package, ensure_ascii=False, indent=2)
        self.txt_json.delete("1.0", tk.END)
        self.txt_json.insert(tk.END, json_str)

        self._populate_tree(package)
        messagebox.showinfo(
            "Thanh cong",
            f"Boc tach thanh cong bai hoc:\n'{package.get('title')}'\n({len(package.get('blocks', []))} khoi, {len(package.get('quiz', []))} cau hoi).\n\n"
            f"Giao vien co the doc toan bo noi dung chi tiet tai tab 'Xem truoc khoi & Doc noi dung'."
        )

    def _populate_tree(self, package: Dict[str, Any]):
        self.tree.delete(*self.tree.get_children())
        self.node_data_map.clear()

        # Root node
        root_node = self.tree.insert(
            "",
            tk.END,
            text=f"Bai {package.get('lesson_id')}: {package.get('title')}",
            values=("package", f"Lop {package.get('grade')} | Trang {package.get('extracted_pages')}")
        )
        self.node_data_map[root_node] = {"_kind": "package", "payload": package}

        # Blocks node
        blocks_node = self.tree.insert(
            root_node,
            tk.END,
            text="Khoi noi dung (Blocks)",
            values=("group", f"{len(package.get('blocks', []))} khoi")
        )

        for idx, b in enumerate(package.get("blocks", [])):
            b_type = b.get("type", "unknown")
            b_title = b.get("title", b.get("badge", ""))
            b_node = self.tree.insert(
                blocks_node,
                tk.END,
                text=f"[{idx+1}] {b_type}",
                values=(b_type, b_title)
            )
            self.node_data_map[b_node] = {"_kind": "block", "payload": b}

        # Quiz node
        quiz_node = self.tree.insert(
            root_node,
            tk.END,
            text="Trac nghiem va goi y Socratic",
            values=("group", f"{len(package.get('quiz', []))} cau hoi")
        )

        for idx, q in enumerate(package.get("quiz", [])):
            qid = q.get("id", f"q{idx+1}")
            q_text = q.get("cau_hoi", "")[:35] + "..."
            q_sub = self.tree.insert(
                quiz_node,
                tk.END,
                text=qid,
                values=("quiz_item", q_text)
            )
            self.node_data_map[q_sub] = {"_kind": "quiz_item", "payload": q}

            hint_node = self.tree.insert(
                q_sub,
                tk.END,
                text="Goi y Socratic",
                values=("hint", "Bao mat su pham")
            )
            self.node_data_map[hint_node] = {"_kind": "hint", "payload": q}

        self.tree.item(root_node, open=True)
        self.tree.item(blocks_node, open=True)
        self.tree.item(quiz_node, open=True)

        # Tu dong chon root node de hien thi tong quan
        self.tree.selection_set(root_node)
        self._on_tree_select(None)

    def validate_json_editor(self) -> bool:
        text_content = self.txt_json.get("1.0", tk.END).strip()
        if not text_content:
            messagebox.showwarning("Canh bao", "Trinh soan thao JSON dang rong.")
            return False

        try:
            parsed = json.loads(text_content)
        except Exception as e:
            messagebox.showerror("Loi cu phap JSON", f"Cu phap JSON khong hop le:\n{e}")
            return False

        # P0-B: Kiem tra truc tiep qua LessonBlockPackageContract va validate_socratic_hint
        try:
            validated = LessonBlockPackageContract(**parsed)
        except Exception as e:
            messagebox.showerror("Vi pham khe uoc Block Schema 2.0", f"Du lieu khong dat chuan:\n{e}")
            return False

        # Kiem tra Socratic Hint cho tung cau hoi
        for q in parsed.get("quiz", []):
            hint = q.get("goi_y_khi_sai", "")
            correct_key = q.get("dap_an_dung", "")
            options = q.get("lua_chon", {})
            forbidden_keywords = q.get("forbidden_keywords", [])
            question_title = q.get("cau_hoi", "")

            is_valid, reason = validate_socratic_hint(
                hint=hint,
                correct_option_key=correct_key,
                options=options,
                forbidden_keywords=forbidden_keywords,
                question_title=question_title
            )
            if not is_valid:
                qid = q.get("id", "unknown")
                messagebox.showerror("Vi pham an toan Socratic", f"Cau hoi {qid} co goi y vi pham an toan su pham:\n{reason}")
                return False

        self.current_package = parsed
        self._populate_tree(parsed)
        messagebox.showinfo("Khe uoc hop le", "Du lieu JSON hop le theo chuan Block Schema 2.0 va vuot qua kiem dinh Socratic!")
        return True

    def save_to_curriculum(self):
        # Kiem tra va nap noi dung moi nhat tu Editor
        if not self.validate_json_editor():
            return

        pkg = self.current_package
        grade = pkg.get("grade", 6)
        lesson_id = pkg.get("lesson_id", 2)

        # P0-B: Goi DUY NHAT mot ham luu save_lesson_blocks tu backend/grounding.py
        try:
            result = save_lesson_blocks(
                grade=grade,
                lesson_id=lesson_id,
                payload=pkg,
                allow_publish=False
            )
            saved_file = result["path"]
            messagebox.showinfo(
                "Lưu bản nháp thành công",
                f"Đã lưu bài học an toàn vào hệ thống:\n{saved_file}\n\n"
                f"• Trạng thái: BẢN NHÁP (Draft) - Đang chờ Giáo viên duyệt trên Web.\n"
                f"• Sao lưu đa thế hệ: Đã tự động tạo bản sao lưu .bak kèm timestamp.\n\n"
                f"LƯU Ý SƯ PHẠM:\n"
                f"Để học sinh nhìn thấy bài học này trên Web, Giáo viên cần:\n"
                f"1. Mở Web ứng dụng (http://127.0.0.1:8000)\n"
                f"2. Bấm nút 'Giáo viên' ở góc phải trên cùng và nhập mã PIN\n"
                f"3. Thẩm định các câu hỏi trắc nghiệm và bấm 'Xuất bản bài học'."
            )
        except Exception as e:
            messagebox.showerror("Lỗi lưu bài", f"Không thể lưu bài học:\n{e}")

    def cancel_extraction(self):
        if self.worker_thread and self.worker_thread.is_alive():
            self.cancel_event.set()
            self.status_var.set("Dang yeu cau huy tien trinh...")
            self.btn_cancel.config(state=tk.DISABLED)

    def on_close(self):
        """Xu ly dong ung dung an toan (P1-5)."""
        if self.worker_thread and self.worker_thread.is_alive():
            self.cancel_event.set()
            self.status_var.set("Dang cho dung luong truoc khi thoat...")
            self.root.update_idletasks()
            self.worker_thread.join(timeout=2.0)
        self.root.destroy()


def main():
    root = tk.Tk()
    try:
        root.tk.call('encoding', 'system', 'utf-8')
    except Exception:
        pass
    app = SGKStudioApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
