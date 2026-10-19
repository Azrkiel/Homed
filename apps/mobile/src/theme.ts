// Colors, spacing and type scale. Light and dark palettes; useTheme follows the system scheme.
import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  good: string;
  goodSurface: string;
  warn: string;
  warnSurface: string;
  danger: string;
  dangerSurface: string;
  badgeSurface: string;
  badgeText: string;
  placeholder: string;
}

const light: Palette = {
  background: '#F5F5F2',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#55575C',
  border: '#D6D7D2',
  accent: '#1F3A6E',
  onAccent: '#FFFFFF',
  good: '#1E6B3A',
  goodSurface: '#E3F2E8',
  warn: '#7A4F00',
  warnSurface: '#FFF1D6',
  danger: '#A4262C',
  dangerSurface: '#FBE4E4',
  badgeSurface: '#E9EBF2',
  badgeText: '#22304F',
  placeholder: '#E2E3DE',
};

const dark: Palette = {
  background: '#0F1115',
  surface: '#1A1D24',
  text: '#F2F2F2',
  muted: '#B4BAC4',
  border: '#343A46',
  accent: '#A9BEF0',
  onAccent: '#0F1115',
  good: '#8ADBA5',
  goodSurface: '#1B3325',
  warn: '#F5C86A',
  warnSurface: '#3A2E12',
  danger: '#FF9E98',
  dangerSurface: '#3E1F1E',
  badgeSurface: '#2A2F3B',
  badgeText: '#DCE3F2',
  placeholder: '#2A2D35',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
/** Minimum touch target (iOS HIG / Material). */
export const MIN_TAP = 44;

export const type = {
  title: 22,
  heading: 17,
  body: 15,
  small: 13,
  caption: 12,
} as const;

export function paletteFor(scheme: 'light' | 'dark' | null | undefined): Palette {
  return scheme === 'dark' ? dark : light;
}

export function useTheme(): { colors: Palette; isDark: boolean } {
  const scheme = useColorScheme();
  return { colors: paletteFor(scheme), isDark: scheme === 'dark' };
}

/** Score colour band: green 75+, amber 50-74, muted below. */
export function scoreTone(score: number, colors: Palette): { fg: string; bg: string } {
  if (score >= 75) return { fg: colors.good, bg: colors.goodSurface };
  if (score >= 50) return { fg: colors.warn, bg: colors.warnSurface };
  return { fg: colors.muted, bg: colors.badgeSurface };
}
