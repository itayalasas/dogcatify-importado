import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGAL_KEY = 'dogcatify_legal_accepted';

export const setLegalAccepted = async () => {
  await AsyncStorage.setItem(LEGAL_KEY, 'true');
};

export const getLegalAccepted = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(LEGAL_KEY);
  return value === 'true';
};

export const resetLegalAcceptance = async () => {
  await AsyncStorage.removeItem(LEGAL_KEY);
};

// Keep old exports as aliases for backward compatibility
export const setTermsAccepted = setLegalAccepted;
export const setPrivacyAccepted = setLegalAccepted;
