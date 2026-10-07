import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import type { MoreStackParamList } from '../types/navigation';
import { useTipJar } from '../utils/tipJar';
import { useFavoritesStore } from '../store/favoritesStore';
import { useHistoryStore } from '../store/historyStore';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';
import { useFlashcardStatsStore } from '../store/flashcardStatsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';

const IOS_STORE_URL = 'https://apps.apple.com/app/id6781443990';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.piraeus.conjugojp';
const APP_VERSION = Constants.expoConfig?.version ?? 'Unknown';

export default function FeedbackScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList, 'MoreMain'>>();
  const { isDark, autoTTS, toggleTheme, toggleAutoTTS } = useThemeStore();
  const clearFavorites = useFavoritesStore(state => state.clearFavorites);
  const clearHistory = useHistoryStore(state => state.clearHistory);
  const resetQuizStats = useQuizStore(state => state.resetStats);
  const clearQuizSessions = useSessionStore(state => state.clearSessions);
  const resetFlashcardStats = useFlashcardStatsStore(state => state.resetStats);
  const clearFlashcardSessions = useFlashcardSessionStore(state => state.clearSessions);
  const resetWeights = useSpacedRepStore(state => state.resetWeights);
  const resetPracticeSettings = usePracticeSettingsStore(state => state.resetPracticeSettings);
  const {
    products,
    loading: tipLoading,
    unavailable: tipUnavailable,
    unsupported: tipUnsupported,
    tip,
  } = useTipJar();

  const handleRateApp = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL('market://details?id=com.piraeus.conjugojp');
      } catch {
        try {
          await Linking.openURL(ANDROID_STORE_URL);
        } catch {
          Alert.alert('Google Play Unavailable', 'Could not open the Google Play listing.');
        }
      }
      return;
    }

    try {
      await Linking.openURL(`${IOS_STORE_URL}?action=write-review`);
    } catch {
      Alert.alert('App Store Unavailable', 'Could not open the App Store listing.');
    }
  };

  const handleResetLearningData = () => {
    Alert.alert(
      'Reset learning data?',
      'This permanently removes favorites, search history, quiz and flashcard stats, sessions, and adaptive practice weights from this device. Practice settings return to beginner defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const operations = [
              { label: 'favorites', run: clearFavorites },
              { label: 'search history', run: clearHistory },
              { label: 'quiz stats', run: resetQuizStats },
              { label: 'quiz sessions', run: clearQuizSessions },
              { label: 'flashcard stats', run: resetFlashcardStats },
              { label: 'flashcard sessions', run: clearFlashcardSessions },
              { label: 'adaptive weights', run: resetWeights },
              { label: 'practice settings', run: resetPracticeSettings },
            ];
            const results = await Promise.allSettled(
              operations.map(operation => operation.run()),
            );
            const failed = operations.filter((_, index) => {
              const result = results[index];
              return result.status === 'rejected' || !result.value;
            });

            if (failed.length === 0) {
              Alert.alert('Learning data reset');
            } else if (failed.length === operations.length) {
              Alert.alert(
                'Reset failed',
                'No learning data was cleared. Your data is still on this device. Please try again.',
              );
            } else {
              Alert.alert(
                'Reset incomplete',
                `Some data was cleared, but these items remain: ${failed.map(item => item.label).join(', ')}. Please try again.`,
              );
            }
          },
        },
      ],
    );
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('ConjuGo JP Feedback');
    const url = `mailto:contact@piraeus.app?subject=${subject}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        'You can send feedback directly to contact@piraeus.app'
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Quiz Stats */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card, marginTop: 0 }]}
          onPress={() => navigation.navigate('Stats')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open quiz stats"
        >
          <Ionicons name="bar-chart-outline" size={24} color={colors.primaryText} style={{ marginRight: spacing.md }} />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Quiz Stats</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>View your quiz progress and streaks</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Flashcard Stats */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('FlashcardStats')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open flashcard stats"
        >
          <Ionicons name="layers-outline" size={24} color={colors.primaryText} style={{ marginRight: spacing.md }} />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Flashcard Stats</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>View your flashcard progress</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Settings section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: isDark ? colors.border : '#C5C0BA', true: colors.primary }}
              thumbColor="#fff"
              accessibilityRole="switch"
              accessibilityLabel="Dark Mode"
              accessibilityState={{ checked: isDark }}
            />
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="volume-medium-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-Play Audio</Text>
            <Switch
              value={autoTTS}
              onValueChange={toggleAutoTTS}
              trackColor={{ false: isDark ? colors.border : '#C5C0BA', true: colors.primary }}
              thumbColor="#fff"
              accessibilityRole="switch"
              accessibilityLabel="Auto-Play Audio"
              accessibilityState={{ checked: autoTTS }}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={handleResetLearningData}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reset all learning data"
        >
          <Ionicons name="trash-outline" size={22} color={colors.errorText} style={{ marginRight: spacing.md }} />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.errorText }]}>Reset Learning Data</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Clear favorites, history, progress, and adaptive weights
            </Text>
          </View>
        </TouchableOpacity>

        {/* Tip Jar */}
        {(products.length > 0 || tipUnavailable) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Tip Jar</Text>
            {products.length > 0 ? (
              <>
                <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>
                  ConjuGo JP is free with no ads. If you find it helpful, consider leaving a tip!
                </Text>
                <View style={styles.tipRow}>
                  {products.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={[styles.tipButton, { backgroundColor: colors.card, borderColor: colors.primaryText }]}
                      onPress={() => tip(product.id)}
                      disabled={tipLoading}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Leave a ${product.displayPrice} tip`}
                      accessibilityState={{ disabled: tipLoading }}
                    >
                      <Text style={[styles.tipPrice, { color: colors.primaryText }]}>{product.displayPrice}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.tipDescription, { color: colors.textMuted }]}>
                {tipUnsupported
                  ? 'Tip Jar is not available in this environment. Please use the installed app.'
                  : 'Tip Jar is temporarily unavailable on this device right now.'}
              </Text>
            )}
          </>
        )}

        {/* Support section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Support</Text>
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={handleSendEmail}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Send feedback email"
        >
          <Text style={styles.rowEmoji}>💬</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Send Feedback</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Bug reports, suggestions, missing verbs</Text>
          </View>
        </TouchableOpacity>

        {/* Rate */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={handleRateApp}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Rate ConjuGo JP on ${Platform.OS === 'android' ? 'Google Play' : 'the App Store'}`}
        >
          <Text style={styles.rowEmoji}>⭐</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Enjoying ConjuGo JP?</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Rate us on {Platform.OS === 'android' ? 'Google Play' : 'the App Store'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => {
            Share.share({
              message: `Check out ConjuGo JP — a Japanese verb conjugation app! ${
                Platform.OS === 'android' ? ANDROID_STORE_URL : IOS_STORE_URL
              }`,
            });
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share ConjuGo JP"
        >
          <Text style={styles.rowEmoji}>🔗</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Share ConjuGo JP</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Tell a friend about the app</Text>
          </View>
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => Linking.openURL('https://piraeus-technology.github.io/conjugo-jp/')}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Open privacy policy"
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.md }} />
          <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          ConjuGo JP v{APP_VERSION}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  tipDescription: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tipButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipPrice: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowEmoji: { fontSize: 32, marginRight: spacing.md },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  rowSubtitle: { fontSize: fonts.sizes.sm, marginTop: 2 },
  linkText: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  version: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
