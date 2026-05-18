import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { ADMIN_PASSWORD, VFX_BUILDER_PASSWORD } from '../config'
import data from '../data/competency.json'

const PositionPage = lazy(() => import('./PositionPage'))
const VFXPromptBuilderPage = lazy(() => import('./VFXPromptBuilderPage'))
const ContractTemplatesPage = lazy(() => import('../features/quotes/pages/ContractTemplatesPage'))
const QuoteCreatePage = lazy(() => import('../features/quotes/pages/QuoteCreatePage'))
const QuoteDetailPage = lazy(() => import('../features/quotes/pages/QuoteDetailPage'))
const QuoteListPage = lazy(() => import('../features/quotes/pages/QuoteListPage'))
const QuoteTrashPage = lazy(() => import('../features/quotes/pages/QuoteTrashPage'))

/* ─── Danh muc sidebar ─── */
const CATEGORIES = [
  {
    id: 'vfx_builder',
    label: 'VFX Prompt Builder',
    icon: '✨',
    shortDesc: 'Tạo prompt VFX chuẩn cho Veo / Kling',
    banner: 'VFX Prompt Builder',
    desc: 'Form chọn tham số transition và gọi Claude để tạo prompt tiếng Anh cho video AI.',
  },
  {
    id: 'quotes',
    label: 'Báo giá',
    icon: '💼',
    shortDesc: 'Tạo, quản lý và chia sẻ báo giá dịch vụ',
    banner: 'Quote Generator',
    desc: 'Module tạo báo giá tự động cho sales Eventus.',
  },
]

const LAB_CONTENT_TABLE = 'lab_pages'

function PageLoading() {
  return <div className="px-4 py-6 text-[13px] font-semibold text-slate-400">Đang tải...</div>
}

const CATEGORY_CARD_META = {
  quy_trinh: { accent: 'from-slate-50 to-blue-50/70', iconBg: 'bg-slate-100', iconText: 'text-slate-700', stroke: '#334155' },
  noi_quy: { accent: 'from-slate-50 to-slate-100/80', iconBg: 'bg-slate-100', iconText: 'text-slate-700', stroke: '#475569' },
  huong_dan: { accent: 'from-slate-50 to-teal-50/70', iconBg: 'bg-slate-100', iconText: 'text-slate-700', stroke: '#0f766e' },
}

const CATEGORY_BANNER_STYLES = {
  quy_trinh: {
    bg: 'from-slate-900 via-blue-900 to-teal-700',
    label: 'text-blue-100',
    desc: 'text-blue-100/90',
  },
  noi_quy: {
    bg: 'from-slate-900 via-slate-800 to-emerald-700',
    label: 'text-emerald-100',
    desc: 'text-emerald-100/90',
  },
  huong_dan: {
    bg: 'from-slate-900 via-teal-900 to-cyan-700',
    label: 'text-cyan-100',
    desc: 'text-cyan-100/90',
  },
  khung_nang_luc: {
    bg: 'from-slate-900 via-blue-900 to-teal-700',
    label: 'text-blue-100',
    desc: 'text-blue-100/90',
  },
  vfx_builder: {
    bg: 'from-slate-900 via-blue-900 to-teal-700',
    label: 'text-blue-100',
    desc: 'text-blue-100/90',
  },
  quotes: {
    bg: 'from-slate-900 via-blue-900 to-teal-700',
    label: 'text-blue-100',
    desc: 'text-blue-100/90',
  },
}

const CONTENT_STANDARDIZATION_PROMPT = `Bạn là biên tập viên tài liệu vận hành nội bộ cho Eventus.

Nhiệm vụ của bạn là đọc hiểu nội dung gốc và viết lại thành tài liệu nội bộ cho Eventus AI Lab có cấu trúc đẹp, rõ ràng, dễ đọc.

Đây KHÔNG phải nhiệm vụ chuyển text sang Markdown đơn giản.
Đây là nhiệm vụ biên tập lại tài liệu vận hành: giữ đầy đủ ý quan trọng, nhưng trình bày lại cho chuyên nghiệp hơn.

YÊU CẦU QUAN TRỌNG:

1. Không giữ nguyên cách chia mục thô của bài gốc nếu cách chia đó xấu.
2. Không tóm tắt quá ngắn.
3. Không tự bịa thêm nội dung mới.
4. Không dùng \`**bold**\`.
5. Không dùng nhiều bullet lồng nhau.
6. Không để tiêu đề toàn chữ in hoa.
7. Không dùng \`# 1. Tên mục\`. Hãy đổi thành dạng đẹp hơn: \`# Bước 1: Tên bước\`.
8. Không đưa tiêu đề chính của bài vào nội dung Markdown. Tiêu đề chính sẽ được nhập riêng ở hệ thống.
9. Không tạo quá nhiều block nhỏ.
10. Mẫu tin nhắn gửi khách phải dùng quote block \`>\`.
11. Phần xử phạt phải gọn, mỗi lỗi là một bullet.
12. Giữ đầy đủ số tiền phạt, deadline, tên người, tên bộ phận, link, quy định quan trọng.

QUY TẮC GIỮ NỘI DUNG GỐC:

- Với các mẫu tin nhắn gửi khách, phải giữ gần nguyên văn nội dung gốc. Chỉ sửa lỗi chính tả rất nhỏ nếu cần, không được viết lại theo cách khác.
- Với các đoạn giải thích quan trọng, không được rút gọn thành bản tóm tắt. Hãy giữ đủ ý như bài gốc, chỉ chia câu và xuống dòng cho dễ đọc hơn.
- Không được đưa cùng một nội dung vào hai vị trí khác nhau. Nếu bài có phần riêng về “khách qua văn phòng”, hãy để nội dung chính ở phần đó, không lặp lại ngắn ở phần trước.
- Không được đổi tên bước nếu tên bước gốc đã rõ. Chỉ chuẩn hóa nhẹ cho dễ đọc.
- Các câu mẫu gửi khách là nội dung vận hành đã được duyệt, nên phải giữ gần nguyên văn. Không được tự viết lại cho “hay hơn”.
- Không được rút gọn phần xử phạt. Mỗi lỗi xử phạt phải giữ đủ điều kiện, ngữ cảnh và mức phạt như nội dung gốc.
- Phần bảo mật cuối bài phải giữ gần nguyên văn nội dung gốc. Không tự viết lại ngắn hơn. Chỉ được bỏ ký hiệu \`***\` và sửa khoảng trắng nếu cần.
- Định dạng phần bảo mật cuối bài là text thường, không tạo heading riêng: \`Lưu ý bảo mật: [nội dung bảo mật gần nguyên văn]\`.
- Không bỏ sót các thao tác vận hành nhỏ nhưng quan trọng, ví dụ: cất giấy tờ vào sổ Binder, cập nhật hệ thống ngay khi xuất/nhập/bàn giao, kiểm tra thiết bị gửi ở tầng 2.
- Nếu một ý trong bài gốc là trách nhiệm bắt buộc, hãy dùng giọng rõ ràng như “cần”, “phải”, “bắt buộc”, không viết quá nhẹ.

QUY TẮC MARKDOWN:

- Phần lớn dùng \`#\`, ví dụ:
# Bước 1: Nhận job và confirm

- Mục con dùng \`##\`, ví dụ:
## Cập nhật trạng thái công việc

- Hạn chế dùng \`###\`. Chỉ dùng khi thật sự cần.
- Không dùng \`####\`.
- Không dùng bold \`**...**\`.
- Không dùng bullet lồng nhiều tầng.

Sai:
- Nội dung chính:
  - Ý nhỏ:
    - Ý nhỏ hơn

Đúng:
- Nội dung chính.
- Ý liên quan 1.
- Ý liên quan 2.

- Với đoạn quy trình dài, hãy viết thành đoạn văn ngắn dễ đọc, không ép tất cả thành bullet.
- Với danh sách kiểm tra, quy định, xử phạt: dùng bullet.

- Với phần xử phạt: không tách mỗi lỗi thành block riêng. Viết gọn dạng:
- Mất file: phạt từ 500.000đ/lần + không tính lương job, tùy mức độ nghiêm trọng.
- Copy file sai quy định: phạt 200.000đ/lần.

- Với mẫu tin nhắn gửi khách: bắt buộc dùng quote block bằng dấu \`>\`.
Ví dụ:
> Em gửi anh/chị video đã dựng, anh/chị xem và feedback giúp em để em hoàn thiện ạ.

- Nếu mẫu tin nhắn có nhiều dòng, mỗi dòng đều phải bắt đầu bằng \`>\`.
Ví dụ:
> Hi anh/chị, em A phụ trách dựng video B cho anh/chị ạ.
> Em đã nhận được nội dung/kịch bản dựng của bên mình.
> Em dự kiến sẽ gửi lại anh/chị vào [thời gian cụ thể] ạ.

- Chỉ chuyển thành quote block những câu thật sự là mẫu tin nhắn gửi khách hoặc câu thoại mẫu.
- Không tự tạo mẫu tin nhắn mới nếu nội dung gốc không có.
- Với các câu mẫu gửi khách, giữ gần nguyên văn nhưng được sửa lỗi trình bày nhỏ:
  - Bỏ chữ “Ví dụ:” khỏi trong quote nếu đã có dòng dẫn bên trên.
  - Sửa khoảng trắng thừa trước dấu câu.
  - Chuẩn hóa khoảng trắng như \`400k/nửa ngày\`, không viết \`400k/ nửa ngày\`.
  - Không đổi ý, không viết lại câu theo văn phong mới.
- Sau quote block, nếu có ý giải thích tiếp theo thì viết thành đoạn văn ngắn hoặc bullet rõ ràng, không để bullet bị lạc nhịp.
- Không để các ký hiệu lỗi như \`###\`, \`####\`, \`**\`, HTML comment, hoặc markdown thừa xuất hiện trong nội dung cuối cùng.

PHONG CÁCH ĐẦU RA CẦN BẮT CHƯỚC:

\`\`\`markdown
# Bước 1: Nhận job và confirm

## Cập nhật trạng thái công việc

Hàng ngày, nhân sự cần đăng nhập vào trang nhansu.eventus để cập nhật trạng thái công việc và ghi chú chi tiết tiến độ hiện tại.

Job dựng sẽ được đội Account thông báo trước qua app My Eventus và trang nhansu.eventus. Khi nhận job, nhân sự cần kiểm tra kỹ thông tin trước khi bắt đầu dựng.

## Kiểm tra source và kịch bản

Trước khi dựng, nhân sự bắt buộc kiểm tra lại số lượng máy quay và số lượng file quay để tránh thiếu source hoặc lệch thông tin bàn giao.

Với các job TVC, phim doanh nghiệp hoặc phim tổng kết, Editor cần dùng công cụ đếm ký tự để ước lượng thời lượng kịch bản:

- Link công cụ: halink.vn/tienich/dem-ky-tu
- Quy đổi tham khảo: 1.000 ký tự tương đương khoảng 1 phút video.

Nếu nội dung kịch bản dài hơn 10 phút, Editor cần chủ động phối hợp với đội Account và Biên kịch để tư vấn khách hàng rút gọn nội dung về khoảng 5-7 phút trước khi tiếp tục sản xuất.

# Bước 2: Triển khai công việc

## Nắm brief và trao đổi nội bộ

Editor cần đọc kỹ timeline sự kiện và agenda của khách trước khi dựng. Nếu cần thêm thông tin, hãy trao đổi với đội quay để nắm các lưu ý quan trọng trong source, ví dụ như khách VIP, shot quay đặc biệt hoặc các yêu cầu riêng từ khách.

Trước khi trao đổi với khách hàng, Editor cần trao đổi trước với anh Bình, Linh/Huyền hoặc Duy, đặc biệt với các video chỉ dựng.

## Nguyên tắc trao đổi với khách hàng

Editor chỉ được trao đổi với khách trong group làm việc để tất cả các bên cùng theo dõi. Không trao đổi riêng với khách qua tin nhắn cá nhân.

Nếu khách nhắn riêng, cần phản hồi lại nội dung đó trong group để đảm bảo minh bạch thông tin và tránh sai lệch khi xử lý công việc.

## Mẫu tin nhắn gửi khách

> Em gửi anh/chị video đã dựng, anh/chị xem và feedback giúp em để em hoàn thiện ạ:
> Anh/chị xem link trên bằng máy tính để feedback nhé ạ, trên mobile thì mình chỉ xem được chứ không feedback được ạ.

# Bước 5: Hình thức xử phạt

- Mất file: phạt từ 500.000đ/lần + không tính lương job, tùy mức độ nghiêm trọng.
- Đi muộn job: phạt từ 100.000đ/lần + không tính lương job, tùy mức độ nghiêm trọng.
- Copy file không đặt tên đúng quy định: phạt 200.000đ/lần.
- Copy thiếu file: phạt 200.000đ/lần.
- Mặc sai đồng phục hoặc không đúng yêu cầu: phạt 100.000đ/lần.
- Đeo pod, vape, hút thuốc lá hoặc thuốc lào trước mặt khách: phạt 200.000đ/lần.

Với những lỗi nghiêm trọng, công ty có thể áp dụng mức xử lý cao hơn tương ứng với mức độ ảnh hưởng.
\`\`\`

CẤU TRÚC ĐẦU RA BẮT BUỘC:

Mô tả mở đầu trên banner:
[Viết 1 câu ngắn 20-35 từ, tóm tắt đúng nội dung bài.]

Nội dung Markdown:
\`\`\`markdown
[Toàn bộ nội dung đã chuẩn hóa]
\`\`\`

TRƯỚC KHI TRẢ KẾT QUẢ, HÃY TỰ KIỂM TRA:

- Có thiếu phần “Mô tả mở đầu trên banner” không?
- Có mẫu tin nhắn nào bị viết lại khác bản gốc quá nhiều không?
- Có đoạn quy định nào bị rút gọn làm mất chi tiết không?
- Có nội dung nào bị lặp ở hai bước khác nhau không?
- Có bullet lồng nhiều tầng không?
- Có tiêu đề nào còn toàn chữ in hoa không?
- Có ký hiệu lỗi như \`**\`, \`###\`, \`####\` không?
- Có tự thêm mẫu câu hoặc quy định không có trong bài gốc không?
- Phần xử phạt đã giữ đủ điều kiện, ngữ cảnh và mức phạt như bài gốc chưa?
- Phần bảo mật cuối bài đã giữ gần nguyên văn và không bị biến thành heading chưa?

Nếu có bất kỳ lỗi nào ở trên, hãy sửa lại trước khi trả kết quả.

Dưới đây là nội dung gốc cần chuẩn hóa:

[DÁN NỘI DUNG GỐC VÀO ĐÂY]`

const CATEGORY_CONFIG_PREFIX = '__menu_config__:'
const CATEGORY_ROUTE_SEGMENTS = {
  quy_trinh: 'quy-trinh',
  noi_quy: 'noi-quy',
  huong_dan: 'huong-dan',
}

function getCategoryConfigTitle(categoryId) {
  return `${CATEGORY_CONFIG_PREFIX}${categoryId}`
}

function isCategoryConfigRow(page) {
  return page?.title?.startsWith(CATEGORY_CONFIG_PREFIX)
}

function parseCategoryConfig(row, fallbackItems = []) {
  if (!row?.content) return fallbackItems

  try {
    const parsed = JSON.parse(row.content)
    if (Array.isArray(parsed?.items)) {
      return parsed.items
        .map(item => String(item || '').trim())
        .filter(Boolean)
    }
  } catch {
    return fallbackItems
  }

  return fallbackItems
}

function getCategoryBasePath(categoryId) {
  const segment = CATEGORY_ROUTE_SEGMENTS[categoryId]
  return segment ? `/${segment}` : '/'
}

function getArticlePath(categoryId, title) {
  const segment = CATEGORY_ROUTE_SEGMENTS[categoryId]
  if (!segment) return '/'
  return `/${segment}/${slugify(title)}`
}

function getCategoryIdFromPath(pathname = '') {
  const cleanPath = String(pathname || '').replace(/^\/+/, '')
  const segment = cleanPath.split('/')[0]
  return Object.entries(CATEGORY_ROUTE_SEGMENTS).find(([, value]) => value === segment)?.[0] || null
}

function CategoryCardIcon({ categoryId, stroke = '#334155' }) {
  const common = {
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (categoryId === 'noi_quy') {
    return (
      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M9 5.5h7.5a2 2 0 0 1 2 2v11a1 1 0 0 1-1.6.8L14 17l-2.9 2.3a1 1 0 0 1-1.6-.8v-11a2 2 0 0 1 2-2Z" />
        <path {...common} d="M12 9.5h4" />
        <path {...common} d="M12 12.5h4" />
      </svg>
    )
  }

  if (categoryId === 'huong_dan') {
    return (
      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M6.5 6.5A2.5 2.5 0 0 1 9 4h8.5v14H9a2.5 2.5 0 0 0-2.5 2.5" />
        <path {...common} d="M6.5 6.5V20" />
        <path {...common} d="M9.5 8.5h5" />
        <path {...common} d="M9.5 11.5h5" />
      </svg>
    )
  }

  return (
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d="M7 6.5h10" />
      <path {...common} d="M7 12h10" />
      <path {...common} d="M7 17.5h6" />
      <circle {...common} cx="5" cy="6.5" r="1" />
      <circle {...common} cx="5" cy="12" r="1" />
      <circle {...common} cx="5" cy="17.5" r="1" />
    </svg>
  )
}

/* ─── Competency grid ─── */
const POSITION_META = {
  cameraman:    { icon: '🎬' },
  editor:       { icon: '🎞️' },
  photographer: { icon: '📷' },
  account:      { icon: '🤝' },
  leader:       { icon: '🧭' },
  ketoan:       { icon: '📊' },
}

const PLACEHOLDER_POSITION = {
  id: 'ketoan',
  name: 'Kế toán',
  levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
  placeholder: true,
}

function getCategoryHref(id) {
  if (id === 'khung_nang_luc') return '/competency'
  if (id === 'vfx_builder') return '/vfx-builder'
  if (id === 'quotes') return '/quotes'
  return '/'
}

function getVisibleCategories() {
  return CATEGORIES
}

function HomeHub({ onOpenCategory, admin }) {
  const featured = getVisibleCategories().map((category) => ({
    ...category,
    href: getCategoryHref(category.id),
    itemCount: category.items?.length || 0,
  }))

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-7 text-white md:px-8 md:py-8">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h1 className="text-[32px] font-semibold tracking-tight md:text-[40px]">
                  Eventus AI Lab
                </h1>
                <p className="mt-3 whitespace-nowrap text-[14px] leading-6 text-blue-100/90">
                  Tra cứu công cụ AI, dữ liệu vận hành, hướng dẫn nội bộ và các module hỗ trợ team từ một nơi duy nhất.
                </p>
              </div>
              {admin.isAdmin ? (
                <div className="flex flex-shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[12px] text-blue-50 backdrop-blur">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span>✅</span>
                    <span>Admin mode</span>
                  </span>
                  <button
                    onClick={admin.logout}
                    className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 transition hover:bg-blue-50"
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => admin.setShowGate(true)}
                  className="flex-shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-blue-50 backdrop-blur transition hover:bg-white/15"
                >
                  🔒 Đăng nhập Admin
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {featured.map((category) => (
            <button
              key={category.id}
              onClick={() => onOpenCategory(category.id)}
              className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-teal-700 text-[18px] text-white shadow-sm">
                      {category.icon}
                    </div>
                    <div>
                      <div className="text-[20px] font-semibold tracking-tight text-slate-900">{category.label}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{category.shortDesc}</div>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <p className="text-[13px] leading-6 text-slate-600">{category.desc}</p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {category.itemCount > 0 ? `${category.itemCount} mục nội dung` : category.href.replace('/', '') || 'Trang chính'}
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                    Mở module
                  </div>
                </div>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}

function PositionNode({ position }) {
  const navigate = useNavigate()
  const meta = POSITION_META[position.id] || POSITION_META.leader

  return (
    <button
      onClick={() => !position.placeholder && navigate(`/position/${position.id}`)}
      className={`group w-full text-left bg-white rounded-2xl shadow-sm px-5 py-4 border border-slate-200 transition-all duration-200
        ${position.placeholder ? 'opacity-50 cursor-default' : 'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="text-[14px] font-bold text-slate-800">{position.name}</div>
      </div>
      <div className="flex items-center gap-1">
        {position.levels.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-blue-500" style={{ opacity: 0.15 + i * 0.17 }} />
        ))}
      </div>
      {!position.placeholder && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400 group-hover:text-blue-700 transition-colors">
          Xem khung năng lực
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

/* ─── Banner chung cho moi danh muc ─── */
function CategoryBanner({ cat }) {
  const style = CATEGORY_BANNER_STYLES[cat.id] || CATEGORY_BANNER_STYLES.quy_trinh

  return (
    <div className={`bg-gradient-to-r ${style.bg} rounded-2xl shadow-lg px-8 py-5 text-white mb-5 flex-shrink-0`}>
      <p className={`text-sm font-semibold mb-1 ${style.label}`}>
        {cat.icon} {cat.banner}
      </p>
      {cat.desc && <p className={`text-sm mt-1 ${style.desc}`}>{cat.desc}</p>}
    </div>
  )
}

function CompetencyGrid() {
  const cat = CATEGORIES.find(c => c.id === 'khung_nang_luc')
  const positions = [...data.competency_framework.positions, PLACEHOLDER_POSITION]
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <CategoryBanner cat={cat} />
      <div className="grid grid-cols-3 gap-4">
        {positions.map(position => (
          <PositionNode key={position.id} position={position} />
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 tracking-wide mt-6">
        Cập nhật nội dung tại{' '}
        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">src/data/competency.json</code>
      </p>
    </div>
  )
}

/* ─── Article renderer ─── */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripMarker(line = '') {
  return line
    .replace(/^#{1,3}\s+/, '')
    .replace(/^\d+\.\d+\.?\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^[-*•+]\s+/, '')
    .trim()
}

function isUpperTitle(line) {
  const letters = line.replace(/[^A-Za-zÀ-ỹ]/g, '')
  return letters.length > 8 && line === line.toUpperCase()
}

function isMainHeading(line) {
  return /^#\s+/.test(line) || /^Bước\s+\d+\s*:/i.test(line)
}

function isSubHeading(line) {
  return /^##\s+/.test(line) || /^\d+\.\d+\.?\s+/.test(line)
}

function isListItem(line) {
  return /^[-*•+]\s+/.test(line) || /^\d+\.\s+/.test(line)
}

function isCallout(line) {
  return /^[⚠️⛔✅ℹ️*]+\s*/.test(line) || /^Lưu ý/i.test(line)
}

function isQuoteLine(line) {
  return /^>\s*/.test(line)
}

function parseInline(text) {
  const nodes = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s)]+)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-b`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={`${match.index}-i`} className="italic">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${match.index}-c`} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-blue-700">
          {token.slice(1, -1)}
        </code>
      )
    } else if (/^https?:\/\//.test(token)) {
      nodes.push(
        <a
          key={`${match.index}-u`}
          href={token}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 transition-colors hover:text-blue-800"
        >
          {token}
        </a>
      )
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes.length ? nodes : text
}

const BANNER_DESC_MARKER = '<!-- banner-desc:'
const PAGE_TITLE_MARKER = '<!-- page-title:'

function extractMarkedValue(rawText = '', marker = '') {
  const text = String(rawText || '').trimStart()
  if (!text.startsWith(marker)) return ''
  const endIndex = text.indexOf('-->')
  if (endIndex === -1) return ''
  return text.slice(marker.length, endIndex).trim()
}

function extractBannerDescription(rawText = '') {
  const text = String(rawText || '').trimStart()
  if (text.startsWith(PAGE_TITLE_MARKER)) {
    const endIndex = text.indexOf('-->')
    if (endIndex === -1) return ''
    return extractMarkedValue(text.slice(endIndex + 3), BANNER_DESC_MARKER)
  }
  return extractMarkedValue(text, BANNER_DESC_MARKER)
}

function extractPageTitle(rawText = '') {
  return extractMarkedValue(rawText, PAGE_TITLE_MARKER)
}

function stripBannerDescription(rawText = '') {
  const text = String(rawText || '')
  const trimmed = text.trimStart()
  let output = trimmed

  if (output.startsWith(PAGE_TITLE_MARKER)) {
    const titleEndIndex = output.indexOf('-->')
    if (titleEndIndex !== -1) output = output.slice(titleEndIndex + 3).replace(/^\s+/, '')
  }

  if (!output.startsWith(BANNER_DESC_MARKER)) return output
  const endIndex = output.indexOf('-->')
  if (endIndex === -1) return output
  return output.slice(endIndex + 3).replace(/^\s+/, '')
}

function buildStoredContent(content = '', bannerDescription = '', pageTitle = '') {
  const normalizedContent = stripBannerDescription(content).trim()
  const normalizedBanner = String(bannerDescription || '').trim()
  const normalizedTitle = String(pageTitle || '').trim()
  const metaLines = []

  if (normalizedTitle) metaLines.push(`${PAGE_TITLE_MARKER} ${normalizedTitle} -->`)
  if (normalizedBanner) metaLines.push(`${BANNER_DESC_MARKER} ${normalizedBanner} -->`)
  if (!metaLines.length) return normalizedContent
  return `${metaLines.join('\n')}\n\n${normalizedContent}`.trim()
}

function parseArticle(rawText, fallbackTitle) {
  const pageTitle = extractPageTitle(rawText)
  const bannerDescription = extractBannerDescription(rawText)
  const lines = stripBannerDescription(rawText)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())

  let title = fallbackTitle
  let lead = []
  const sections = []
  const footerNotes = []
  let currentSection = null
  let currentSubsection = null

  const getTarget = () => {
    if (currentSubsection) return currentSubsection
    if (currentSection) return currentSection
    return null
  }

  const ensureSection = (label = 'Nội dung') => {
    if (currentSection) return currentSection
    currentSection = { id: slugify(label), title: label, blocks: [], subsections: [] }
    sections.push(currentSection)
    currentSubsection = null
    return currentSection
  }

  const pushBlock = (block) => {
    const target = getTarget() || ensureSection()
    target.blocks.push(block)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) continue

    if (!title && (isUpperTitle(line) || /^#\s+/.test(line))) {
      title = stripMarker(line)
      continue
    }

    if (/^Cập nhật ngày/i.test(line)) {
      footerNotes.push({ type: 'meta', text: line })
      continue
    }

    if (/bảo mật/i.test(line) && line.length > 50) {
      footerNotes.push({ type: 'warning', text: line.replace(/^\*+|\*+$/g, '').trim() })
      continue
    }

    if (isMainHeading(line)) {
      const sectionTitle = stripMarker(line)
      currentSection = { id: slugify(sectionTitle), title: sectionTitle, blocks: [], subsections: [] }
      sections.push(currentSection)
      currentSubsection = null
      continue
    }

    if (isSubHeading(line)) {
      const subsectionTitle = stripMarker(line)
      ensureSection()
      currentSubsection = { id: slugify(`${currentSection.id}-${subsectionTitle}`), title: subsectionTitle, blocks: [] }
      currentSection.subsections.push(currentSubsection)
      continue
    }

    if (!currentSection && !currentSubsection && !isListItem(line) && !isQuoteLine(line) && line.length > 60) {
      lead.push(line)
      continue
    }

    if (isCallout(line)) {
      pushBlock({ type: 'callout', tone: line.startsWith('⛔') ? 'warning' : 'info', text: line })
      continue
    }

    if (isQuoteLine(line)) {
      const items = [line.replace(/^>\s*/, '').trim()].filter(Boolean)
      while (i + 1 < lines.length && lines[i + 1] && isQuoteLine(lines[i + 1])) {
        i += 1
        const quoteText = lines[i].replace(/^>\s*/, '').trim()
        if (quoteText) items.push(quoteText)
      }
      pushBlock({ type: 'quote', items })
      continue
    }

    if (isListItem(line)) {
      const items = [stripMarker(line)]
      while (i + 1 < lines.length && lines[i + 1] && isListItem(lines[i + 1])) {
        i += 1
        items.push(stripMarker(lines[i]))
      }
      pushBlock({ type: 'list', items })
      continue
    }

    if (line.endsWith(':')) {
      const titleText = line.slice(0, -1).trim()
      const items = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (!next || isMainHeading(next) || isSubHeading(next) || /^Cập nhật ngày/i.test(next)) break
        if (next.endsWith(':') && items.length > 0) break
        i += 1
        items.push(stripMarker(lines[i]))
      }

      if (items.length >= 2) {
        pushBlock({ type: 'cardList', title: titleText, items })
      } else if (items.length === 1) {
        pushBlock({ type: 'paragraph', text: `${titleText}: ${items[0]}` })
      } else {
        pushBlock({ type: 'miniTitle', text: titleText })
      }
      continue
    }

    let paragraph = line
    while (i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next || isMainHeading(next) || isSubHeading(next) || isListItem(next) || isCallout(next) || isQuoteLine(next) || /^Cập nhật ngày/i.test(next)) break
      if (next.endsWith(':')) break
      i += 1
      paragraph += ` ${lines[i]}`
    }
    pushBlock({ type: 'paragraph', text: paragraph })
  }

  return {
    title: pageTitle || title || fallbackTitle,
    bannerDescription,
    lead,
    sections,
    footerNotes,
  }
}

function CalloutBlock({ tone = 'info', children }) {
  const classes = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-blue-200 bg-blue-50 text-slate-700'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${classes}`}>
      {children}
    </div>
  )
}

function QuoteBlock({ items = [] }) {
  const [copiedIndex, setCopiedIndex] = useState(null)

  async function copyQuote(text, index) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(null), 1400)
    } catch {
      setCopiedIndex(null)
    }
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-teal-50/70 px-4 py-3 shadow-sm">
      <div className="space-y-3 border-l-4 border-blue-500 pl-4">
        {items.map((item, idx) => (
          <div key={idx} className="group relative pr-16">
            <blockquote className="text-[14px] leading-7 text-slate-700">
              {parseInline(item)}
            </blockquote>
            <button
              onClick={() => copyQuote(item, idx)}
              className="absolute right-0 top-0 rounded-lg border border-blue-100 bg-white/80 px-2 py-1 text-[11px] font-semibold text-blue-700 opacity-70 shadow-sm transition hover:bg-white hover:opacity-100"
            >
              {copiedIndex === idx ? 'Đã copy' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContentBlock({ block }) {
  if (block.type === 'paragraph') {
    return <p className="text-[15px] leading-7 text-slate-600">{parseInline(block.text)}</p>
  }

  if (block.type === 'miniTitle') {
    return <h4 className="text-[15px] font-semibold text-slate-900">{block.text}</h4>
  }

  if (block.type === 'callout') {
    return <CalloutBlock tone={block.tone}>{parseInline(block.text)}</CalloutBlock>
  }

  if (block.type === 'quote') {
    return <QuoteBlock items={block.items} />
  }

  if (block.type === 'list') {
    return (
      <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        {block.items.map((item, idx) => (
          <li key={idx} className="flex gap-3 text-[14px] leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === 'cardList') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.12em] text-slate-500">{block.title}</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {block.items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-[14px] leading-6 text-slate-700">
              {parseInline(item)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

function ArticleDocument({ title, category, page }) {
  const article = useMemo(() => parseArticle(page?.content, title), [page?.content, title])
  const hasSections = article.sections.length > 0
  const updatedLabel = page?.updated_at ? new Date(page.updated_at).toLocaleString('vi-VN') : null
  const bannerDescription = article.bannerDescription || article.lead[0] || 'Thêm phần mô tả mở đầu trong nội dung bài viết để hiển thị tại đây.'
  const editButton = page?.editButton ?? null

  return (
    <div className="px-6 pb-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-4 text-white md:px-8 md:py-5">
              <div className="mb-2 flex items-start justify-end gap-4">
                {editButton}
              </div>
              <h1 className="max-w-5xl text-[24px] font-semibold tracking-tight md:text-[30px]">{article.title}</h1>
              <p className="mt-2 max-w-none text-[14px] leading-6 text-blue-100/90">
                {parseInline(bannerDescription)}
              </p>
              {updatedLabel && (
                <div className="mt-4 text-right text-[12px] text-blue-100/75">
                  Cập nhật {updatedLabel}
                </div>
              )}
            </div>
          </section>

          {article.lead.length > 1 && (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="space-y-3">
                {article.lead.slice(1).map((paragraph, idx) => (
                  <p key={idx} className="text-[15px] leading-7 text-slate-600">
                    {parseInline(paragraph)}
                  </p>
                ))}
              </div>
            </section>
          )}

          {hasSections ? article.sections.map((section, index) => (
            <section key={section.id || index} id={section.id} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 md:text-[19px]">{section.title}</h2>
                </div>
              </div>

              <div className="space-y-5">
                {section.blocks.map((block, idx) => (
                  <ContentBlock key={idx} block={block} />
                ))}
              </div>

              {section.subsections.length > 0 && (
                <div className="mt-8 space-y-5">
                  {section.subsections.map((subsection, idx) => (
                    <div key={subsection.id || idx} id={subsection.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <h3 className="mb-4 text-[16px] font-semibold text-slate-900 md:text-[17px]">{subsection.title}</h3>
                      <div className="space-y-4">
                        {subsection.blocks.map((block, blockIdx) => (
                          <ContentBlock key={blockIdx} block={block} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )) : (
            <section className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-[15px] leading-7 text-slate-600">
                {page?.content ? parseInline(stripBannerDescription(page.content)) : 'Chưa có nội dung.'}
              </p>
            </section>
          )}

          {article.footerNotes.length > 0 && (
            <section className="space-y-4">
              {article.footerNotes.map((note, idx) => (
                note.type === 'warning' ? (
                  <CalloutBlock key={idx} tone="warning">{parseInline(note.text)}</CalloutBlock>
                ) : (
                  <div key={idx} className="text-[12px] text-slate-400">{note.text}</div>
                )
              ))}
            </section>
          )}
      </div>
    </div>
  )
}

/* ─── Admin gate — persist qua localStorage ─── */
const ADMIN_KEY = 'eventus_admin'
const VFX_BUILDER_ACCESS_KEY = 'eventus_vfx_builder_access'

function readStoredFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeStoredFlag(key) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Storage can be blocked by browser privacy settings. Keep in-memory state working.
  }
}

function clearStoredFlag(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage can be blocked by browser privacy settings. Keep in-memory state working.
  }
}

function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => readStoredFlag(ADMIN_KEY))
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const tryLogin = () => {
    if (input === ADMIN_PASSWORD) {
      writeStoredFlag(ADMIN_KEY)
      setIsAdmin(true); setShowGate(false); setError(''); setInput('')
    } else {
      setError('Sai mật khẩu')
    }
  }

  const logout = () => {
    clearStoredFlag(ADMIN_KEY)
    setIsAdmin(false)
  }

  return { isAdmin, showGate, setShowGate, input, setInput, error, tryLogin, logout }
}

function useVfxBuilderAccess() {
  const [hasAccess, setHasAccess] = useState(() => readStoredFlag(VFX_BUILDER_ACCESS_KEY))
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const requestAccess = () => {
    setError('')
    setShowGate(true)
  }

  const tryUnlock = (onSuccess) => {
    if (input === VFX_BUILDER_PASSWORD) {
      writeStoredFlag(VFX_BUILDER_ACCESS_KEY)
      setHasAccess(true)
      setShowGate(false)
      setError('')
      setInput('')
      if (typeof onSuccess === 'function') onSuccess()
    } else {
      setError('Sai pass, vui lòng nhập lại.')
    }
  }

  const cancel = () => {
    setShowGate(false)
    setInput('')
    setError('')
  }

  return { hasAccess, showGate, input, setInput, error, requestAccess, tryUnlock, cancel }
}

function LockedVfxBuilderPage({ onRequestAccess }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[22px]">
          ✨
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">VFX Prompt Builder</h1>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">
          Nhập pass wifi văn phòng để tiếp tục:
        </p>
        <button
          type="button"
          onClick={onRequestAccess}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-blue-700"
        >
          Nhập pass
        </button>
      </div>
    </div>
  )
}

function QuoteModulePage() {
  const location = useLocation()
  const quoteIdMatch = location.pathname.match(/^\/quotes\/([^/]+)$/)
  const searchParams = new URLSearchParams(location.search)
  let page = <QuoteListPage />

  if (location.pathname === '/quotes/new') {
    page = <QuoteCreatePage />
  } else if (location.pathname === '/quotes/trash') {
    page = <QuoteTrashPage />
  } else if (location.pathname === '/quotes/contract-templates') {
    page = <ContractTemplatesPage />
  } else if (quoteIdMatch) {
    if (searchParams.get('mode') === 'edit') {
      page = <QuoteCreatePage mode="edit" quoteId={quoteIdMatch[1]} />
    } else {
      page = <QuoteDetailPage />
    }
  }

  return <Suspense fallback={<PageLoading />}>{page}</Suspense>
}

/* ─── Main Eventus AI Lab page ─── */
export default function EventusAILabPage() {
  const location = useLocation()
  const { positionId, articleSlug } = useParams()
  const navigate = useNavigate()
  const [pages, setPages] = useState([])
  const [activeCat, setActiveCat] = useState('home')
  const [selectedTitle, setSelectedTitle] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuTitleDraft, setMenuTitleDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [bannerDraft, setBannerDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showPromptGuide, setShowPromptGuide] = useState(false)
  const [copyPromptState, setCopyPromptState] = useState('idle')
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [itemActionError, setItemActionError] = useState('')
  const [itemActionLoading, setItemActionLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const admin = useAdmin()
  const vfxAccess = useVfxBuilderAccess()
  const visibleCategories = useMemo(() => getVisibleCategories(), [])

  useEffect(() => {
    if (
      location.pathname === '/quotes' ||
      location.pathname.startsWith('/quotes/') ||
      location.pathname === '/competency' ||
      location.pathname === '/vfx-builder' ||
      location.pathname.startsWith('/position/')
    ) {
      setLoading(false)
      return
    }

    if (!hasSupabaseConfig) {
      setLoading(false)
      return
    }

    supabase.from(LAB_CONTENT_TABLE).select('*').then(({ data: rows, error }) => {
      if (!error && rows) setPages(rows)
      setLoading(false)
    })
  }, [location.pathname])

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const visiblePages = useMemo(() => pages.filter(page => !isCategoryConfigRow(page)), [pages])
  const categoryConfigRow = pages.find(p => p.category === activeCat && p.title === getCategoryConfigTitle(activeCat))
  const currentCategoryItems = useMemo(
    () => parseCategoryConfig(categoryConfigRow, currentCat?.items || []),
    [categoryConfigRow, currentCat]
  )
  const currentPage = visiblePages.find(p => p.category === activeCat && p.title === selectedTitle)

  async function upsertCategoryItems(nextItems) {
    if (!supabase) return

    const cleanItems = nextItems.map(item => String(item || '').trim()).filter(Boolean)
    const payload = {
      category: activeCat,
      title: getCategoryConfigTitle(activeCat),
      content: JSON.stringify({ items: cleanItems }),
      updated_at: new Date().toISOString(),
    }

    if (categoryConfigRow) {
      const { data: updated } = await supabase
        .from(LAB_CONTENT_TABLE)
        .update({ content: payload.content, updated_at: payload.updated_at })
        .eq('id', categoryConfigRow.id)
        .select()
        .single()

      if (updated) {
        setPages(prev => prev.map(page => (page.id === updated.id ? updated : page)))
      }
    } else {
      const { data: inserted } = await supabase
        .from(LAB_CONTENT_TABLE)
        .insert(payload)
        .select()
        .single()

      if (inserted) {
        setPages(prev => [...prev, inserted])
      }
    }
  }

  async function savePage() {
    setSaving(true)
    if (!supabase) {
      setSaving(false)
      setItemActionError('Thiếu cấu hình Supabase local nên chưa thể lưu nội dung.')
      return
    }

    const normalizedMenuTitle = String(menuTitleDraft || '').trim()
    const oldTitle = selectedTitle
    const existingTitleTaken = currentCategoryItems.some(
      item => item.toLowerCase() === normalizedMenuTitle.toLowerCase() && item !== oldTitle
    )

    if (!normalizedMenuTitle) {
      setSaving(false)
      return
    }

    if (existingTitleTaken) {
      setSaving(false)
      setItemActionError('Tên tài liệu đã tồn tại trong danh mục này.')
      return
    }

    const storedContent = buildStoredContent(draft, bannerDraft, titleDraft)
    const nextItems = currentCategoryItems.map(item => (item === oldTitle ? normalizedMenuTitle : item))

    if (currentPage) {
      const { data: updated } = await supabase
        .from(LAB_CONTENT_TABLE).update({ title: normalizedMenuTitle, content: storedContent, updated_at: new Date().toISOString() })
        .eq('id', currentPage.id).select().single()
      if (updated) setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    } else {
      const { data: inserted } = await supabase
        .from(LAB_CONTENT_TABLE).insert({ category: activeCat, title: normalizedMenuTitle, content: storedContent })
        .select().single()
      if (inserted) setPages(prev => [...prev, inserted])
    }
    await upsertCategoryItems(nextItems)
    setSelectedTitle(normalizedMenuTitle)
    setItemActionError('')
    if (CATEGORY_ROUTE_SEGMENTS[activeCat]) {
      navigate(getArticlePath(activeCat, normalizedMenuTitle), { replace: true })
    }
    setSaving(false)
    setEditing(false)
  }

  useEffect(() => {
    if (positionId) {
      setActiveCat('khung_nang_luc')
      setSelectedTitle(null)
      setEditing(false)
    }
  }, [positionId])

  useEffect(() => {
    if (positionId) return

    if (location.pathname === '/') {
      setActiveCat('home')
      setSelectedTitle(null)
      setEditing(false)
      return
    }

    if (location.pathname === '/competency') {
      setActiveCat('khung_nang_luc')
      setSelectedTitle(null)
      setEditing(false)
      return
    }

    if (location.pathname === '/vfx-builder') {
      setActiveCat('vfx_builder')
      setSelectedTitle(null)
      setEditing(false)
      if (!vfxAccess.hasAccess) {
        vfxAccess.requestAccess()
      }
      return
    }

    if (location.pathname === '/quotes' || location.pathname.startsWith('/quotes/')) {
      setActiveCat('quotes')
      setSelectedTitle(null)
      setEditing(false)
      return
    }

    const routeCategoryId = getCategoryIdFromPath(location.pathname)
    if (routeCategoryId) {
      setActiveCat(routeCategoryId)
      setEditing(false)

      if (!articleSlug) {
        setSelectedTitle(null)
        return
      }

      const matchedTitle = currentCategoryItems.find(title => slugify(title) === articleSlug)
      setSelectedTitle(matchedTitle || null)
    }
  }, [location.pathname, positionId, articleSlug, currentCategoryItems, admin.isAdmin, vfxAccess.hasAccess, navigate])

  function selectCat(id) {
    if (id === 'khung_nang_luc') {
      navigate('/competency')
    } else if (id === 'vfx_builder') {
      navigate('/vfx-builder')
    } else if (id === 'quotes') {
      navigate('/quotes')
    } else if (CATEGORY_ROUTE_SEGMENTS[id]) {
      navigate(getCategoryBasePath(id))
    } else if (location.pathname !== '/') {
      navigate('/')
    }
    setActiveCat(id)
    setSelectedTitle(null)
    setEditing(false)
  }

  function openHomeCategory(id) {
    if (id === 'khung_nang_luc' || id === 'vfx_builder' || id === 'quotes') {
      selectCat(id)
      return
    }

    if (CATEGORY_ROUTE_SEGMENTS[id]) {
      navigate(getCategoryBasePath(id))
    } else {
      setActiveCat(id)
      setSelectedTitle(null)
      setEditing(false)
    }
  }
  function openPage(title) {
    if (CATEGORY_ROUTE_SEGMENTS[activeCat]) {
      navigate(getArticlePath(activeCat, title))
      return
    }
    setSelectedTitle(title); setEditing(false)
  }
  function startEdit() {
    setMenuTitleDraft(selectedTitle || '')
    setTitleDraft(extractPageTitle(currentPage?.content || '') || selectedTitle || '')
    setBannerDraft(extractBannerDescription(currentPage?.content || ''))
    setDraft(stripBannerDescription(currentPage?.content || ''))
    setItemActionError('')
    setEditing(true)
  }

  async function addMenuItem() {
    const normalizedTitle = String(newItemTitle || '').trim()
    const exists = currentCategoryItems.some(item => item.toLowerCase() === normalizedTitle.toLowerCase())

    if (!normalizedTitle) {
      setItemActionError('Vui lòng nhập tên tài liệu.')
      return
    }

    if (exists) {
      setItemActionError('Tên tài liệu này đã tồn tại.')
      return
    }

    if (!supabase) {
      setItemActionError('Thiếu cấu hình Supabase local nên chưa thể tạo tài liệu.')
      return
    }

    setItemActionLoading(true)
    await upsertCategoryItems([...currentCategoryItems, normalizedTitle])
    setItemActionLoading(false)
    setItemActionError('')
    setNewItemTitle('')
    setShowAddItemModal(false)
    setSelectedTitle(normalizedTitle)
    if (CATEGORY_ROUTE_SEGMENTS[activeCat]) {
      navigate(getArticlePath(activeCat, normalizedTitle))
    }
    setEditing(false)
  }

  async function deleteMenuItem() {
    if (!selectedTitle) return
    if (!supabase) {
      setItemActionError('Thiếu cấu hình Supabase local nên chưa thể xóa tài liệu.')
      return
    }

    setItemActionLoading(true)

    if (currentPage) {
      await supabase.from(LAB_CONTENT_TABLE).delete().eq('id', currentPage.id)
      setPages(prev => prev.filter(page => page.id !== currentPage.id))
    }

    await upsertCategoryItems(currentCategoryItems.filter(item => item !== selectedTitle))
    setItemActionLoading(false)
    setShowDeleteConfirm(false)
    setSelectedTitle(null)
    if (CATEGORY_ROUTE_SEGMENTS[activeCat]) {
      navigate(getCategoryBasePath(activeCat))
    }
    setEditing(false)
    setItemActionError('')
  }

  async function copyPromptGuide() {
    try {
      await navigator.clipboard.writeText(CONTENT_STANDARDIZATION_PROMPT)
      setCopyPromptState('copied')
      window.setTimeout(() => setCopyPromptState('idle'), 1800)
    } catch {
      setCopyPromptState('error')
      window.setTimeout(() => setCopyPromptState('idle'), 2200)
    }
  }

  const isQuotesPage = activeCat === 'quotes'

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        {!isQuotesPage && <aside className="w-80 flex-shrink-0 border-r border-slate-200/80 bg-white/95 flex flex-col">
          <div className="border-b border-slate-200/70 px-4 py-4">
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-5 py-6 text-left text-white shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <p className="text-[18px] font-semibold tracking-tight leading-7">Eventus AI Lab</p>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {visibleCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  if (activeCat === 'home') {
                    openHomeCategory(cat.id)
                  } else {
                    selectCat(cat.id)
                  }
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  activeCat === cat.id
                    ? 'border-blue-200 bg-gradient-to-r from-blue-50 via-white to-teal-50 shadow-sm shadow-blue-100/70'
                    : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg ${
                      activeCat === cat.id
                        ? 'bg-white text-blue-700 ring-1 ring-blue-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[14px] font-semibold leading-5 ${activeCat === cat.id ? 'text-slate-900' : 'text-slate-700'}`}>
                      {cat.label}
                    </div>
                    <div className={`mt-1 text-[12px] leading-5 ${activeCat === cat.id ? 'text-slate-600' : 'text-slate-400'}`}>
                      {cat.shortDesc}
                    </div>
                  </div>
                  {activeCat === cat.id && (
                    <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </nav>

        </aside>}

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Home */}
          {activeCat === 'home' && <HomeHub onOpenCategory={openHomeCategory} admin={admin} />}

          {/* Khung nang luc */}
          {activeCat === 'khung_nang_luc' && (positionId ? (
            <div className="flex-1 overflow-y-auto">
              <Suspense fallback={<PageLoading />}>
                <PositionPage embedded />
              </Suspense>
            </div>
          ) : <CompetencyGrid />)}

          {/* VFX Prompt Builder */}
          {activeCat === 'vfx_builder' && (
            vfxAccess.hasAccess
              ? (
                <Suspense fallback={<PageLoading />}>
                  <VFXPromptBuilderPage />
                </Suspense>
              )
              : <LockedVfxBuilderPage onRequestAccess={vfxAccess.requestAccess} />
          )}

          {/* Quote Generator */}
          {activeCat === 'quotes' && (
            <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-7">
              <QuoteModulePage />
            </div>
          )}

          {/* Card grid cac danh muc khac */}
          {activeCat !== 'home' && activeCat !== 'khung_nang_luc' && activeCat !== 'vfx_builder' && activeCat !== 'quotes' && !selectedTitle && (
            <div className="flex-1 overflow-y-auto p-6">
              <CategoryBanner cat={currentCat} />
              {admin.isAdmin && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => {
                      setNewItemTitle('')
                      setItemActionError('')
                      setShowAddItemModal(true)
                    }}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    + Thêm tài liệu
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {currentCategoryItems?.map(title => {
                  const page = visiblePages.find(p => p.category === activeCat && p.title === title)
                  const cardMeta = CATEGORY_CARD_META[activeCat] || CATEGORY_CARD_META.quy_trinh
                  return (
                    <button
                      key={title}
                      onClick={() => openPage(title)}
                      className={`group relative overflow-hidden rounded-[18px] border border-slate-200 bg-gradient-to-br ${cardMeta.accent} px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/70`}
                    >
                      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/55 to-transparent pointer-events-none" />
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${cardMeta.iconBg} ${cardMeta.iconText} ring-1 ring-white/70`}>
                            <CategoryCardIcon categoryId={activeCat} stroke={cardMeta.stroke} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold leading-5 text-slate-800 transition-colors group-hover:text-slate-900">
                              {title}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                          {page ? (
                            <div className="text-[11px] font-medium text-slate-500">
                              Cập nhật: {new Date(page.updated_at).toLocaleDateString('vi-VN')}
                            </div>
                          ) : (
                            <div className="text-[11px] italic text-slate-400">
                              Chưa có nội dung
                            </div>
                          )}
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-400 ring-1 ring-slate-200/70 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Content view */}
          {activeCat !== 'home' && activeCat !== 'khung_nang_luc' && activeCat !== 'vfx_builder' && activeCat !== 'quotes' && selectedTitle && !editing && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 pt-0 pb-5">
                {currentPage ? (
                  <ArticleDocument
                    title={selectedTitle}
                    category={currentCat}
                    page={{
                      ...currentPage,
                      editButton: admin.isAdmin ? (
                        <button
                          onClick={startEdit}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/18"
                        >
                          ✏️ Chỉnh sửa
                        </button>
                      ) : null,
                    }}
                  />
                ) : (
                  <div className="mx-auto max-w-4xl rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-12 text-center">
                    <p className="text-sm italic text-slate-400">
                      Chưa có nội dung.{admin.isAdmin ? ' Tạo nội dung mới cho mục này ngay tại đây.' : ''}
                    </p>
                    {admin.isAdmin && (
                      <div className="mt-5 flex items-center justify-center gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          🗑️ Xóa tài liệu
                        </button>
                        <button
                          onClick={startEdit}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-900"
                        >
                          ✏️ Chỉnh sửa nội dung
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editor */}
          {activeCat !== 'home' && activeCat !== 'khung_nang_luc' && activeCat !== 'vfx_builder' && activeCat !== 'quotes' && selectedTitle && editing && (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-3">
                <div />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPromptGuide(true)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    Hướng dẫn chuẩn hóa cấu trúc nội dung
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[12px] px-3.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Xóa trang này
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    Huỷ
                  </button>
                  <button onClick={savePage} disabled={saving}
                    className="min-w-[96px] text-[12px] px-5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold shadow-sm shadow-blue-300/50 hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Đang lưu...' : '💾 Lưu'}
                  </button>
                </div>
              </div>
              {itemActionError && (
                <p className="mb-3 text-[12px] text-red-500">{itemActionError}</p>
              )}
              <label className="mb-3 block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Tên tài liệu</span>
                <input
                  value={menuTitleDraft}
                  onChange={e => setMenuTitleDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Nhập tên tài liệu hiển thị ngoài danh sách..."
                />
              </label>
              <label className="mb-3 block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Tiêu đề hiển thị của bài</span>
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Nhập tiêu đề hiển thị..."
                />
              </label>
              <label className="mb-3 block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Mô tả mở đầu trên banner</span>
                <textarea
                  value={bannerDraft}
                  onChange={e => setBannerDraft(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Nhập đoạn mô tả ngắn hiển thị ở banner đầu bài..."
                />
              </label>
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Nhập nội dung Markdown..." />
            </div>
          )}
        </div>
      </div>

      {/* Admin modal */}
      {admin.showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-80">
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">🔒 Admin Login</h3>
            <p className="text-[12px] text-slate-400 mb-4">Nhập mật khẩu để mở chế độ chỉnh sửa</p>
            <input type="password" value={admin.input} onChange={e => admin.setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && admin.tryLogin()}
              placeholder="Mật khẩu"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus />
            {admin.error && <p className="text-[12px] text-red-500 mb-2">{admin.error}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => admin.setShowGate(false)}
                className="flex-1 text-[13px] py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                Huỷ
              </button>
              <button onClick={admin.tryLogin}
                className="flex-1 text-[13px] py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VFX Prompt Builder gate */}
      {vfxAccess.showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl shadow-slate-950/20">
            <h3 className="mb-1 text-[16px] font-bold text-slate-900">VFX Prompt Builder</h3>
            <p className="mb-4 text-[13px] leading-6 text-slate-500">
              Nhập pass wifi văn phòng để tiếp tục:
            </p>
            <input
              type="password"
              value={vfxAccess.input}
              onChange={e => vfxAccess.setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  vfxAccess.tryUnlock()
                }
              }}
              placeholder="Nhập pass"
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            {vfxAccess.error && <p className="mb-2 text-[12px] text-red-500">{vfxAccess.error}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  vfxAccess.cancel()
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-[13px] text-slate-500 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  vfxAccess.tryUnlock()
                }}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromptGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[22px] font-semibold tracking-tight">
                    Hướng dẫn chuẩn hóa cấu trúc nội dung
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-blue-100/90">
                    Nhân viên chỉ cần copy prompt bên dưới, dán vào ChatGPT của mình, rồi gửi tiếp tên bài và nội dung thô để nhận lại bản đã chuẩn hóa.
                  </p>
                </div>
                <button
                  onClick={() => setShowPromptGuide(false)}
                  className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Cách dùng nhanh
                </p>
                <div className="mt-3 space-y-2 text-[13px] leading-6 text-slate-600">
                  <p>1. Bấm nút copy ở dưới để sao chép prompt mẫu.</p>
                  <p>2. Dán prompt dưới đây vào ChatGPT của bạn.</p>
                  <p>3. Gửi tiếp theo mẫu: <span className="font-medium text-slate-800">Tên bài:</span> ... và <span className="font-medium text-slate-800">Nội dung thô:</span> ...</p>
                  <p>4. Paste kết quả đã được ChatGPT chuẩn hóa.</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Prompt mẫu
                </p>
                <button
                  onClick={copyPromptGuide}
                  className="rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-900"
                >
                  {copyPromptState === 'copied'
                    ? 'Đã copy prompt'
                    : copyPromptState === 'error'
                      ? 'Không copy được'
                      : 'Copy prompt'}
                </button>
              </div>

              <pre className="mt-3 overflow-x-auto rounded-[22px] border border-slate-200 bg-white p-5 text-[12px] leading-6 text-slate-700 shadow-sm whitespace-pre-wrap">
                {CONTENT_STANDARDIZATION_PROMPT}
              </pre>
            </div>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-[18px] font-semibold tracking-tight text-slate-900">Thêm tài liệu mới</h3>
              <p className="mt-1 text-[13px] leading-6 text-slate-500">
                Tạo thêm một tài liệu mới trong danh mục <span className="font-medium text-slate-700">{currentCat?.label}</span>.
              </p>
            </div>

            <div className="px-6 py-5">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Tên tài liệu</span>
                <input
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Ví dụ: Đội Livestream"
                  autoFocus
                />
              </label>
              {itemActionError && (
                <p className="mt-3 text-[12px] text-red-500">{itemActionError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowAddItemModal(false)
                  setItemActionError('')
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={addMenuItem}
                disabled={itemActionLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {itemActionLoading ? 'Đang tạo...' : 'Tạo tài liệu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="px-6 py-5">
              <h3 className="text-[18px] font-semibold tracking-tight text-slate-900">Xóa tài liệu này?</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Tài liệu <span className="font-medium text-slate-700">{selectedTitle}</span> sẽ bị xóa khỏi danh sách.
                {currentPage ? ' Nội dung của bài này cũng sẽ bị xóa khỏi hệ thống.' : ''}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={deleteMenuItem}
                disabled={itemActionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {itemActionLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
