import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const getSingleParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const buildDeepLink = (params: Record<string, string | string[] | undefined>) => {
  const target = getSingleParam(params.target);
  if (target?.startsWith('dogcatify://')) {
    return target;
  }

  const url = new URL('dogcatify://profile/subscription');

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'target') return;

    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (typeof item === 'string' && item.length > 0) {
        url.searchParams.append(key, item);
      }
    });
  });

  const externalReference = getSingleParam(params.external_reference);
  if (!url.searchParams.get('subscription_id') && externalReference && isUuid(externalReference)) {
    url.searchParams.set('subscription_id', externalReference);
  }

  return url.toString();
};

export default function SubscriptionReturn() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const deepLink = useMemo(() => buildDeepLink(params), [params]);

  const openApp = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = deepLink;
        return;
      }

      await Linking.openURL(deepLink);
    } catch (error) {
      console.warn('Could not open DogCatiFy subscription deep link:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(openApp, 400);
    return () => clearTimeout(timeoutId);
  }, [deepLink]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.title}>Abriendo DogCatiFy</Text>
        <Text style={styles.text}>
          Estamos confirmando tu suscripcion y volviendo a la app.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openApp}>
          <Text style={styles.buttonText}>Abrir la app</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
  },
  text: {
    marginTop: 10,
    marginBottom: 24,
    maxWidth: 340,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
  button: {
    minWidth: 180,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
