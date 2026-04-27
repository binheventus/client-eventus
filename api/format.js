export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, title } = req.body

  if (!text) {
    return res.status(400).json({ error: 'Missing text' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Bạn là trợ lý format nội dung wiki nội bộ cho công ty Eventus Production (dịch vụ quay phim, chụp ảnh, dựng phim).
Nhiệm vụ: Nhận text thô, format lại thành Markdown rõ ràng, dễ đọc.

Quy tắc bắt buộc:
- Dùng # cho tiêu đề chính, ## cho mục, ### cho tiểu mục
- Dùng - cho danh sách gạch đầu dòng
- Dùng **text** để in đậm các điểm quan trọng
- Giữ nguyên 100% nội dung gốc, KHÔNG thêm, KHÔNG bớt, KHÔNG diễn giải lại
- Xuống dòng hợp lý giữa các đoạn
- Chỉ trả về nội dung Markdown thuần, không giải thích gì thêm, không bọc trong code block

Tên trang: ${title}

Nội dung cần format:
${text}`
            }]
          }]
        })
      }
    )

    const data = await response.json()
    const formatted = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!formatted) {
      return res.status(500).json({ error: 'Gemini không trả về kết quả' })
    }

    return res.status(200).json({ result: formatted })
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi kết nối Gemini' })
  }
}
