export const EMPTY_MANUAL_CONTRACT_SOURCE = {
  source_type: 'manual',
  quote_snapshot: {
    client_name: '',
    event_name: '',
    event_date: '',
    location: '',
    has_vat: true,
    subtotal: 0,
    travel_fee_total: 0,
    overtime_fee_total: 0,
    vat_amount: 0,
    total_amount: 0,
    items: [
      {
        service_code: 'MANUAL_TOTAL',
        service_name: 'Dịch vụ media theo thỏa thuận',
        unit: 'Gói',
        quantity: 1,
        num_sessions: 1,
        unit_price: 0,
        total_price: 0,
        sort_order: 1,
      },
    ],
  },
  source_snapshot: {
    source_type: 'manual',
  },
  schedule_rows: [
    { time_range: '', date_text: '', location: '' },
  ],
}

export const SCHEDULE_CONTRACT_QUERY_KEYS = [
  'sales_brief',
  'customer_code',
  'service_scope',
  'job_title',
  'ekip',
  'start_time',
  'end_time',
  'job_time',
  'job_date',
  'location',
  'contract_value',
]

export function getContractRoute(contract = {}) {
  const identifier = contract?.contract_id || contract?.id
  return identifier ? `/contracts/${encodeURIComponent(identifier)}` : '/contracts'
}

function getContractIdentifier(contractOrId = '') {
  if (typeof contractOrId === 'string' || typeof contractOrId === 'number') return compactText(contractOrId)
  return compactText(contractOrId?.contract_id || contractOrId?.id)
}

function getDocumentIdentifier(documentOrId = '') {
  if (typeof documentOrId === 'string' || typeof documentOrId === 'number') return compactText(documentOrId)
  return compactText(documentOrId?.document_id || documentOrId?.id)
}

export function getContractDocumentsRoute(contractOrId = '') {
  const contractId = getContractIdentifier(contractOrId)
  return contractId ? `/contracts/${encodeURIComponent(contractId)}/documents` : '/contracts'
}

export function getNewContractDocumentRoute(contractOrId = '', documentType = 'advance_request') {
  const contractId = getContractIdentifier(contractOrId)
  const type = compactText(documentType) || 'advance_request'
  return contractId
    ? `/contracts/${encodeURIComponent(contractId)}/documents/new/${encodeURIComponent(type)}`
    : '/contracts'
}

export function getContractDocumentEditRoute(contractOrId = '', documentOrId = '') {
  const documentId = getDocumentIdentifier(documentOrId)
  return documentId
    ? `/documents/${encodeURIComponent(documentId)}/edit`
    : getContractDocumentsRoute(contractOrId)
}

function makeSearchParams(searchParams = {}) {
  return searchParams instanceof URLSearchParams
    ? new URLSearchParams(searchParams)
    : new URLSearchParams(searchParams)
}

function getNormalizedContractSource(source = '') {
  const normalized = compactText(source).toLowerCase()
  if (normalized === 'job' || normalized === 'lichlamviec') return 'job'
  if (normalized === 'quote') return 'quote'
  if (normalized === 'manual') return 'manual'
  return ''
}

function appendQuery(path, params = new URLSearchParams()) {
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}`
}

function stripContractSourceParams(params = new URLSearchParams()) {
  const nextParams = new URLSearchParams(params)
  nextParams.delete('source')
  nextParams.delete('jobId')
  nextParams.delete('job_id')
  nextParams.delete('quoteId')
  nextParams.delete('quote_id')
  return nextParams
}

export function getNewContractRoute(searchParams = {}) {
  const params = makeSearchParams(searchParams)
  const rawSource = compactText(params.get('source')).toLowerCase()
  const source = getNormalizedContractSource(rawSource)
  const jobId = compactText(params.get('jobId') || params.get('job_id'))
  const quoteId = compactText(params.get('quoteId') || params.get('quote_id'))
  const nextParams = stripContractSourceParams(params)

  if (rawSource === 'lichlamviec' && !nextParams.has('origin_source')) {
    nextParams.set('origin_source', 'lichlamviec')
  }

  if (source === 'job' && jobId) {
    return appendQuery(`/contracts/from-job/${encodeURIComponent(jobId)}`, nextParams)
  }

  if (source === 'quote' && quoteId) {
    return appendQuery(`/contracts/from-quote/${encodeURIComponent(quoteId)}`, nextParams)
  }

  if (source === 'manual') {
    return appendQuery('/contracts/new/manual', nextParams)
  }

  if (source === 'job' || source === 'quote') {
    nextParams.set('source', source)
  }

  return appendQuery('/contracts/new', nextParams)
}

export function getLegacyNewContractRedirect(searchParams = {}) {
  const params = makeSearchParams(searchParams)
  const source = compactText(params.get('source'))
  if (!source) return ''

  const legacyPath = appendQuery('/contracts/new', params)
  const nextPath = getNewContractRoute(params)
  return nextPath === legacyPath ? '' : nextPath
}

export function compactText(value = '') {
  return String(value || '').trim()
}

export function parseContractValue(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

export function getScheduleQueryParams(params = new URLSearchParams()) {
  const get = key => compactText(params.get(key))
  return {
    source: get('source'),
    originSource: get('origin_source'),
    jobId: get('jobId') || get('job_id'),
    quoteId: get('quoteId') || get('quote_id'),
    salesBrief: get('sales_brief'),
    customerCode: get('customer_code'),
    serviceScope: get('service_scope'),
    jobTitle: get('job_title'),
    ekip: get('ekip'),
    startTime: get('start_time'),
    endTime: get('end_time'),
    jobTime: get('job_time'),
    jobDate: get('job_date'),
    location: get('location'),
    contractValue: get('contract_value'),
  }
}

function buildJobTime({ jobTime = '', startTime = '', endTime = '' } = {}) {
  if (jobTime) return jobTime
  return [startTime, endTime].filter(Boolean).join(' - ')
}

function buildJobServiceScope(job = {}, { serviceScope = '', salesBrief = '' } = {}) {
  const brief = compactText(serviceScope || salesBrief)
  if (brief) return /^cung cấp\s+/i.test(brief) ? brief : `cung cấp ${brief}`
  return job.job_title ? `cung cấp dịch vụ media cho ${job.job_title}` : 'cung cấp dịch vụ media theo job'
}

function buildJobQuoteSnapshot(job = {}, scheduleParams = {}) {
  const quoteSnapshot = job.quote_snapshot || {}
  const contractValue = parseContractValue(scheduleParams.contractValue)
  const total = contractValue || Number(quoteSnapshot.total_amount || job.price || 0)
  const serviceName = scheduleParams.serviceScope || scheduleParams.jobTitle || quoteSnapshot.items?.[0]?.service_name || job.job_title || 'Dịch vụ media theo job'
  const hasVat = quoteSnapshot.has_vat !== false
  const subtotal = hasVat ? Math.round(total / 1.08) : total
  const vatAmount = hasVat ? total - subtotal : 0

  return {
    ...quoteSnapshot,
    client_name: quoteSnapshot.client_name || job.customer_name || job.customer_snapshot?.company_name || '',
    event_name: scheduleParams.jobTitle || quoteSnapshot.event_name || job.job_title || '',
    event_date: scheduleParams.jobDate || quoteSnapshot.event_date || job.job_date || '',
    location: scheduleParams.location || quoteSnapshot.location || job.location || '',
    has_vat: hasVat,
    subtotal,
    vat_amount: vatAmount,
    total_amount: total,
    items: [{
      service_code: quoteSnapshot.items?.[0]?.service_code || 'JOB_TOTAL',
      service_name: serviceName,
      unit: quoteSnapshot.items?.[0]?.unit || 'Gói',
      quantity: 1,
      num_sessions: 1,
      billable_duration_hours: quoteSnapshot.items?.[0]?.billable_duration_hours || '',
      unit_price: total,
      total_price: total,
      sort_order: 1,
      group_label: quoteSnapshot.items?.[0]?.group_label || '',
    }],
  }
}

export function buildJobSourceDraft(job = {}, scheduleParams = {}) {
  const jobTitle = scheduleParams.jobTitle || job.job_title || ''
  const jobTime = buildJobTime(scheduleParams)
  const jobDate = scheduleParams.jobDate || job.date_text || ''
  const location = scheduleParams.location || job.location || ''
  const quoteSnapshot = buildJobQuoteSnapshot(job, scheduleParams)
  const originSource = scheduleParams.originSource || scheduleParams.source || job.source_snapshot?.origin_source || ''

  return {
    ...job,
    job_title: jobTitle || job.job_title,
    ekip: scheduleParams.ekip || job.ekip,
    time_range: jobTime || job.time_range,
    date_text: jobDate,
    location,
    price: parseContractValue(scheduleParams.contractValue) || job.price,
    source_type: 'job',
    external_job_id: job.id,
    service_scope: buildJobServiceScope({ ...job, job_title: jobTitle }, scheduleParams),
    customer_snapshot: {
      ...(job.customer_snapshot || {}),
      customer_code: scheduleParams.customerCode || job.customer_snapshot?.customer_code || '',
    },
    quote_snapshot: quoteSnapshot,
    schedule_rows: [{
      time_range: jobTime || job.time_range || '',
      date_text: jobDate,
      location,
    }],
    source_snapshot: {
      ...(job.source_snapshot || {}),
      source_type: 'job',
      origin_source: originSource,
      external_job_id: job.id,
      job_title: jobTitle || job.source_snapshot?.job_title || '',
      date_text: jobDate,
      start_time: scheduleParams.startTime || job.source_snapshot?.start_time || '',
      end_time: scheduleParams.endTime || job.source_snapshot?.end_time || '',
      time_range: jobTime || job.source_snapshot?.time_range || '',
      job_description: scheduleParams.location || job.source_snapshot?.job_description || '',
      location,
      ekip: scheduleParams.ekip || job.source_snapshot?.ekip || '',
      price: parseContractValue(scheduleParams.contractValue) || job.source_snapshot?.price || job.price || 0,
      sales_brief: scheduleParams.salesBrief || job.source_snapshot?.sales_brief || '',
      service_scope: scheduleParams.serviceScope || job.source_snapshot?.service_scope || '',
      customer_snapshot: {
        ...(job.source_snapshot?.customer_snapshot || job.customer_snapshot || {}),
        customer_code: scheduleParams.customerCode || job.source_snapshot?.customer_snapshot?.customer_code || job.customer_snapshot?.customer_code || '',
      },
    },
  }
}
