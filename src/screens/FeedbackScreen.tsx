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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import type { MoreStackParamList } from '../types/navigation';

const APP_VERSION = '1.0.0';

export default function FeedbackScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList, 'MoreMain'>>();
  const { isDark, toggleTheme } = useThemeStore();

  const handleRateApp = () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/app/conjugo-jp', // TODO: update with real App Store ID
      android: 'market://details?id=com.piraeus.conjugojp',
      default: 'https://apps.apple.com/app/conjugo-jp',
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Not Available Yet', 'Rating will be available once the app is on the App Store.');
    });
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
          <Ionicons name="bar-chart-outline" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
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
          <Ionicons name="layers-outline" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
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
        </View>

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
          accessibilityLabel="Rate ConjuGo JP on the App Store"
        >
          <Text style={styles.rowEmoji}>⭐</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Enjoying ConjuGo JP?</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Rate us on the App Store</Text>
          </View>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => {
            Share.share({
              message: 'Check out ConjuGo JP — a Japanese verb conjugation app!',
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
