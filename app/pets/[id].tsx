import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, Scale, Syringe, Heart, TriangleAlert as AlertTriangle, Pill, Camera, Plus, CreditCard as Edit, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function PetDetail() {
  const { id, refresh, activeTab: initialTab } = useLocalSearchParams<{ 
    id: string; 
    refresh?: string;
    activeTab?: string;
  }>();
  const { currentUser } = useAuth();
  const [pet, setPet] = useState<any>(null);
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [illnesses, setIllnesses] = useState<any[]>([]);
  const [allergies, setAllergies] = useState<any[]>([]);
  const [dewormings, setDewormings] = useState<any[]>([]);
  const [weightRecords, setWeightRecords] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'basics' | 'health' | 'albums' | 'behavior' | 'appointments'>(
    initialTab as any || 'basics'
  );

  useEffect(() => {
    fetchPetDetails();
    fetchHealthRecords();
    fetchAlbums();
  }, [id]);

  const fetchPetDetails = async () => {
    try {
      const { data: petData, error } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (petData && !error) {
        setPet({
          id: petData.id,
          ...petData
        });
      }
    } catch (error) {
      console.error('Error fetching pet details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthRecords = async () => {
    try {
      const { data: healthRecords, error } = await supabaseClient
        .from('pet_health') 
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false });
      
      if (healthRecords && !error) {
        const processedRecords = healthRecords.map(record => ({
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
          status: record.status || 'active'
        }));
      
        // Filter by type
        setVaccines(processedRecords.filter(record => record.type === 'vaccine'));
        setIllnesses(processedRecords.filter(record => record.type === 'illness'));
        setAllergies(processedRecords.filter(record => record.type === 'allergy'));
        setDewormings(processedRecords.filter(record => record.type === 'deworming'));
        setWeightRecords(processedRecords.filter(record => record.type === 'weight'));
      }
    } catch (error) {
      console.error('Error fetching health records:', error);
    }
  };

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_albums')
        .select('*')
        .eq('pet_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        // Procesar las URLs de las imágenes para asegurarse de que sean completas
        const processedAlbums = data.map(album => {
          let processedImages = album.images || [];
          if (processedImages.length > 0) {
            processedImages = processedImages.map((img: string) => {
              if (img && img.startsWith('/storage/v1/object/public/')) {
                const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
                return `${supabaseUrl}${img}`;
              }
              return img;
            });
          }
          
          return {
            ...album,
            images: processedImages,
            createdAt: new Date(album.created_at)
          };
        });
        
        setAlbums(processedAlbums);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
  };

  const handleAddVaccine = () => {
    router.push(`/pets/health/vaccines/${id}`);
  };

  const handleAddIllness = () => {
    router.push(`/pets/health/illness/${id}`);
  };

  const handleAddAllergy = () => {
    router.push(`/pets/health/allergies/${id}`);
  };

  const handleAddDeworming = () => {
    router.push(`/pets/health/deworming/${id}`);
  };
  
  const handleAddWeight = () => {
    router.push(`/pets/health/weight/${id}`);
  };

  const handleAddPhoto = () => {
    router.push(`/pets/albums/add/${id}`);
  };

  const handleBehaviorAssessment = () => {
    router.push(`/pets/behavior/${id}`);
  };

  const handleViewAppointments = () => {
    router.push(`/pets/appointments/${id}`);
  };
  
  const handleBookAppointment = () => {
    router.push('/(tabs)/services');
  };
  
  const handleUpdatePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Upload the image
        const imageUri = result.assets[0].uri;
        const filename = `pets/${id}/${Date.now()}.jpg`;
        
        // Show loading
        Alert.alert('Actualizando foto', 'Subiendo imagen...');
        
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: filename,
        } as any);

        // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
          .from('dogcatify')
          .upload(filename, formData, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
          .from('dogcatify')
          .getPublicUrl(filename);
        
        // Update pet record with new photo URL
        const { error: updateError } = await supabaseClient
          .from('pets')
          .update({ photo_url: publicUrl })
          .eq('id', id);

        if (updateError) throw updateError;
        
        // Update local state
        setPet({...pet, photo_url: publicUrl});
        
        Alert.alert('Éxito', 'Foto de perfil actualizada correctamente');
      }
    } catch (error) {
      console.error('Error updating pet photo:', error);
      Alert.alert('Error', 'No se pudo actualizar la foto de perfil');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información de la mascota...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró la mascota</Text>
          <Button title="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const renderBasicsTab = () => (
    <Card style={styles.infoCard}>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Especie:</Text>
        <Text style={styles.infoValue}>
          {pet.species === 'dog' ? '🐕 Perro' : '🐱 Gato'}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Raza:</Text>
        <Text style={styles.infoValue}>{pet.breed}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Sexo:</Text>
        <Text style={styles.infoValue}>
          {pet.gender === 'male' ? '♂️ Macho' : '♀️ Hembra'}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Edad:</Text>
        <Text style={styles.infoValue}>
          {pet.ageDisplay ? `${pet.ageDisplay.value} ${pet.ageDisplay.unit === 'years' ? 'años' : pet.ageDisplay.unit === 'months' ? 'meses' : 'días'}` : `${pet.age} años`}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Peso:</Text>
        <Text style={styles.infoValue}>
          {pet.weightDisplay ? `${pet.weightDisplay.value} ${pet.weightDisplay.unit}` : `${pet.weight} kg`}
        </Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Estado:</Text>
        <Text style={styles.infoValue}>
          {pet.isNeutered ? 'Castrado' : 'No castrado'}
        </Text>
      </View>
      
      {pet.hasChip && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Microchip:</Text>
          <Text style={styles.infoValue}>{pet.chipNumber || 'Sí'}</Text>
        </View>
      )}
    </Card>
  );

  const renderHealthTab = () => (
    <View style={styles.healthContainer}>
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Syringe size={20} color="#3B82F6" />
            <Text style={styles.healthTitle}>Vacunas</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddVaccine}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {vaccines.length === 0 ? (
          <Text style={styles.emptyText}>No hay vacunas registradas</Text>
        ) : (
          vaccines.map((vaccine) => (
            <Card key={vaccine.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>{vaccine.name}</Text>
              <Text style={styles.healthItemDate}>
                Aplicada: {vaccine.applicationDate}
              </Text>
              {vaccine.nextDueDate && (
                <Text style={styles.healthItemNextDate}>
                  Próxima: {vaccine.nextDueDate}
                </Text>
              )}
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Heart size={20} color="#EF4444" />
            <Text style={styles.healthTitle}>Enfermedades</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddIllness}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {illnesses.length === 0 ? (
          <Text style={styles.emptyText}>No hay enfermedades registradas</Text>
        ) : (
          illnesses.map((illness) => (
            <Card key={illness.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>{illness.name}</Text>
              <Text style={styles.healthItemDate}>
                Diagnóstico: {illness.diagnosisDate}
              </Text>
              {illness.treatment && (
                <Text style={styles.healthItemTreatment}>
                  Tratamiento: {illness.treatment}
                </Text>
              )}
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <AlertTriangle size={20} color="#F59E0B" />
            <Text style={styles.healthTitle}>Alergias</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddAllergy}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {allergies.length === 0 ? (
          <Text style={styles.emptyText}>No hay alergias registradas</Text>
        ) : (
          allergies.map((allergy) => (
            <Card key={allergy.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>{allergy.name}</Text>
              {allergy.symptoms && (
                <Text style={styles.healthItemSymptoms}>
                  Síntomas: {allergy.symptoms}
                </Text>
              )}
              {allergy.severity && (
                <Text style={styles.healthItemSeverity}>
                  Severidad: {allergy.severity}
                </Text>
              )}
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Pill size={20} color="#10B981" />
            <Text style={styles.healthTitle}>Desparasitaciones</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddDeworming}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {dewormings.length === 0 ? (
          <Text style={styles.emptyText}>No hay desparasitaciones registradas</Text>
        ) : (
          dewormings.map((deworming) => (
            <Card key={deworming.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>{deworming.productName}</Text>
              <Text style={styles.healthItemDate}>
                Aplicada: {deworming.applicationDate}
              </Text>
              {deworming.nextDueDate && (
                <Text style={styles.healthItemNextDate}>
                  Próxima: {deworming.nextDueDate}
                </Text>
              )}
            </Card>
          ))
        )}
      </View>
      
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <View style={styles.healthTitleContainer}>
            <Scale size={20} color="#3B82F6" />
            <Text style={styles.healthTitle}>Seguimiento de Peso</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddWeight}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {weightRecords.length === 0 ? (
          <Text style={styles.emptyText}>No hay registros de peso</Text>
        ) : (
          weightRecords.slice(0, 3).map((record) => (
            <Card key={record.id} style={styles.healthCard}>
              <Text style={styles.healthItemTitle}>
                {record.weight} {record.weight_unit}
              </Text>
              <Text style={styles.healthItemDate}>
                Fecha: {record.date}
              </Text>
              {record.notes && (
                <Text style={styles.healthItemNotes}>
                  {record.notes}
                </Text>
              )}
            </Card>
          ))
        )}
        
        {weightRecords.length > 3 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push(`/pets/health/weight/${id}`)}
          >
            <Text style={styles.viewAllText}>
              Ver todos los registros ({weightRecords.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderAlbumsTab = () => (
    <View style={styles.albumsContainer}>
      <TouchableOpacity style={styles.addAlbumButton} onPress={handleAddPhoto}>
        <Camera size={24} color="#3B82F6" />
        <Text style={styles.addAlbumText}>Agregar Fotos</Text>
      </TouchableOpacity>
      
      {albums.length === 0 ? (
        <Text style={styles.emptyAlbumsText}>No hay álbumes creados</Text>
      ) : (
        <View style={styles.albumsGrid}>
          {albums.map((album) => (
            <TouchableOpacity 
              key={album.id} 
              style={styles.albumItem}
              onPress={() => router.push(`/pets/albums/${album.id}`)}
            >
              {album.images && album.images.length > 0 ? (
                <Image source={{ uri: album.images[0] }} style={styles.albumCover} />
              ) : (
                <View style={styles.albumPlaceholder}>
                  <Camera size={24} color="#9CA3AF" />
                </View>
              )}
              <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
              <Text style={styles.albumCount}>{album.images?.length || 0} fotos</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderBehaviorTab = () => (
    <View style={styles.behaviorContainer}>
      <Card style={styles.behaviorCard}>
        <Text style={styles.behaviorTitle}>Evaluación de Comportamiento</Text>
        <Text style={styles.behaviorDescription}>
          Evalúa el comportamiento de tu mascota para entender mejor sus necesidades y personalidad.
        </Text>
        <Button
          title="Realizar Evaluación"
          onPress={handleBehaviorAssessment}
          size="medium"
        />
      </Card>
    </View>
  );

  const renderAppointmentsTab = () => (
    <View style={styles.appointmentsContainer}>
      <Card style={styles.appointmentsCard}>
        <Text style={styles.appointmentsTitle}>Historial de Citas</Text>
        <Text style={styles.appointmentsDescription}>
          Consulta el historial de citas médicas y reserva nuevas citas para tu mascota.
        </Text>
        <Button
          title="Ver Citas"
          onPress={handleViewAppointments}
          size="medium"
        />
      </Card>
    </View>
  );

  const renderBreedInfo = () => {
    if (!pet.breed_info && (!pet.breedInfo || Object.keys(pet.breedInfo).length === 0)) return null;
    
    // Use breed_info from database if available, otherwise use breedInfo
    const breedInfoData = pet.breed_info || pet.breedInfo || {};
    
    // Ensure the image URL is complete
    let breedImageUrl = breedInfoData.image_link;
    if (breedImageUrl && breedImageUrl.startsWith('/storage/v1/object/public/')) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      breedImageUrl = `${supabaseUrl}${breedImageUrl}`;
    }
    
    return (
      <Card style={styles.infoCard}>
        <Text style={styles.breedInfoTitle}>Información de la Raza</Text>
        
        {breedImageUrl && (
          <Image 
            source={{ uri: breedImageUrl }} 
            style={styles.breedImage} 
            onError={(e) => console.log('Error loading breed image:', breedImageUrl, e.nativeEvent.error)}
          />
        )}
        
        {breedInfoData.min_life_expectancy && breedInfoData.max_life_expectancy && (
          <Text style={styles.infoValue}>
            Esperanza de vida: {breedInfoData.min_life_expectancy}-{breedInfoData.max_life_expectancy} años
          </Text>
        )}
        
        {breedInfoData.energy !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de energía: {breedInfoData.energy}/5
            {breedInfoData.energy >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Necesitará mucho ejercicio)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.trainability !== undefined && (
          <Text style={styles.infoValue}>
            Facilidad de entrenamiento: {breedInfoData.trainability}/5
            {breedInfoData.trainability <= 2 && (
              <Text style={styles.breedHighlight}> (Bajo - Puede ser difícil de entrenar)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.shedding !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de muda: {breedInfoData.shedding}/5
            {breedInfoData.shedding >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Requerirá cepillado frecuente)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.barking !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de ladrido: {breedInfoData.barking}/5
            {breedInfoData.barking >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Puede ser ruidoso)</Text>
            )}
          </Text>
        )}
        
        {breedInfoData.protectiveness !== undefined && (
          <Text style={styles.infoValue}>
            Nivel de protección: {breedInfoData.protectiveness}/5
            {breedInfoData.protectiveness >= 4 && (
              <Text style={styles.breedHighlight}> (Alto - Puede ser territorial)</Text>
            )}
          </Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{pet.name}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.petProfile}>
        <TouchableOpacity onPress={handleUpdatePhoto}>
          <Image 
            source={{ uri: pet.photo_url || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }} 
            style={styles.petImage} 
            onError={(e) => console.log('Error loading pet image:', pet.photo_url, e.nativeEvent.error)}
          />
          <View style={styles.editPhotoOverlay}>
            <Camera size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <View style={styles.petInfo}>
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petBreed}>{pet.breed}</Text>
          
          <View style={styles.petStats}>
            <View style={styles.petStat}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.petStatText}>
                {pet.ageDisplay ? `${pet.ageDisplay.value} ${pet.ageDisplay.unit === 'years' ? 'años' : pet.ageDisplay.unit === 'months' ? 'meses' : 'días'}` : `${pet.age} años`}
              </Text>
            </View>
            
            <View style={styles.petStat}>
              <Scale size={16} color="#6B7280" />
              <Text style={styles.petStatText}>
                {pet.weightDisplay ? `${pet.weightDisplay.value} ${pet.weightDisplay.unit}` : `${pet.weight} kg`}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.appointmentsButton}
            onPress={handleBookAppointment}
          >
            <Calendar size={16} color="#3B82F6" />
            <Text style={styles.appointmentsButtonText}>Citas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'basics' && styles.activeTab]} 
          onPress={() => setActiveTab('basics')}
        >
          <Text style={[styles.tabText, activeTab === 'basics' && styles.activeTabText]}>
            Básicos
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'health' && styles.activeTab]} 
          onPress={() => setActiveTab('health')}
        >
          <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>
            Salud
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'albums' && styles.activeTab]}
          onPress={() => setActiveTab('albums')}
        >
          <Text style={[styles.tabText, activeTab === 'albums' && styles.activeTabText]}>
            Álbumes
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'behavior' && styles.activeTab]} 
          onPress={() => setActiveTab('behavior')}
        >
          <Text style={[styles.tabText, activeTab === 'behavior' && styles.activeTabText]}>
            Conducta
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'appointments' && styles.activeTab]} 
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.activeTabText]}>
            Citas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'basics' && (
          <>
            {renderBasicsTab()}
            {renderBreedInfo()}
          </>
        )}
        
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'albums' && renderAlbumsTab()}
        {activeTab === 'behavior' && renderBehaviorTab()}
        {activeTab === 'appointments' && renderAppointmentsTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 50, // Increased padding at the top for better spacing across devices
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  petProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  petImage: {
    width: 80,
    height: 80,
    borderRadius: 40, 
    marginRight: 16,
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  petStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  petStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  petStatText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  appointmentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  appointmentsButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
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
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    textAlign: 'right',
  },
  breedInfoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827', 
    marginBottom: 12,
  },
  breedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  breedHighlight: {
    fontFamily: 'Inter-Medium',
    color: '#EF4444',
    fontSize: 13,
  },
  healthContainer: {
    gap: 16,
    paddingTop: 10,
  },
  healthSection: {
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthCard: {
    marginBottom: 8,
    padding: 12,
  },
  healthItemTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  healthItemDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  healthItemNextDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#3B82F6',
  },
  healthItemTreatment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemSymptoms: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemSeverity: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  healthItemNotes: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
  },
  albumsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  addAlbumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignSelf: 'center',
  },
  addAlbumText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  emptyAlbumsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  albumsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  albumItem: {
    width: '48%',
    marginBottom: 16,
  },
  albumCover: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  albumPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  albumTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 2,
  },
  albumCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  behaviorContainer: {
    paddingVertical: 20,
    paddingTop: 10,
  },
  behaviorCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  behaviorTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  behaviorDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  appointmentsContainer: {
    paddingVertical: 20,
    paddingTop: 10,
  },
  appointmentsCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appointmentsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 8,
  },
  appointmentsDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
});