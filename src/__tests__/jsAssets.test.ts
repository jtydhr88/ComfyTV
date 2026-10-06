import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const JS_DIR = path.resolve(__dirname, '../../js')

describe('built js/ directory', () => {
  it('holds main.js as the only .js file, since ComfyUI imports every .js under it as an extension', () => {
    const jsFiles = fs.readdirSync(JS_DIR, { recursive: true, encoding: 'utf8' })
      .filter(f => f.endsWith('.js'))
      .map(f => f.split(path.sep).join('/'))
    expect(jsFiles).toEqual(['main.js'])
  })
})
