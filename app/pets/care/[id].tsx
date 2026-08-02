import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  HeartPulse,
  Syringe,
  Scale,
  TriangleAlert as AlertTriangle,
  Pill,
  Calendar,
  ChevronRight,
  Share2,
} from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseClient } from '../../../lib/supabase';
import { envConfig } from '../../../utils/envConfig';
import {
  formatPetAgeLabel,
  getLatestWeightRecord,
  getPetAgeInMonths,
  getWeightRange,
  getWeightStatus,
  formatWeightLabel,
} from '../../../utils/petCare';
import { generateSecureMedicalHistoryUrl } from '../../../utils/medicalHistoryTokens';

type RecommendationState = {
  vaccines: any[];
  allergies: any[];
  illnesses: any[];
  treatments: any[];
  weightTips: string[];
  behaviorTips: string[];
};

const emptyRecommendations: RecommendationState = {
  vaccines: [],
  allergies: [],
  illnesses: [],
  treatments: [],
  weightTips: [],
  behaviorTips: [],
};

export default function PetCareDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();

  const [pet, setPet] = useState<any>(null);
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [illnesses, setIllnesses] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [dewormings, setDewormings] = useState<any[]>([]);
  const [weightRecords, setWeightRecords] = useState<any[]>([]);
  const [medicalAlerts, setMedicalAlerts] = useState<any[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationState>(emptyRecommendations);
  const [loading, setLoading] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sharingHistory, setSharingHistory] = useState(false);

  useEffect(() => {
    if (id && currentUser?.id) {
      loadPetCareHub();
    } else {
      setLoading(false);
    }
  }, [id, currentUser?.id]);

  const loadPetCareHub = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [
        { data: petData, error: petError },
        { data: healthData, error: healthError },
        { data: alertsData, error: alertsError },
        { data: behaviorData, error: behaviorError },
      ] = await Promise.all([
        supabaseClient.from('pets').select('*').eq('id', id).single(),
        supabaseClient
          .from('pet_health')
          .select('*')
          .eq('pet_id', id)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('medical_alerts')
          .select('*')
          .eq('pet_id', id)
          .eq('status', 'pending')
          .order('due_date', { ascending: true }),
        supabaseClient
          .from('pet_behavior')
          .select('*')
          .eq('pet_id', id)
          .order('assessment_date', { ascending: false }),
      ]);

      if (petError) throw petError;

      if (!petData) {
        setPet(null);
        setRecommendations(emptyRecommendations);
        return;
      }

      const processedRecords = (healthData || []).map((record: any) => ({
        ...record,
        createdAt: new Date(record.created_at || Date.now()),
        name: record.name || record.product_name || 'Sin nombre',
        applicationDate: record.application_date || '',
        diagnosisDate: record.diagnosis_date || '',
        nextDueDate: record.next_due_date || '',
        productName: record.product_name || '',
        symptoms: record.symptoms || '',
        severity: record.severity || '',
        treatment: record.treatment || '',
        veterinarian: record.veterinarian || '',
        status: record.status || 'active',
      }));

      if (healthError) {
      }
      if (alertsError) {
      }
      if (behaviorError) {
      }

      const vaccinesData = processedRecords.filter((record: any) => record.type === 'vaccine');
      const illnessesData = processedRecords.filter((record: any) => record.type === 'illness');
      const allergiesData = processedRecords.filter((record: any) => record.type === 'allergy');
      const dewormingsData = processedRecords.filter((record: any) => record.type === 'deworming');
      const weightData = processedRecords.filter((record: any) => record.type === 'weight');

      setPet(petData);
      setVaccines(vaccinesData);
      setIllnesses(illnessesData);
      setAllergies(allergiesData);
      setDewormings(dewormingsData);
      setWeightRecords(weightData);
      setMedicalAlerts(alertsData || []);
      setBehaviorHistory(behaviorData || []);

      await loadRecommendations({
        pet: petData,
        vaccines: vaccinesData,
        illnesses: illnessesData,
        allergies: allergiesData,
        dewormings: dewormingsData,
        weightRecords: weightData,
        behaviorRecords: behaviorData || [],
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el centro de cuidado');
    } finally {
      setLoading(false);
    }
  };

  const callEdgeFunction = async (functionName: string, payload: any) => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Debes iniciar sesión nuevamente');
    }

    const response = await fetch(
      `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error invoking ${functionName}`);
    }

    return response.json();
  };

  const loadRecommendations = async ({
    pet: petData,
    vaccines: vaccineRecords,
    illnesses: illnessRecords,
    allergies: allergyRecords,
    dewormings: dewormingRecords,
    weightRecords: currentWeightRecords,
    behaviorRecords,
  }: {
    pet: any;
    vaccines: any[];
    illnesses: any[];
    allergies: any[];
    dewormings: any[];
    weightRecords: any[];
    behaviorRecords: any[];
  }) => {
    setLoadingRecommendations(true);

    try {
      const ageInMonths = getPetAgeInMonths(petData);
      const safeAgeInMonths = ageInMonths ?? 12;
      const latestWeight = getLatestWeightRecord(currentWeightRecords);
      const currentWeight = latestWeight?.weight !== undefined ? Number(latestWeight.weight) : petData?.weight !== undefined ? Number(petData.weight) : undefined;
      const idealRange = getWeightRange(petData);
      const weightStatusInfo = getWeightStatus(currentWeight, idealRange);
      const weightUnit = latestWeight?.weight_unit || petData?.weight_display?.unit || petData?.weightDisplay?.unit || 'kg';

      const sortedWeightRecords = [...currentWeightRecords].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      );
      const previousWeight =
        sortedWeightRecords.length > 1 ? Number(sortedWeightRecords[sortedWeightRecords.length - 2]?.weight) : undefined;
      const weightTrend =
        previousWeight !== undefined && currentWeight !== undefined
          ? currentWeight > previousWeight
            ? 'increasing'
            : currentWeight < previousWeight
              ? 'decreasing'
              : 'stable'
          : 'stable';
      const weightDifference =
        previousWeight !== undefined && currentWeight !== undefined
          ? Math.abs(currentWeight - previousWeight)
          : undefined;

      const latestBehavior = behaviorRecords?.[0];
      const latestIllness = illnessRecords?.[0];

      const requests = [
        callEdgeFunction('generate-vaccine-recommendations', {
          species: petData.species,
          ageInMonths: safeAgeInMonths,
          breed: petData.breed,
        }),
        callEdgeFunction('generate-allergy-recommendations', {
          species: petData.species,
          breed: petData.breed,
          ageInMonths: safeAgeInMonths,
          weight: currentWeight,
        }),
        callEdgeFunction('generate-illness-recommendations', {
          species: petData.species,
          breed: petData.breed,
          ageInMonths: safeAgeInMonths,
          weight: currentWeight,
        }),
      ];

      if (currentWeight !== undefined) {
        requests.push(
          callEdgeFunction('generate-weight-advice', {
            petName: petData.name,
            species: petData.species,
            breed: petData.breed,
            gender: petData.gender,
            ageMonths: safeAgeInMonths,
            currentWeight,
            weightUnit,
            weightStatus: weightStatusInfo.status,
            idealMin: idealRange?.min,
            idealMax: idealRange?.max,
            weightTrend,
            weightDifference,
          }),
        );
      }

      if (latestBehavior?.traits?.length > 0) {
        requests.push(
          callEdgeFunction('generate-behavior-recommendations', {
            petName: petData.name,
            species: petData.species,
            breed: petData.breed,
            age: petData.age,
            weight: currentWeight,
            traits: latestBehavior.traits,
            breedInfo: petData.breed_info || petData.breedInfo,
          }),
        );
      }

      if (latestIllness?.name) {
        requests.push(
          callEdgeFunction('generate-treatment-recommendations', {
            species: petData.species,
            illnessName: latestIllness.name,
            ageInMonths: safeAgeInMonths,
            weight: currentWeight,
          }),
        );
      }

      const results = await Promise.allSettled(requests);
      const [vaccinesResult, allergiesResult, illnessesResult, weightResult, behaviorResult, treatmentResult] = results;

      const nextRecommendations: RecommendationState = {
        vaccines:
          vaccinesResult?.status === 'fulfilled' && Array.isArray(vaccinesResult.value?.vaccines)
            ? vaccinesResult.value.vaccines
            : buildFallbackVaccineTips(petData),
        allergies:
          allergiesResult?.status === 'fulfilled' && Array.isArray(allergiesResult.value?.allergies)
            ? allergiesResult.value.allergies
            : buildFallbackAllergyTips(petData),
        illnesses:
          illnessesResult?.status === 'fulfilled' && Array.isArray(illnessesResult.value?.illnesses)
            ? illnessesResult.value.illnesses
            : buildFallbackIllnessTips(petData),
        treatments:
          treatmentResult?.status === 'fulfilled' && Array.isArray(treatmentResult.value?.treatments)
            ? treatmentResult.value.treatments
            : buildFallbackTreatmentTips(latestIllness?.name),
        weightTips:
          weightResult?.status === 'fulfilled' && Array.isArray(weightResult.value?.tips)
            ? weightResult.value.tips
            : buildFallbackWeightTips(weightStatusInfo.status, currentWeight, idealRange, weightUnit),
        behaviorTips:
          behaviorResult?.status === 'fulfilled' && Array.isArray(behaviorResult.value?.recommendations)
            ? behaviorResult.value.recommendations
            : buildFallbackBehaviorTips(latestBehavior?.traits),
      };

      setRecommendations(nextRecommendations);
    } catch (error) {
      setRecommendations({
        vaccines: buildFallbackVaccineTips(petData),
        allergies: buildFallbackAllergyTips(petData),
        illnesses: buildFallbackIllnessTips(petData),
        treatments: buildFallbackTreatmentTips(illnessRecords?.[0]?.name),
        weightTips: buildFallbackWeightTips(
          getWeightStatus(
            currentWeightRecords?.[0]?.weight !== undefined ? Number(currentWeightRecords[0].weight) : undefined,
            getWeightRange(petData),
          ).status,
          currentWeightRecords?.[0]?.weight !== undefined ? Number(currentWeightRecords[0].weight) : undefined,
          getWeightRange(petData),
          currentWeightRecords?.[0]?.weight_unit || petData?.weight_display?.unit || 'kg',
        ),
        behaviorTips: buildFallbackBehaviorTips(behaviorRecords?.[0]?.traits),
      });
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const buildFallbackVaccineTips = (petData: any) => {
    const label = petData?.species === 'cat' ? 'felinas' : 'caninas';
    return [
      {
        name: `Vacunas esenciales ${label}`,
        fullName: 'Vacunas preventivas principales',
        description: 'Revisa con tu veterinario el calendario de vacunas esenciales y refuerzos',
        frequency: 'Según calendario veterinario',
        isEssential: true,
        notes: 'Ideal para mantener al día la protección preventiva',
      },
    ];
  };

  const buildFallbackAllergyTips = (petData: any) => {
    return [
      {
        name: `Vigila alergias en ${petData?.name || 'tu mascota'}`,
        description: 'Picazón, enrojecimiento o digestión sensible pueden ser señales de alerta',
        allergy_type: 'Contacto / Alimentaria',
        severity: 'moderate',
        frequency: 'Común',
        symptoms: ['Picazón', 'Enrojecimiento', 'Estornudos'],
        triggers: ['Alimentos nuevos', 'Pasto', 'Productos de limpieza'],
        prevention_tips: ['Introduce cambios de dieta de forma gradual', 'Observa reacciones después de paseos o comidas'],
      },
    ];
  };

  const buildFallbackIllnessTips = (petData: any) => {
    return [
      {
        name: `Monitorea cambios en ${petData?.name || 'tu mascota'}`,
        description: 'Si cambia el apetito, energía o digestión, registra los síntomas y consulta',
        category: 'Preventiva',
        severity: 'medium',
        symptoms: ['Pérdida de apetito', 'Decaimiento', 'Vómitos o diarrea'],
        is_contagious: false,
        affected_systems: ['digestivo', 'general'],
      },
    ];
  };

  const buildFallbackTreatmentTips = (illnessName?: string) => {
    if (!illnessName) return [];

    return [
      {
        name: `Tratamiento indicado para ${illnessName}`,
        description: 'Sigue el plan de tu veterinario y no suspendas medicación antes de tiempo',
        type: 'Cuidado veterinario',
        requires_prescription: true,
        dosage: 'Según prescripción veterinaria',
        duration: 'Según evolución clínica',
        side_effects: ['Vigila apetito', 'Observa tolerancia digestiva'],
      },
    ];
  };

  const buildFallbackWeightTips = (
    status: 'underweight' | 'ideal' | 'overweight' | 'unknown',
    currentWeight?: number,
    idealRange?: { min: number; max: number; unit: string } | null,
    unit: string = 'kg',
  ) => {
    if (status === 'underweight') {
      return [
        `Tu mascota está por debajo del rango ideal${currentWeight !== undefined ? ` (${formatWeightLabel(currentWeight, unit)})` : ''}.`,
        idealRange ? `El rango estimado es ${idealRange.min} - ${idealRange.max} ${idealRange.unit}.` : 'Consulta al veterinario antes de aumentar calorías.',
        'Haz cambios graduales y prioriza una dieta de alta calidad.',
      ];
    }

    if (status === 'overweight') {
      return [
        `Tu mascota está por encima del rango ideal${currentWeight !== undefined ? ` (${formatWeightLabel(currentWeight, unit)})` : ''}.`,
        'Reduce snacks, controla porciones y sube la actividad de forma gradual.',
        'Evita dietas bruscas: el objetivo es bajar peso de forma segura.',
      ];
    }

    if (status === 'ideal') {
      return [
        'El peso se ve dentro de un rango saludable.',
        'Mantén una rutina estable de alimentación y actividad física.',
        'Pesa a tu mascota periódicamente para detectar cambios a tiempo.',
      ];
    }

    return [
      'Agrega un registro de peso para poder calcular recomendaciones más precisas.',
      'Tener el peso actualizado mejora mucho la calidad de las recomendaciones.',
    ];
  };

  const buildFallbackBehaviorTips = (traits: any[] = []) => {
    if (!traits || traits.length === 0) {
      return ['Realiza una primera evaluación de conducta para tener una línea base.'];
    }

    const topTrait = [...traits].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    return [
      `La evaluación más reciente muestra foco en ${topTrait?.name || 'comportamiento general'}.`,
      'Repite evaluaciones para ver la evolución y detectar cambios a tiempo.',
      'Usa refuerzo positivo y rutinas consistentes en casa.',
    ];
  };

  const handleShareHistory = async () => {
    if (!pet || !currentUser?.id) return;

    setSharingHistory(true);
    try {
      const secureUrlResult = await generateSecureMedicalHistoryUrl(pet.id, currentUser.id);

      if (!secureUrlResult.success || !secureUrlResult.url || !secureUrlResult.token) {
        throw new Error(secureUrlResult.error || 'No se pudo generar el enlace seguro');
      }

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(secureUrlResult.url)}&format=png&margin=20&ecc=M&color=2D6A6F&bgcolor=FFFFFF`;
      const shortUrl = `dogcatify.com/vet/${secureUrlResult.token.slice(-8)}`;

      router.push({
        pathname: '/pets/share-medical-history',
        params: {
          petId: pet.id,
          petName: pet.name,
          qrCodeUrl,
          shareUrl: secureUrlResult.url,
          shortUrl,
          token: secureUrlResult.token,
          expiresAt: secureUrlResult.expiresAt?.toISOString(),
        },
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar el enlace seguro');
    } finally {
      setSharingHistory(false);
    }
  };

  const handleOpenMedicalHistory = () => {
    if (!pet?.id) return;

    router.push(`/medical-history/${pet.id}`);
  };

  const handleBackToPet = () => {
    if (!pet?.id) return;

    router.push({
      pathname: '/pets/[id]',
      params: { id: pet.id, activeTab: 'health' },
    });
  };

  const latestWeight = getLatestWeightRecord(weightRecords);
  const currentWeight = latestWeight?.weight !== undefined ? Number(latestWeight.weight) : pet?.weight !== undefined ? Number(pet.weight) : undefined;
  const idealRange = getWeightRange(pet);
  const weightUnit = latestWeight?.weight_unit || pet?.weight_display?.unit || pet?.weightDisplay?.unit || 'kg';
  const weightStatus = getWeightStatus(currentWeight, idealRange);
  const ageLabel = formatPetAgeLabel(pet);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D6A6F" />
          <Text style={styles.loadingText}>Cargando centro de cuidado...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No se encontró la mascota</Text>
          <Button title="Volver" onPress={() => router.back()} size="medium" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToPet} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Cuidado Inteligente</Text>
          <Text style={styles.subtitle}>{pet.name}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.petHeroCard}>
          <View style={styles.petHeroRow}>
            <Image
              source={{
                uri:
                  pet.photo_url ||
                  'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=200',
              }}
              style={styles.petImage}
            />
            <View style={styles.petHeroInfo}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petMeta}>
                {pet.species === 'dog' ? '🐕 Perro' : '🐱 Gato'} · {pet.breed || 'Raza no disponible'}
              </Text>
              <Text style={styles.petMeta}>{ageLabel}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.emergencyCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <ShieldAlert size={20} color="#DC2626" />
              <Text style={styles.sectionTitle}>Modo emergencia</Text>
            </View>
            <Text style={styles.sectionBadge}>Acceso rápido</Text>
          </View>

          <View style={styles.emergencyGrid}>
            <View style={styles.emergencyMetric}>
              <Text style={styles.emergencyMetricValue}>{vaccines.length}</Text>
              <Text style={styles.emergencyMetricLabel}>Vacunas</Text>
            </View>
            <View style={styles.emergencyMetric}>
              <Text style={styles.emergencyMetricValue}>{allergies.length}</Text>
              <Text style={styles.emergencyMetricLabel}>Alergias</Text>
            </View>
            <View style={styles.emergencyMetric}>
              <Text style={styles.emergencyMetricValue}>{medicalAlerts.length}</Text>
              <Text style={styles.emergencyMetricLabel}>Alertas</Text>
            </View>
            <View style={styles.emergencyMetric}>
              <Text style={styles.emergencyMetricValue}>{formatWeightLabel(currentWeight, weightUnit)}</Text>
              <Text style={styles.emergencyMetricLabel}>Peso</Text>
            </View>
          </View>

          <View style={styles.emergencyActions}>
            <Button
              title="Ver historia clínica"
              onPress={handleOpenMedicalHistory}
              size="medium"
            />
            <Button
              title={sharingHistory ? 'Generando QR...' : 'Compartir QR'}
              onPress={handleShareHistory}
              size="medium"
              variant="outline"
              disabled={sharingHistory}
            />
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <HeartPulse size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Resumen inteligente</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillLabel}>Peso</Text>
              <Text style={styles.summaryPillValue}>
                {weightStatus.status === 'unknown'
                  ? 'Sin dato'
                  : weightStatus.status === 'ideal'
                    ? 'Ideal'
                    : weightStatus.status === 'underweight'
                      ? 'Bajo'
                      : 'Alto'}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillLabel}>Alertas</Text>
              <Text style={styles.summaryPillValue}>{medicalAlerts.length}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillLabel}>Condiciones</Text>
              <Text style={styles.summaryPillValue}>{illnesses.length}</Text>
            </View>
          </View>

          {weightStatus.status !== 'unknown' && (
            <Text style={styles.summaryText}>
              {weightStatus.status === 'ideal'
                ? 'El peso está dentro de un rango saludable. Mantén la rutina.'
                : weightStatus.status === 'underweight'
                  ? `Está por debajo del rango ideal${idealRange ? ` (${idealRange.min}-${idealRange.max} ${idealRange.unit})` : ''}.`
                  : `Está por encima del rango ideal${idealRange ? ` (${idealRange.min}-${idealRange.max} ${idealRange.unit})` : ''}.`}
            </Text>
          )}
        </Card>

        <Card style={styles.recommendationsCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Sparkles size={20} color="#2D6A6F" />
              <Text style={styles.sectionTitle}>Recomendaciones personalizadas</Text>
            </View>
            {loadingRecommendations && <ActivityIndicator size="small" color="#2D6A6F" />}
          </View>

          {!loadingRecommendations && (
            <Text style={styles.sectionSubtitle}>
              La app ajusta estas sugerencias según el historial y el perfil real de {pet.name}.
            </Text>
          )}

          {renderRecommendationObjectSection('Vacunas preventivas', recommendations.vaccines, '#3B82F6', (item) => (
            <>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemText}>{item.fullName || item.description}</Text>
              {item.frequency && <Text style={styles.itemMeta}>Frecuencia: {item.frequency}</Text>}
              {item.isEssential && <Text style={styles.itemMeta}>Esencial</Text>}
            </>
          ))}

          {renderRecommendationObjectSection('Alergias a vigilar', recommendations.allergies, '#F59E0B', (item) => (
            <>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemText}>{item.description}</Text>
              {Array.isArray(item.prevention_tips) && item.prevention_tips.length > 0 && (
                <Text style={styles.itemMeta}>{item.prevention_tips[0]}</Text>
              )}
            </>
          ))}

          {renderRecommendationObjectSection('Enfermedades a monitorear', recommendations.illnesses, '#EF4444', (item) => (
            <>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemText}>{item.description}</Text>
              {Array.isArray(item.symptoms) && item.symptoms.length > 0 && (
                <Text style={styles.itemMeta}>Síntomas: {item.symptoms.slice(0, 3).join(', ')}</Text>
              )}
            </>
          ))}

          {renderRecommendationObjectSection('Tratamientos relacionados', recommendations.treatments, '#8B5CF6', (item) => (
            <>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemText}>{item.description}</Text>
              <Text style={styles.itemMeta}>{item.dosage || 'Según prescripción veterinaria'}</Text>
            </>
          ))}

          {renderRecommendationStringSection('Peso y nutrición', recommendations.weightTips, '#10B981')}
          {renderRecommendationStringSection('Conducta y bienestar', recommendations.behaviorTips, '#0EA5E9')}
        </Card>

        <Card style={styles.quickActionsCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Calendar size={20} color="#2D6A6F" />
              <Text style={styles.sectionTitle}>Acciones rápidas</Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() =>
                router.push({
                  pathname: '/pets/health/vaccines/[id]',
                  params: { id },
                })
              }
            >
              <Syringe size={20} color="#3B82F6" />
              <Text style={styles.quickActionText}>Agregar vacuna</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() =>
                router.push({
                  pathname: '/pets/health/weight/[id]',
                  params: { id },
                })
              }
            >
              <Scale size={20} color="#10B981" />
              <Text style={styles.quickActionText}>Registrar peso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() =>
                router.push({
                  pathname: '/pets/behavior/[id]',
                  params: { id },
                })
              }
            >
              <HeartPulse size={20} color="#8B5CF6" />
              <Text style={styles.quickActionText}>Evaluar conducta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() =>
                router.push({
                  pathname: '/pets/health/select-allergy',
                  params: {
                    petId: id,
                    species: pet.species,
                    breed: pet.breed || '',
                    ageInMonths: String(getPetAgeInMonths(pet) ?? 12),
                    weight: String(currentWeight ?? ''),
                    returnPath: `/pets/health/allergies/${id}`,
                  },
                })
              }
            >
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={styles.quickActionText}>Registrar alergia</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.viewDetailLink} onPress={handleBackToPet}>
            <Text style={styles.viewDetailLinkText}>Volver al perfil de la mascota</Text>
            <ChevronRight size={16} color="#2D6A6F" />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );

  function renderRecommendationObjectSection(
    title: string,
    items: any[],
    accentColor: string,
    renderItem: (item: any) => React.ReactNode,
  ) {
    if (!items || items.length === 0) return null;

    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionBlockHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionBlockTitle}>{title}</Text>
        </View>

        {items.slice(0, 3).map((item, index) => (
          <View key={`${title}-${index}`} style={styles.recommendationItemCard}>
            {renderItem(item)}
          </View>
        ))}
      </View>
    );
  }

  function renderRecommendationStringSection(title: string, items: string[], accentColor: string) {
    if (!items || items.length === 0) return null;

    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionBlockHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionBlockTitle}>{title}</Text>
        </View>

        {items.slice(0, 4).map((item, index) => (
          <View key={`${title}-${index}`} style={styles.recommendationItemCard}>
            <Text style={styles.bulletItem}>• {item}</Text>
          </View>
        ))}
      </View>
    );
  }
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  petHeroCard: {
    marginBottom: 14,
  },
  petHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  petImage: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  petHeroInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
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
  emergencyCard: {
    marginBottom: 14,
  },
  summaryCard: {
    marginBottom: 14,
  },
  recommendationsCard: {
    marginBottom: 14,
  },
  quickActionsCard: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  sectionBadge: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emergencyMetric: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emergencyMetricValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  emergencyMetricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emergencyActions: {
    marginTop: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  summaryPill: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryPillLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  summaryPillValue: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  summaryText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 19,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionAccent: {
    width: 8,
    height: 18,
    borderRadius: 999,
  },
  sectionBlockTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  recommendationItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#475569',
    lineHeight: 19,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  bulletItem: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#334155',
    lineHeight: 19,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
    minHeight: 86,
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginTop: 8,
  },
  viewDetailLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewDetailLinkText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
});
