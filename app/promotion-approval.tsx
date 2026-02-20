import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    success: { badge: 'OK', color: '#0f766e', bg: '#e6f4f2', border: '#4B9991' },
    warning: { badge: 'ATENCIÓN', color: '#9a3412', bg: '#fff7ed', border: '#fdba74' },
    danger: { badge: 'ERROR', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
    info: { badge: 'INFO', color: '#1d4ed8', bg: '#eef6ff', border: '#93c5fd' },
  }[status];

  return (
    <>
      <Stack.Screen options={{ title: 'Aprobación de promoción' }} />
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <View
            style={[
              styles.badge,
              { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
            ]}
          >
            <Text style={[styles.badgeText, { color: statusConfig.color }]}>{statusConfig.badge}</Text>
          </View>

          <Text style={styles.message}>{message}</Text>

          <View style={[styles.detailBox, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
            <Text style={styles.detailText}>Código de respuesta: {code}</Text>
          </View>

          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Ir al inicio</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f7f9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  detailBox: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  button: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: '#4B9991',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
