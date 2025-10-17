import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building, Camera, MapPin, Phone, Mail, FileText, ChevronDown, Check } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';

const businessTypes = [
  { id: 'veterinary', name: 'Veterinaria', icon: '🏥', description: 'Servicios médicos para mascotas' },
  { id: 'grooming', name: 'Peluquería', icon: '✂️', description: 'Servicios de estética y cuidado' },
  { id: 'walking', name: 'Paseador', icon: '🚶', description: 'Servicios de paseo y ejercicio' },
  { id: 'boarding', name: 'Pensión', icon: '🏠', description: 'Hospedaje temporal para mascotas' },
  { id: 'shop', name: 'Tienda', icon: '🛍️', description: 'Venta de productos para mascotas' },
  { id: 'shelter', name: 'Refugio', icon: '🐾', description: 'Adopción y rescate de mascotas' },
];

export default function EditBusiness() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { currentUser } = useAuth();
  
  // Form state
  const [businessName, setBusinessName] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [newLogoSelected, setNewLogoSelected] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  // Location state
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [showDepartmentSuggestions, setShowDepartmentSuggestions] = useState(false);
  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  const [barrio, setBarrio] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  
  // UI state
  const [countries, setCountries] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<any[]>([]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<any[]>([]);
  const [showGeocodingResults, setShowGeocodingResults] = useState(false);

  // IVA state
  const [ivaRate, setIvaRate] = useState('0');
  const [ivaIncludedInPrice, setIvaIncludedInPrice] = useState(false);

  useEffect(() => {
    if (businessId) {
      loadBusinessData();
      loadCountries();
    }
  }, [businessId]);

  const loadBusinessData = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setBusinessName(data.business_name || '');
        setSelectedType(data.business_type || '');
        setDescription(data.description || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setLogo(data.logo);
        setCalle(data.calle || '');
        setNumero(data.numero || '');
        setBarrio(data.barrio || '');
        setCodigoPostal(data.codigo_postal || '');
        setLatitud(data.latitud || '');
        setLongitud(data.longitud || '');
        setIvaRate(data.iva_rate?.toString() || '0');
        setIvaIncludedInPrice(data.iva_included_in_price || false);

        // Load country and department if they exist
        if (data.country_id) {
          const { data: countryData } = await supabaseClient
            .from('countries')
            .select('*')
            .eq('id', data.country_id)
            .single();
          
          if (countryData) {
            setSelectedCountry(countryData);
            await loadDepartments(countryData.id);
          }
        }
        
        if (data.department_id) {
          const { data: departmentData } = await supabaseClient
            .from('departments')
            .select('*')
            .eq('id', data.department_id)
            .single();
          
          if (departmentData) {
            setSelectedDepartment(departmentData);
            setDepartmentQuery(departmentData.name);
          }
        }
      }
    } catch (error) {
      console.error('Error loading business data:', error);
      Alert.alert('Error', 'No se pudo cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('countries')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCountries(data || []);
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadDepartments = async (countryId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('departments')
        .select('*')
        .eq('country_id', countryId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      setDepartments(data || []);
      setFilteredDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const handleCountrySelect = async (country: any) => {
    setSelectedCountry(country);
    setSelectedDepartment(null);
    setDepartmentQuery('');
    setShowCountryModal(false);
    await loadDepartments(country.id);
  };

  const handleDepartmentSelect = (department: any) => {
    setSelectedDepartment(department);
    setDepartmentQuery(department.name);
    setShowDepartmentSuggestions(false);
  };

  const handleDepartmentInputChange = (text: string) => {
    setDepartmentQuery(text);
    
    if (text.trim()) {
      const filtered = departments.filter(dept =>
        dept.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredDepartments(filtered);
      setShowDepartmentSuggestions(true);
    } else {
      setFilteredDepartments(departments);
      setShowDepartmentSuggestions(false);
      setSelectedDepartment(null);
    }
    
    const exactMatch = departments.find(dept => 
      dept.name.toLowerCase() === text.toLowerCase()
    );
    if (exactMatch && selectedDepartment?.id !== exactMatch.id) {
      setSelectedDepartment(exactMatch);
    } else if (!exactMatch && selectedDepartment) {
      setSelectedDepartment(null);
    }
  };

  const performGeocoding = async () => {
    if (!calle.trim() || !numero.trim() || !selectedDepartment || !selectedCountry) {
      Alert.alert('Información incompleta', 'Por favor completa calle, número, departamento y país para buscar la ubicación');
      return;
    }

    setIsGeocoding(true);
    setGeocodingResults([]);
    setShowGeocodingResults(false);

    try {
      const query = `${calle.trim()}+${numero.trim()}+${selectedDepartment.name}+${selectedCountry.name}`;
      const nominatimBaseUrl = process.env.EXPO_PUBLIC_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
      const searchUrl = `${nominatimBaseUrl}/search?q=${query}&format=json&limit=4&addressdetails=1`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'DogCatiFy/1.0 (contact@dogcatify.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`Error en la API de geocodificación: ${response.status}`);
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        Alert.alert('Sin resultados', 'No se encontraron ubicaciones para la dirección ingresada.');
        return;
      }

      setGeocodingResults(results.slice(0, 5));
      setShowGeocodingResults(true);
    } catch (error) {
      console.error('Error en geocodificación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectGeocodingResult = (result: any) => {
    const displayName = result.display_name || '';
    const parts = displayName.split(',').map((part: string) => part.trim());
    
    // Buscar código postal
    const postalCodeMatch = displayName.match(/\b\d{5}\b/);
    if (postalCodeMatch) {
      setCodigoPostal(postalCodeMatch[0]);
    }
    
    // Extraer barrio
    let barrioFound = '';
    const streetIndex = parts.findIndex(part => 
      part.toLowerCase().includes(calle.toLowerCase())
    );
    
    if (streetIndex >= 0 && streetIndex + 1 < parts.length) {
      const possibleBarrio = parts[streetIndex + 1];
      if (possibleBarrio && 
          possibleBarrio !== selectedDepartment?.name && 
          possibleBarrio !== selectedCountry?.name &&
          !possibleBarrio.match(/\b\d{5}\b/) && 
          possibleBarrio.length > 2) {
        barrioFound = possibleBarrio;
      }
    }
    
    if (!barrioFound && result.address) {
      const address = result.address;
      barrioFound = address.neighbourhood || 
                   address.suburb || 
                   address.quarter || 
                   address.district || '';
    }
    
    if (barrioFound) {
      setBarrio(barrioFound);
    }
    
    setLatitud(result.lat);
    setLongitud(result.lon);
    setShowGeocodingResults(false);
    
    Alert.alert(
      'Ubicación encontrada',
      `Se ha encontrado la ubicación exacta de tu negocio.\n\nCoordenadas: ${result.lat}, ${result.lon}${barrioFound ? `\nBarrio: ${barrioFound}` : ''}`,
      [{ text: 'Perfecto' }]
    );
  };

  const handleSelectLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setNewLogoSelected(result.assets[0]);
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadImage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      const filename = `partners/${businessId}/logo/${Date.now()}.jpg`;
      return await uploadImageUtil(imageAsset.uri, filename);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!businessName.trim() || !selectedType || !description.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setSaveLoading(true);
    try {
      let logoUrl = logo;

      // Upload new logo if selected
      if (newLogoSelected) {
        logoUrl = await uploadImage(newLogoSelected);
      }

      // Update business data
      const updateData = {
        business_name: businessName.trim(),
        business_type: selectedType,
        description: description.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logo: logoUrl,
        country_id: selectedCountry?.id || null,
        department_id: selectedDepartment?.id || null,
        calle: calle.trim() || null,
        numero: numero.trim() || null,
        barrio: barrio.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        latitud: latitud.trim() || null,
        longitud: longitud.trim() || null,
        address: `${calle.trim()} ${numero.trim()}${barrio ? ', ' + barrio : ''}, ${selectedDepartment?.name || ''}, ${selectedCountry?.name || ''}`,
        iva_rate: parseFloat(ivaRate) || 0,
        iva_included_in_price: ivaIncludedInPrice,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('partners')
        .update(updateData)
        .eq('id', businessId);

      if (error) throw error;

      Alert.alert('Éxito', 'Información del negocio actualizada correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating business:', error);
      Alert.alert('Error', 'No se pudo actualizar la información del negocio');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando información del negocio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Negocio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>✏️ Editar Información del Negocio</Text>
            <Text style={styles.headerSubtitle}>
              Actualiza la información de tu negocio para mantener tu perfil al día
            </Text>
          </View>

          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Text style={styles.sectionTitle}>Logo del negocio</Text>
            <TouchableOpacity style={styles.logoSelector} onPress={handleSelectLogo}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoPreview} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Camera size={32} color="#9CA3AF" />
                  <Text style={styles.logoPlaceholderText}>Seleccionar logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Business Type */}
          <Text style={styles.sectionTitle}>Tipo de Negocio</Text>
          <View style={styles.businessTypes}>
            {businessTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.businessType,
                  selectedType === type.id && styles.selectedBusinessType
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={styles.businessTypeIcon}>{type.icon}</Text>
                <Text style={[
                  styles.businessTypeName,
                  selectedType === type.id && styles.selectedBusinessTypeName
                ]}>
                  {type.name}
                </Text>
                <Text style={styles.businessTypeDescription}>{type.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Nombre del negocio *"
            placeholder="Ej: Veterinaria San Martín"
            value={businessName}
            onChangeText={setBusinessName}
            leftIcon={<Building size={20} color="#6B7280" />}
          />

          <Input
            label="Descripción *"
            placeholder="Describe tu negocio y servicios..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            leftIcon={<FileText size={20} color="#6B7280" />}
          />

          {/* Location Fields */}
          <TouchableOpacity onPress={() => setShowCountryModal(true)}>
            <Input
              label="País *"
              placeholder="Selecciona tu país"
              value={selectedCountry?.name || ''}
              editable={false}
              leftIcon={<MapPin size={20} color="#6B7280" />}
              rightIcon={<ChevronDown size={20} color="#6B7280" />}
            />
          </TouchableOpacity>

          <View style={styles.departmentInputGroup}>
            <Input
              label="Departamento *"
              placeholder={selectedCountry ? "Departamento..." : "Primero selecciona un país"}
              value={departmentQuery}
              onChangeText={handleDepartmentInputChange}
              onFocus={() => selectedCountry && setShowDepartmentSuggestions(true)}
              editable={!!selectedCountry}
              leftIcon={<MapPin size={20} color="#6B7280" />}
              style={!selectedCountry ? styles.disabledInput : undefined}
            />
            
            {showDepartmentSuggestions && filteredDepartments.length > 0 && selectedCountry && (
              <View style={styles.departmentSuggestions}>
                {filteredDepartments.slice(0, 6).map((department) => (
                  <TouchableOpacity
                    key={department.id}
                    style={styles.departmentSuggestion}
                    onPress={() => handleDepartmentSelect(department)}
                  >
                    <Text style={styles.departmentSuggestionText}>{department.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Input
            label="Calle *"
            placeholder="Nombre de la calle"
            value={calle}
            onChangeText={setCalle}
            editable={!!selectedDepartment}
            style={!selectedDepartment ? styles.disabledInput : undefined}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Número *"
                placeholder="1234"
                value={numero}
                onChangeText={setNumero}
                editable={!!selectedDepartment}
                style={!selectedDepartment ? styles.disabledInput : undefined}
              />
            </View>
            <View style={styles.halfWidth}>
              <Input
                label="Código Postal"
                placeholder="11800"
                value={codigoPostal}
                onChangeText={setCodigoPostal}
                editable={!!selectedDepartment}
                style={!selectedDepartment ? styles.disabledInput : undefined}
              />
            </View>
          </View>

          <Input
            label="Barrio"
            placeholder="Nombre del barrio"
            value={barrio}
            onChangeText={setBarrio}
            editable={!!selectedDepartment}
            style={!selectedDepartment ? styles.disabledInput : undefined}
          />

          {/* IVA Configuration */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 Configuración de IVA</Text>
            <Text style={styles.sectionSubtitle}>
              Configura el IVA que se aplicará a tus servicios y productos
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Porcentaje de IVA (%)"
                placeholder="21"
                value={ivaRate}
                onChangeText={setIvaRate}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.inputLabel}>IVA Incluido en Precio</Text>
              <TouchableOpacity
                style={styles.switchContainer}
                onPress={() => setIvaIncludedInPrice(!ivaIncludedInPrice)}
              >
                <View style={[
                  styles.switch,
                  ivaIncludedInPrice && styles.switchActive
                ]}>
                  <View style={[
                    styles.switchThumb,
                    ivaIncludedInPrice && styles.switchThumbActive
                  ]} />
                </View>
                <Text style={styles.switchLabel}>
                  {ivaIncludedInPrice ? 'Sí' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.ivaExplanation}>
            <Text style={styles.ivaExplanationText}>
              {ivaIncludedInPrice
                ? '✓ El IVA está incluido en el precio que muestras a tus clientes'
                : '✓ El IVA se sumará al precio final en el checkout'}
            </Text>
          </View>

          {/* Geocoding Button */}
          {calle.trim() && numero.trim() && selectedDepartment && selectedCountry && (
            <View style={styles.geocodingSection}>
              <Button
                title={isGeocoding ? "Buscando ubicación..." : "🌍 Actualizar ubicación exacta"}
                onPress={performGeocoding}
                loading={isGeocoding}
                variant="outline"
                size="medium"
              />
              <Text style={styles.geocodingHint}>
                Esto actualizará automáticamente el código postal, barrio y coordenadas GPS
              </Text>
            </View>
          )}

          {/* Geocoding Results */}
          {showGeocodingResults && geocodingResults.length > 0 && (
            <View style={styles.geocodingResults}>
              <Text style={styles.geocodingResultsTitle}>
                📍 Selecciona la ubicación correcta:
              </Text>
              {geocodingResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.geocodingResultItem}
                  onPress={() => handleSelectGeocodingResult(result)}
                >
                  <Text style={styles.geocodingResultAddress}>
                    {result.display_name}
                  </Text>
                  <Text style={styles.geocodingResultType}>
                    Coordenadas: {result.lat}, {result.lon}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.cancelGeocodingButton}
                onPress={() => setShowGeocodingResults(false)}
              >
                <Text style={styles.cancelGeocodingText}>Cancelar búsqueda</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show coordinates if available */}
          {(latitud || longitud) && (
            <View style={styles.coordinatesDisplay}>
              <Text style={styles.coordinatesTitle}>📍 Coordenadas GPS:</Text>
              <Text style={styles.coordinatesText}>
                Latitud: {latitud || 'No disponible'}
              </Text>
              <Text style={styles.coordinatesText}>
                Longitud: {longitud || 'No disponible'}
              </Text>
            </View>
          )}

          <Input
            label="Teléfono *"
            placeholder="Número de contacto"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color="#6B7280" />}
          />

          <Input
            label="Email de contacto *"
            placeholder="email@negocio.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color="#6B7280" />}
          />

          <Button
            title="Guardar Cambios"
            onPress={handleSave}
            loading={saveLoading}
            size="large"
          />
        </Card>
      </ScrollView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar País</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {countries.map((country) => (
                <TouchableOpacity
                  key={country.id}
                  style={[
                    styles.optionItem,
                    selectedCountry?.id === country.id && styles.selectedOptionItem
                  ]}
                  onPress={() => handleCountrySelect(country)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedCountry?.id === country.id && styles.selectedOptionText
                  ]}>
                    {country.name}
                  </Text>
                  {selectedCountry?.id === country.id && (
                    <Check size={16} color="#2D6A6F" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
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
  formCard: {
    margin: 16,
  },
  headerInfo: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  logoSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  logoSelector: {
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  logoPlaceholderText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  businessTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  businessType: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedBusinessType: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  businessTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  businessTypeName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  selectedBusinessTypeName: {
    color: '#3B82F6',
  },
  businessTypeDescription: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  departmentInputGroup: {
    position: 'relative',
    zIndex: 1000,
  },
  departmentSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
    maxHeight: 200,
  },
  departmentSuggestion: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  departmentSuggestionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#10B981',
  },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginLeft: 12,
  },
  ivaExplanation: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ivaExplanationText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  geocodingSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  geocodingHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#0369A1',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  geocodingResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  geocodingResultsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  geocodingResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  geocodingResultAddress: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 20,
  },
  geocodingResultType: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  cancelGeocodingButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  cancelGeocodingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  coordinatesDisplay: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  coordinatesTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#166534',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedOptionItem: {
    backgroundColor: '#F0F9FF',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    flex: 1,
  },
  selectedOptionText: {
    color: '#2D6A6F',
    fontFamily: 'Inter-Medium',
  },
});