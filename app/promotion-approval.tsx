import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Button } from '../components/ui';
import { colors, radius, shadows, spacing } from '../constants/theme';

type StatusType = 'success' | 'warning' | 'danger' | 'info';

const getFirstValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
};

const normalizeStatus = (value: string): StatusType => {
  if (value === 'success' || value === 'warning' || value === 'danger' || value === 'info') {
    return value;
  }
  return 'info';
};

export default function PromotionApprovalScreen() {
  const params = useLocalSearchParams();

  const status = normalizeStatus(getFirstValue(params.status));
  const title = getFirstValue(params.title) || 'Resultado';
  const message = getFirstValue(params.message) || 'Tu solicitud fue procesada correctamente.';
  const code = getFirstValue(params.code) || '200';

  const statusConfig = {
    success: { badge: 'Listo', bg: colors.successSoft },
    warning: { badge: 'Atención', bg: colors.warningSoft },
    danger: { badge: 'Error', bg: colors.dangerSoft },
    info: { badge: 'Información', bg: colors.infoSoft },
  }[status];

  return (
    <>
      <Stack.Screen options={{ title: 'Aprobación de promoción' }} />
      <View style={styles.screen}>
        <View style={styles.card}>
          <AppText variant="title" accessibilityRole="header">{title}</AppText>

          <Badge tone={status} label={statusConfig.badge} style={styles.badge} />

          <AppText variant="body" color="textSecondary" style={styles.message}>{message}</AppText>

          <View style={[styles.detailBox, { backgroundColor: statusConfig.bg }]}>
            <AppText variant="label" color="textSecondary">Código de respuesta: {code}</AppText>
          </View>

          <Button
            title="Ir al inicio"
            onPress={() => router.replace('/')}
            fullWidth={false}
            style={styles.button}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xxl,
    ...shadows.md,
  },
  badge: {
    marginTop: spacing.md,
  },
  message: {
    marginTop: spacing.md,
  },
  detailBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xxl,
  },
});
