import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, DollarSign, Clock, Package } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

export default function ConfigureActivitiesPage() {
  const { partnerId, businessType } = useLocalSearchParams<{ partnerId: string; businessType: string }>();
  const { currentUser } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDuration, setActivityDuration] = useState('');
  const [activityPrice, setActivityPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    
    // Fetch partner profile
    const fetchPartner = async () => {
      try {
        const partnerDoc = await getDoc(doc(db, 'partners', partnerId));
        if (partnerDoc.exists()) { 
          setPartnerProfile({ id: partnerDoc.id, ...partnerDoc.data() });
        }
      } catch (error) {
        console.error('Error fetching partner:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPartner();
  }, [partnerId]);

  const getBusinessTypeConfig = (type: string) => { 
    switch (type) {
      case 'veterinary':
        return {
          title: 'Servicios Veterinarios',
          suggestions: [
            { name: 'Consulta General', duration: 30, price: 5000 },
            { name: 'Vacunación', duration: 15, price: 3000 },
            { name: 'Cirugía Menor', duration: 60, price: 15000 },
            { name: 'Emergencia', duration: 45, price: 8000 },
            { name: 'Control de Salud', duration: 20, price: 4000 },
          ],
          categories: ['Consulta', 'Vacunación', 'Cirugía', 'Emergencia', 'Control']
        };
      case 'grooming':
        return {
          title: 'Servicios de Peluquería',
          suggestions: [
            { name: 'Baño Completo', duration: 45, price: 4000 },
            { name: 'Corte de Pelo', duration: 60, price: 6000 },
            { name: 'Corte de Uñas', duration: 15, price: 1500 },
            { name: 'Limpieza de Oídos', duration: 10, price: 1000 },
            { name: 'Desenredado', duration: 30, price: 3000 },
          ],
          categories: ['Baño', 'Corte', 'Uñas', 'Oídos', 'Completo']
        };
      case 'walking':
        return {
          title: 'Servicios de Paseo',
          suggestions: [
            { name: 'Paseo Corto (30min)', duration: 30, price: 2000 },
            { name: 'Paseo Largo (60min)', duration: 60, price: 3500 },
            { name: 'Ejercicio en Parque', duration: 45, price: 3000 },
            { name: 'Cuidado por Horas', duration: 120, price: 6000 },
            { name: 'Socialización', duration: 90, price: 4500 },
          ],
          categories: ['Paseo', 'Ejercicio', 'Cuidado', 'Socialización']
        };
      case 'boarding':
        return {
          title: 'Servicios de Pensión',
          suggestions: [
            { name: 'Hospedaje Diario', duration: 1440, price: 8000 }, // 24 hours
            { name: 'Hospedaje Nocturno', duration: 720, price: 5000 }, // 12 hours
            { name: 'Fin de Semana', duration: 2880, price: 15000 }, // 48 hours
            { name: 'Hospedaje Semanal', duration: 10080, price: 50000 }, // 7 days
          ],
          categories: ['Diario', 'Nocturno', 'Fin de semana', 'Semanal']
        };
      default:
        return {
          title: 'Actividades del Negocio',
          suggestions: [],
          categories: ['General']
        };
    }
  };

  const handleAddActivity = async () => { 
    if (!activityName.trim() || !activityDuration || !activityPrice) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      // Determine which collection to use based on business type
      const collectionName = businessType === 'shop' ? 'partnerProducts' : 'partnerServices';
      
      if (businessType === 'shop') {
        // For shop products
        const productData = {
          partnerId,
          name: activityName.trim(),
          description: activityDescription.trim() || '',
          price: parseFloat(activityPrice),
          category: selectedCategory || 'General',
          stock: parseInt(activityDuration), // Use duration field as stock for products
          isActive: true,
          createdAt: new Date(),
        };
        
        await addDoc(collection(db, 'partnerProducts'), productData);
      } else {
        // For services
        const serviceData = { 
          partnerId,
          name: activityName.trim(),
          description: activityDescription.trim() || '',
          duration: parseInt(activityDuration),
          price: parseFloat(activityPrice),
          category: selectedCategory || 'General',
          isActive: true,
          createdAt: new Date(),
        };
        
        await addDoc(collection(db, 'partnerServices'), serviceData);
      }

      Alert.alert('Éxito', `${businessType === 'shop' ? 'Producto' : 'Servicio'} agregado correctamente`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(`Error adding ${businessType === 'shop' ? 'product' : 'service'}:`, error);
      Alert.alert('Error', `No se pudo agregar el ${businessType === 'shop' ? 'producto' : 'servicio'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = (suggestion: any) => { 
    setActivityName(suggestion.name);
    setActivityDescription(`Servicio de ${suggestion.name.toLowerCase()}`);
    setActivityDuration(suggestion.duration.toString());
    setActivityPrice(suggestion.price.toString());
  };

  const config = getBusinessTypeConfig(businessType || '');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.businessInfo}>
            {partnerProfile?.logo ? (
              <Image source={{ uri: partnerProfile.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>
                  {businessType === 'veterinary' ? '🏥' : 
                   businessType === 'grooming' ? '✂️' : 
                   businessType === 'walking' ? '🚶' : 
                   businessType === 'boarding' ? '🏠' : 
                   businessType === 'shop' ? '🛍️' : '⚙️'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>Agregar Servicio</Text>
              <Text style={styles.businessName}>{partnerProfile?.businessName}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}> 
          <Text style={styles.sectionTitle}>{config.title}</Text>
          
          {config.suggestions && config.suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.suggestionsTitle}>Sugerencias:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {config.suggestions.map((suggestion, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.suggestionCard}
                    onPress={() => handleUseSuggestion(suggestion)}
                  >
                    <Text style={styles.suggestionName}>{suggestion.name}</Text>
                    <Text style={styles.suggestionDetails}>
                      {suggestion.duration}min • ${suggestion.price.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Input 
            label="Nombre del servicio *"
            placeholder="Ej: Consulta general, Baño completo..."
            value={activityName}
            onChangeText={setActivityName}
          />

          <Input
            label="Descripción" 
            placeholder="Describe brevemente el servicio..."
            value={activityDescription}
            onChangeText={setActivityDescription}
            multiline
            numberOfLines={2}
          />

          {config.categories && config.categories.length > 0 && (
            <View style={styles.categorySection}> 
              <Text style={styles.categoryLabel}>Categoría</Text>
              <View style={styles.categories}>
                {config.categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category && styles.selectedCategory
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[
                      styles.categoryText,
                      selectedCategory === category && styles.selectedCategoryText
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Input
            label={businessType === 'shop' ? "Stock disponible *" : "Duración (minutos) *"} 
            placeholder={businessType === 'shop' ? "10" : "30"}
            value={activityDuration}
            onChangeText={setActivityDuration}
            keyboardType="numeric"
            leftIcon={businessType === 'shop' 
              ? <Package size={20} color="#6B7280" /> 
              : <Clock size={20} color="#6B7280" />}
          />

          <Input
            label="Precio *" 
            placeholder="5000"
            value={activityPrice}
            onChangeText={setActivityPrice}
            keyboardType="numeric"
            leftIcon={<DollarSign size={20} color="#6B7280" />}
          />

          <View style={styles.buttonContainer}> 
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="outline"
              size="medium"
            />
            <Button
              title={`Agregar ${businessType === 'shop' ? 'Producto' : 'Servicio'}`}
              onPress={handleAddActivity}
              loading={loading}
              size="medium"
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    padding: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessInfo: { 
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  logoPlaceholder: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoPlaceholderText: { 
    fontSize: 20,
  },
  businessName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  title: { 
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formCard: { 
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  }, 
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  }, 
  suggestionCard: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
  },
  suggestionName: { 
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  suggestionDetails: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  categorySection: { 
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 8,
  }, 
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  }, 
  selectedCategory: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
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
  },
});