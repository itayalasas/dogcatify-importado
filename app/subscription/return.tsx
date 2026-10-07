import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SubscriptionReturnBanner } from '@/components/SubscriptionReturnBanner';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
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
  const title = scope === 'partner' ? 'Volviendo a tu cuenta de aliado' : 'Volviendo a tu suscripción';

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.text}>
          Estamos confirmando {scope === 'partner' ? 'tu suscripción de aliado' : 'tu suscripción'} y volviendo a la app.
        </Text>
        <SubscriptionReturnBanner
          scope={scope}
          status={getSingleParam(params.subscription_status)}
          message={getSingleParam(params.subscription_message)}
          style={styles.banner}
        />
        <View style={styles.actions}>
          <Button title="Abrir la app" onPress={openApp} size="large" />
          <Button
            title={scope === 'partner' ? 'Ir a suscripción de aliado' : 'Ir a mi suscripción'}
            onPress={handleGoToSubscription}
            variant="outline"
            size="large"
            style={styles.actionGap}
          />
          <Button title="Ir al inicio" onPress={handleGoToHome} variant="ghost" style={styles.actionGap} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  title: {
    marginTop: spacing.xl,
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  text: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    maxWidth: 340,
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.lg,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
  },
  actionGap: {
    marginTop: spacing.md,
  },
});
