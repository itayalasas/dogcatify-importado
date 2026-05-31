import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Briefcase, CircleCheck as CheckCircle, Chrome as Home, ShieldCheck } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppRole, getAvailableRoles, getStoredActiveRole, resolveRoleRoute, setStoredActiveRole } from '../../utils/onboarding';

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
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
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
        icon: <Home size={28} color="#2D6A6F" />,
        accentColor: '#2D6A6F',
        backgroundColor: '#F0FDFA',
        borderColor: '#CCFBF1',
      });
    }

    if (availableRoles.includes('partner')) {
      options.push({
        role: 'partner',
        title: t('partnerRoleTitle'),
        description: t('partnerRoleDescription'),
        icon: <Briefcase size={28} color="#7C3AED" />,
        accentColor: '#7C3AED',
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
      });
    }

    if (availableRoles.includes('admin')) {
      options.push({
        role: 'admin',
        title: t('adminRoleTitle'),
        description: t('adminRoleDescription'),
        icon: <ShieldCheck size={28} color="#DC2626" />,
        accentColor: '#DC2626',
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
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

  const handleBackToLogin = () => {
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
          <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>

          <Image
            source={require('../../assets/images/logo-transp.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>{t('selectRoleTitle')}</Text>
          <Text style={styles.subtitle}>{t('selectRoleSubtitle')}</Text>
        </View>

        <View style={styles.note}>
          <CheckCircle size={18} color="#2D6A6F" />
          <Text style={styles.noteText}>{t('roleSelectionSaved')}</Text>
        </View>

        <View style={styles.cardsContainer}>
          {roleOptions.map((option) => {
            const isSelected = selectedRole === option.role || activeRole === option.role;

            return (
              <TouchableOpacity
                key={option.role}
                activeOpacity={0.88}
                onPress={() => handleSelectRole(option.role)}
                style={styles.cardPressable}
              >
                <Card
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: option.backgroundColor,
                      borderColor: isSelected ? option.accentColor : option.borderColor,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.roleHeader}>
                    <View style={styles.roleIconWrapper}>
                      {option.icon}
                    </View>

                    <View style={styles.roleHeaderText}>
                      <Text style={styles.roleTitle}>{option.title}</Text>
                      <Text style={styles.roleDescription}>{option.description}</Text>
                    </View>
                  </View>

                  <View style={styles.roleFooter}>
                    <Text style={[styles.roleActionText, { color: option.accentColor }]}>
                      {isSelected ? 'Seleccionado' : 'Elegir perfil'}
                    </Text>
                    <View style={[styles.roleActionDot, { backgroundColor: option.accentColor }]} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.cancelLink}>
          <Text style={styles.cancelText}>Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  logo: {
    width: 76,
    height: 76,
    resizeMode: 'contain',
  },
  hero: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 20,
  },
  noteText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#0F766E',
  },
  cardsContainer: {
    gap: 14,
  },
  cardPressable: {
    borderRadius: 20,
  },
  roleCard: {
    borderRadius: 20,
    padding: 18,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  roleIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleHeaderText: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
  },
  roleFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleActionText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  roleActionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 22,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});
