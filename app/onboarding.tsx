import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  Image,
  } from 'react-native';
import { router } from 'expo-router';
import {
  BarChart3,
  CalendarCheck,
  FileText,
  Heart,
  MapPin,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import {
  type AppRole,
  completeOnboarding,
  getAvailableRoles,
  resolvePostLoginRoute,
  setStoredActiveRole,
} from '../utils/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

type OnboardingVariant = {
  label: string;
  headline: string;
  subheadline: string;
  accentColor: string;
  softColor: string;
  highlights: string[];
  slides: SlideItem[];
};

const ONBOARDING_VARIANTS: Record<AppRole, OnboardingVariant> = {
  owner: {
    label: 'Usuario',
    headline: 'Tu inicio personal',
    subheadline: 'Todo lo que necesitas para cuidar a tus mascotas desde el primer día.',
    accentColor: '#2D6A6F',
    softColor: '#F0F9FF',
    highlights: ['Mascotas', 'Salud', 'Historial'],
    slides: [
      {
        id: 'owner-1',
        title: 'Registrá tus mascotas',
        description: 'Creá el perfil, sumá foto y guardá sus datos, raza, peso y edad en un solo lugar.',
        icon: <Heart size={44} color="#2D6A6F" />,
      },
      {
        id: 'owner-2',
        title: 'Recibí alertas útiles',
        description: 'La app te avisa sobre pendientes, recordatorios y próximos pasos para cada mascota.',
        icon: <ShieldCheck size={44} color="#2D6A6F" />,
      },
      {
        id: 'owner-3',
        title: 'Guardá salud e historial',
        description: 'Vacunas, tratamientos, alergias y seguimiento ordenado para compartir cuando lo necesites.',
        icon: <FileText size={44} color="#2D6A6F" />,
      },
      {
        id: 'owner-4',
        title: 'Encontrá servicios cercanos',
        description: 'Buscá veterinarias, tiendas y lugares pet-friendly sin salir de la app.',
        icon: <MapPin size={44} color="#2D6A6F" />,
      },
    ],
  },
  partner: {
    label: 'Aliado',
    headline: 'Tu inicio de negocio',
    subheadline: 'Un recorrido breve para arrancar con clientes, reservas, adopciones y métricas.',
    accentColor: '#4F46E5',
    softColor: '#EEF2FF',
    highlights: ['Clientes', 'Reservas', 'Adopciones'],
    slides: [
      {
        id: 'partner-1',
        title: 'Revisá tu dashboard',
        description: 'Mirá métricas, accesos y el estado general del negocio desde un solo lugar.',
        icon: <BarChart3 size={44} color="#4F46E5" />,
      },
      {
        id: 'partner-2',
        title: 'Trabajá clientes y retención',
        description: 'Seguimiento, reactivación y CRM para cuidar tus clientes más valiosos.',
        icon: <Users size={44} color="#4F46E5" />,
      },
      {
        id: 'partner-3',
        title: 'Gestioná reservas y agenda',
        description: 'Controlá turnos, confirmaciones y movimiento diario con más claridad.',
        icon: <CalendarCheck size={44} color="#4F46E5" />,
      },
      {
        id: 'partner-4',
        title: 'Publicá adopciones',
        description: 'Mostrá mascotas disponibles, revisá requisitos y mantené el catálogo actualizado.',
        icon: <Heart size={44} color="#4F46E5" />,
      },
    ],
  },
  admin: {
    label: 'Admin',
    headline: 'Tu centro de control',
    subheadline: 'Monitoreá la plataforma, los partners y las alertas que requieren atención.',
    accentColor: '#E11D48',
    softColor: '#FFF1F2',
    highlights: ['Partners', 'Alertas', 'Permisos'],
    slides: [
      {
        id: 'admin-1',
        title: 'Controlá la plataforma',
        description: 'Revisá métricas, actividad reciente y la salud general del ecosistema.',
        icon: <BarChart3 size={44} color="#E11D48" />,
      },
      {
        id: 'admin-2',
        title: 'Revisá partners',
        description: 'Gestioná solicitudes, estados y accesos de los negocios registrados.',
        icon: <Users size={44} color="#E11D48" />,
      },
      {
        id: 'admin-3',
        title: 'Supervisá alertas',
        description: 'Detectá pendientes, incidencias y acciones prioritarias a tiempo.',
        icon: <ShieldCheck size={44} color="#E11D48" />,
      },
      {
        id: 'admin-4',
        title: 'Ajustá permisos',
        description: 'Definí visibilidad, reglas y el comportamiento de la plataforma.',
        icon: <Settings size={44} color="#E11D48" />,
      },
    ],
  },
};

const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Usuario',
  partner: 'Aliado',
  admin: 'Admin',
};

export default function OnboardingScreen() {
  const { currentUser, activeRole, setActiveRole } = useAuth();
  const listRef = useRef<FlatList<SlideItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const availableRoles = useMemo(() => getAvailableRoles(currentUser), [currentUser]);
  const showRoleSwitcher = availableRoles.length > 1;

  const initialRole = useMemo<AppRole>(() => {
    if (activeRole && availableRoles.includes(activeRole)) {
      return activeRole;
    }

    if (availableRoles.includes('owner')) return 'owner';
    if (availableRoles.includes('partner')) return 'partner';
    if (availableRoles.includes('admin')) return 'admin';

    return 'owner';
  }, [activeRole, availableRoles]);

  const [selectedRole, setSelectedRole] = useState<AppRole>(initialRole);

  useEffect(() => {
    setSelectedRole(initialRole);
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [initialRole]);

  const activeVariant = ONBOARDING_VARIANTS[selectedRole];
  const slides = activeVariant.slides;
  const isLastSlide = currentIndex === slides.length - 1;

  const handleRoleSelect = async (role: AppRole) => {
    setSelectedRole(role);
    setActiveRole(role);
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });

    if (currentUser?.id) {
      await setStoredActiveRole(currentUser.id, role);
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(nextIndex);
  };

  const handleNext = () => {
    if (isLastSlide) {
      handleFinish();
      return;
    }

    const next = currentIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);

    let nextRoute = '/(tabs)';
    try {
      if (currentUser?.id) {
        if (showRoleSwitcher) {
          await setStoredActiveRole(currentUser.id, selectedRole);
          setActiveRole(selectedRole);
        }
        await completeOnboarding(currentUser.id);
        nextRoute = await resolvePostLoginRoute(currentUser.id, undefined, currentUser);
      }
    } catch (error) {
    }

    router.replace(nextRoute as any);
  };

  const renderItem = ({ item, index }: { item: SlideItem; index: number }) => {
    const stepLabel = `Paso ${String(index + 1).padStart(2, '0')}`;

    return (
      <View
        style={[
          styles.slide,
          {
            borderColor: `${activeVariant.accentColor}18`,
            shadowColor: activeVariant.accentColor,
          },
        ]}
      >
        <View
          style={[
            styles.slideDecorTop,
            {
              backgroundColor: activeVariant.accentColor,
            },
          ]}
        />
        <View style={styles.slideHeader}>
          <Image source={require('../assets/images/logo-transp.png')} style={styles.logo} />
          <Text
            style={[
              styles.stepBadge,
              {
                color: activeVariant.accentColor,
                backgroundColor: `${activeVariant.accentColor}12`,
              },
            ]}
          >
            {stepLabel}
          </Text>
        </View>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: `${activeVariant.accentColor}10`,
              borderColor: `${activeVariant.accentColor}20`,
            },
          ]}
        >
          {item.icon}
        </View>
        <Text style={[styles.title, { color: '#111827' }]}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeVariant.softColor }]}>
      <View style={styles.topActions}>
        <TouchableOpacity onPress={handleFinish} disabled={finishing}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <View pointerEvents="none" style={styles.decorLayer}>
        <View
          style={[
            styles.decorOrb,
            {
              top: -70,
              right: -50,
              backgroundColor: `${activeVariant.accentColor}18`,
            },
          ]}
        />
        <View
          style={[
            styles.decorOrb,
            styles.decorOrbSecondary,
            {
              bottom: 170,
              left: -70,
              backgroundColor: `${activeVariant.accentColor}10`,
            },
          ]}
        />
        <View
          style={[
            styles.decorBand,
            {
              backgroundColor: `${activeVariant.accentColor}08`,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.heroCard,
          {
            borderColor: `${activeVariant.accentColor}16`,
            shadowColor: activeVariant.accentColor,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <Text
            style={[
              styles.roleBadge,
              {
                color: activeVariant.accentColor,
                backgroundColor: `${activeVariant.accentColor}14`,
              },
            ]}
          >
            {activeVariant.label}
          </Text>
          <View
            style={[
              styles.heroKicker,
              {
                backgroundColor: `${activeVariant.accentColor}0F`,
                borderColor: `${activeVariant.accentColor}18`,
              },
            ]}
          >
            <Sparkles size={13} color={activeVariant.accentColor} />
            <Text style={[styles.heroKickerText, { color: activeVariant.accentColor }]}>
              Experiencia guiada
            </Text>
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: activeVariant.accentColor }]}>{activeVariant.headline}</Text>
        <Text style={styles.heroSubtitle}>{activeVariant.subheadline}</Text>
        <View style={styles.highlightRow}>
          {activeVariant.highlights.map((highlight) => (
            <View
              key={highlight}
              style={[
                styles.highlightChip,
                {
                  borderColor: `${activeVariant.accentColor}18`,
                  backgroundColor: `${activeVariant.accentColor}0A`,
                },
              ]}
            >
              <Text style={[styles.highlightChipText, { color: activeVariant.accentColor }]}>
                {highlight}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {showRoleSwitcher && (
        <View
          style={[
            styles.roleSwitcher,
            {
              borderColor: `${activeVariant.accentColor}14`,
              shadowColor: activeVariant.accentColor,
            },
          ]}
        >
          <Text style={styles.roleSwitcherLabel}>Elegí el rol con el que querés empezar</Text>
          <View style={styles.rolePills}>
            {availableRoles.map((role) => {
              const isSelected = selectedRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.rolePill,
                    isSelected && {
                      backgroundColor: activeVariant.accentColor,
                      borderColor: activeVariant.accentColor,
                    },
                  ]}
                  onPress={() => void handleRoleSelect(role)}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      isSelected && styles.rolePillTextActive,
                    ]}
                  >
                    {ROLE_LABELS[role]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                index === currentIndex && { backgroundColor: activeVariant.accentColor, width: 18 },
              ]}
            />
          ))}
        </View>

        <Button
          title={isLastSlide ? 'Comenzar' : 'Siguiente'}
          onPress={handleNext}
          loading={finishing}
          disabled={finishing}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  topActions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  decorOrbSecondary: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  decorBand: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 176,
    height: 1,
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  heroKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroKickerText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-SemiBold',
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  highlightChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  highlightChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-SemiBold',
  },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 4,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 28,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  roleBadge: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  roleSwitcher: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  roleSwitcherLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  rolePills: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  rolePillText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  rolePillTextActive: {
    color: '#FFFFFF',
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH - 40,
    marginHorizontal: 20,
    marginVertical: 4,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  slideDecorTop: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 0,
    height: 4,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#D1D5DB',
  },
  slideHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  stepBadge: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  logo: {
    width: 54,
    height: 54,
    resizeMode: 'contain',
    marginBottom: 0,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    paddingTop: 10,
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
});
