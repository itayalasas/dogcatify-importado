import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Briefcase, CircleCheck as CheckCircle, Chrome as Home, ShieldCheck, ChevronRight } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { IconButton } from '../../components/ui/IconButton';
import { colors, typography, spacing, radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  AppRole,
  clearStoredActivePartnerBusinessId,
  getAvailableRoles,
  getStoredActiveRole,
  resolveRoleRoute,
  setStoredActiveRole,
} from '../../utils/onboarding';

type RoleOption = {
  role: AppRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
};

export default function SelectRoleScreen() {
  const { redirect, source } = useLocalSearchParams<{ redirect?: string; source?: string }>();
  const { currentUser, activeRole, setActiveRole } = useAuth();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(activeRole);

  const availableRoles = useMemo(() => getAvailableRoles(currentUser), [currentUser]);

  useEffect(() => {
    if (activeRole) {
      setSelectedRole(activeRole);
    }
  }, [activeRole]);

  useEffect(() => {
    let mounted = true;

    const loadStoredRole = async () => {
      if (!currentUser?.id) return;

      try {
        const storedRole = await getStoredActiveRole(currentUser.id);
        if (!mounted || !storedRole) return;

        if (availableRoles.includes(storedRole)) {
          setSelectedRole(storedRole);
        }
      } catch (error) {
        console.warn('Error loading stored active role:', error);
      }
    };

    void loadStoredRole();

    return () => {
      mounted = false;
    };
  }, [currentUser?.id, availableRoles]);

  const getCurrentRoleRoute = async (): Promise<string> => {
    if (!currentUser?.id) {
      return '/auth/login';
    }

    const fallbackRole =
      activeRole ??
      selectedRole ??
      (availableRoles.length === 1 ? availableRoles[0] : null);

    if (fallbackRole) {
      return resolveRoleRoute(currentUser.id, fallbackRole);
    }

    return '/(tabs)';
  };

  useEffect(() => {
    const autoRedirect = async () => {
      if (!currentUser?.id) {
        router.replace('/auth/login');
        return;
      }

      if (availableRoles.length <= 1) {
        const fallbackRole = availableRoles[0] || 'owner';
        const nextRoute = redirect
          ? String(redirect)
          : await resolveRoleRoute(currentUser.id, fallbackRole);
        router.replace(nextRoute as any);
      }
    };

    autoRedirect();
  }, [availableRoles, currentUser?.id]);

  const roleOptions = useMemo<RoleOption[]>(() => {
    const options: RoleOption[] = [];

    if (availableRoles.includes('owner')) {
      options.push({
        role: 'owner',
        title: t('ownerRoleTitle'),
        description: t('ownerRoleDescription'),
        icon: <Home size={26} color={colors.primary} />,
        accentColor: colors.primary,
        backgroundColor: colors.primarySoft,
        borderColor: colors.border,
      });
    }

    if (availableRoles.includes('partner')) {
      options.push({
        role: 'partner',
        title: t('partnerRoleTitle'),
        description: t('partnerRoleDescription'),
        icon: <Briefcase size={26} color={colors.warning} />,
        accentColor: colors.warning,
        backgroundColor: colors.accentSoft,
        borderColor: colors.border,
      });
    }

    if (availableRoles.includes('admin')) {
      options.push({
        role: 'admin',
        title: t('adminRoleTitle'),
        description: t('adminRoleDescription'),
        icon: <ShieldCheck size={26} color={colors.info} />,
        accentColor: colors.info,
        backgroundColor: colors.infoSoft,
        borderColor: colors.border,
      });
    }

    return options;
  }, [availableRoles, t]);

  const handleSelectRole = async (role: AppRole) => {
    if (!currentUser?.id) {
      router.replace('/auth/login');
      return;
    }

    setSelectedRole(role);

    try {
      await clearStoredActivePartnerBusinessId(currentUser.id);
      await setStoredActiveRole(currentUser.id, role);
      setActiveRole(role);

      const nextRoute = redirect
        ? String(redirect)
        : await resolveRoleRoute(currentUser.id, role);
      router.replace(nextRoute as any);
    } catch (error) {
      console.error('Error selecting role:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil seleccionado');
      setSelectedRole(null);
    }
  };

  const handleCancel = async () => {
    if (source === 'profile' && currentUser?.id) {
      const nextRoute = await getCurrentRoleRoute();
      router.replace(nextRoute as any);
      return;
    }

    router.replace('/auth/login');
  };

  if (!currentUser) {
    return null;
  }

  if (availableRoles.length <= 1) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton
            icon={<ArrowLeft size={24} color={colors.text} />}
            onPress={() => void handleCancel()}
            accessibilityLabel={source === 'profile' ? 'Volver a mi perfil' : 'Volver a ingresar'}
          />

          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={styles.logo}
            accessibilityLabel="DogCatiFy"
          />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title} accessibilityRole="header">{t('selectRoleTitle')}</Text>
          <Text style={styles.subtitle}>{t('selectRoleSubtitle')}</Text>
        </View>

        <View style={styles.cardsContainer}>
          {roleOptions.map((option) => {
            const isSelected = selectedRole === option.role || activeRole === option.role;

            return (
              <TouchableOpacity
                key={option.role}
                activeOpacity={0.85}
                onPress={() => handleSelectRole(option.role)}
                style={styles.cardPressable}
                accessibilityRole="button"
                accessibilityLabel={`${option.title}. ${option.description}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Card
                  style={[
                    styles.roleCard,
                    isSelected && styles.roleCardSelected,
                  ]}
                >
                  <View style={styles.roleHeader}>
                    <View style={[styles.roleIconWrapper, { backgroundColor: option.backgroundColor }]}>
                      {option.icon}
                    </View>

                    <View style={styles.roleHeaderText}>
                      <Text style={styles.roleTitle}>{option.title}</Text>
                      <Text style={styles.roleDescription}>{option.description}</Text>
                    </View>

                    {isSelected ? (
                      <CheckCircle size={22} color={colors.primary} />
                    ) : (
                      <ChevronRight size={22} color={colors.icon} />
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.note}>
          <CheckCircle size={16} color={colors.textTertiary} />
          <Text style={styles.noteText}>{t('roleSelectionSaved')}</Text>
        </View>

        <TouchableOpacity
          onPress={() => void handleCancel()}
          style={styles.cancelLink}
          accessibilityRole="link"
        >
          <Text style={styles.cancelText}>
            {source === 'profile' ? 'Volver a mi perfil' : 'Volver a ingresar'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.huge,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginLeft: -spacing.md,
  },
  headerSpacer: {
    width: 44,
  },
  logo: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  hero: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  noteText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    flexShrink: 1,
  },
  cardsContainer: {
    gap: spacing.md,
  },
  cardPressable: {
    borderRadius: radius.lg,
  },
  roleCard: {
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleHeaderText: {
    flex: 1,
  },
  roleTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  roleDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cancelLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.lg,
  },
  cancelText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
