# Cơ chế VAT trong báo giá

Tài liệu mô tả cách hệ thống xử lý VAT (thuế GTGT) cho quote, contract và export.
Đọc trước khi sửa bất kỳ logic nào liên quan tới `has_vat`, `prices_include_vat`,
`vat_amount`, hoặc nhãn "Thuế GTGT".

## Hai cờ độc lập

Mỗi quote có 2 cờ boolean, lưu ở bảng `client_quotes`:

| Cờ | Mặc định | Ý nghĩa |
|---|---|---|
| `has_vat` | `1` (true) | Có xuất VAT / cộng VAT vào tổng hay không. |
| `prices_include_vat` | `0` (false) | Đơn giá nhập vào ĐÃ gồm VAT (gross) hay CHƯA gồm VAT (net). |

Hai cờ này độc lập:
- `has_vat=false` → không tính VAT, `prices_include_vat` vô nghĩa.
- `has_vat=true, prices_include_vat=false` → giá net, hệ thống cộng VAT lên trên (mặc định, hành vi cũ).
- `has_vat=true, prices_include_vat=true` → giá brief là gross, đã được quy về net khi lưu (xem bên dưới).

## Quy ước cốt lõi: bảng quote LUÔN lưu giá net (Cách B)

`unit_price` của mỗi item trong DB **luôn là giá chưa gồm VAT**. Đây là bất biến
quan trọng nhất. Tầng tính tiền [pricingCalculator.js](../apps/web/src/features/quotes/lib/pricingCalculator.js)
luôn tính `total = taxable + vat`, không bao giờ phải "gỡ" VAT ra khỏi unit_price
lúc tính tổng.

`prices_include_vat=true` KHÔNG đổi công thức tính tổng. Nó chỉ là:
1. **Provenance** — ghi nhận rằng giá ban đầu khách báo là gross.
2. **Trigger quy đổi** — khi bật cờ, đơn giá gross được chuyển sang net NGAY tại
   thời điểm nhập (parse AI hoặc tick checkbox), rồi mới lưu.

### Luồng quy đổi gross → net

Khi giá đầu vào là gross (brief "đã gồm VAT" hoặc sales tick "Đã gồm VAT"):

- `convertItemsGrossToNet(items, { vatRate })` chia mỗi `unit_price` cho `(1 + vatRate)`,
  round về **bội 1000** (`VAT_PRICE_ROUNDING`).
- Đảo lại: `convertItemsNetToGross` khi sales bỏ tick.
- Round 2 lần (qua lại) không lossless — chấp nhận drift vài nghìn ở total, đây là
  lựa chọn có chủ đích để đơn giá luôn tròn nghìn (dễ đọc cho khách).

Ví dụ brief "all-in 22tr đã gồm VAT" (2×5tr chụp + 2×6tr quay, VAT 8%):
- 5,000,000 / 1.08 → round 1000 = 4,630,000
- 6,000,000 / 1.08 → round 1000 = 5,556,000
- subtotal net = 20,372,000, VAT = 1,629,760, total ≈ 22,001,760 (drift +1,760đ).

## VAT_RATE lấy từ business_rules (KHÔNG hardcode)

Thuế suất đọc từ `pricing_business_rules` rule_code `VAT_RATE` (chỉnh ở `/pricing-admin`).
Fallback `DEFAULT_VAT_RATE = 0.08` khi rule thiếu.

- Tính VAT: `getRuleValue(businessRules, 'VAT_RATE', DEFAULT_VAT_RATE)` trong `calculateQuotePricing`.
- Quy đổi gross↔net: `getQuoteVatRate(rulesMap)` ở [QuoteCreatePage.jsx](../apps/web/src/features/quotes/pages/QuoteCreatePage.jsx).

→ Đổi VAT_RATE trong `/pricing-admin` là cả tính toán lẫn quy đổi đều tự đổi theo.

### Nhãn "Thuế GTGT X%" hiển thị động

KHÔNG hardcode "8%". Dùng 2 helper trong `pricingCalculator.js`:

- `resolveVatRate(quote, businessRules)` — suy ngược tỷ lệ từ chính số tiền đã lưu
  (`vat_amount / taxable`). Khớp đúng số tiền trong tài liệu, kể cả quote lịch sử lưu
  ở thuế suất khác. Fallback: businessRules → DEFAULT_VAT_RATE.
- `formatVatLabel(quote, businessRules, { prefix, percentFractionDigits })` — trả
  chuỗi nhãn, vd `"Thuế GTGT 8%"` hoặc `"VAT 10%"`.

Mọi nơi hiển thị nhãn VAT phải dùng `formatVatLabel`, không viết "8%" trực tiếp:
preview, PDF báo giá, PDF/DOCX hợp đồng, Excel, điều khoản quoteTerms.

## Nhận diện VAT từ brief

`/api/parse-quote` set 2 cờ qua 2 đường:

1. **AI parser** — schema `submit_parsed_quote` có field `has_vat`, `prices_include_vat`
   ([claude-quote-parser.js](../apps/api/lib/claude-quote-parser.js)). Luật nhận diện
   trong system prompt ([claude-quote-prompt.js](../apps/api/lib/claude-quote-prompt.js))
   + ví dụ huấn luyện ([claude-quote-examples.js](../apps/api/lib/claude-quote-examples.js)).
2. **Regex fallback** — `detectVatFromBrief(inputText)` trong
   [parse-quote.js](../apps/api/parse-quote.js). Chạy khi AI lỗi, và backfill cho
   nhánh AI khi AI để cờ null.

Bảng nhận diện:

| Cụm trong brief | has_vat | prices_include_vat |
|---|---|---|
| "đã gồm VAT", "all-in ... VAT", "incl vat", "gross" | true | true |
| "chưa gồm VAT", "+VAT", "ex vat", "giá net" | true | false |
| "không xuất VAT", "không hoá đơn", "no vat" | false | (n/a) |
| "xuất VAT", "có VAT" (chung chung) | true | null |
| Không nhắc | null | null (giữ default của user) |

`detectVatFromBrief` check "chưa gồm VAT" TRƯỚC "đã gồm VAT" vì chuỗi con "gồm vat"
trùng nhau. `normalizeVietnameseText` đã xử lý `đ → d`.

## Checklist khi sửa liên quan VAT

- [ ] Đổi công thức? Nhớ bảng quote luôn lưu net — đừng "gỡ" VAT lúc tính tổng.
- [ ] Thêm nơi hiển thị VAT? Dùng `formatVatLabel`, không hardcode %.
- [ ] Đổi schema parser? Cập nhật cả prompt, examples, và regex fallback cho đồng bộ.
- [ ] Thêm cột DB? Cập nhật `QUOTE_COLUMNS`, `quoteColumns` (migration), mysql-schema.sql.
- [ ] Export (PDF/DOCX/XLSX) phải đồng bộ với preview — xem AGENTS.md.
- [ ] Chạy `npm run test:quotes` (185+ test) trước khi xong.

## File liên quan

| File | Vai trò |
|---|---|
| `apps/web/.../lib/pricingCalculator.js` | Tính tiền, convert gross↔net, resolveVatRate, formatVatLabel |
| `apps/web/.../pages/QuoteCreatePage.jsx` | Checkbox VAT, toggle quy đổi, apply cờ từ parse |
| `apps/api/parse-quote.js` | detectVatFromBrief, backfill cờ |
| `apps/api/lib/claude-quote-*.js` | Schema, prompt, examples cho AI parser |
| `apps/api/quotes.js`, `contracts.js` | Lưu/đọc cờ ở DB layer |
| `docs/mysql-schema.sql`, `scripts/migrate-mysql.mjs` | Cột `prices_include_vat` |
