import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react-native';

interface Pet {
  id: string;
  name: string;
  breed: string;
  breed_info?: any;
}

interface BehaviorTrait {
  name: string;
  score: number;
  description: string;
}

const behaviorTraits = [
  { name: 'Energía', description: 'Nivel de actividad y energía' },
  { name: 'Sociabilidad', description: 'Interacción con otros animales y personas' },
  { name: 'Entrenabilidad', description: 'Facilidad para aprender comandos' },
  { name: 'Agresividad', description: 'Tendencia a mostrar comportamiento agresivo' },
  { name: 'Ansiedad', description: 'Nivel de estrés y ansiedad' },
  { name: 'Protección', description: 'Instinto protector hacia la familia' },
  { name: 'Ladrido', description: 'Frecuencia e intensidad de ladridos' },
  { name: 'Independencia', description: 'Capacidad de estar solo' },
];

export default function PetBehaviorAssessment() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [traits, setTraits] = useState<BehaviorTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPetData();
  }, [id]);

  const fetchPetData = async () => {
    try {
      const { data: petData, error: petError } = await supabase
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();

      if (petError) throw petError;

      setPet(petData);

      // Fetch existing behavior assessment
      const { data: behaviorData, error: behaviorError } = await supabase
        .from('pet_behavior')
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (behaviorError && behaviorError.code !== 'PGRST116') {
        throw behaviorError;
      }

      // Initialize traits with breed info if available
      const initialTraits = behaviorTraits.map(trait => {
        let score = 3; // Default score
        
        // Pre-fill based on breed info if available
        if (petData.breed_info) {
          const breedInfo = petData.breed_info;
          
          // Normalize breed info values to 1-5 scale
          const normalizeValue = (value: any) => {
            if (typeof value === 'number') {
              return Math.max(1, Math.min(5, Math.round(value)));
            }
            if (typeof value === 'string') {
              const num = parseInt(value);
              return isNaN(num) ? 3 : Math.max(1, Math.min(5, num));
            }
            return 3;
          };

          switch (trait.name) {
            case 'Energía':
              if (breedInfo.energy_level) score = normalizeValue(breedInfo.energy_level);
              break;
            case 'Entrenabilidad':
              if (breedInfo.trainability) score = normalizeValue(breedInfo.trainability);
              break;
            case 'Protección':
              if (breedInfo.protectiveness) score = normalizeValue(breedInfo.protectiveness);
              break;
            case 'Ladrido':
              if (breedInfo.barking_level) score = normalizeValue(breedInfo.barking_level);
              break;
          }
        }

        // Use existing assessment if available
        if (behaviorData && behaviorData.length > 0) {
          const existingTrait = behaviorData[0].traits.find((t: any) => t.name === trait.name);
          if (existingTrait) {
            score = existingTrait.score;
          }
        }

        return {
          name: trait.name,
          score,
          description: trait.description,
        };
      });

      setTraits(initialTraits);
    } catch (error) {
      console.error('Error fetching pet data:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la mascota');
    } finally {
      setLoading(false);
    }
  };

  const updateTraitScore = (traitName: string, score: number) => {
    setTraits(prev => prev.map(trait => 
      trait.name === traitName ? { ...trait, score } : trait
    ));
  };

  const getRecommendations = () => {
    const recommendations = [];
    const breedInfo = pet?.breed_info;

    // Energy level recommendations
    const energyTrait = traits.find(t => t.name === 'Energía');
    if (energyTrait && energyTrait.score >= 4) {
      recommendations.push('Necesita ejercicio diario intenso y actividades estimulantes');
    } else if (energyTrait && energyTrait.score <= 2) {
      recommendations.push('Prefiere actividades tranquilas y paseos cortos');
    }

    // Sociability recommendations
    const socialTrait = traits.find(t => t.name === 'Sociabilidad');
    if (socialTrait && socialTrait.score >= 4) {
      recommendations.push('Excelente para familias y socialización con otros animales');
    } else if (socialTrait && socialTrait.score <= 2) {
      recommendations.push('Requiere socialización gradual y supervisada');
    }

    // Training recommendations
    const trainTrait = traits.find(t => t.name === 'Entrenabilidad');
    if (trainTrait && trainTrait.score >= 4) {
      recommendations.push('Ideal para entrenamientos avanzados y trucos complejos');
    } else if (trainTrait && trainTrait.score <= 2) {
      recommendations.push('Requiere paciencia y métodos de entrenamiento positivos');
    }

    // Breed-specific recommendations
    if (breedInfo) {
      if (breedInfo.shedding_level && breedInfo.shedding_level >= 4) {
        recommendations.push('Requiere cepillado frecuente debido a alta muda');
      }
      if (breedInfo.grooming_frequency && breedInfo.grooming_frequency >= 4) {
        recommendations.push('Necesita cuidado profesional regular del pelaje');
      }
    }

    return recommendations;
  };

  const saveAssessment = async () => {
    if (!user || !pet) return;

    setSaving(true);
    try {
      const assessmentData = {
        pet_id: pet.id,
        user_id: user.id,
        traits: traits,
        assessment_date: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('pet_behavior')
        .insert(assessmentData);

      if (error) throw error;

      Alert.alert('Éxito', 'Evaluación de comportamiento guardada correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving assessment:', error);
      Alert.alert('Error', 'No se pudo guardar la evaluación');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.container}>
        <Text>No se encontró la mascota</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Evaluación de Comportamiento</Text>
      </View>

      <Card style={styles.petInfo}>
        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petBreed}>{pet.breed}</Text>
        {pet.breed_info && (
          <View style={styles.breedInfo}>
            <Text style={styles.breedInfoTitle}>Información de la Raza:</Text>
            {pet.breed_info.energy_level && (
              <Text style={styles.breedInfoItem}>
                Energía: {pet.breed_info.energy_level}/5
              </Text>
            )}
            {pet.breed_info.trainability && (
              <Text style={styles.breedInfoItem}>
                Entrenabilidad: {pet.breed_info.trainability}/5
              </Text>
            )}
            {pet.breed_info.shedding_level && pet.breed_info.shedding_level >= 4 && (
              <Text style={[styles.breedInfoItem, styles.highlight]}>
                ⚠️ Alta muda - Requiere cepillado frecuente
              </Text>
            )}
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Evalúa el Comportamiento</Text>
      <Text style={styles.sectionSubtitle}>
        Califica cada aspecto del 1 al 5 según tu experiencia con {pet.name}
      </Text>

      <View style={styles.traitsContainer}>
        {traits.map((trait, index) => (
          <Card key={index} style={styles.traitCard}>
            <Text style={styles.traitName}>{trait.name}</Text>
            <Text style={styles.traitDescription}>{trait.description}</Text>
            
            <View style={styles.scoreContainer}>
              {[1, 2, 3, 4, 5].map((score) => (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.scoreButton,
                    trait.score === score && styles.scoreButtonActive,
                  ]}
                  onPress={() => updateTraitScore(trait.name, score)}
                >
                  <Text
                    style={[
                      styles.scoreText,
                      trait.score === score && styles.scoreTextActive,
                    ]}
                  >
                    {score}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.traitScoreBar}>
              <View
                style={[
                  styles.traitScoreBarFill,
                  { width: `${(trait.score / 5) * 100}%` },
                ]}
              />
            </View>
          </Card>
        ))}
      </View>

      <Card style={styles.recommendationsCard}>
        <Text style={styles.recommendationsTitle}>Recomendaciones Personalizadas</Text>
        {getRecommendations().map((recommendation, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.saveContainer}>
        <Button
          title="Guardar Evaluación"
          onPress={saveAssessment}
          loading={saving}
          icon={<Save size={20} color="white" />}
          size="large"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  petInfo: {
    margin: 20,
    marginBottom: 10,
  },
  petName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  petBreed: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  breedInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  breedInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  breedInfoItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  highlight: {
    color: '#ff6b35',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  traitsContainer: {
    paddingHorizontal: 20,
  },
  traitCard: {
    marginBottom: 15,
  },
  traitName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  traitDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scoreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  scoreButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  scoreTextActive: {
    color: 'white',
  },
  traitScoreBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  traitScoreBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  recommendationsCard: {
    margin: 20,
    marginTop: 10,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 8,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  saveContainer: {
    padding: 20,
  },
});