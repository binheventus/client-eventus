import { useEffect } from 'react'

export default function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = '404 - Không tìm thấy trang | Eventus Production'

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#22254a] px-5 py-12 text-[#c8ecf8]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(177,221,240,0.22)_0,rgba(177,221,240,0)_16rem),radial-gradient(circle_at_82%_12%,rgba(247,152,32,0.2)_0,rgba(247,152,32,0)_13rem),linear-gradient(180deg,#171a3a_0%,#22254a_56%,#17243e_100%)]" />
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle,rgba(255,255,255,0.82)_1px,transparent_1.5px),radial-gradient(circle,rgba(177,221,240,0.58)_1px,transparent_1.5px)] [background-position:0_0,42px_58px] [background-size:118px_118px,154px_154px]" />
      <div className="absolute left-[8%] top-[16%] h-2 w-2 rounded-full bg-[#f79820] shadow-[0_0_26px_8px_rgba(247,152,32,0.42)]" />
      <div className="absolute right-[13%] top-[18%] h-24 w-24 rounded-full border border-[#b1ddf0]/25 bg-[#b1ddf0]/10 shadow-[0_0_42px_rgba(177,221,240,0.15)] sm:h-32 sm:w-32" />
      <div className="absolute -left-16 bottom-24 h-52 w-52 rounded-full border border-[#f79820]/25" />

      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[46vh] min-h-[250px] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 420"
      >
        <path d="M0 246L90 212L180 236L276 170L384 220L510 138L650 224L760 164L880 226L1000 144L1130 214L1238 182L1340 224L1440 198V420H0V246Z" fill="#101936" />
        <path d="M0 292L116 252L236 284L340 230L480 294L604 244L736 304L860 236L1012 306L1140 250L1288 296L1440 244V420H0V292Z" fill="#152442" />
        <path d="M0 340C130 302 238 322 344 356C468 396 594 316 724 348C850 378 958 394 1080 350C1212 302 1336 326 1440 358V420H0V340Z" fill="#0c1f31" />
        <path d="M0 376C164 340 306 364 450 380C616 398 744 358 886 370C1058 386 1204 354 1440 372V420H0V376Z" fill="#071522" />
      </svg>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center text-center">
        <p className="text-7xl font-black leading-none tracking-[0.08em] text-[#f79820] sm:text-8xl lg:text-9xl">404</p>
        <h1 className="mt-8 max-w-3xl text-4xl font-extrabold leading-tight text-[#d7f5ff] sm:text-5xl lg:text-6xl">
          Bạn đã đi khá xa rồi!!
        </h1>
        <p className="mt-8 max-w-5xl text-base leading-8 text-[#b1ddf0] sm:text-lg">
          <span className="lg:whitespace-nowrap">Rất tiếc, trang bạn đang tìm không tồn tại trên hệ thống của Eventus Production.</span>
          <br className="hidden sm:block" />
          Dù vậy, hãy cùng tận hưởng khung cảnh ở đây một chút nhé.
        </p>
        <a
          href="https://eventusproduction.com/"
          className="mt-11 inline-flex min-h-12 items-center justify-center rounded-md bg-[#f79820] px-7 text-sm font-bold text-[#171a3a] shadow-[0_16px_34px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#ffad3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b1ddf0]"
        >
          Về trang chủ
        </a>
      </section>
    </main>
  )
}
