import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { ArrowRight, X, CheckCircle } from 'lucide-react-native';
import { supabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetRoute?: string;
  action?: () => void;
  position: 'top' | 'center' | 'bottom';
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a DogCatiFy! 🐾',
    description: 'Te voy a mostrar cómo usar la aplicación. Comenzaremos creando el perfil de tu primera mascota.',
    position: 'center',
  },
  {
    id: 'pets-tab',
    title: 'Pestaña Mascotas 🐕🐈',
    description: 'Aquí puedes ver todas tus mascotas. Toca el botón "+" para agregar tu primera mascota.',
    targetRoute: '/pets',
    position: 'bottom',
  },
  {
    id: 'services-tab',
    title: 'Servicios Veterinarios 🏥',
    description: 'Encuentra veterinarias, peluquerías, entrenadores y más servicios cerca de ti.',
    position: 'bottom',
  },
  {
    id: 'shop-tab',
    title: 'Tienda 🛒',
    description: 'Compra comida, juguetes, accesorios y productos de salud para tus mascotas.',
    position: 'bottom',
  },
  {
    id: 'places-tab',
    title: 'Lugares Pet-Friendly 📍',
    description: 'Descubre parques, restaurantes y lugares donde puedes ir con tu mascota.',
    position: 'bottom',
  },
  {
    id: 'profile-tab',
    title: 'Tu Perfil 👤',
    description: 'Configura tu cuenta, actualiza tu información y gestiona tus preferencias.',
    position: 'bottom',
  },
];

interface InteractiveTourGuideProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const InteractiveTourGuide: React.FC<InteractiveTourGuideProps> = ({
  onComplete,
  onSkip,
}) => {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const handleNext = () => {
    const step = tourSteps[currentStep];

    if (step.targetRoute) {
      router.push(step.targetRoute as any);
    }

    if (step.action) {
      step.action();
    }

    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);

    if (currentUser) {
      try {
        await supabaseClient
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', currentUser.id);
      } catch (error) {
        console.error('Error updating onboarding status:', error);
      }
    }

    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[
          styles.tooltipContainer,
          step.position === 'top' && styles.tooltipTop,
          step.position === 'center' && styles.tooltipCenter,
          step.position === 'bottom' && styles.tooltipBottom,
        ]}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.stepNumber}>
                Paso {currentStep + 1} de {tourSteps.length}
              </Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleSkip}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Saltar tour</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNext}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {currentStep === tourSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
                </Text>
                {currentStep === tourSteps.length - 1 ? (
                  <CheckCircle size={18} color="#FFFFFF" />
                ) : (
                  <ArrowRight size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  tooltipTop: {
    position: 'absolute',
    top: 100,
  },
  tooltipCenter: {
    alignSelf: 'center',
  },
  tooltipBottom: {
    position: 'absolute',
    bottom: 140,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2D6A6F',
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skipButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#2D6A6F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
