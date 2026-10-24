# 04 — LIVE-01 và bằng chứng nguồn phản hồi

Local đã thử dashboard/theory/quiz đều 200 với loader mock và key tắt. Production trước đó Dashboard lỗi hai lần. Chưa chứng minh mã HTTP 422; không kết luận đã sửa production chỉ từ local.

Giữ active_tab dashboard/exam trong contract hiện tại. Thu thập status, request_id và revision frontend/backend ở production trước khi quyết định sửa/deploy. Không log Authorization, cookie, toàn bộ payload/history hoặc API key.

Để phân biệt Gemini/fallback mà không phá 10 caller trả str: thêm diagnostics=None cuối chữ ký chat_with_tutor. Mẫu helper cục bộ trong hàm, dùng req_id/actual_model/start_time sẵn có:

```python
def finish(reply, source, error_code):
    if diagnostics is not None:
        diagnostics.update({
            'request_id': req_id,
            'source': source,
            'error_code': error_code,
        })
    return reply
```

Tất cả return của orchestrator phải đi qua finish. Nhánh Gemini thành công: source=gemini, NONE. Ngoại lệ/key thiếu: source=local_fallback và mã đã phân loại. Guardrail thay lời Gemini vẫn phải giữ nguồn gọi rõ; có thể thêm guardrail_applied riêng, không tự suy nguồn từ nội dung.

Server tạo diag={} cho mỗi request, truyền diagnostics=diag; trả source cùng reply/request_id hoặc giữ riêng log quản trị nếu không muốn public. Tuyệt đối không trả chi tiết exception. Nếu public source, thêm kiểu Literal tương ứng trong hợp đồng phản hồi. Giữ wrapper/caller cũ hoạt động.

frontend/app.js chỉ sửa transport, không redesign: giữ HTTP status trong Error; không đồng nhất 422/429/500 thành “máy chủ khởi động”. Mẫu phần kiểm tra response:

```javascript
if (!res || !res.ok) {
  const status = res?.status ?? 0;
  const error = new Error(`CHAT_HTTP_${status}`);
  error.status = status;
  throw error;
}
const data = await res.json();
if (typeof data.reply !== 'string' || !data.reply.trim()) {
  throw new Error('CHAT_EMPTY_REPLY');
}
```

Đối chiếu source/request_id ở cùng request mới chứng minh live. Test F12 hiện chỉ assert 200/nonempty; chưa assert source hay liên kết log. Không suy luận live từ latency hoặc câu chữ.
