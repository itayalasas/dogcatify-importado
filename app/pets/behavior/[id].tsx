import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/ui/Card';
import { envConfig } from '../../../utils/envConfig';
import { Button } from '../../../components/ui/Button';
import { Save, Sparkles, PawPrint } from 'lucide-react-native';
import { ScreenHeader, EmptyState, Skeleton, toast } from '../../../components/ui';

import { colors, radius, spacing, typography } from '../../../constants/theme';
interface Pet {
  id: string;
  name: string;
  breed: string;
  breed_info?: any;
  species?: 'dog' | 'cat';
  age?: number;
  weight?: number;
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
  { name: 'Independencia', description: 'Capacidad de estar solo' },
];

const dogSpecificTraits = [
  { name: 'Ladrido', description: 'Frecuencia e intensidad de ladridos' },
];

const catSpecificTraits = [
  { name: 'Maullido', description: 'Frecuencia e intensidad de maullidos' },
  { name: 'Arañado', description: 'Tendencia a arañar muebles u objetos' },
];

export default function PetBehaviorAssessment() {
  const { id } = useLocalSearchParams();
  const { currentUser } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [traits, setTraits] = useState<BehaviorTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [useAI, setUseAI] = useState(false);

  useEffect(() => {
    fetchPetData();
  }, [id]);

  const fetchPetData = async () => {
    try {
      const { data: petData, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();

      if (petError) throw petError;

      setPet(petData);

      // Fetch existing behavior assessment
      const { data: behaviorData, error: behaviorError } = await supabaseClient
        .from('pet_behavior')
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (behaviorError && behaviorError.code !== 'PGRST116') {
        throw behaviorError;
      }

      // Get species-specific traits
      const speciesSpecificTraits = petData.species === 'cat' ? catSpecificTraits : dogSpecificTraits;
      const allTraits = [...behaviorTraits, ...speciesSpecificTraits];

      // Initialize traits with breed info if available
      const initialTraits = allTraits.map(trait => {
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

          const isCat = petData.species === 'cat';
          const isDog = petData.species === 'dog';

          switch (trait.name) {
            case 'Energía':
              if (isDog && breedInfo.energy) {
                score = normalizeValue(breedInfo.energy);
              } else if (isCat && breedInfo.playfulness) {
                score = normalizeValue(breedInfo.playfulness);
              }
              break;
            case 'Sociabilidad':
              if (breedInfo.family_friendly) {
                score = normalizeValue(breedInfo.family_friendly);
              }
              break;
            case 'Entrenabilidad':
              if (isDog && breedInfo.trainability) {
                score = normalizeValue(breedInfo.trainability);
              } else if (isCat && breedInfo.intelligence) {
                score = normalizeValue(breedInfo.intelligence);
              }
              break;
            case 'Agresividad':
              // Inversa de "family_friendly" y "children_friendly"
              if (breedInfo.family_friendly && breedInfo.children_friendly) {
                const avg = (breedInfo.family_friendly + breedInfo.children_friendly) / 2;
                score = Math.max(1, 6 - normalizeValue(avg)); // Invertir escala
              }
              break;
            case 'Ansiedad':
              // Para gatos, usar independencia como inversa
              if (isCat && breedInfo.other_pets_friendly) {
                score = normalizeValue(breedInfo.other_pets_friendly);
              } else {
                score = 3; // Default moderate
              }
              break;
            case 'Protección':
              if (isDog && breedInfo.protectiveness) {
                score = normalizeValue(breedInfo.protectiveness);
              } else if (isCat && breedInfo.stranger_friendly) {
                // Para gatos, usar como inversa de protección
                score = Math.max(1, 6 - normalizeValue(breedInfo.stranger_friendly));
              }
              break;
            case 'Independencia':
              if (isCat && breedInfo.stranger_friendly) {
                score = normalizeValue(breedInfo.stranger_friendly);
              } else {
                score = 3; // Default moderate
              }
              break;
            case 'Ladrido':
              if (isDog && breedInfo.barking_level) {
                score = normalizeValue(breedInfo.barking_level);
              }
              break;
            case 'Maullido':
              if (isCat && breedInfo.meowing) {
                score = normalizeValue(breedInfo.meowing);
              }
              break;
            case 'Arañado':
              if (isCat && breedInfo.grooming) {
                // Usar grooming como proxy para arañado
                score = normalizeValue(breedInfo.grooming);
              }
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
    // Reset AI recommendations when traits change
    if (useAI && aiRecommendations.length > 0) {
      setAiRecommendations([]);
    }
  };

  const generateAIRecommendations = async () => {
    if (!pet) return;

    setLoadingAI(true);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Tenés que iniciar sesión');
        return;
      }

      const response = await fetch(
        `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/generate-behavior-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            petName: pet.name,
            species: pet.species,
            breed: pet.breed,
            age: pet.age,
            weight: pet.weight,
            traits: traits,
            breedInfo: pet.breed_info,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al generar recomendaciones');
      }

      const data = await response.json();
      setAiRecommendations(data.recommendations);
      setUseAI(true);
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      Alert.alert(
        'Error',
        'No se pudieron generar recomendaciones con IA. Usando recomendaciones predeterminadas.'
      );
      setUseAI(false);
    } finally {
      setLoadingAI(false);
    }
  };

  const getRecommendations = () => {
    const recommendations: string[] = [];
    const breedInfo = pet?.breed_info;
    const isCat = pet?.species === 'cat';
    const isDog = pet?.species === 'dog';

    // Energy level recommendations
    const energyTrait = traits.find(t => t.name === 'Energía');
    if (energyTrait) {
      if (energyTrait.score >= 4) {
        recommendations.push(
          isCat
            ? '🎯 Necesita sesiones de juego interactivo 2-3 veces al día (15-20 min cada una)'
            : '🎯 Requiere ejercicio intenso diario: caminatas largas, correr o deportes caninos'
        );
        recommendations.push(
          isCat
            ? '🧩 Proporciona juguetes tipo puzzle y rompecabezas para estimulación mental'
            : '🧩 Considera actividades como agility, frisbee o natación'
        );
      } else if (energyTrait.score <= 2) {
        recommendations.push(
          isCat
            ? '😴 Prefiere sesiones de juego cortas (5-10 min) y espacios tranquilos para descansar'
            : '😴 Paseos cortos y tranquilos son suficientes (15-20 min, 2-3 veces al día)'
        );
      } else {
        recommendations.push(
          isCat
            ? '⚖️ Nivel de energía moderado: juegos regulares y tiempo de descanso equilibrado'
            : '⚖️ Nivel de energía moderado: paseos diarios de 30-45 minutos'
        );
      }
    }

    // Sociability recommendations
    const socialTrait = traits.find(t => t.name === 'Sociabilidad');
    if (socialTrait) {
      if (socialTrait.score >= 4) {
        recommendations.push(
          isCat
            ? '👨‍👩‍👧 Excelente para familias: disfruta la compañía y puede convivir con otros gatos'
            : '👨‍👩‍👧 Ideal para familias activas y socialización frecuente con personas y otros perros'
        );
        recommendations.push('🎉 Puede participar en eventos sociales y disfrutar visitas de invitados');
      } else if (socialTrait.score <= 2) {
        recommendations.push('⚠️ Requiere socialización gradual y supervisada en ambientes nuevos');
        recommendations.push('🏠 Mejor en hogares tranquilos con pocas visitas o sin otras mascotas');
      } else {
        recommendations.push('👥 Sociabilidad moderada: presenta nuevas personas/mascotas gradualmente');
      }
    }

    // Training recommendations
    const trainTrait = traits.find(t => t.name === 'Entrenabilidad');
    if (trainTrait) {
      if (trainTrait.score >= 4) {
        recommendations.push(
          isCat
            ? '🎓 Alta capacidad de aprendizaje: ideal para entrenamiento con clicker y trucos'
            : '🎓 Excelente para entrenamiento avanzado: obediencia, trucos complejos y tareas'
        );
      } else if (trainTrait.score <= 2) {
        recommendations.push(
          isCat
            ? '💝 Requiere paciencia: usa refuerzo positivo constante con premios de alto valor'
            : '💝 Necesita métodos de refuerzo positivo muy consistentes y sesiones cortas'
        );
      }
    }

    // Aggression management
    const aggressionTrait = traits.find(t => t.name === 'Agresividad');
    if (aggressionTrait && aggressionTrait.score >= 4) {
      recommendations.push('⚠️ IMPORTANTE: Consulta con un etólogo o entrenador profesional certificado');
      recommendations.push('🚫 Manejo cuidadoso: evita situaciones estresantes y mantén rutinas predecibles');
    }

    // Anxiety management
    const anxietyTrait = traits.find(t => t.name === 'Ansiedad');
    if (anxietyTrait) {
      if (anxietyTrait.score >= 4) {
        recommendations.push(
          isCat
            ? '😰 Alta ansiedad: proporciona escondites seguros y feromonas calmantes (Feliway)'
            : '😰 Considera técnicas de desensibilización y consulta con veterinario sobre ansiedad'
        );
        recommendations.push('🎵 Música relajante y rutinas consistentes pueden ayudar a reducir el estrés');
      } else if (anxietyTrait.score <= 2) {
        recommendations.push('😌 Buen manejo del estrés: mascota equilibrada emocionalmente');
      }
    }

    // Independence recommendations
    const independenceTrait = traits.find(t => t.name === 'Independencia');
    if (independenceTrait) {
      if (independenceTrait.score >= 4) {
        recommendations.push(
          isCat
            ? '🗝️ Muy independiente: tolera bien estar solo, proporciona enriquecimiento ambiental'
            : '🗝️ Puede estar solo por períodos moderados sin desarrollar ansiedad por separación'
        );
      } else if (independenceTrait.score <= 2) {
        recommendations.push('❤️ Necesita compañía constante: considera otra mascota o cuidador diurno');
      }
    }

    // Species-specific behavioral recommendations
    if (isCat) {
      const meowTrait = traits.find(t => t.name === 'Maullido');
      if (meowTrait && meowTrait.score >= 4) {
        recommendations.push('🗣️ Muy vocal: establece rutinas claras para evitar maullidos excesivos por demanda');
      }

      const scratchTrait = traits.find(t => t.name === 'Arañado');
      if (scratchTrait && scratchTrait.score >= 4) {
        recommendations.push('🪵 Necesita múltiples rascadores en áreas estratégicas y protección de muebles');
        recommendations.push('💅 Corta uñas regularmente y considera protectores de uñas si es necesario');
      }
    } else if (isDog) {
      const barkTrait = traits.find(t => t.name === 'Ladrido');
      if (barkTrait && barkTrait.score >= 4) {
        recommendations.push('🔊 Ladrido frecuente: entrena comando "Silencio" y aborda causas subyacentes');
        recommendations.push('🏘️ Considera el impacto en vecinos y trabaja con entrenador si es necesario');
      }
    }

    // Grooming recommendations based on breed
    if (breedInfo) {
      if (breedInfo.shedding && breedInfo.shedding >= 4) {
        recommendations.push(
          isCat
            ? '🧹 Alta muda: cepillado diario obligatorio y considera dieta para salud del pelaje'
            : '🧹 Muda abundante: cepillado diario necesario y aspirado frecuente del hogar'
        );
      }
      if (breedInfo.grooming && breedInfo.grooming >= 4) {
        recommendations.push(
          isCat
            ? '✂️ Pelaje demandante: grooming profesional cada 6-8 semanas recomendado'
            : '✂️ Necesita grooming profesional cada 4-6 semanas para mantener pelaje saludable'
        );
      }
    }

    // Overall wellness recommendations
    if (recommendations.length < 3) {
      recommendations.push('✅ Comportamiento equilibrado: mantén rutinas consistentes y chequeos veterinarios regulares');
    }

    return recommendations;
  };

  const saveAssessment = async () => {
    if (!currentUser || !pet) return;

    setSaving(true);
    try {
      const assessmentData = {
        pet_id: pet.id,
        user_id: currentUser.id,
        traits: traits,
        assessment_date: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('pet_behavior')
        .insert(assessmentData);

      if (error) throw error;

      toast.success('Evaluación de comportamiento guardada correctamente');
      router.push({
        pathname: '/pets/[id]',
        params: { id: pet.id, refresh: 'true', activeTab: 'behavior' }
      });
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
        <ScreenHeader title="Evaluación de comportamiento" onBack={() => router.back()} />
        <View style={styles.skeletonWrap} accessibilityLabel="Cargando evaluación">
          <Skeleton height={96} borderRadius={16} />
          <Skeleton height={140} borderRadius={16} style={styles.skeletonGap} />
          <Skeleton height={140} borderRadius={16} style={styles.skeletonGap} />
        </View>
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Evaluación de comportamiento" onBack={() => router.back()} />
        <EmptyState
          icon={<PawPrint size={32} color={colors.primary} />}
          title="No encontramos esta mascota"
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Evaluación de comportamiento" onBack={() => router.back()} />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

      <Card style={styles.petInfo}>
        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petBreed}>{pet.breed}</Text>
        {pet.breed_info && (
          <View style={styles.breedInfo}>
            <Text style={styles.breedInfoTitle}>Información de la raza:</Text>
            {/* Para perros */}
            {pet.species === 'dog' && pet.breed_info.energy && (
              <Text style={styles.breedInfoItem}>
                Energía: {pet.breed_info.energy}/5
              </Text>
            )}
            {pet.species === 'dog' && pet.breed_info.trainability && (
              <Text style={styles.breedInfoItem}>
                Entrenabilidad: {pet.breed_info.trainability}/5
              </Text>
            )}
            {/* Para gatos */}
            {pet.species === 'cat' && pet.breed_info.playfulness && (
              <Text style={styles.breedInfoItem}>
                Juguetón: {pet.breed_info.playfulness}/5
              </Text>
            )}
            {pet.species === 'cat' && pet.breed_info.intelligence && (
              <Text style={styles.breedInfoItem}>
                Inteligencia: {pet.breed_info.intelligence}/5
              </Text>
            )}
            {/* Común para ambos */}
            {pet.breed_info.shedding && pet.breed_info.shedding >= 4 && (
              <Text style={[styles.breedInfoItem, styles.highlight]}>
                ⚠️ Alta muda - Requiere cepillado frecuente
              </Text>
            )}
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Evaluá el comportamiento</Text>
      <Text style={styles.sectionSubtitle}>
        Calificá cada aspecto del 1 al 5 según tu experiencia con {pet.name}
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
                  accessibilityRole="radio"
                  accessibilityLabel={`${trait.name}: ${score} de 5`}
                  accessibilityState={{ selected: trait.score === score }}
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
        <View style={styles.recommendationsHeader}>
          <Text style={styles.recommendationsTitle}>Recomendaciones personalizadas</Text>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={generateAIRecommendations}
            disabled={loadingAI}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Generar recomendaciones con IA para ${pet.name}`}
          >
            {loadingAI ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Sparkles size={14} color="white" style={styles.aiButtonIcon} />
                <Text style={styles.aiButtonText}>Evaluar {pet.name}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {loadingAI && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.success} />
            <Text style={styles.loadingText}>Generando recomendaciones personalizadas con IA...</Text>
          </View>
        )}

        {!loadingAI && (useAI && aiRecommendations.length > 0 ? aiRecommendations : getRecommendations()).map((recommendation, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}

        {useAI && aiRecommendations.length > 0 && (
          <View style={styles.aiLabel}>
            <Sparkles size={14} color={colors.success} />
            <Text style={styles.aiLabelText}>Generado con IA</Text>
          </View>
        )}
      </Card>

      <View style={styles.saveContainer}>
        <Button
          title="Guardar evaluación"
          onPress={saveAssessment}
          loading={saving}
          icon={<Save size={20} color="white" />}
          size="large"
        />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  scroll: {
    flex: 1,
  },
  skeletonWrap: {
    padding: spacing.lg,
  },
  skeletonGap: {
    marginTop: spacing.md,
  },
  petInfo: {
    margin: spacing.lg,
    marginBottom: spacing.lg,
  },
  petName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petBreed: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  breedInfo: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  breedInfoTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  breedInfoItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  highlight: {
    color: colors.danger,
    fontFamily: 'Inter-Medium',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  traitsContainer: {
    paddingHorizontal: spacing.lg,
  },
  traitCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  traitName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  traitDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  scoreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  scoreButtonActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  scoreText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: colors.textSecondary,
  },
  scoreTextActive: {
    color: colors.white,
  },
  traitScoreBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
  },
  traitScoreBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  recommendationsCard: {
    margin: spacing.lg,
    marginTop: spacing.sm,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  recommendationsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginRight: spacing.md,
    flex: 1,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: 6,
  },
  aiButtonIcon: {
    marginRight: spacing.xs,
  },
  aiButtonText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  aiLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.success,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  recommendationBullet: {
    fontSize: 16,
    color: colors.success,
    marginRight: 10,
    marginTop: spacing.xxs,
  },
  recommendationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  saveContainer: {
    padding: spacing.xxl,
    paddingBottom: 60,
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
});
