import { useState } from 'react'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { findLegalEntityByAlias, isMediaMonsterEntityCode, normalizeLegalEntityCode } from '../lib/entityCodes'
import { buildQuoteExcelWorkbook, getQuoteExcelFilename } from '../lib/quoteExcel'

function getQuoteEntity(quote = {}) {
  return findLegalEntityByAlias(quote.entity_code || 'EVENTUS', legalEntitiesData)
}

function getLogoExtension(logoFile = '') {
  const extension = String(logoFile).split('.').pop()?.toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : 'png'
}

async function loadQuoteLogo(quote = {}) {
  const entity = getQuoteEntity(quote)
  const entityCode = normalizeLegalEntityCode(quote.entity_code || 'EVENTUS')
  const logoFile = entity?.logo_file || entity?.logoFile || (isMediaMonsterEntityCode(entityCode) ? 'logo_mediamonster.png' : 'logo_eventus.png')
  if (!logoFile) return {}

  try {
    const response = await fetch(`/logos/${logoFile}`)
    if (!response.ok) return { logoFile }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const chunks = []
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)))
    }
    const extension = getLogoExtension(logoFile)
    const mimeType = extension === 'jpeg' ? 'image/jpeg' : 'image/png'
    return {
      logoFile,
      logoExtension: extension,
      logoBase64: `data:${mimeType};base64,${btoa(chunks.join(''))}`,
    }
  } catch {
    return { logoFile }
  }
}

export default function QuoteExcelDownloadButton({
  quote,
  items,
  children = 'Download Excel',
  loadingLabel = 'Đang tạo Excel...',
  className = '',
}) {
  const [loading, setLoading] = useState(false)

  async function downloadExcel() {
    if (loading || !quote) return

    setLoading(true)
    try {
      const ExcelJS = await import('exceljs')
      const logoOptions = await loadQuoteLogo(quote)
      const workbook = buildQuoteExcelWorkbook(quote, items || quote?.items || [], ExcelJS, {
        equipmentRules: equipmentRulesData,
        legalEntities: legalEntitiesData,
        ...logoOptions,
      })
      const content = await workbook.xlsx.writeBuffer()
      const blob = new Blob([content], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getQuoteExcelFilename(quote)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={downloadExcel}
      disabled={loading || !quote}
      className={className}
    >
      {loading ? loadingLabel : children}
    </button>
  )
}
