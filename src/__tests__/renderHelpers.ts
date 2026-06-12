import { createTestingPinia } from '@pinia/testing'
import { render, type RenderOptions } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'

import enMessages from '../../locales/en/main.json'

export function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en: enMessages },
    missingWarn: false,
    fallbackWarn: false,
  })
}

export function renderWithPlugins(
  component: any,
  options: {
    props?: Record<string, unknown>
    initialState?: Record<string, any>
    stubActions?: boolean
  } & Omit<RenderOptions<any>, 'props' | 'global'> = {},
) {
  const { props, initialState, stubActions = false, ...rest } = options
  return render(component, {
    ...rest,
    props,
    global: {
      plugins: [
        makeI18n(),
        createTestingPinia({ stubActions, initialState }),
      ],
    },
  })
}
