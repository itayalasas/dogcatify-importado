import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Heart, PawPrint, Store } from 'lucide-react-native';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { completeOnboarding, resolvePostLoginRoute } from '../utils/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  accent: string;
  soft: string;
  eyebrow: string;
  title: string;
  description: string;
}

// Un recorrido único de 3 pasos para cualquier usuario nuevo (antes había 4
// pasos distintos por rol con un selector arriba, pero eso duplicaba lo que
// ya hace /auth/select-role después del login, y alargaba innecesariamente
// lo que debería ser un resumen rápido). Paso 1 y 2 cubren las dos caras de
// la app — dueños de mascotas y negocios aliados — y el paso 3 cierra con el
// CTA final, sin importar qué rol termine teniendo la cuenta.
const SLIDES: Slide[] = [
  {
    id: 'client',
    icon: Heart,
    accent: '#2D6A6F',
    soft: '#EAF6F5',
    eyebrow: 'Para tu mascota',
    title: 'Todo lo que tu mascota necesita',
    description:
      'Tienda, turnos con veterinarios, lugares pet-friendly y su carnet de salud digital, todo en un solo lugar.',
  },
  {
    id: 'partner',
    icon: Store,
    accent: '#4F46E5',
    soft: '#EEF2FF',
    eyebrow: 'Para tu negocio',
    title: '¿Tenés un negocio pet-friendly?',
    description:
      'Sumate como aliado y gestioná productos, turnos, pedidos y clientes desde la misma app.',
  },
  {
    id: 'start',
    icon: PawPrint,
    accent: '#2D6A6F',
    soft: '#EAF6F5',
    eyebrow: 'Todo listo',
    title: 'Empecemos',
    description:
      'Creá tu cuenta gratis y sumate a la comunidad que ya cuida a sus mascotas con DogCatiFy.',
  },
];

export default function OnboardingScreen() {
  const { currentUser } = useAuth();
  const listRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const activeSlide = SLIDES[currentIndex];
  const isLastSlide = currentIndex === SLIDES.length - 1;

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
        await completeOnboarding(currentUser.id);
        nextRoute = await resolvePostLoginRoute(currentUser.id, undefined, currentUser);
      }
    } catch (error) {
      console.warn('Error finishing onboarding:', error);
    }

    router.replace(nextRoute as any);
  };

  const renderItem = ({ item }: { item: Slide }) => {
    const Icon = item.icon;

    return (
      <View style={[styles.slide, { backgroundColor: item.soft }]}>
        <View pointerEvents="none" style={styles.decorLayer}>
          <View style={[styles.decorOrb, { backgroundColor: `${item.accent}14`, top: -60, right: -60 }]} />
          <View
            style={[
              styles.decorOrb,
              styles.decorOrbSmall,
              { backgroundColor: `${item.accent}0F`, bottom: 40, left: -50 },
            ]}
          />
        </View>

        <View style={styles.slideContent}>
          <View style={[styles.iconRing, { backgroundColor: `${item.accent}12` }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFFFFF', borderColor: `${item.accent}30` }]}>
              <Icon size={56} color={item.accent} strokeWidth={1.75} />
            </View>
          </View>

          <Text style={[styles.eyebrow, { color: item.accent, backgroundColor: `${item.accent}14` }]}>
            {item.eyebrow.toUpperCase()}
          </Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeSlide.soft }]}>
      <View style={styles.topActions}>
        <TouchableOpacity onPress={handleFinish} disabled={finishing} hitSlop={12}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.carousel}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                index === currentIndex && { backgroundColor: activeSlide.accent, width: 20 },
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
          style={{ backgroundColor: activeSlide.accent }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topActions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(17, 24, 39, 0.45)',
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
  },
  decorLayer: {
    ...StyleSheet.absoluteFill,
  },
  decorOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  decorOrbSmall: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconRing: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#4B5563',
    fontFamily: 'Inter-Regular',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    gap: 18,
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
    backgroundColor: 'rgba(17, 24, 39, 0.15)',
  },
});
