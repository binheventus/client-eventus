import { useEffect } from 'react'
import { Clock3, Leaf, LockKeyhole, ShieldCheck } from 'lucide-react'

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Bảo mật tuyệt đối',
    desc: 'Mọi văn bản được mã hóa và chỉ có thể truy cập qua liên kết riêng tư được cấp quyền.',
  },
  {
    icon: Clock3,
    title: 'Nhanh chóng & Tiện lợi',
    desc: 'Xem, phản hồi và xác nhận báo giá/hợp đồng trực tuyến mọi lúc mọi nơi.',
  },
  {
    icon: Leaf,
    title: 'Hướng tới ESG',
    desc: 'Giảm thiểu thủ tục in ấn giấy tờ, tối ưu hóa quy trình làm việc số để cùng bạn bảo vệ môi trường.',
  },
]

function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Eventus Production'

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main className="eventus-landing relative h-[100svh] overflow-hidden text-[#111827]">
      <div className="eventus-home__wash absolute inset-0" />
      <div className="eventus-home__grid absolute inset-0" />

      <div className="eventus-home__shell relative z-10 mx-auto grid w-full grid-rows-[auto_minmax(0,1fr)]">
        <header className="eventus-home__header flex items-center justify-between border-b border-[#dfd6c9] pb-3 sm:pb-4">
          <img
            src="/logos/logo_eventus.png"
            alt="Eventus Production"
            className="eventus-home__logo h-auto w-[160px] max-w-full sm:w-[210px] lg:w-[238px]"
          />
          <div className="eventus-home__header-mark flex items-center gap-2 text-[#a35116]">
            <span className="h-px w-12 bg-[#d59a68]" />
            <p className="eventus-home__eyebrow text-[10px] font-semibold uppercase text-[#b55217]">
              Eventus Client Space
            </p>
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </div>
        </header>

        <section className="eventus-home__content grid min-h-0 items-start gap-4 py-4 sm:gap-6 sm:py-6 lg:py-8 xl:grid-cols-[minmax(0,1fr)_390px] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_430px] 2xl:gap-10">
          <div className="eventus-home__copy min-w-0">
            <h1 className="eventus-home__title max-w-5xl font-semibold text-[#111827]">
              <span className="eventus-home__title-line">Chào mừng bạn đến với</span>
              <span className="eventus-home__title-line">không gian số của Eventus Production</span>
            </h1>

            <p className="eventus-home__welcome mt-5 text-lg font-semibold leading-7 text-[#364152] sm:text-xl">
                Rất vui được đón tiếp bạn ghé thăm!
            </p>

            <div className="eventus-home__body mt-6 max-w-3xl space-y-4 text-[15px] leading-7 text-[#4b5565]">
              <p>
                  Nếu bạn đang tìm kiếm bảng báo giá hoặc hợp đồng dịch vụ được thiết kế riêng cho mình,
                  chúng đã được chúng tôi "gói ghém" cẩn thận và bảo mật trong một đường link riêng tư
                  được gửi trực tiếp đến bạn.
              </p>
              <p>
                  Trang chủ này chỉ là lối đi chung, còn không gian trải nghiệm dành riêng cho bạn nằm ở
                  liên kết mà nhân viên Eventus đã cung cấp.
              </p>
              <p>
                  Nếu bạn là khách hàng hiện tại đang tìm hợp đồng/báo giá, vui lòng kiểm tra lại tin
                  nhắn/email để click vào link riêng của mình. Hệ thống không hiển thị công khai để bảo
                  mật cho bạn.
              </p>
            </div>
          </div>

          <aside className="eventus-home__security min-h-0">
            <div className="eventus-home__highlights grid gap-3">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon

                return (
                  <article key={item.title} className="eventus-home__highlight">
                    <span className="eventus-home__highlight-icon">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="eventus-home__highlight-title text-[16px] font-semibold text-[#111827]">
                        {item.title}
                      </h2>
                      <p className="eventus-home__highlight-desc mt-1 text-[13px] leading-6 text-[#596170]">
                        {item.desc}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>
        </section>

      </div>

      <footer className="eventus-home__footer relative z-10 mx-auto w-full max-w-[1440px] border-t border-[#dfd6c9] pt-3 text-center sm:pt-4">
        <p className="eventus-home__copyright text-[10px] font-medium leading-5 text-[#6f6b63] sm:text-[11px]">
          Copyright © 2017 - 2026 Eventus Production. Developed by Founder Pham Thanh Binh. All rights reserved.
        </p>
      </footer>
    </main>
  )
}

export default LandingPage
