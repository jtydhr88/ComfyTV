<script setup lang="ts">
import Button from '@agent/components/ui/button/Button.vue'
import { computed, inject } from 'vue'
import type { TVInteraction, InteractionResponse } from '../../../schemas/hermesInteractionSchema'
import { interactionViewKey } from '../../../services/agent/agentInteractions'
const props = defineProps<{ interaction: Extract<TVInteraction, { kind: 'hermes_approval' }> }>()
const emit = defineEmits<{ respond: [response: InteractionResponse] }>()
const view = inject(interactionViewKey, undefined)
const disabled = computed(() => !view?.canRespond(props.interaction))
function respond(choice: 'once' | 'deny') {
 if (disabled.value || (choice === 'once' && (!props.interaction.action.approvable || props.interaction.action.truncated))) return
 emit('respond', { interaction: props.interaction, decision: { choice } })
}
</script>
<template>
 <section aria-label="Hermes tool approval" class="ctv:rounded-xl ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:text-base-foreground ctv:p-3 ctv:space-y-2">
  <strong>Hermes · Tool approval</strong>
  <pre class="ctv:whitespace-pre-wrap ctv:break-all">{{ interaction.action.command }}</pre>
  <p>{{ interaction.action.description }}</p>
  <p v-if="interaction.action.redacted">Credentials redacted</p>
  <p>Expires: {{ interaction.expires_at ?? 'No configured deadline' }}</p>
  <p role="status">{{ interaction.state }}</p>
  <p v-if="view?.protocolError?.(interaction)" role="alert">{{ view.protocolError(interaction) }}</p>
  <p v-if="disabled">Read-only: local desktop channel and live connection required.</p>
  <Button variant="secondary" size="sm" type="button" :disabled="disabled || !interaction.action.approvable || interaction.action.truncated" @click="respond('once')">Approve once</Button>
  <Button variant="secondary" size="sm" type="button" :disabled="disabled" @click="respond('deny')">Deny</Button>
 </section>
</template>
