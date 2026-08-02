import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Sparkles, ShieldAlert, HeartPulse, ChevronRight } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';
import { formatPetAgeLabel } from '../../../utils/petCare';

export default function PetCareIndex() {
  const { currentUser } = useAuth();
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      setPets([]);
      return;
    }

    loadPets();
  }, [currentUser?.id]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('owner_id', currentUser!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPets(data || []);
    } catch (error) {
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPet = (petId: string) => {
    router.push({
      pathname: '/pets/care/[id]',
      params: { id: petId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Cuidado Inteligente</Text>
          <Text style={styles.subtitle}>Recomendaciones y emergencia, todo en un solo lugar</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Sparkles size={26} color="#2D6A6F" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Centro de cuidado para tus mascotas</Text>
              <Text style={styles.heroText}>
                Abre una mascota para ver recomendaciones personalizadas de vacunas, peso, conducta,
                alergias y un modo de emergencia con acceso rápido a su historial.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <ShieldAlert size={20} color="#DC2626" />
            <Text style={styles.featureTitle}>Modo emergencia</Text>
          </View>
          <Text style={styles.featureText}>
            Ten a mano la historia clínica, el QR para veterinarios y los datos críticos de salud
            de cada mascota.
          </Text>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.featureHeader}>
            <HeartPulse size={20} color="#10B981" />
            <Text style={styles.featureTitle}>Recomendaciones personalizadas</Text>
          </View>
          <Text style={styles.featureText}>
            El sistema usa el perfil real de cada mascota para sugerir cuidados, prevención y
            próximos pasos.
          </Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tus mascotas</Text>
          <Text style={styles.sectionCount}>{pets.length} registradas</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner message="Cargando mascotas..." size="medium" />
          </View>
        ) : pets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún no tienes mascotas registradas</Text>
            <Text style={styles.emptyText}>
              Cuando agregues tu primera mascota podrás ver recomendaciones personalizadas, alertas
              y el centro de emergencia.
            </Text>
            <Button
              title="Registrar mi primera mascota"
              onPress={() => router.push('/pets/add')}
              size="medium"
            />
          </Card>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity key={pet.id} activeOpacity={0.88} onPress={() => handleOpenPet(pet.id)}>
              <Card style={styles.petCard}>
                <View style={styles.petRow}>
                  <Image
                    source={{
                      uri:
                        pet.photo_url ||
                        'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=200',
                    }}
                    style={styles.petImage}
                  />
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petMeta}>
                      {pet.species === 'dog' ? '🐕 Perro' : '🐱 Gato'} · {pet.breed || 'Raza no disponible'}
                    </Text>
                    <Text style={styles.petMeta}>{formatPetAgeLabel(pet)}</Text>
                    <Text style={styles.petHint}>Toca para abrir el centro de cuidado</Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerCopy: {
    flex: 1,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  heroCard: {
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  heroText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  featureCard: {
    marginBottom: 12,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  loadingContainer: {
    paddingVertical: 40,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  petCard: {
    marginBottom: 12,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  petImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  petMeta: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  petHint: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginTop: 4,
  },
});
