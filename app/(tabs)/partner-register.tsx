import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Building, Camera, MapPin, Phone, Mail, FileText, DollarSign } from 'lucide-react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import * as ImagePicker from 'expo-image-picker';
import { Modal, TextInput } from 'react-native';
import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '@/utils/notifications';
import { PartnerServiceAgreement } from '../../components/PartnerServiceAgreement';

const replicateMercadoPagoConfig = async (userId: string) => {
  try {
    console.log('Checking for existing Mercado Pago configuration for user:', userId);
    
    // Find any existing business from this user with Mercado Pago configured
    const { data: existingPartners, error } = await supabaseClient
      .from('partners')
      .select('*')
      .eq('user_id', userId)
      .eq('mercadopago_connected', true)
      .limit(1);
    
    if (error) {
      console.error('Error checking existing partners:', error);
      return;
    }
    
    if (existingPartners && existingPartners.length > 0) {
      const sourcePartner = existingPartners[0];
      console.log('Found existing partner with MP config:', sourcePartner.business_name);
      
      if (sourcePartner.mercadopago_config) {
        console.log('Replicating Mercado Pago configuration to new business...');
        
        // Get the newly created partner (last one created by this user)
        const { data: newPartners, error: newPartnerError } = await supabaseClient
          .from('partners')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (newPartnerError || !newPartners || newPartners.length === 0) {
          console.error('Error finding new partner:', newPartnerError);
          return;
        }
        
        const newPartner = newPartners[0];
        
        // Replicate the Mercado Pago configuration
        const { error: updateError } = await supabaseClient
          .from('partners')
          .update({
            mercadopago_connected: true,
            mercadopago_config: sourcePartner.mercadopago_config,
            commission_percentage: sourcePartner.commission_percentage || 5.0,
            updated_at: new Date().toISOString()
          })
          .eq('id', newPartner.id);
        
        if (updateError) {
          console.error('Error replicating MP config:', updateError);
        } else {
          console.log('Mercado Pago configuration replicated successfully to:', newPartner.business_name);
        }
      }
    } else {
      console.log('No existing Mercado Pago configuration found for user');
    }
  } catch (error) {
    console.error('Error in replicateMercadoPagoConfig:', error);
    // Don't throw error to avoid breaking the registration process
  }
};

const businessTypes = [
  { id: 'veterinary', name: 'Veterinaria', icon: '🏥', description: 'Servicios médicos para mascotas' },
  { id: 'grooming', name: 'Peluquería', icon: '✂️', description: 'Servicios de estética y cuidado' },
  { id: 'walking', name: 'Paseador', icon: '🚶', description: 'Servicios de paseo y ejercicio' },
  { id: 'boarding', name: 'Pensión', icon: '🏠', description: 'Hospedaje temporal para mascotas' },
  { id: 'shop', name: 'Tienda', icon: '🛍️', description: 'Venta de productos para mascotas' },
  { id: 'shelter', name: 'Refugio', icon: '🐾', description: 'Adopción y rescate de mascotas' },
];

export default function PartnerRegister() {
  const { currentUser } = useAuth();
  const { sendNotificationToAdmin } = useNotifications();
  const [selectedType, setSelectedType] = useState<string>('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [logo, setLogo] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [hasShipping, setHasShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Nuevos campos de ubicación
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
  
  // Estados para los dropdowns
  const [countries, setCountries] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<any[]>([]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  
  // Estados para geocodificación
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<any[]>([]);
  const [showGeocodingResults, setShowGeocodingResults] = useState(false);
  const [selectedGeocodingResult, setSelectedGeocodingResult] = useState<any>(null);

  // Estados para el contrato de servicio
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // Estados para IVA
  const [ivaRate, setIvaRate] = useState('0');
  const [ivaIncludedInPrice, setIvaIncludedInPrice] = useState(false);

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('countries')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCountries(data || []);
      
      // Seleccionar Uruguay por defecto
      if (data && data.length > 0) {
        const uruguay = data.find(country => country.code === 'UY');
        if (uruguay) {
          setSelectedCountry(uruguay);
          loadDepartments(uruguay.id);
        }
      }
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
    setSelectedGeocodingResult(result);
    setShowGeocodingResults(false);
    
    Alert.alert(
      'Ubicación encontrada',
      `Se ha encontrado la ubicación exacta de tu negocio.\n\nCoordenadas: ${result.lat}, ${result.lon}${barrioFound ? `\nBarrio: ${barrioFound}` : ''}`,
      [{ text: 'Perfecto' }]
    );
  };

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleSelectLogo = async () => {
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso a tu galería de fotos para seleccionar el logo'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Logo selected:', result.assets[0].uri);
        setLogo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting logo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleSelectImages = async () => {
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso a tu galería de fotos para seleccionar las imágenes'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        console.log('Images selected:', newImages);
        setImages(prev => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      console.error('Error selecting images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };


  const uploadImage = async (imageUri: string, path: string): Promise<string> => {
    try {
      console.log(`Uploading image to path: ${path}`);
      console.log(`Image URI: ${imageUri}`);

      // Verificar que la URI existe
      if (!imageUri || imageUri.trim() === '') {
        throw new Error('URI de imagen inválida');
      }

      // Determinar el tipo de archivo
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

      // Fetch the image and convert to blob
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      console.log(`Image blob size: ${blob.size} bytes, type: ${blob.type}`);

      // Verificar que el blob tiene contenido
      if (blob.size === 0) {
        throw new Error('La imagen está vacía');
      }

      // Convert blob to ArrayBuffer for React Native compatibility
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert blob to ArrayBuffer'));
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      console.log(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);

      // Upload ArrayBuffer to Supabase storage
      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(path, arrayBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Supabase storage error:', error);
        console.error('Error details:', JSON.stringify(error));
        throw error;
      }

      console.log('Upload successful, data:', data);
      console.log('Getting public URL...');

      const { data: urlData } = supabaseClient.storage
        .from('dogcatify')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;
      console.log(`Generated public URL: ${publicUrl}`);

      // Verificar que la URL es válida
      if (!publicUrl || publicUrl.trim() === '') {
        throw new Error('No se pudo generar la URL pública');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !businessName || !description || !calle || !numero || !selectedCountry || !selectedDepartment || !phone) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!agreementAccepted) {
      Alert.alert(
        'Contrato requerido',
        'Debes leer y aceptar el contrato de servicio para continuar',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      let logoUrl = null;
      if (logo) {
        try {
          console.log('Uploading logo...');
          logoUrl = await uploadImage(logo, `partners/${currentUser.id}/${Date.now()}_logo.jpg`);
          console.log('Logo uploaded successfully:', logoUrl);
        } catch (logoError) {
          console.error('Error uploading logo:', logoError);
          Alert.alert(
            'Error al subir logo',
            'No se pudo subir el logo. ¿Deseas continuar sin logo?',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => setLoading(false) },
              { text: 'Continuar sin logo', onPress: () => proceedWithoutLogo() }
            ]
          );
          return;
        }
      }

      const imageUrls: string[] = [];
      if (images.length > 0) {
        try {
          console.log(`Uploading ${images.length} gallery images...`);
          for (let i = 0; i < images.length; i++) {
            console.log(`Uploading image ${i + 1} of ${images.length}...`);
            const imageUrl = await uploadImage(images[i], `partners/${currentUser.id}/gallery/${Date.now()}_${i}.jpg`);
            imageUrls.push(imageUrl);
          }
          console.log('All gallery images uploaded successfully');
        } catch (galleryError) {
          console.error('Error uploading gallery images:', galleryError);
          Alert.alert(
            'Error al subir imágenes',
            'No se pudieron subir las imágenes de la galería. ¿Deseas continuar sin galería?',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => setLoading(false) },
              { text: 'Continuar sin galería', onPress: () => proceedWithoutGallery() }
            ]
          );
          return;
        }
      }

      await createPartnerRecord(logoUrl, imageUrls);
    } catch (error) {
      console.error('Error registering partner:', error);
      Alert.alert('Error', 'No se pudo completar el registro');
    } finally {
      setLoading(false);
    }
  };

  const proceedWithoutLogo = async () => {
    try {
      await createPartnerRecord(null, []);
    } catch (error) {
      console.error('Error registering partner without logo:', error);
      Alert.alert('Error', 'No se pudo completar el registro');
    } finally {
      setLoading(false);
    }
  };

  const proceedWithoutGallery = async () => {
    try {
      let logoUrl = null;
      if (logo) {
        logoUrl = await uploadImage(logo, `partners/${currentUser.id}/${Date.now()}_logo.jpg`);
      }
      await createPartnerRecord(logoUrl, []);
    } catch (error) {
      console.error('Error registering partner without gallery:', error);
      Alert.alert('Error', 'No se pudo completar el registro');
    } finally {
      setLoading(false);
    }
  };

  const createPartnerRecord = async (logoUrl: string | null, imageUrls: string[]) => {
    try {
      console.log('Creating partner record in database...');
      
      // Create partner request
      const { error } = await supabaseClient
        .from('partners')
        .insert({
          user_id: currentUser.id,
          business_name: businessName.trim(),
          business_type: selectedType,
          description: description.trim(),
          address: `${calle.trim()} ${numero.trim()}${barrio ? ', ' + barrio : ''}, ${selectedDepartment?.name || ''}, ${selectedCountry?.name || ''}`,
          phone: phone.trim(),
          email: email.trim(),
          logo: logoUrl,
          images: imageUrls,
          has_shipping: hasShipping,
          shipping_cost: hasShipping ? parseFloat(shippingCost) || 0 : 0,
          country_id: selectedCountry?.id,
          department_id: selectedDepartment?.id,
          calle: calle.trim(),
          numero: numero.trim(),
          barrio: barrio.trim() || null,
          codigo_postal: codigoPostal.trim() || null,
          latitud: latitud.trim() || null,
          longitud: longitud.trim() || null,
          iva_rate: parseFloat(ivaRate) || 0,
          iva_included_in_price: ivaIncludedInPrice,
          is_active: true,
          is_verified: false,
          rating: 0,
          reviews_count: 0,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      console.log('Partner record created successfully');

      // Check if user has other businesses with Mercado Pago configured
      await replicateMercadoPagoConfig(currentUser.id);
      
      // Update user profile to be a partner
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          is_partner: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Enviar notificación push al admin
      try {
        await sendNotificationToAdmin(
          'Nueva solicitud de aliado',
          `${businessName.trim()} ha solicitado unirse como ${businessTypes.find(t => t.id === selectedType)?.name}`,
          {
            type: 'partner_request',
            businessName: businessName.trim(),
            businessType: selectedType,
            userId: currentUser.id,
            deepLink: '(admin-tabs)/requests'
          }
        );
        console.log('Push notification sent to admin');
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError);
      }

      Alert.alert(
        'Registro exitoso',
        'Tu solicitud para ser aliado ha sido enviada. Te notificaremos cuando sea aprobada.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error creating partner record:', error);
      throw error;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Convertirse en Aliado</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>🤝 Únete como Aliado</Text>
          <Text style={styles.introDescription}>
            Ofrece tus servicios a la comunidad de Patitas y haz crecer tu negocio
          </Text>
        </Card>

        <Card style={styles.formCard}>
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

          {/* Botón de geocodificación */}
          {calle.trim() && numero.trim() && selectedDepartment && selectedCountry && (
            <View style={styles.geocodingSection}>
              <Button
                title={isGeocoding ? "Buscando ubicación..." : "🌍 Buscar ubicación exacta"}
                onPress={performGeocoding}
                loading={isGeocoding}
                variant="outline"
                size="medium"
              />
              <Text style={styles.geocodingHint}>
                Esto completará automáticamente el código postal, barrio y coordenadas GPS
              </Text>
            </View>
          )}

          {/* Resultados de geocodificación */}
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

          {/* Mostrar coordenadas si están disponibles */}
          {(latitud || longitud) && (
            <View style={styles.coordinatesDisplay}>
              <Text style={styles.coordinatesTitle}>📍 Coordenadas GPS:</Text>
              <Text style={styles.coordinatesText}>
                Latitud: {latitud || 'No disponible'}
              </Text>
              <Text style={styles.coordinatesText}>
                Longitud: {longitud || 'No disponible'}
              </Text>
              {selectedGeocodingResult && (
                <Text style={styles.coordinatesNote}>
                  ✅ Ubicación verificada automáticamente
                </Text>
              )}
            </View>
          )}

          {/* Sección de IVA */}
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

          <View style={styles.imageSection}>
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

          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Galería de imágenes (máx. 5)</Text>
            <TouchableOpacity style={styles.gallerySelector} onPress={handleSelectImages}>
              <Camera size={24} color="#3B82F6" />
              <Text style={styles.gallerySelectorText}>Agregar imágenes</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <ScrollView horizontal style={styles.imagePreview} showsHorizontalScrollIndicator={false}>
                {images.map((image, index) => (
                  <Image key={index} source={{ uri: image }} style={styles.previewImage} />
                ))}
              </ScrollView>
            )}
          </View>

          {selectedType === 'shop' && (
            <View style={styles.shippingSection}>
              <View style={styles.shippingHeader}>
                <Text style={styles.shippingTitle}>Configuración de Envío</Text>
              </View>

              <TouchableOpacity
                style={styles.shippingCheckbox}
                onPress={() => setHasShipping(!hasShipping)}
              >
                <View style={[styles.checkbox, hasShipping && styles.checkedCheckbox]}>
                  {hasShipping && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Ofrece servicio de envío</Text>
              </TouchableOpacity>

              {hasShipping && (
                <Input
                  label="Costo de envío"
                  placeholder="Ej: 500"
                  value={shippingCost}
                  onChangeText={setShippingCost}
                  keyboardType="numeric"
                  leftIcon={<DollarSign size={20} color="#6B7280" />}
                />
              )}
            </View>
          )}

          <View style={styles.agreementSection}>
            <TouchableOpacity
              style={styles.agreementCheckbox}
              onPress={() => {
                if (agreementAccepted) {
                  setAgreementAccepted(false);
                } else {
                  setShowAgreement(true);
                }
              }}
            >
              <View style={[styles.checkbox, agreementAccepted && styles.checkedCheckbox]}>
                {agreementAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.agreementTextContainer}>
                <Text style={styles.agreementText}>
                  He leído y acepto el{' '}
                  <Text
                    style={styles.agreementLink}
                    onPress={() => setShowAgreement(true)}
                  >
                    Contrato de Servicio para Aliados
                  </Text>
                </Text>
              </View>
            </TouchableOpacity>

            {!agreementAccepted && (
              <TouchableOpacity
                style={styles.readAgreementButton}
                onPress={() => setShowAgreement(true)}
              >
                <FileText size={16} color="#2D6A6F" />
                <Text style={styles.readAgreementText}>Leer contrato completo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            title="Enviar Solicitud"
            onPress={handleSubmit}
            loading={loading}
            size="large"
          />
        </Card>
      </ScrollView>

      {/* Modal de selección de país */}
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

      {/* Modal del Contrato de Servicio */}
      <PartnerServiceAgreement
        visible={showAgreement}
        onClose={() => setShowAgreement(false)}
        onAccept={() => setAgreementAccepted(true)}
      />
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
  introCard: {
    margin: 16,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
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
  imageSection: {
    marginBottom: 20,
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
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  gallerySelectorText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#3B82F6',
    marginLeft: 8,
  },
  imagePreview: {
    flexDirection: 'row',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
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
  coordinatesNote: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
    marginTop: 8,
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
  shippingSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shippingHeader: {
    marginBottom: 16,
  },
  shippingTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  shippingCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
  },
  agreementSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  agreementCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  agreementTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  agreementText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    lineHeight: 20,
  },
  agreementLink: {
    color: '#2D6A6F',
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
  readAgreementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D6A6F',
  },
  readAgreementText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginLeft: 8,
  },
});