<template>
  <div class="ctv:group ctv:relative ctv:my-1 ctv:overflow-hidden ctv:rounded-md ctv:border ctv:border-border-subtle">
    <div class="ctv:flex ctv:items-center ctv:justify-between ctv:border-b ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5">
      <span class="ctv:font-mono ctv:text-[10px] ctv:text-muted-foreground">{{ lang || 'text' }}</span>
      <button
        class="ctv:cursor-pointer ctv:border-none ctv:bg-transparent ctv:p-0.5 ctv:text-muted-foreground"
        :title="$t('bot.copyCode')"
        @click="copy"
      >
        <i class="pi ctv:text-[10px]" :class="copied ? 'pi-check' : 'pi-copy'" />
      </button>
    </div>
    <div
      v-if="highlighted"
      class="ctv-bot-shiki ctv:overflow-x-auto ctv:text-[11px] ctv:leading-relaxed"
      v-html="highlighted"
    />
    <pre
      v-else
      class="ctv:m-0 ctv:overflow-x-auto ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:leading-relaxed ctv:whitespace-pre"
    >{{ code }}</pre>
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import DOMPurify from 'dompurify'
import { ref } from 'vue'

const { code, lang = '' } = defineProps<{ code: string; lang?: string }>()

const highlighted = ref('')
const copied = ref(false)

const LANG_ALIASES: Record<string, string> = {
  py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash',
  shell: 'bash', zsh: 'bash', yml: 'yaml', md: 'markdown',
}

type Highlighter = Awaited<
  ReturnType<typeof import('shiki/core').createHighlighterCore>
>
let highlighterPromise: Promise<Highlighter> | null = null

function loadHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] =
      await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
      ])
    return createHighlighterCore({
      themes: [import('@shikijs/themes/github-dark-default')],
      langs: [
        import('@shikijs/langs/python'),
        import('@shikijs/langs/javascript'),
        import('@shikijs/langs/typescript'),
        import('@shikijs/langs/json'),
        import('@shikijs/langs/bash'),
        import('@shikijs/langs/html'),
        import('@shikijs/langs/css'),
        import('@shikijs/langs/yaml'),
        import('@shikijs/langs/markdown'),
      ],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
  })()
  return highlighterPromise
}

watchDebounced(
  () => code,
  async () => {
    const source = code
    try {
      const highlighter = await loadHighlighter()
      const requested = LANG_ALIASES[lang] ?? lang
      const known = highlighter.getLoadedLanguages().includes(requested)
      const html = highlighter.codeToHtml(source, {
        lang: known ? requested : 'text',
        theme: 'github-dark-default',
      })
      if (source === code) {
        highlighted.value = DOMPurify.sanitize(html)
      }
    } catch {
      highlighted.value = ''
    }
  },
  { debounce: 150, immediate: true },
)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1200)
  } catch {
    copied.value = false
  }
}
</script>

<style scoped>
.ctv-bot-shiki :deep(pre) {
  margin: 0;
  padding: 6px 8px;
}
</style>
