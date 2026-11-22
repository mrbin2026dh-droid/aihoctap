# 04. Cơ sở dữ liệu và bảo mật

Mức bảo mật (AGENTS.md mục H): **CAO**, vì bài làm có dữ liệu cá nhân học sinh (nghề quan tâm, sở thích, chuyện người thân) và đáp án GV (PL9.2.9). Nội dung học sinh xem (tình huống, thẻ nghề, ví dụ) ở mức THƯỜNG.

## 1. Nhánh RTDB mới (chỉ Worker truy cập)
Gốc luật đang `.read: false, .write: false`, nên các nhánh dưới đây **mặc định đóng**. Không thêm luật mở đọc, không cho học sinh ghi REST trực tiếp như `thi_nop`/`nang_luc`.

| Nhánh | Khóa | Nội dung | Ai ghi (qua Worker) |
|---|---|---|---|
| `phieu_bo/{packId}` | `ai9_bai2` | Gói phiếu cho học sinh (03) | Giáo viên quản trị / công cụ nạp |
| `phieu_dapan/{packId}` | | Đáp án, tiêu chí Đạt/Khá/Tốt, mẫu nhận xét | Giáo viên quản trị; **chỉ route giáo viên đọc** |
| `phieu_bai/{packId}/{lopKey}/{uid}` | `lopKey` = `class_code` đã chuẩn hóa | `{name, class_code, group, answers{fieldId:string}, locked{fieldId:at}, status:'draft'|'submitted'|'returned'|'reviewed', rev, updated_at, submitted_at}` | Chủ bài; giáo viên chỉ đổi `status` |
| `phieu_ls/{packId}/{uid}/{rev}` | | Bản chụp bất biến `{answers, status, at, by:'hs'|'gv', ly_do}` | Worker tự ghi khi nộp, nộp lại, trả bài. **Không bao giờ sửa/xóa** |
| `phieu_gv/{packId}/{uid}` | | `{muc{'9.A3.1':'chua_thay'|'dat'|'kha'|'tot'}, thieu{code:text}, ho_tro, nhan_xet, mieng{fieldId:true}, by, at}` | Giáo viên đúng lớp |
| `phieu_gv_ls/{packId}/{uid}/{n}` | | Lịch sử nhận xét | Worker |
| `phieu_nhom/{packId}/{lopKey}/{nhom}` | `nhom` 1–12 | `{job, job_custom?, cells{c1,c2,c3,c4_1,c4_1vi,c4_2,c4_2vi, the_nl…}, phan_cong{c1:[uid],…,phan_bien:uid}, tram, members{uid:name}, rev, updated_at}` | Thành viên nhóm |
| `phieu_nhom_ls/{packId}/{lopKey}/{nhom}/{n}` | | `{uid, fields[], at}`: ai sửa ô nào | Worker |
| `phieu_gopy/{packId}/{ownerUid}/{peerUid}` | | `{muc_tieu:1|2, kiem[3], text, at}`: minh chứng của người góp ý | Người góp ý |
| `phieu_quansat/{packId}/{lopKey}/{nhom}` | | Ba chỉ báo PL9.2.9 mục 4, ghi đóng góp cá nhân | Giáo viên |
| `phieu_mo/{packId}/{lopKey}` | | Giáo viên mở bước (ví dụ trang 2 PL9.2.8) | Giáo viên |

`lopKey`: chữ thường, thay `. # $ [ ] /` bằng `_` (giống `fbKey_`). Không lưu số điện thoại, địa chỉ, thông tin gia đình; đặt nhắc ngay dưới trường "hỏi người lớn" và "nghề người thân".

**Chỉ mục:** RTDB REST không cần chỉ mục cho đường dẫn theo khóa. Mọi truy vấn của giáo viên đi theo `phieu_bai/{packId}/{lopKey}` (một lớp mỗi lần), không quét toàn bộ.

**Di chuyển dữ liệu (migration):** không có. Toàn bộ là nhánh mới, không đổi nhánh cũ, không đổi IndexedDB (dùng khóa tiền tố `phieu:` trong store sẵn có).

## 2. Route Worker và quyền
Mọi route bắt buộc JWT. `uid`, `class_code`, `name` **lấy từ token**, không bao giờ từ body.

| Route | Ai | Kiểm tra |
|---|---|---|
| `GET /api/pwa/phieu/{packId}` | Học sinh | Token hợp lệ; `grade` khớp `pack.grade`; trả gói, bài của em, nhóm của em. Không trả `phieu_dapan` |
| `PUT /api/pwa/phieu/{packId}/draft` | Học sinh | `fieldId` thuộc lược đồ, không phải trường nhóm, chưa bị khóa; chuỗi ≤ `max` (mặc định 2.000), tổng ≤ 40 KB; `status` ∈ {draft, returned}; `rev` khớp, nếu không thì 409 |
| `POST /api/pwa/phieu/{packId}/lock` | Học sinh | Khóa nhóm trường `lock` (ví dụ `chot_dau_gio`); khóa rồi thì không mở lại được (chỉ giáo viên mở, có lịch sử) |
| `POST /api/pwa/phieu/{packId}/submit` | Học sinh | Ghi bản chụp `phieu_ls/{rev}` (chỉ khi chưa tồn tại), `status=submitted` |
| `PUT /api/pwa/phieu/{packId}/nhom` | Học sinh | Thành viên nhóm (`members[uid]` tồn tại) cùng `lopKey`; chỉ trường `mode:nhom` |
| `POST /api/pwa/phieu/{packId}/gopy` | Học sinh | `ownerUid` cùng lớp (đọc `phieu_bai/{pack}/{lopKey}/{owner}` phải tồn tại); người góp ý ≠ chủ phiếu; chỉ ghi `phieu_gopy/…/{owner}/{uidToken}` |
| `GET /api/pwa/teacher/phieu/{packId}?lop=` | Giáo viên | `requireTeacher`; nếu `scope==='class'` thì `lop` ∈ `user.classes`, nếu không thì 403. Trả danh sách gọn (tên, trạng thái, mức) |
| `GET …/teacher/phieu/{packId}/hs/{uid}?lop=` | Giáo viên | Như trên, và bài phải nằm đúng `lopKey`; trả bài, lịch sử bản, góp ý nhận được, đáp án GV |
| `PUT …/teacher/phieu/{packId}/hs/{uid}/danh-gia` | Giáo viên | Chỉ ghi `phieu_gv`; giá trị mức thuộc tập cho phép; ghi lịch sử |
| `POST …/teacher/phieu/{packId}/hs/{uid}/tra-bai` | Giáo viên | `status: submitted → returned`; bản chụp `by:'gv'`; cần xác nhận ở giao diện (mục J) |
| `PUT …/teacher/phieu/{packId}/nhom/{nhom}/quan-sat`, `…/mo` | Giáo viên | Phạm vi lớp như trên |

- Không dùng đường `authTeacherAny` (mã + PIN giáo viên trong body) cho các route này, vì đường đó không trả danh sách lớp, nên không lọc được theo lớp.
- Giới hạn tần suất: dùng lại Durable Object hiện có (khóa `rate:phieu:{uid}`), ví dụ 60 lần ghi mỗi phút.
- Lỗi trả `{error: MÃ, detail: câu tiếng Việt}` để giao diện hiện đúng (tránh lỗi nuốt câu như vụ đổi PIN).

## 3. Mối đe dọa và cách chặn
| Mối đe dọa | Chặn |
|---|---|
| Học sinh đọc bài bạn | Nhánh đóng; route học sinh chỉ đọc `{uid token}` |
| Học sinh tự nhận quyền GV | Quyền GV chỉ từ JWT ký bởi Worker (`hasTeacherClaims`); không có trường vai trò nào do client gửi |
| GV lớp A xem lớp B | Lọc `user.classes` ở mọi route giáo viên |
| Sửa "Lúc đầu em chọn…" | Trường `lock` bị Worker chặn |
| Sửa bài sau khi nộp không dấu vết | Bản chụp bất biến; chỉ sửa được khi `returned` |
| Lộ đáp án PL9.2.9 | Nằm ở `phieu_dapan`, chỉ route GV; không vào gói học sinh, không vào `sw.js` |
| Chèn công thức CSV | Hàm `csvSafe()` thêm `'` trước `= + - @ \t \r` |
| XSS từ câu trả lời | Dựng DOM bằng `textContent` (`el()` trong `dom.js`), không `innerHTML` với dữ liệu người dùng |
| Máy dùng chung lộ nháp | Xóa khóa `phieu:` trong IndexedDB khi đăng xuất (theo cơ chế cách ly vai trò mục N) |
| Gia sư AI đưa "đáp án" | Gói có `ai_tutor:false`; nút Gia sư ẩn trong phiếu |

## 4. Lưu giữ dữ liệu (chờ giáo viên/nhà trường quyết định)
Đề xuất: giữ đến hết năm học; giáo viên xuất CSV lưu hồ sơ rồi xóa theo lớp bằng thao tác có xác nhận (mục J). Không tự xóa.
