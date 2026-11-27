import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getTodayKey } from '../utils/dayKey';

export function useTodayKey(): string {
  const navigation = useNavigation();
  const [, setDay] = useState(getTodayKey);

  useEffect(() => {
    const refresh = () => setDay(getTodayKey());
    const unsubscribe = navigation.addListener('focus', refresh);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [navigation]);

  return getTodayKey();
}
