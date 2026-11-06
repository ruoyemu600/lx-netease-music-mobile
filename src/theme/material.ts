// Material semantic colors are separate from the legacy generated tint ramp.
// Existing themes and imported user themes retain their original behavior.
const palettes = {
  material_dark: {
    background: '#111318',
    surface: '#262A35',
    surfaceLow: '#1C1F26',
    primary: '#BDC5FF',
    onPrimary: '#222B5B',
    primaryContainer: '#3D4565',
    onPrimaryContainer: '#E0E4FF',
    text: '#E6E7EF',
    secondaryText: '#A8ADBD',
    outline: '#444959',
    selection: '#252B40',
    hover: '#30364A',
  },
  material_light: {
    background: '#FAF8FF',
    surface: '#ECEEF8',
    surfaceLow: '#F2F2FA',
    primary: '#4F5B92',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DFE3FF',
    onPrimaryContainer: '#18244F',
    text: '#1A1B23',
    secondaryText: '#585D70',
    outline: '#C6C9D8',
    selection: '#E4E7FC',
    hover: '#D8DDF4',
  },
} as const

export const getMaterialThemeColors = (id: string): Partial<LX.ActiveTheme> | undefined => {
  if (id !== 'material_dark' && id !== 'material_light') return
  const p = palettes[id]
  return {
    'c-app-background': p.background,
    'c-main-background': p.background,
    'c-content-background': p.surface,
    'c-font': p.text,
    'c-font-label': p.secondaryText,
    'c-850': p.text,
    'c-450': p.secondaryText,
    'c-primary': p.primary,
    'c-theme': p.surfaceLow,
    'c-primary-light-1000': p.surfaceLow,
    'c-primary-font': p.primary,
    'c-primary-font-hover': p.primary,
    'c-primary-font-active': p.onPrimaryContainer,
    'c-primary-background': p.selection,
    'c-primary-background-hover': p.hover,
    'c-primary-background-active': p.primaryContainer,
    'c-primary-input-background': p.surface,
    'c-button-font': p.primary,
    'c-button-font-selected': p.onPrimary,
    'c-button-background': p.primaryContainer,
    'c-button-background-selected': p.primary,
    'c-button-background-hover': p.hover,
    'c-button-background-active': p.primaryContainer,
    'c-list-header-border-bottom': p.outline,
    'c-border-background': p.outline,
  }
}
