import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { Button } from '../components/ui/Button';
import { colors, typography, spacing, radius } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Compass size={40} color={colors.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">No encontramos esta pantalla</Text>
        <Text style={styles.text}>Puede que el enlace esté roto o que la página ya no exista.</Text>
        <Button
          title="Ir al inicio"
          onPress={() => router.replace('/')}
          size="large"
          fullWidth={false}
          style={styles.button}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xxl,
  },
  button: {
    minWidth: 200,
  },
});
