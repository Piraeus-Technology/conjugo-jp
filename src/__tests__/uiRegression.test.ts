import { existsSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { getConjugationIndex, styles as homeStyles } from '../screens/HomeScreen';
import { themes } from '../utils/theme';

jest.mock(
  '@react-native-async-storage/async-storage',
  // The package ships this CommonJS mock as its supported Jest integration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success' },
}));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: 'Swipeable' }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('UI regression guards', () => {
  it('keeps normal text roles at WCAG AA contrast in both themes', () => {
    for (const colors of Object.values(themes)) {
      const surfaces = [colors.bg, colors.card, colors.searchBg];
      for (const textColor of [colors.textMuted, colors.textSecondary, colors.primaryText]) {
        for (const surface of surfaces) {
          expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio('#FFFFFF', colors.primary)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(themes.light.accent, themes.light.card)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps search filter chips at least 44 points tall', () => {
    expect(StyleSheet.flatten(homeStyles.filterChip).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('excludes unavailable forms from search but retains valid quiz exclusions', () => {
    const index = getConjugationIndex();
    expect(index.get('あれる') ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: 'ある', form: 'potential' }),
    ]));
    expect(index.get('うけられる') ?? []).toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: '受ける', form: 'passive' }),
    ]));
  });

  it('keeps the large design source outside the bundled assets directory', () => {
    expect(existsSync(join(process.cwd(), 'assets/icon-source.png'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'design/icon-source.png'))).toBe(true);
  });
});
