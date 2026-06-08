import { useState } from 'react'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { buildQuoteExcelWorkbook, getQuoteExcelFilename } from '../lib/quoteExcel'

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
      const workbook = buildQuoteExcelWorkbook(quote, items || quote?.items || [], ExcelJS, {
        equipmentRules: equipmentRulesData,
        legalEntities: legalEntitiesData,
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
