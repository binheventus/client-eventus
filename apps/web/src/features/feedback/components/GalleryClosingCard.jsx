import { Link } from 'react-router-dom'

// Warm closing call-to-action shown after the photo grid. This is the primary
// moment to invite feedback — right after the visitor has enjoyed the album.
// Branding-orange styling makes it stand out from the neutral grid area.
export default function GalleryClosingCard({ surveyLink }) {
  if (!surveyLink) return null

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-[#f79820]/30 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,236,214,0.96))] px-6 py-8 text-center shadow-[0_12px_32px_rgba(247,152,32,0.12)]">
      <p className="text-[16px] font-extrabold leading-snug text-[#202b3c] sm:text-[18px]">
        Bạn hài lòng với bộ ảnh chứ?
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] font-semibold leading-[1.6] text-[#7a5a32]">
        Eventus luôn muốn lắng nghe cảm nhận của bạn về bộ ảnh và dịch vụ vừa qua để nâng cao chất lượng mỗi ngày.
      </p>
      <Link
        to={surveyLink}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f79820] px-7 text-[14px] font-extrabold leading-tight text-white shadow-[0_10px_22px_rgba(247,152,32,0.28)] transition hover:-translate-y-px hover:bg-[#d97706]"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" />
        </svg>
        <span>Gửi phản hồi ngay· chỉ 2 phút</span>
      </Link>
    </div>
  )
}
