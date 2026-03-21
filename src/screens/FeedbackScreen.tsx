import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';

export default function FeedbackScreen() {
  const colors = useColors();
  const [message, setMessage] = useState('');

  const handleSendEmail = () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please write your feedback before sending.');
      return;
    }

    const subject = encodeURIComponent('ConjuGo JP Feedback');
    const body = encodeURIComponent(message);
    const url = `mailto:contact@piraeus.app?subject=${subject}&body=${body}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        'Could not open your email app. You can send feedback directly to contact@piraeus.app'
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>💬</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>We'd Love Your Feedback</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Found a bug? Have a suggestion? Missing a verb? Let us know!
          </Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.divider }]}
            placeholder="Write your feedback here..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: message.trim() ? '#43A047' : colors.pillBg },
            ]}
            onPress={handleSendEmail}
            disabled={!message.trim()}
          >
            <Ionicons
              name="send"
              size={18}
              color={message.trim() ? '#FFFFFF' : colors.textMuted}
            />
            <Text
              style={[
                styles.sendText,
                { color: message.trim() ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              Send Feedback
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  header: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg },
  headerEmoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold, marginTop: spacing.md },
  subtitle: {
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  inputCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    fontSize: fonts.sizes.md,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 22,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: 8,
  },
  sendText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.semibold },
});
