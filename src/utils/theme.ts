import { useThemeStore } from '../store/themeStore';

const lightColors = {
  primary: '#BC002D',
  primaryLight: '#D4354F',
  primaryDark: '#8C0021',

  accent: '#E890A0',
  accentLight: '#FFF0F3',

  bg: '#FFFAFA',
  card: '#FFFFFF',
  searchBg: '#FFF5F6',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9E9E9E',

  border: '#F0D8DC',
  divider: '#FFF0F3',

  pillBg: '#FFF0F3',
  pillActiveBg: '#BC002D',
  pillText: '#4A4A4A',
  pillActiveText: '#FFFFFF',

  godanTag: '#E8F5E9',
  godanTagText: '#2E7D32',
  ichidanTag: '#E3F2FD',
  ichidanTagText: '#1565C0',
  irregularTag: '#FFF3E0',
  irregularTagText: '#E65100',

  n5Bg: '#E0F7FA', n5Text: '#00838F',
  n4Bg: '#E0F2F1', n4Text: '#00695C',
  n3Bg: '#EDE7F6', n3Text: '#4527A0',
  n2Bg: '#FCE4EC', n2Text: '#AD1457',
  n1Bg: '#F3E5F5', n1Text: '#6A1B9A',
};

const darkColors = {
  primary: '#E8384F',
  primaryLight: '#FF5A6E',
  primaryDark: '#FF6B7A',

  accent: '#F48FB1',
  accentLight: '#2D1520',

  bg: '#141012',
  card: '#1E1A1C',
  searchBg: '#2A2426',

  textPrimary: '#F0F0F0',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',

  border: '#3A2A30',
  divider: '#2A2426',

  pillBg: '#2A2426',
  pillActiveBg: '#E8384F',
  pillText: '#A0A0A0',
  pillActiveText: '#FFFFFF',

  godanTag: '#1B3A1B',
  godanTagText: '#66BB6A',
  ichidanTag: '#0D2137',
  ichidanTagText: '#64B5F6',
  irregularTag: '#3E2200',
  irregularTagText: '#FFB74D',

  n5Bg: '#0A2E30', n5Text: '#4DD0E1',
  n4Bg: '#0D2E2B', n4Text: '#4DB6AC',
  n3Bg: '#1A1035', n3Text: '#B39DDB',
  n2Bg: '#2D0E1E', n2Text: '#F48FB1',
  n1Bg: '#1F0D2B', n1Text: '#CE93D8',
};

export type ThemeColors = typeof lightColors;

export const themes = { light: lightColors, dark: darkColors };

export function useColors(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}

export const colors = lightColors;

export const fonts = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
};
