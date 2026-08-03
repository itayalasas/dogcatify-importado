import React, { useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SubscriptionReturnBanner } from '@/components/SubscriptionReturnBanner';
import {
  buildSubscriptionDeepLink,
  getSingleParam,
  isUuid,
  normalizeSubscriptionScope,
} from '@/utils/subscriptionReturn';

const buildDeepLink = (
  params: Record<string, string | string[] | undefined>,
  scope: 'user' | 'partner',
) => {
  return buildSubscriptionDeepLink(
    params,
    scope === 'partner' ? 'dogcatify://partner/subscription' : 'dogcatify://profile/subscription',
  );
};

const buildInternalRoute = (params: Record<string, string | string[] | undefined>) => {
  const target = getSingleParam(params.target);
  const scope = target?.includes('://partner/subscription')
    ? 'partner'
    : normalizeSubscriptionScope(params.scope ?? params.subscription_scope ?? params.account_scope);
  const routePath = scope === 'partner' ? '/partner/subscription' : '/profile/subscription';
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'target') return;

    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      const cleanValue = typeof item === 'string' ? item.trim() : '';
      if (!cleanValue) return;

      if (key === 'business_id') {
        query.set('businessId', cleanValue);
        return;
      }

      query.set(key, cleanValue);
    });
  });

  const externalReference = getSingleParam(params.external_reference);
  if (!query.get('subscription_id') && externalReference && isUuid(externalReference)) {
    query.set('subscription_id', externalReference);
  }

  if (!query.get('subscription_scope')) {
    query.set('subscription_scope', scope);
  }

  const queryString = query.toString();
  return `${routePath}${queryString ? `?${queryString}` : ''}`;
};

export default function SubscriptionReturn() {
  const params = useLocalSearchParams();
  const scope = getSingleParam(params.target)?.includes('://partner/subscription')
    ? 'partner'
    : normalizeSubscriptionScope(params.scope ?? params.subscription_scope ?? params.account_scope);
  const deepLink = useMemo(() => buildDeepLink(params, scope), [params, scope]);
  const internalRoute = useMemo(() => buildInternalRoute(params), [params]);
  const title = scope === 'partner' ? 'Retorno de aliado' : 'Retorno de suscripcion';

  const handleGoToSubscription = () => {
    router.replace(internalRoute as any);
  };

  const handleGoToHome = () => {
    router.replace('/(tabs)');
  };

  const openApp = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = deepLink;
        return;
      }

      await Linking.openURL(deepLink);
    } catch (error) {
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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>
          Estamos confirmando {scope === 'partner' ? 'tu suscripcion de aliado' : 'tu suscripcion'} y volviendo a la app.
        </Text>
        <SubscriptionReturnBanner
          scope={scope}
          status={getSingleParam(params.subscription_status)}
          message={getSingleParam(params.subscription_message)}
          style={styles.banner}
        />
        <TouchableOpacity style={styles.button} onPress={openApp}>
          <Text style={styles.buttonText}>Abrir la app</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleGoToSubscription}>
          <Text style={styles.secondaryButtonText}>
            {scope === 'partner' ? 'Ir a suscripcion de aliado' : 'Ir a mi suscripcion'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleGoToHome}>
          <Text style={styles.secondaryButtonText}>Ir al inicio</Text>
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
  banner: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 18,
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
  secondaryButton: {
    minWidth: 180,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0F766E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0F766E',
  },
});
