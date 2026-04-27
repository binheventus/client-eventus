# Hướng dẫn sửa câu hỏi 30-Day Review

File câu hỏi đang dùng:
- `src/data/thirtyDayReviewQuestions.json`

Sau khi sửa file JSON này và commit trên GitHub, Vercel sẽ tự deploy lại. Không cần sửa code ở file khác.

## Cấu trúc tổng

File có dạng:

```json
{
  "sections": [
    {
      "id": "ten_section",
      "title": "Tên phần",
      "icon": "eye",
      "questions": []
    }
  ]
}
```

## Cấu trúc mỗi section

Mỗi section gồm:

- `id`: mã section, không trùng nhau, nên dùng chữ thường và dấu `_`
- `title`: tiêu đề hiển thị
- `icon`: chỉ nên dùng một trong 4 giá trị sau
  - `eye`
  - `star`
  - `lightbulb`
  - `rocket`
- `questions`: danh sách câu hỏi trong section

## Cấu trúc mỗi câu hỏi

Mỗi câu hỏi nên có:

- `id`: mã câu hỏi, không trùng nhau
- `label`: nội dung câu hỏi hiển thị
- `type`: loại câu hỏi
- `required`: `true` hoặc `false`

Có thể thêm:

- `placeholder`: gợi ý nhập liệu
- `description`: mô tả phụ
- `options`: danh sách lựa chọn cho `radio` hoặc `checkbox`
- `scale_label`: nhãn 2 đầu cho thang điểm

## Các loại `type` đang hỗ trợ

### 1. `text`

Ví dụ:

```json
{
  "id": "ho_tro_them",
  "label": "Bạn cần hỗ trợ gì thêm?",
  "type": "text",
  "required": false,
  "placeholder": "Nhập nội dung..."
}
```

### 2. `date`

Ví dụ:

```json
{
  "id": "ngay_bat_dau_du_an",
  "label": "Ngày bắt đầu dự án",
  "type": "date",
  "required": false
}
```

### 3. `textarea`

Ví dụ:

```json
{
  "id": "cam_nhan",
  "label": "Cảm nhận của bạn",
  "type": "textarea",
  "required": true,
  "placeholder": "Viết chi tiết..."
}
```

### 4. `radio`

Ví dụ dạng lựa chọn thường:

```json
{
  "id": "muc_do_ro_rang",
  "label": "Bạn thấy mức độ rõ ràng thế nào?",
  "type": "radio",
  "required": true,
  "options": ["Thấp", "Trung bình", "Cao"]
}
```

Ví dụ dạng thang điểm có `scale_label`:

```json
{
  "id": "tong_quan",
  "label": "Tổng quan 30 ngày qua",
  "type": "radio",
  "required": true,
  "options": ["1", "2", "3", "4", "5"],
  "scale_label": {
    "min": "Chưa quen",
    "max": "Rất tốt"
  }
}
```

### 5. `checkbox`

Ví dụ:

```json
{
  "id": "kho_khan",
  "label": "Bạn gặp khó khăn ở đâu?",
  "type": "checkbox",
  "required": true,
  "options": [
    "Công việc",
    "Quy trình",
    "Thiết bị",
    "Giao tiếp"
  ]
}
```

## Quy tắc để không làm lỗi form

- Không xóa dấu phẩy, dấu ngoặc nhọn `{}`, ngoặc vuông `[]` sai vị trí
- Dòng cuối cùng trong object hoặc array không có dấu phẩy thừa
- `id` của section và câu hỏi không được trùng nhau
- Nếu `type` là `radio` hoặc `checkbox`, bắt buộc phải có `options`
- Nếu dùng `scale_label`, chỉ nên dùng cùng `type: "radio"`
- `required` chỉ dùng `true` hoặc `false`

## Cách sửa an toàn nhất

1. Chỉ sửa 1-2 câu hỏi mỗi lần
2. Commit
3. Chờ Vercel deploy
4. Mở `/30dayreview` để kiểm tra

## Gợi ý commit message

Nếu chỉ sửa nội dung câu hỏi:

```text
content: update 30 day review questions
```

Nếu thêm section hoặc đổi cấu trúc lớn:

```text
feat: update 30 day review question structure
```
