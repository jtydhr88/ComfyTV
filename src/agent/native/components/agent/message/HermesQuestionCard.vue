<script setup lang="ts">
import Button from '@agent/components/ui/button/Button.vue'
import { computed, inject, reactive, watch } from 'vue'
import { validInteractionDecision, type TVInteraction, type InteractionResponse, type QuestionAnswer } from '../../../schemas/hermesInteractionSchema'
import { interactionViewKey } from '../../../services/agent/agentInteractions'
const props = defineProps<{ interaction: Extract<TVInteraction, { kind: 'hermes_question' }> }>()
const emit = defineEmits<{ respond: [response: InteractionResponse] }>()
const view = inject(interactionViewKey, undefined)
const disabled = computed(() => !view?.canRespond(props.interaction))
const selected = reactive<Record<string,string[]>>({})
const other = reactive<Record<string,string>>({})
watch(() => props.interaction.id, () => { for (const key of Object.keys(selected)) delete selected[key]; for (const key of Object.keys(other)) delete other[key] }, { immediate: true })
function choose(id: string, value: string, multi: boolean, checked: boolean) {
 if (disabled.value) return
 if (!multi) { selected[id] = [value]; other[id] = '' }
 else selected[id] = checked ? [...(selected[id] ?? []), value] : (selected[id] ?? []).filter(v => v !== value)
}
function text(id: string, value: string, multi: boolean) { other[id] = value; if (!multi && value.trim()) selected[id] = [] }
const answers = computed<QuestionAnswer[]>(() => props.interaction.questions.map(q => ({ id: q.id, selected: selected[q.id] ?? [], ...(other[q.id]?.trim() ? { other_text: other[q.id] } : {}) })))
const valid = computed(() => validInteractionDecision(props.interaction, { answers: answers.value }))
function respond(skip = false) { if (disabled.value || (!skip && !valid.value)) return; emit('respond', { interaction: props.interaction, decision: skip ? { skip: true } : { answers: answers.value } }) }
</script>
<template>
 <section aria-label="Hermes clarification" class="ctv:rounded-xl ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:text-base-foreground ctv:p-3 ctv:space-y-2">
  <strong>Hermes · Clarification</strong>
  <fieldset v-for="q in interaction.questions" :key="q.id" :disabled="disabled">
   <legend>{{ q.question }}</legend>
   <label v-for="choice in q.choices" :key="choice" class="ctv:block">
    <input class="ctv:appearance-auto ctv:size-4 ctv:mr-2" :type="q.multi_select ? 'checkbox' : 'radio'" :name="`${interaction.id}-${q.id}`" :value="choice" :checked="selected[q.id]?.includes(choice)" @change="choose(q.id, choice, q.multi_select, ($event.target as HTMLInputElement).checked)" />{{ choice }}
   </label>
   <label v-if="q.allow_other || !q.choices.length" class="ctv:block">{{ q.choices.length ? 'Other' : 'Your answer' }}
    <textarea class="ctv:block ctv:w-full ctv:min-h-16 ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:text-base-foreground ctv:p-2" :data-qid="q.id" :value="other[q.id] ?? ''" @input="text(q.id, ($event.target as HTMLTextAreaElement).value, q.multi_select)" />
   </label>
  </fieldset>
  <p>Expires: {{ interaction.expires_at ?? 'No configured deadline' }}</p>
  <p role="status">{{ interaction.state }}</p>
  <p v-if="view?.protocolError?.(interaction)" role="alert">{{ view.protocolError(interaction) }}</p>
  <p v-if="disabled">Read-only: local desktop channel and live connection required.</p>
  <Button variant="secondary" size="sm" type="button" data-action="answer" :disabled="disabled || !valid" @click="respond()">Submit answers</Button>
  <Button variant="secondary" size="sm" type="button" data-action="skip" :disabled="disabled" @click="respond(true)">Skip questions</Button>
 </section>
</template>
