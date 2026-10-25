# Thẩm định: cập nhật PWA cho học sinh đã cài (25/10/2026)
**Phán quyết: YÊU CẦU ĐIỀU CHỈNH — KHÔNG deploy nếu chưa sửa P1.** (AGENTS.md mục L)

## Đã kiểm thật
- Luồng sẵn có đúng hướng: `sw.js` chỉ cache vỏ giao diện, không chặn API; cập nhật chờ (`waiting`), có nút "Cập nhật khi sẵn sàng", giữ nháp đang làm, chỉ `skipWaiting` khi người dùng đồng ý; IndexedDB có `onversionchange`/`onblocked`.
- Đã tính băm shell theo thuật toán của công cụ đóng dấu trên các tệp hiện tại.

## Lỗi
- **P1 (chặn):** dấu cache trong `sw.js` đã LỖI THỜI: ghi `4bd541a4…`, byte shell hiện tại cho `efbd3a2a…`. Nếu deploy, `sw.js` giống hệt bản đã cài → trình duyệt coi là không có bản mới → học sinh KHÔNG nhận menu Cài đặt, hộp thoại, sửa lỗi UI. Đúng lỗi người dùng lo.
- **P2 (chặn):** `tools/package_student_pwa.py` (đóng dấu/kiểm) chỉ có trong `scratch/`, không có ở `tools/`; workflow `deploy-pages.yml` không đóng dấu cũng không kiểm. Dấu chỉ đúng nếu người nhớ chạy tay.
- **P3 (chặn):** `install` dùng `cache.addAll` theo bộ nhớ đệm HTTP của GitHub Pages (max-age ~10 phút): SW mới có thể nạp NHẸ tệp cũ, cache mới chứa mã cũ, bản cập nhật "giả".
- **P4:** chỉ kiểm tra cập nhật khi mở trang; ứng dụng cài mở lâu ngày không tự kiểm. Thiếu kiểm khi quay lại màn hình/có mạng lại và theo giờ.
- **P5:** nhiều cửa sổ: cửa sổ khác bị đổi controller nhưng không có thông báo và không tải lại (chạy mã cũ với cache mới); nguy cơ treo/lệch phiên bản.
- **P6:** điều hướng có `?` (ví dụ `./?source=pwa`) không khớp cache → mất mạng là trang trắng.
- **P7:** không có nơi xem phiên bản/ nút "Kiểm tra cập nhật" để người dùng thử thực tế.
- Lưu ý: Worker/IndexedDB phải thay đổi tương thích ngược (mục L).

## Điều kiện ACCEPT
Sửa P1–P7 theo `claude-antigravity-pwa-update.md`, cùng S1–S5 menu; Claude chạy lại; sau đó mới deploy cho người dùng thử.
