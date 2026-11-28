import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSpeechFeedback, stopSpeech, subscribeToSpeechFeedback } from '../utils/speech';
import { fonts, radius, spacing, useColors } from '../utils/theme';

const HEADER_HEIGHT = 56;

export default function SpeechIndicator() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const feedback = useSyncExternalStore(subscribeToSpeechFeedback, getSpeechFeedback, getSpeechFeedback);
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'inactive' || state === 'background') stopSpeech();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    scale.setValue(0.92);
    const pulse = Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true });
    pulse.start();
    return () => pulse.stop();
  }, [feedback, scale]);

  if (!feedback) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.indicator,
        {
          top: insets.top + HEADER_HEIGHT + spacing.sm,
          backgroundColor: colors.speechIndicatorBg,
          transform: [{ scale }],
        },
      ]}
    >
      <Ionicons name="volume-high" size={16} color={colors.speechIndicatorText} />
      <Text numberOfLines={1} style={[styles.text, { color: colors.speechIndicatorText }]}>
        {feedback.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    flexShrink: 1,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
});
