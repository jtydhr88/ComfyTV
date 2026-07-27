import { describe, expect, it } from 'vitest'

import { assetPreviewUrl, isPsdAsset, PSD_MIME } from './assetMedia'

describe('isPsdAsset', () => {
  it('detects by mime type', () => {
    expect(isPsdAsset({ payload_url: '/view?filename=x.bin', mime_type: PSD_MIME })).toBe(true)
  })

  it('detects by name extension', () => {
    expect(isPsdAsset({ payload_url: '/view?filename=abc', name: 'layers.psd' })).toBe(true)
    expect(isPsdAsset({ payload_url: '/view?filename=abc', name: 'big.PSB' })).toBe(true)
  })

  it('detects by url filename', () => {
    expect(isPsdAsset({ payload_url: '/view?filename=comfytv-layers-1.psd&type=input' })).toBe(true)
    expect(isPsdAsset({ payload_url: '/files/export.psb' })).toBe(true)
  })

  it('rejects regular images', () => {
    expect(isPsdAsset({ payload_url: '/view?filename=pic.png', name: 'pic.png', mime_type: 'image/png' })).toBe(false)
    expect(isPsdAsset({ payload_url: '/view?filename=my-psd-notes.txt', name: 'psd-notes' })).toBe(false)
  })
})

describe('assetPreviewUrl', () => {
  it('prefers metadata preview url', () => {
    expect(assetPreviewUrl({
      payload_url: '/view?filename=x.psd',
      metadata: { preview_url: '/view?filename=x-prev.png' },
    })).toBe('/view?filename=x-prev.png')
  })

  it('falls back to payload url', () => {
    expect(assetPreviewUrl({ payload_url: '/view?filename=x.png' })).toBe('/view?filename=x.png')
    expect(assetPreviewUrl({ payload_url: '/view?filename=x.png', metadata: { preview_url: 42 } })).toBe('/view?filename=x.png')
    expect(assetPreviewUrl({ payload_url: '/view?filename=x.png', metadata: { preview_url: '' } })).toBe('/view?filename=x.png')
  })
})
