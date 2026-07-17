import { computed } from 'vue'

export interface PlatformRow {
  name: string
  verdict: string
  target_lufs: number
}

export interface ReportRow {
  label: string
  value: string
}

export const ANALYSIS_LABELS: Record<string, string> = {
  integrated_lufs: 'I (LUFS)',
  momentary_max_lufs: 'Max M (LUFS)',
  short_max_lufs: 'Max S (LUFS)',
  threshold_lufs: 'Threshold (LUFS)',
  lra_lu: 'LRA (LU)',
  lra_low_lufs: 'LRA low (LUFS)',
  lra_high_lufs: 'LRA high (LUFS)',
  peak_dbfs: 'Peak (dBFS)',
  mean_volume_db: 'Mean (dB)',
  max_volume_db: 'Max (dB)',
  n_samples: 'Samples',
  dc_offset: 'DC offset',
  peak_level_db: 'Peak (dB)',
  rms_level_db: 'RMS (dB)',
  rms_peak_db: 'RMS peak (dB)',
  flat_factor: 'Flat factor',
  peak_count: 'Peak count',
  count: 'Silences',
}

export const MAX_SILENCE_SEGMENTS = 12

export function parseAnalysisReport(output: string | null | undefined): Record<string, unknown> | null {
  if (!output) return null
  try {
    const parsed = JSON.parse(output)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function analysisPlatforms(report: Record<string, unknown> | null): PlatformRow[] {
  return Array.isArray(report?.platforms) ? report.platforms as PlatformRow[] : []
}

export function analysisReportRows(report: Record<string, unknown> | null): ReportRow[] {
  if (!report) return []
  const rows: ReportRow[] = []
  for (const [key, label] of Object.entries(ANALYSIS_LABELS)) {
    const v = report[key]
    if (v === undefined || v === null) continue
    rows.push({ label, value: typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v) })
  }
  const segments = report.segments
  if (Array.isArray(segments)) {
    for (const [i, seg] of segments.slice(0, MAX_SILENCE_SEGMENTS).entries()) {
      const s = seg as { start?: number, end?: number }
      rows.push({
        label: `#${i + 1}`,
        value: `${s.start?.toFixed?.(2) ?? '?'}s – ${s.end?.toFixed?.(2) ?? '…'}s`,
      })
    }
  }
  return rows
}

export function useAudioAnalysis(getOutput: () => string | null | undefined) {
  const report = computed(() => parseAnalysisReport(getOutput()))
  const platforms = computed(() => analysisPlatforms(report.value))
  const reportRows = computed(() => analysisReportRows(report.value))
  return { report, platforms, reportRows }
}
