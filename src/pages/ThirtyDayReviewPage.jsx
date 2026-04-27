import { useState, useEffect, useRef, useCallback } from 'react';
import { thirtyDayReviewSupabase as supabase } from '../lib/thirtyDayReviewSupabase'
import questionsConfig from '../data/thirtyDayReviewQuestions.json'
import {
  Star,
  Eye,
  Lightbulb,
  Rocket,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Phone,
  User as UserIcon,
  Calendar,
} from 'lucide-react';

const LOCAL_QUESTION_VERSION = 'repo-json-v1'

const iconMap = {
  star: Star,
  eye: Eye,
  lightbulb: Lightbulb,
  rocket: Rocket,
};

// ====== HELPERS ======
function generateToken() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

function normalizePhone(phone) {
  return phone.replace(/[\s\-\.]/g, '').trim();
}

function formatPhone(phone) {
  if (!phone) return '';
  const p = phone.replace(/\D/g, '');
  if (p.length === 10) return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  if (p.length === 11) return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  return phone;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function validateNgayGiaNhap(dateStr) {
  if (!dateStr) return 'Vui lòng chọn ngày gia nhập.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return 'Ngày gia nhập không đúng định dạng.';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Ngày gia nhập không hợp lệ.';

  const min = new Date('2017-01-01');
  const max = new Date();
  max.setHours(23, 59, 59, 999);

  if (d < min) return 'Ngày gia nhập phải từ năm 2017 trở đi.';
  if (d > max) return 'Ngày gia nhập không được ở tương lai.';
  return null;
}

function getTodayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function ThirtyDayReviewPage({ embedded = false }) {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('r');

  const [stage, setStage] = useState(tokenFromUrl ? 'loading' : 'login');
  const [responseId, setResponseId] = useState(null);
  const [accessToken, setAccessToken] = useState(tokenFromUrl || null);

  const [hoTen, setHoTen] = useState('');
  const [sdt, setSdt] = useState('');
  const [viTri, setViTri] = useState('');
  const [ngayGiaNhap, setNgayGiaNhap] = useState('');
  const [loginError, setLoginError] = useState('');
  const [missingFields, setMissingFields] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [questionsData, setQuestionsData] = useState(null);
  const [questionVersion, setQuestionVersion] = useState(null);

  const [formData, setFormData] = useState({});
  const [status, setStatus] = useState('draft');

  const [saveState, setSaveState] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const [validationError, setValidationError] = useState('');
  const [showShareLink, setShowShareLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const saveTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true);
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  const loadQuestionsConfig = async () => {
    return {
      version: LOCAL_QUESTION_VERSION,
      config: questionsConfig,
    };
  };

  useEffect(() => {
    if (!tokenFromUrl) return;

    (async () => {
      try {
        const { data: respData, error: respError } = await supabase
          .from('responses')
          .select('*')
          .eq('access_token', tokenFromUrl)
          .single();

        if (respError || !respData) {
          setErrorMessage('Đường link không hợp lệ hoặc đã bị xóa.');
          setStage('error');
          return;
        }

        const latest = await loadQuestionsConfig();
        setQuestionsData(latest.config);
        setQuestionVersion(respData.question_version || latest.version);

        setResponseId(respData.id);
        setAccessToken(respData.access_token);
        setHoTen(respData.ho_ten);
        setSdt(respData.sdt);
        setViTri(respData.vi_tri || '');
        setNgayGiaNhap(respData.ngay_gia_nhap || '');
        setFormData(respData.data || {});
        setStatus(respData.status);

        if (respData.updated_at) setLastSavedAt(new Date(respData.updated_at));
        else if (respData.created_at) setLastSavedAt(new Date(respData.created_at));

        setStage('form');
        isInitialLoad.current = false;
      } catch (err) {
        setErrorMessage(err.message || 'Có lỗi xảy ra khi tải dữ liệu.');
        setStage('error');
      }
    })();
  }, [tokenFromUrl]);

  const handleLogin = async () => {
    setLoginError('');

    const phoneNorm = normalizePhone(sdt);
    const missing = {
      hoTen: !hoTen.trim(),
      sdt: !sdt.trim(),
      viTri: !viTri.trim(),
      ngayGiaNhap: !ngayGiaNhap,
    };
    setMissingFields(missing);

    if (Object.values(missing).some(Boolean)) {
      setLoginError('Vui lòng điền đầy đủ cả 4 thông tin để tiếp tục.');
      return;
    }

    if (!/^\d{9,11}$/.test(phoneNorm)) {
      setLoginError('Số điện thoại không hợp lệ (9-11 chữ số).');
      setMissingFields({ ...missing, sdt: true });
      return;
    }

    const dateErr = validateNgayGiaNhap(ngayGiaNhap);
    if (dateErr) {
      setLoginError(dateErr);
      setMissingFields({ ...missing, ngayGiaNhap: true });
      return;
    }

    setLoginSubmitting(true);
    setStage('loading');

    try {
      const { data: existing } = await supabase
        .from('responses')
        .select('*')
        .eq('sdt', phoneNorm)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const resp = existing[0];

        const config = await loadQuestionsConfig();
        setQuestionsData(config.config);
        setQuestionVersion(resp.question_version || config.version);
        setResponseId(resp.id);
        setAccessToken(resp.access_token);
        setHoTen(resp.ho_ten);
        setViTri(resp.vi_tri || '');
        setNgayGiaNhap(resp.ngay_gia_nhap || '');
        setFormData(resp.data || {});
        setStatus(resp.status);

        if (resp.updated_at) setLastSavedAt(new Date(resp.updated_at));
        else if (resp.created_at) setLastSavedAt(new Date(resp.created_at));

        window.history.replaceState({}, '', `?r=${resp.access_token}`);
      } else {
        const config = await loadQuestionsConfig();
        const newToken = generateToken();

        const { data: created, error: createErr } = await supabase
          .from('responses')
          .insert({
            access_token: newToken,
            ho_ten: hoTen.trim(),
            sdt: phoneNorm,
            vi_tri: viTri.trim(),
            ngay_gia_nhap: ngayGiaNhap,
            question_version: LOCAL_QUESTION_VERSION,
            data: {},
            status: 'draft',
          })
          .select()
          .single();

        if (createErr) throw createErr;

        setQuestionsData(config.config);
        setQuestionVersion(config.version);
        setResponseId(created.id);
        setAccessToken(created.access_token);
        setFormData({});
        setStatus('draft');
        setLastSavedAt(new Date(created.created_at || Date.now()));

        window.history.replaceState({}, '', `?r=${created.access_token}`);
      }

      setStage('form');
      isInitialLoad.current = false;
    } catch (err) {
      console.error(err);
      setLoginError('Có lỗi khi kết nối. Vui lòng thử lại.');
      setStage('login');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const saveToServer = useCallback(async (data) => {
    if (!responseId) return;
    setSaveState('saving');
    try {
      const { error } = await supabase
        .from('responses')
        .update({ data })
        .eq('id', responseId);
      if (error) throw error;
      setSaveState('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Save error:', err);
      setSaveState('error');
    }
  }, [responseId]);

  useEffect(() => {
    if (isInitialLoad.current || !responseId) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveState('saving');

    saveTimeoutRef.current = setTimeout(() => {
      saveToServer(formData);
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, responseId, saveToServer]);

  const handleChange = (qid, value) => {
    setFormData((prev) => ({ ...prev, [qid]: value }));
  };

  const handleCheckboxChange = (qid, option) => {
    setFormData((prev) => {
      const current = prev[qid] || [];
      const updated = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      return { ...prev, [qid]: updated };
    });
  };

  const validateForm = () => {
    if (!questionsData) return null;
    for (const section of questionsData.sections) {
      if (section.id === 'info') continue;
      for (const q of section.questions) {
        if (q.required) {
          const v = formData[q.id];
          if (!v || (Array.isArray(v) && v.length === 0)) {
            return `Vui lòng điền: "${q.label}"`;
          }
        }
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      setValidationError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationError('');

    setSaveState('saving');
    try {
      const { error } = await supabase
        .from('responses')
        .update({
          data: formData,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', responseId);

      if (error) throw error;
      setStatus('submitted');
      setSaveState('saved');
      setLastSavedAt(new Date());
      setShowShareLink(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSaveState('error');
      setValidationError('Có lỗi khi gửi. Vui lòng thử lại.');
    }
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}?r=${accessToken}`;
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const embeddedShellClass = embedded ? 'bg-transparent' : 'bg-gradient-to-br from-slate-50 to-blue-50'
  const embeddedCardClass = embedded ? 'rounded-[28px] border border-slate-200 shadow-sm' : 'rounded-2xl shadow-xl'
  const embeddedPagePaddingClass = embedded ? 'px-6 py-6' : 'py-10 px-4'

  // ====== RENDER: LOADING ======
  if (stage === 'loading') {
    return (
      <div className={`${embedded ? 'min-h-full px-6 py-12' : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50'} flex items-center justify-center`}>
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Đang tải...</span>
        </div>
      </div>
    );
  }

  // ====== RENDER: ERROR ======
  if (stage === 'error') {
    return (
      <div className={`${embedded ? 'min-h-full px-6 py-12' : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6'} flex items-center justify-center`}>
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Có lỗi xảy ra</h1>
          <p className="text-slate-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => { window.location.href = window.location.pathname; }}
            className="bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-800"
          >
            Quay lại trang chính
          </button>
        </div>
      </div>
    );
  }

  // ====== RENDER: LOGIN ======
  if (stage === 'login') {
    const inputBase =
      'w-full px-4 py-3 text-[15px] text-slate-900 bg-white border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-700/20 transition';
    const inputNormal = 'border-slate-300 focus:border-blue-700';
    const inputError = 'border-red-500 focus:border-red-500';

    return (
      <div className={`${embedded ? 'px-6 py-6' : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4'} flex items-center justify-center`}>
        <div className={`w-full ${embedded ? 'max-w-[1180px]' : 'max-w-[460px]'} overflow-hidden bg-white ${embeddedCardClass}`}>
          {embedded ? (
            <div className="grid lg:grid-cols-[1fr_1fr]">
              <div className="flex items-center bg-gradient-to-br from-slate-900 via-blue-900 to-teal-700 px-8 py-8 text-white md:px-10">
                <div className="mx-auto w-full max-w-[440px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100/80">
                    Eventus Onboarding
                  </p>
                  <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">
                    30-Day Review
                  </h1>
                  <p className="mt-3 text-[14px] leading-7 text-blue-100/90">
                    Ghi nhận cảm nhận sau 30 ngày đầu tiên để Eventus cải thiện tốt hơn, từ góc nhìn thực tế của chính bạn.
                  </p>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-[13px] leading-6 text-blue-50/95 backdrop-blur">
                    Hệ thống tự lưu trong quá trình làm.
                    <br />
                    Bạn có thể quay lại tiếp tục bằng đúng số điện thoại đã dùng trước đó.
                  </div>
                </div>
              </div>

              <div className="flex items-center px-8 py-8 md:px-10">
                <div className="mx-auto w-full max-w-[440px]">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Bắt đầu
                  </p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900">
                    Nhập thông tin của bạn
                  </h2>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">
                    Điền đủ 4 thông tin để mở bài review hoặc tiếp tục phần đã lưu trước đó.
                  </p>

                  {loginError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 mt-6 mb-5 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-red-800 leading-snug">{loginError}</p>
                    </div>
                  )}

                  <div className="mt-6 grid gap-[18px] md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-[13px] font-medium text-slate-900 mb-2">Họ tên</label>
                      <input
                        type="text"
                        value={hoTen}
                        onChange={(e) => {
                          setHoTen(e.target.value);
                          if (missingFields.hoTen) setMissingFields({ ...missingFields, hoTen: false });
                        }}
                        placeholder="Nguyễn Văn A"
                        className={`${inputBase} ${missingFields.hoTen ? inputError : inputNormal}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-slate-900 mb-2">Số điện thoại</label>
                      <input
                        type="tel"
                        value={sdt}
                        onChange={(e) => {
                          setSdt(e.target.value);
                          if (missingFields.sdt) setMissingFields({ ...missingFields, sdt: false });
                        }}
                        placeholder="0901234567"
                        className={`${inputBase} ${missingFields.sdt ? inputError : inputNormal}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-medium text-slate-900 mb-2">Ngày gia nhập</label>
                      <input
                        type="date"
                        value={ngayGiaNhap}
                        min="2017-01-01"
                        max={getTodayISO()}
                        onChange={(e) => {
                          setNgayGiaNhap(e.target.value);
                          if (missingFields.ngayGiaNhap) setMissingFields({ ...missingFields, ngayGiaNhap: false });
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className={`${inputBase} ${missingFields.ngayGiaNhap ? inputError : inputNormal}`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[13px] font-medium text-slate-900 mb-2">Vị trí</label>
                      <input
                        type="text"
                        value={viTri}
                        onChange={(e) => {
                          setViTri(e.target.value);
                          if (missingFields.viTri) setMissingFields({ ...missingFields, viTri: false });
                        }}
                        placeholder="VD: Video-Editor, Photographer, Account ..."
                        className={`${inputBase} ${missingFields.viTri ? inputError : inputNormal}`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loginSubmitting}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-[12px] bg-blue-700 px-6 py-3 text-[15px] font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    {loginSubmitting ? 'Đang xử lý...' : 'Bắt đầu / Tiếp tục'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-8 py-6">
                <h1 className="text-[22px] font-medium text-white leading-tight tracking-tight">
                  Eventus Onboarding 30-Day Review
                </h1>
                <p className="mt-2 text-[13px] leading-6 text-blue-100/90">
                  Ghi nhận cảm nhận sau 30 ngày đầu tiên để Eventus cải thiện tốt hơn.
                </p>
              </div>

              <div className="px-8 py-7">
                <p className="text-sm text-slate-700 leading-relaxed mb-6">
                  Nhập thông tin để bắt đầu hoặc tiếp tục bài làm.
                  <br />
                  Hệ thống sẽ tự lưu để bạn quay lại bất cứ lúc nào.
                </p>

                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 mb-5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-red-800 leading-snug">{loginError}</p>
                  </div>
                )}

                <div className="space-y-[18px]">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-900 mb-2">Họ tên</label>
                    <input
                      type="text"
                      value={hoTen}
                      onChange={(e) => {
                        setHoTen(e.target.value);
                        if (missingFields.hoTen) setMissingFields({ ...missingFields, hoTen: false });
                      }}
                      placeholder="Nguyễn Văn A"
                      className={`${inputBase} ${missingFields.hoTen ? inputError : inputNormal}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-900 mb-2">Số điện thoại</label>
                    <input
                      type="tel"
                      value={sdt}
                      onChange={(e) => {
                        setSdt(e.target.value);
                        if (missingFields.sdt) setMissingFields({ ...missingFields, sdt: false });
                      }}
                      placeholder="0901234567"
                      className={`${inputBase} ${missingFields.sdt ? inputError : inputNormal}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-900 mb-2">Vị trí</label>
                    <input
                      type="text"
                      value={viTri}
                      onChange={(e) => {
                        setViTri(e.target.value);
                        if (missingFields.viTri) setMissingFields({ ...missingFields, viTri: false });
                      }}
                      placeholder="VD: Video-Editor, Photographer, Account ..."
                      className={`${inputBase} ${missingFields.viTri ? inputError : inputNormal}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-900 mb-2">Ngày gia nhập</label>
                    <input
                      type="date"
                      value={ngayGiaNhap}
                      min="2017-01-01"
                      max={getTodayISO()}
                      onChange={(e) => {
                        setNgayGiaNhap(e.target.value);
                        if (missingFields.ngayGiaNhap) setMissingFields({ ...missingFields, ngayGiaNhap: false });
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className={`${inputBase} ${missingFields.ngayGiaNhap ? inputError : inputNormal}`}
                    />
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loginSubmitting}
                  className="w-full mt-6 bg-blue-700 hover:bg-blue-800 text-white font-medium text-[15px] py-3 rounded-[10px] transition disabled:opacity-50"
                >
                  {loginSubmitting ? 'Đang xử lý...' : 'Bắt đầu / Tiếp tục'}
                </button>

                <p className="text-center text-[11px] text-slate-400 mt-6 tracking-wide">
                  Eventus Production · Built by Phạm Thanh Bình · 2026
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ====== RENDER: FORM ======
  if (!questionsData) return null;

  const sectionsToRender = questionsData.sections.filter((s) => s.id !== 'info');
  const savedTimeStr = lastSavedAt ? formatTime(lastSavedAt) : '';

  const HeaderSaveIndicator = () => {
    if (saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-white/85">
          <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
        </span>
      );
    }
    if (saveState === 'error') {
      return <span className="text-[11.5px] text-red-100">⚠ Lỗi lưu</span>;
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-white/90">
        <Check className="w-3 h-3" strokeWidth={3} />
        {savedTimeStr ? `Đã lưu lúc ${savedTimeStr}` : 'Đã lưu'}
      </span>
    );
  };

  return (
    <div className={embedded ? embeddedPagePaddingClass : `min-h-screen ${embeddedShellClass} ${embeddedPagePaddingClass}`}>
      <div className={`${embedded ? 'max-w-[1320px] mx-auto' : 'max-w-3xl mx-auto'}`}>
        {/* ===== HEADER ===== */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 rounded-[28px] shadow-lg px-8 py-6 md:px-10 md:py-7 mb-6 text-white">
          <div className="flex items-start justify-between gap-4 mb-2.5">
            <h1 className="text-[22px] md:text-[26px] font-medium leading-tight tracking-tight">
              HÀNH TRÌNH 30 NGÀY <span className="opacity-60 mx-1">|</span> {hoTen.toUpperCase()}
            </h1>
            <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg text-xs whitespace-nowrap flex-shrink-0">
              {status === 'submitted' ? '✓ Đã gửi' : '✎ Đang làm'}
            </div>
          </div>

          <p className="text-[14px] mb-3 opacity-95 leading-6">
            Nơi những cảm nhận mới mẻ định hình nên một Eventus tốt hơn.
          </p>

          <div className="bg-white/12 backdrop-blur rounded-2xl px-[18px] py-3.5 text-[13px] leading-[1.65] space-y-2.5 ring-1 ring-white/10">
            <p className="m-0">
              Eventus trân trọng góc nhìn từ những "đôi mắt mới" để hoàn thiện mỗi ngày. Đây không phải bài thi hay đánh giá thử việc. Bạn đang ở khoảnh khắc duy nhất có thể nhìn Eventus bằng góc nhìn còn mới. Một tháng nữa, bạn sẽ không còn thấy những gì hôm nay bạn đang thấy. Hãy ghi lại trước khi nó phai.
            </p>
            <p className="m-0">
              Sau khi bạn nộp bài, anh Bình sẽ dành một buổi cafe để cùng bạn trao đổi. Những gì bạn viết sẽ được lắng nghe và dẫn đến hành động thật.
            </p>
            <p className="m-0">
              Câu trả lời "mọi thứ ổn ạ" là câu tệ nhất. Không phải vì sai, mà vì vô dụng cho cả bạn và Eventus. Hãy chia sẻ chân thành, đó chính là chìa khóa để xây dựng một môi trường làm việc tốt hơn cho chính bạn và những người vào sau.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-3.5 flex-wrap text-[11.5px] opacity-85">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                {formatPhone(sdt)}
              </span>
              <span className="opacity-40">|</span>
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="w-3 h-3" />
                {viTri}
              </span>
              <span className="opacity-40">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Gia nhập: {formatDate(ngayGiaNhap)}
              </span>
            </div>
            <HeaderSaveIndicator />
          </div>
        </div>

        {showShareLink && status === 'submitted' && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-emerald-900 mb-1">Đã gửi thành công!</h3>
                <p className="text-sm text-emerald-800">
                  Copy đường link dưới đây và <strong>gửi cho sếp</strong> để sếp xem ngay. Bạn cũng có thể quay lại link này để chỉnh sửa câu trả lời sau.
                </p>
              </div>
            </div>
            <div className="flex gap-2 bg-white rounded-lg border border-emerald-200 p-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => e.target.select()}
                className="flex-1 bg-transparent text-sm text-slate-700 px-2 py-1 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 transition"
              >
                {linkCopied ? <><Check className="w-4 h-4" /> Đã copy</> : <><Copy className="w-4 h-4" /> Copy link</>}
              </button>
            </div>
          </div>
        )}

        {status === 'submitted' && !showShareLink && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              Bài này đã gửi. Bạn vẫn có thể chỉnh sửa và <strong>thay đổi sẽ được lưu tự động</strong>.{' '}
              <button onClick={() => setShowShareLink(true)} className="underline font-semibold">
                Xem lại link để gửi sếp
              </button>
            </div>
          </div>
        )}

        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
            ⚠️ {validationError}
          </div>
        )}

        {/* ===== SECTIONS ===== */}
        {sectionsToRender.map((section) => {
          const Icon = iconMap[section.icon] || Star;
          return (
            <div key={section.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 mb-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Icon className="w-5 h-5 text-blue-700" />
                </div>
                <h2 className="text-lg md:text-xl font-bold text-slate-800">
                  {section.title}
                  {section.weight && (
                    <span className="text-sm font-normal text-slate-500 ml-2">({section.weight})</span>
                  )}
                </h2>
              </div>

              <div className={`${embedded ? 'grid gap-x-8 gap-y-6 lg:grid-cols-2' : 'space-y-6'}`}>
                {section.questions.map((q) => (
                  <div key={q.id} className={q.type === 'textarea' ? (embedded ? 'lg:col-span-2' : '') : ''}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {q.label}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {q.type === 'text' && (
                      <input
                        type="text"
                        value={formData[q.id] || ''}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                        placeholder={q.placeholder || ''}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}

                    {q.type === 'date' && (
                      <input
                        type="date"
                        value={formData[q.id] || ''}
                        onChange={(e) => handleChange(q.id, e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}

                    {q.type === 'textarea' && (
                      <textarea
                        value={formData[q.id] || ''}
                        onChange={(e) => {
                          handleChange(q.id, e.target.value);
                          autoResize(e.target);
                        }}
                        onFocus={(e) => autoResize(e.target)}
                        ref={(el) => {
                          if (el) autoResize(el);
                        }}
                        placeholder={q.placeholder || ''}
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                      />
                    )}

                    {q.type === 'radio' && (
                      <div>
                        {q.scale_label ? (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {q.options.map((opt, idx) => {
                                const isSelected = formData[q.id] === opt;
                                const colorClass = isSelected
                                  ? 'bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 border-slate-900 text-white shadow-md'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50';

                                return (
                                  <label key={opt} className="relative flex flex-col items-center gap-1.5 flex-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={q.id}
                                      value={opt}
                                      checked={isSelected}
                                      onChange={(e) => handleChange(q.id, e.target.value)}
                                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    />
                                    <div className={`w-full py-2.5 rounded-lg border-2 text-center text-sm font-semibold transition-all ${colorClass}`}>
                                      {opt}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 px-0.5">
                              <span>{q.scale_label.min}</span>
                              <span>{q.scale_label.max}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {q.options.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  checked={formData[q.id] === opt}
                                  onChange={(e) => handleChange(q.id, e.target.value)}
                                  className="text-blue-600"
                                />
                                <span className="text-slate-700 text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === 'checkbox' && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(formData[q.id] || []).includes(opt)}
                              onChange={() => handleCheckboxChange(q.id, opt)}
                              className="text-blue-600"
                            />
                            <span className="text-slate-700 text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ===== KHỐI SUBMIT ===== */}
        <div className="rounded-[28px] border border-slate-200 bg-white px-8 py-8 shadow-sm">
          {status === 'submitted' ? (
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-[24px] font-semibold tracking-tight text-slate-900">Đã gửi bài review</h3>
                <p className="mt-2 text-[14px] leading-7 text-slate-600">
                  Mọi thay đổi đang được lưu tự động. Sếp sẽ thấy bản mới nhất khi mở đúng đường link này.
                </p>
              </div>
              <button
                onClick={() => setShowShareLink(true)}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-blue-900"
              >
                XEM LINK GỬI SẾP
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Hoàn tất bài review
                </p>
                <h3 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900">
                  Kiểm tra lại và gửi bài cho anh Bình
                </h3>
                <div className="mt-3 space-y-2 text-[14.5px] leading-7 text-slate-600">
                  <p>
                    {savedTimeStr ? `Vừa lưu lúc ${savedTimeStr}. ` : ''}
                    Bạn có thể đóng trình duyệt và quay lại làm tiếp bất cứ lúc nào.
                  </p>
                  <p>
                    Khi đã sẵn sàng, hãy nhấn nút bên dưới để gửi bài cho anh Bình nhé!
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-500">
                  {saveState === 'saving' ? 'Đang lưu dữ liệu...' : 'Sẵn sàng để gửi'}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={saveState === 'saving'}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-7 py-3.5 text-[15px] font-semibold tracking-wide text-white transition hover:bg-blue-900 disabled:opacity-50"
                >
                  GỬI BÀI THU HOẠCH
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
