import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  analysisPlatforms,
  analysisReportRows,
  parseAnalysisReport,
  useAudioAnalysis,
} from './useAudioAnalysis'

describe('parseAnalysisReport', () => {
  it('parses a JSON object', () => {
    expect(parseAnalysisReport('{"integrated_lufs":-14}')).toEqual({ integrated_lufs: -14 })
  })

  it('returns null for empty / null output', () => {
    expect(parseAnalysisReport(null)).toBeNull()
    expect(parseAnalysisReport('')).toBeNull()
    expect(parseAnalysisReport(undefined)).toBeNull()
  })

  it('returns null for malformed JSON or non-objects', () => {
    expect(parseAnalysisReport('{bad')).toBeNull()
    expect(parseAnalysisReport('42')).toBeNull()
    expect(parseAnalysisReport('"str"')).toBeNull()
    expect(parseAnalysisReport('null')).toBeNull()
  })
})

describe('analysisPlatforms', () => {
  it('extracts the platforms array', () => {
    const rows = [{ name: 'YouTube', verdict: 'ok', target_lufs: -14 }]
    expect(analysisPlatforms({ platforms: rows })).toEqual(rows)
  })

  it('returns [] when missing or not an array', () => {
    expect(analysisPlatforms(null)).toEqual([])
    expect(analysisPlatforms({})).toEqual([])
    expect(analysisPlatforms({ platforms: 'x' })).toEqual([])
  })
})

describe('analysisReportRows', () => {
  it('maps known keys to labels and rounds numbers to 2 decimals', () => {
    const rows = analysisReportRows({
      integrated_lufs: -14.336,
      peak_dbfs: -1,
      unknown_key: 99,
    })
    expect(rows).toEqual([
      { label: 'I (LUFS)', value: '-14.34' },
      { label: 'Peak (dBFS)', value: '-1' },
    ])
  })

  it('skips null / undefined values, stringifies non-numbers', () => {
    const rows = analysisReportRows({ count: '3', lra_lu: null })
    expect(rows).toEqual([{ label: 'Silences', value: '3' }])
  })

  it('appends up to 12 silence segments with fallbacks', () => {
    const segments = Array.from({ length: 14 }, (_, i) => ({ start: i, end: i + 0.5 }))
    const rows = analysisReportRows({ segments })
    const segRows = rows.filter(r => r.label.startsWith('#'))
    expect(segRows).toHaveLength(12)
    expect(segRows[0]).toEqual({ label: '#1', value: '0.00s – 0.50s' })

    const partial = analysisReportRows({ segments: [{}] })
    expect(partial[0]).toEqual({ label: '#1', value: '?s – …s' })
  })

  it('returns [] without a report', () => {
    expect(analysisReportRows(null)).toEqual([])
  })
})

describe('useAudioAnalysis', () => {
  it('derives report, platforms and rows reactively from the output', () => {
    const output = ref<string | null>(null)
    const a = useAudioAnalysis(() => output.value)
    expect(a.report.value).toBeNull()
    expect(a.platforms.value).toEqual([])
    expect(a.reportRows.value).toEqual([])

    output.value = JSON.stringify({
      mean_volume_db: -20.5,
      platforms: [{ name: 'Spotify', verdict: 'quiet', target_lufs: -14 }],
    })
    expect(a.report.value).not.toBeNull()
    expect(a.platforms.value[0].name).toBe('Spotify')
    expect(a.reportRows.value).toEqual([{ label: 'Mean (dB)', value: '-20.5' }])
  })
})
