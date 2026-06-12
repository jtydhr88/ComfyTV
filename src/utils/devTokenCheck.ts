const THEME_TOKENS = [
  '--base-foreground',
  '--base-background',
  '--muted-foreground',
  '--muted-background',
  '--accent-background',
  '--primary-background',
  '--primary-background-hover',
  '--secondary-background',
  '--secondary-background-hover',
  '--secondary-background-selected',
  '--destructive-background',
  '--destructive-background-hover',
  '--warning-background',
  '--warning-background-hover',
  '--success-background',
  '--border-default',
  '--border-subtle',
  '--interface-menu-surface',
  '--interface-menu-stroke',
  '--interface-panel-surface',
  '--interface-menu-component-surface-hovered',
  '--interface-menu-component-surface-selected',
  '--node-component-border',
  '--modal-card-background',
] as const

export function checkThemeTokens(): void {
  if (process.env.NODE_ENV === 'production') return
  if (typeof document === 'undefined' || !document.documentElement) return

  const style = getComputedStyle(document.documentElement)
  const missing = THEME_TOKENS.filter(
    (name) => style.getPropertyValue(name).trim() === '',
  )

  if (missing.length) {
    console.warn(
      '[ComfyTV] host theme tokens not found (using fallbacks): ' +
        missing.join(', '),
    )
  }
}
