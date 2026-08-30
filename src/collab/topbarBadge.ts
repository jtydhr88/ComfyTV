import { i18n } from '@/i18n'

export const collabTopbarBadge: { text: string; variant: 'info'; tooltip?: string } = {
  text: '',
  variant: 'info',
}

export function updateCollabBadge(peerCount: number, coEditing: boolean): void {
  const t = i18n.global.t
  if (peerCount <= 0) {
    collabTopbarBadge.text = ''
    return
  }
  collabTopbarBadge.text = coEditing
    ? t('collab.badgeEditing', { count: peerCount + 1 })
    : t('collab.badgeOnline', { count: peerCount + 1 })
  collabTopbarBadge.tooltip = t('collab.badgeTooltip')
}
