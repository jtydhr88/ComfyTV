export const dividerClass = 'ctv:h-5 ctv:w-px ctv:shrink-0 ctv:bg-[#161616]'
export const fieldClass = 'ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:whitespace-nowrap'
export const colorInputClass =
  'ctv:size-6 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-[#161616] ctv:bg-transparent ctv:p-0 ctv:disabled:opacity-30'
export const segGroupClass = 'ctv:flex ctv:h-6 ctv:items-center ctv:gap-0.5 ctv:rounded ctv:bg-[#1e1e1e] ctv:p-0.5'

export function segBtnClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-sm ctv:border-0 ctv:px-1.5 ctv:py-0.5',
    'ctv:text-[11px] ctv:cursor-pointer ctv:[font-family:inherit] ctv:transition-colors',
    active
      ? 'ctv:bg-[#4a4a4a] ctv:text-[#f0f0f0]'
      : 'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:hover:text-[#d6d6d6]',
  ].join(' ')
}

export const iconBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-[#3a3a3a] ctv:hover:text-[#d6d6d6] ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'

export const actionBtnClass =
  'ctv:inline-flex ctv:h-6 ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:rounded ctv:border ctv:border-[#161616] ' +
  'ctv:bg-[#3a3a3a] ctv:px-2 ctv:text-[11px] ctv:text-[#d6d6d6] ctv:cursor-pointer ' +
  'ctv:[font-family:inherit] ctv:transition-colors ctv:hover:bg-[#4a4a4a] ' +
  'ctv:disabled:opacity-40 ctv:disabled:cursor-default'
