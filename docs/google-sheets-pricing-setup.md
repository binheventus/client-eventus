# Hướng Dẫn Kết Nối Google Sheet Bảng Giá

Mục tiêu: bạn sửa bảng giá trong Google Sheet, sau đó chạy lệnh export để app tự cập nhật các file JSON trong code.

App không đọc Google Sheet trực tiếp khi mở trang báo giá. Google Sheet chỉ là nơi lưu bảng giá gốc để bạn dễ sửa.

## 1. Tạo Google Sheet bảng giá

1. Mở Google Drive.
2. Upload file `Eventus_Pricing_Master_v4.xlsx`.
3. Bấm chuột phải vào file vừa upload.
4. Chọn **Open with** -> **Google Sheets**.
5. Sau khi mở ra, chọn **File** -> **Save as Google Sheets**.
6. Google sẽ tạo một file Google Sheets mới. Hãy dùng link của file mới này, không dùng link của file `.xlsx` gốc.
7. Kiểm tra các tab vẫn giữ đúng tên:
   - `01_services`
   - `02_travel_fees`
   - `03_customer_tiers`
   - `04_business_rules`
   - `05_legal_entities`
   - `06_equipment_rules`

Tab `05_quote_template` đã bỏ vì chỉ là cấu trúc/mẫu báo giá tham khảo, không còn là dữ liệu bắt buộc để app tính giá hoặc export bảng giá.

Tab `07_owner_decisions` cũng đã bỏ vì chỉ là decision log nội bộ; các quyết định đang được dùng đã chuyển vào các sheet dữ liệu tương ứng như `04_business_rules`, `05_legal_entities`, hoặc các sheet bảng giá khác.

Sau đó copy **Google Sheet ID** từ đường link của file Google Sheets mới.

Ví dụ link có dạng:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjK123456789/edit
```

Thì Google Sheet ID là:

```text
1AbCdEfGhIjK123456789
```

Nếu khi export gặp lỗi:

```text
This operation is not supported for this document. The document must not be an Office file.
```

Nghĩa là bạn đang dùng link file Excel `.xlsx` trên Google Drive, chưa phải file Google Sheets native. Hãy mở file đó rồi chọn **File** -> **Save as Google Sheets**, sau đó lấy link mới.

## 2. Bật Google Sheets API

1. Mở trang [Google Cloud Console](https://console.cloud.google.com/).
2. Nếu Google hỏi chọn project, bấm **New Project**.
3. Đặt tên project, ví dụ:

```text
Eventus Pricing Export
```

4. Bấm **Create**.
5. Sau khi tạo xong, chọn đúng project vừa tạo.
6. Ở thanh tìm kiếm phía trên, gõ:

```text
Google Sheets API
```

7. Chọn **Google Sheets API**.
8. Bấm **Enable**.

## 3. Tạo service account

Service account là một tài khoản kỹ thuật để script đọc Google Sheet. Nó không phải tài khoản Gmail cá nhân của bạn.

1. Trong Google Cloud Console, mở menu bên trái.
2. Vào **IAM & Admin** -> **Service Accounts**.
3. Bấm **Create service account**.
4. Điền tên:

```text
pricing-export
```

5. Bấm **Create and Continue**.
6. Phần quyền project có thể bỏ qua, bấm **Continue**.
7. Bấm **Done**.

## 4. Tải file key JSON

1. Trong danh sách service account, bấm vào service account `pricing-export`.
2. Mở tab **Keys**.
3. Bấm **Add key**.
4. Chọn **Create new key**.
5. Chọn loại key là **JSON**.
6. Bấm **Create**.
7. Google sẽ tải về một file `.json`.

Nên lưu file này ở ngoài repo, ví dụ:

```text
/Users/phamthanhbinh_1/Documents/eventus-pricing-service-account.json
```

Không đưa file key này lên GitHub. Không gửi nội dung file key vào chat.

## 5. Share Google Sheet cho service account

1. Mở file key JSON vừa tải về.
2. Tìm dòng:

```json
"client_email": "pricing-export@....iam.gserviceaccount.com"
```

3. Copy email đó.
4. Mở Google Sheet bảng giá.
5. Bấm **Share**.
6. Dán email service account vào.
7. Chọn quyền **Viewer**.
8. Bấm **Send** hoặc **Share**.

## 6. Chạy thử export

Chạy lệnh này trong thư mục repo:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/duong-dan-toi-file-key-json" \
PRICING_SPREADSHEET_ID="google_sheet_id" \
npm run pricing:export -- --dry-run
```

Ví dụ:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/Users/phamthanhbinh_1/Documents/eventus-pricing-service-account.json" \
PRICING_SPREADSHEET_ID="1AbCdEfGhIjK123456789" \
npm run pricing:export -- --dry-run
```

`--dry-run` nghĩa là chỉ kiểm tra, chưa ghi đè file JSON.

Nếu chạy thành công, bạn sẽ thấy kết quả có dạng:

```json
{
  "ok": true,
  "dry_run": true,
  "services_count": 53
}
```

## 7. Export thật sau khi sửa bảng giá

Khi bạn đã sửa Google Sheet xong và muốn cập nhật app:

```bash
GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/duong-dan-toi-file-key-json" \
PRICING_SPREADSHEET_ID="google_sheet_id" \
npm run pricing:export
```

Lệnh này sẽ cập nhật các file trong:

```text
src/data/pricing/
```

## 8. Script sẽ tự kiểm tra lỗi gì?

Script sẽ dừng lại nếu phát hiện các lỗi quan trọng:

- Thiếu tab bắt buộc.
- Thiếu cột bắt buộc.
- `service_code` bị trống.
- `service_code` bị trùng.
- Giá `price_tier_1`, `price_tier_2`, `price_tier_3` không phải số.
- Bảng dịch vụ còn quá ít dòng bất thường.
- Thiếu rule quan trọng như `VAT_RATE`, `FULL_DAY_THRESHOLD`, `OVERTIME_HOURLY_FEE`.
- Thiếu pháp nhân mặc định.

Nếu script báo lỗi, không nên deploy app. Sửa Google Sheet trước rồi export lại.

## 9. Quy trình mỗi lần đổi bảng giá

```text
1. Bạn sửa bảng giá trong Google Sheet
2. Chạy dry-run để kiểm tra
3. Nếu không lỗi, chạy export thật
4. Chạy build/test nếu cần
5. Commit/push để Vercel deploy lại
```

## 10. Các file quan trọng

Script export:

```text
scripts/export-pricing-from-google-sheet.mjs
```

Dữ liệu JSON app đang dùng:

```text
src/data/pricing/
```

Biến môi trường cần dùng khi export:

```text
GOOGLE_SERVICE_ACCOUNT_KEY_FILE
PRICING_SPREADSHEET_ID
```
