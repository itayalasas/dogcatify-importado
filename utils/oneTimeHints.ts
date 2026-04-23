import AsyncStorage from '@react-native-async-storage/async-storage';

const HINT_PREFIX = '@one_time_hint';
const HINT_SCHEMA_VERSION = 'v2';

const buildHintStorageKey = (hintKey: string, userId?: string | null) => {
  const resolvedUser = userId || 'guest';
  return `${HINT_PREFIX}:${HINT_SCHEMA_VERSION}:${resolvedUser}:${hintKey}`;
};

export const hasSeenHint = async (hintKey: string, userId?: string | null): Promise<boolean> => {
  try {
    const storageKey = buildHintStorageKey(hintKey, userId);
    const value = await AsyncStorage.getItem(storageKey);
    return value === 'true';
  } catch (error) {
    console.warn('Error reading hint visibility:', error);
    return false;
  }
};

export const markHintAsSeen = async (hintKey: string, userId?: string | null): Promise<void> => {
  try {
    const storageKey = buildHintStorageKey(hintKey, userId);
    await AsyncStorage.setItem(storageKey, 'true');
  } catch (error) {
    console.warn('Error storing hint visibility:', error);
  }
};
