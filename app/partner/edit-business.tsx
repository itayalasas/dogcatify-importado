import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Modal, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building, Camera, MapPin, Phone, Mail, FileText, ChevronDown, Check, X } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { toast } from '../../components/ui/Toast';
import { FormSection } from '../../components/partner-setup/FormSection';
import { FormFooter } from '../../components/partner-setup/FormFooter';
import { FormSkeleton } from '../../components/partner-setup/FormSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage as uploadImageUtil } from '../../utils/imageUpload';
import { envConfig } from '../../utils/envConfig';
import { colors, radius, shadows, spacing, typography } from '../../constants/theme';

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
  const [rut, setRut] = useState('');
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
        setRut(data.rut || '');
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
      Alert.alert('Información incompleta', 'Completá calle, número, departamento y país para buscar la ubicación');
      return;
    }

    setIsGeocoding(true);
    setGeocodingResults([]);
    setShowGeocodingResults(false);

    try {
      const query = `${calle.trim()}+${numero.trim()}+${selectedDepartment.name}+${selectedCountry.name}`;
      const nominatimBaseUrl = envConfig.getOrDefault('EXPO_PUBLIC_NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org');
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
    const streetIndex = parts.findIndex((part: string) => 
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
    if (!businessName.trim() || !selectedType || !description.trim() || !phone.trim() || !email.trim() || !rut.trim()) {
      Alert.alert('Error', 'Completá todos los campos obligatorios');
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
        rut: rut.trim(),
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

      toast.success('Información del negocio actualizada');
      router.back();
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
        <ScreenHeader title="Editar negocio" />
        <FormSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={"Editar negocio"} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.headerInfo}>
            <Text style={styles.headerSubtitle}>
              Actualizá la información de tu negocio para mantener tu perfil al día
            </Text>
          </View>

        <FormSection title="Logo">
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <TouchableOpacity
              style={styles.logoSelector}
              onPress={handleSelectLogo}
              accessibilityRole="button"
              accessibilityLabel={logo ? 'Cambiar logo del negocio' : 'Elegir logo del negocio'}
            >
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoPreview} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Camera size={32} color={colors.textTertiary} />
                  <Text style={styles.logoPlaceholderText}>Seleccionar logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

        </FormSection>

        <FormSection title="Tipo de negocio">
          {/* Business Type */}
          <View style={styles.businessTypes}>
            {businessTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.businessType,
                  selectedType === type.id && styles.selectedBusinessType
                ]}
                onPress={() => setSelectedType(type.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedType === type.id }}
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

        </FormSection>

        <FormSection title="Datos básicos">
          <Input
            label="Nombre del negocio *"
            placeholder="Ej: Veterinaria San Martín"
            value={businessName}
            onChangeText={setBusinessName}
            leftIcon={<Building size={20} color={colors.textTertiary} />}
          />

          <Input
            label="Descripción *"
            placeholder="Describí tu negocio y servicios..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            leftIcon={<FileText size={20} color={colors.textTertiary} />}
          />

        </FormSection>

        <FormSection title="Ubicación">
          {/* Location Fields */}
          <TouchableOpacity
            onPress={() => setShowCountryModal(true)}
            accessibilityRole="button"
            accessibilityLabel={`País: ${selectedCountry?.name || 'sin elegir'}. Cambiar`}
          >
            <Input
              label="País *"
              placeholder="Seleccioná tu país"
              value={selectedCountry?.name || ''}
              editable={false}
              leftIcon={<MapPin size={20} color={colors.textTertiary} />}
              rightIcon={<ChevronDown size={20} color={colors.textTertiary} />}
            />
          </TouchableOpacity>

          <View style={styles.departmentInputGroup}>
            <Input
              label="Departamento *"
              placeholder={selectedCountry ? "Departamento..." : "Primero elegí un país"}
              value={departmentQuery}
              onChangeText={handleDepartmentInputChange}
              onFocus={() => selectedCountry && setShowDepartmentSuggestions(true)}
              editable={!!selectedCountry}
              leftIcon={<MapPin size={20} color={colors.textTertiary} />}
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
                label="Código postal"
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

          {/* Geocoding Button */}
          {calle.trim() && numero.trim() && selectedDepartment && selectedCountry && (
            <View style={styles.geocodingSection}>
              <Button
                title={isGeocoding ? "Buscando ubicación..." : "Actualizar ubicación exacta"}
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
                Seleccioná la ubicación correcta
              </Text>
              {geocodingResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.geocodingResultItem}
                  onPress={() => handleSelectGeocodingResult(result)}
                  accessibilityRole="button"
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
              <Text style={styles.coordinatesTitle}>Coordenadas GPS</Text>
              <Text style={styles.coordinatesText}>
                Latitud: {latitud || 'No disponible'}
              </Text>
              <Text style={styles.coordinatesText}>
                Longitud: {longitud || 'No disponible'}
              </Text>
            </View>
          )}

        </FormSection>

        <FormSection title="IVA" subtitle="Configurá el IVA que se aplica a tus servicios y productos">
          <Input
            label="Porcentaje de IVA (%)"
            placeholder="21"
            value={ivaRate}
            onChangeText={setIvaRate}
            keyboardType="decimal-pad"
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextBox}>
              <Text style={styles.toggleLabel}>IVA incluido en el precio</Text>
              <Text style={styles.toggleHint}>
                {ivaIncludedInPrice
                  ? 'El IVA está incluido en el precio que ven tus clientes'
                  : 'El IVA se suma al precio final en el checkout'}
              </Text>
            </View>
            <Switch
              value={ivaIncludedInPrice}
              onValueChange={setIvaIncludedInPrice}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={colors.white}
              accessibilityLabel="IVA incluido en el precio"
            />
          </View>
        </FormSection>

        <FormSection title="Contacto y facturación">
          <Input
            label="Teléfono *"
            placeholder="Número de contacto"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color={colors.textTertiary} />}
          />

          <Input
            label="Email de contacto *"
            placeholder="email@negocio.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color={colors.textTertiary} />}
          />

          <Input
            label="RUT *"
            placeholder="12345678-9"
            value={rut}
            onChangeText={setRut}
            leftIcon={<FileText size={20} color={colors.textTertiary} />}
          />

        </FormSection>
      </ScrollView>

      <FormFooter>
            <Button
          title="Guardar cambios"
          onPress={handleSave}
          loading={saveLoading}
          size="large"
        />
      </FormFooter>

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
              <Text style={styles.modalTitle}>Elegí tu país</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowCountryModal(false)}
                accessibilityLabel="Cerrar"
              />
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
                    <Check size={16} color={colors.primary} />
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  toggleTextBox: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  toggleHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
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
    ...typography.body,
    color: colors.textTertiary,
  },
  formCard: {
    margin: spacing.lg,
  },
  headerInfo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  logoSection: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
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
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  logoPlaceholderText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  businessTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  businessType: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedBusinessType: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  businessTypeIcon: {
    ...typography.title,
    marginBottom: spacing.xs,
  },
  businessTypeName: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xxs,
  },
  selectedBusinessTypeName: {
    color: colors.primary,
  },
  businessTypeDescription: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  disabledInput: {
    backgroundColor: colors.background,
    color: colors.textTertiary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    ...shadows.lg,
    zIndex: 1001,
    maxHeight: 200,
  },
  departmentSuggestion: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  departmentSuggestionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionHeaderTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: colors.borderStrong,
    padding: spacing.xxs,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.success,
  },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  switchLabel: {
    ...typography.label,
    color: colors.text,
    marginLeft: spacing.md,
  },
  ivaExplanation: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  ivaExplanationText: {
    ...typography.bodySmall,
    color: colors.info,
  },
  inputLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  geocodingSection: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  geocodingHint: {
    ...typography.caption,
    color: colors.info,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  geocodingResults: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  geocodingResultsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  geocodingResultItem: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  geocodingResultAddress: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  geocodingResultType: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cancelGeocodingButton: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  cancelGeocodingText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  coordinatesDisplay: {
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  coordinatesTitle: {
    ...typography.label,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  coordinatesText: {
    ...typography.bodySmall,
    color: colors.success,
    marginBottom: spacing.xxs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  modalCloseText: {
    ...typography.heading,
    color: colors.textTertiary,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  selectedOptionItem: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  selectedOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-Medium',
  },
});
