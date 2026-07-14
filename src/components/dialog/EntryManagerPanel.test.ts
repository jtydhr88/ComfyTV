import { screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'

import EntryManagerPanel from './EntryManagerPanel.vue'

describe('EntryManagerPanel (deprecated dialog)', () => {
  it('renders only the moved-to-sidebar notice', () => {
    renderWithPlugins(EntryManagerPanel, { stubActions: false })

    expect(screen.getByText(/moved to the ComfyTV left sidebar/i)).toBeInTheDocument()
    expect(screen.getByText(/removed in the next release/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
