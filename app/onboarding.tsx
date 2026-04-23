import React, { useMemo, useRef, useState } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { CalendarCheck, CreditCard, MessageCircle, MapPin } from 'lucide-react-native';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { completeOnboarding } from '../utils/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function OnboardingScreen() {
  const { currentUser } = useAuth();
  const listRef = useRef<FlatList<SlideItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const slides = useMemo<SlideItem[]>(
    () => [
      {
        id: '1',
        title: 'Reservá servicios en segundos',
        description: 'Encontrá veterinarias, peluquerías y más. Elegí horario y confirmá tu turno rápido.',
        icon: <CalendarCheck size={44} color="#2D6A6F" />,
      },
      {
        id: '2',
        title: 'Pagá de forma simple',
        description: 'Realizá pagos seguros desde la app y seguí el estado de cada compra o reserva.',
        icon: <CreditCard size={44} color="#2D6A6F" />,
      },
      {
        id: '3',
        title: 'Chateá con tiendas y servicios',
        description: 'Consultá dudas, coordiná detalles y recibí respuestas sin salir de la plataforma.',
        icon: <MessageCircle size={44} color="#2D6A6F" />,
      },
      {
        id: '4',
        title: 'Descubrí lugares pet-friendly',
        description: 'Explorá parques, locales y espacios para compartir con tu mascota todos los días.',
        icon: <MapPin size={44} color="#2D6A6F" />,
      },
    ],
    []
  );

  const isLastSlide = currentIndex === slides.length - 1;

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

    try {
      if (currentUser?.id) {
        await completeOnboarding(currentUser.id);
      }
    } catch (error) {
      console.warn('Error finishing onboarding:', error);
    } finally {
      router.replace('/(tabs)');
    }
  };

  const renderItem = ({ item }: { item: SlideItem }) => (
    <View style={styles.slide}>
      <Image source={require('../assets/images/logo-transp.png')} style={styles.logo} />
      <View style={styles.iconCircle}>{item.icon}</View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity onPress={handleFinish} disabled={finishing}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, index === currentIndex && styles.dotActive]}
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
  },
  topActions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 76,
    height: 76,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    color: '#2D6A6F',
    fontFamily: 'Inter-Bold',
    marginBottom: 14,
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
  dotActive: {
    width: 18,
    backgroundColor: '#2D6A6F',
  },
});
