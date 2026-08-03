import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Platform, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Upload, User, Phone, MapPin, Mail, ChevronDown, Check, Search } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../../lib/supabase';
import { uploadImage } from '../../utils/imageUpload';
import { envConfig } from '../../utils/envConfig';

type PhoneCountryOption = {
  id: number;
  name: string;
  nativeName?: string;
  iso2?: string;
  phoneCode?: string;
  emoji?: string;
  flagPng?: string;
  flagSvg?: string;
};

const phoneCountries: PhoneCountryOption[] = require('../../countries.json');

const getDefaultPhoneCountry = () =>
  phoneCountries.find((country) => country.iso2 === 'UY') || phoneCountries[0] || null;

const normalizePhoneCode = (value?: string | null) => String(value || '').trim().replace(/\s+/g, '');

const sanitizePhoneNumber = (value: string) => String(value || '').replace(/[^\d]/g, '');

const parseStoredPhone = (value?: string | null) => {
  const defaultCountry = getDefaultPhoneCountry();
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return {
      country: defaultCountry,
      phoneNumber: '',
    };
  }

  const normalizedValue = rawValue.replace(/[\s()-]/g, '');
  const internationalValue = normalizedValue.startsWith('00')
    ? `+${normalizedValue.slice(2)}`
    : normalizedValue;

  const sortedCountries = [...phoneCountries].sort((a, b) => {
    const aLength = normalizePhoneCode(a.phoneCode).length;
    const bLength = normalizePhoneCode(b.phoneCode).length;
    return bLength - aLength;
  });

  for (const country of sortedCountries) {
    const normalizedCode = normalizePhoneCode(country.phoneCode);
    const digitsOnlyCode = normalizedCode.replace(/^\+/, '');

    if (normalizedCode && internationalValue.startsWith(normalizedCode)) {
      return {
        country,
        phoneNumber: sanitizePhoneNumber(internationalValue.slice(normalizedCode.length)),
      };
    }

    if (digitsOnlyCode && internationalValue.startsWith(digitsOnlyCode)) {
      return {
        country,
        phoneNumber: sanitizePhoneNumber(internationalValue.slice(digitsOnlyCode.length)),
      };
    }
  }

  return {
    country: defaultCountry,
    phoneNumber: sanitizePhoneNumber(internationalValue.replace(/^\+/, '')),
  };
};

const buildStoredPhone = (country: PhoneCountryOption | null, phoneNumber: string) => {
  const localNumber = sanitizePhoneNumber(phoneNumber);
  const phoneCode = normalizePhoneCode(country?.phoneCode);

  if (!localNumber) {
    return null;
  }

  if (!phoneCode) {
    return localNumber;
  }

  return `${phoneCode}${localNumber}`;
};

export default function EditProfile() {
  const { currentUser, updateCurrentUser } = useAuth();
  const { t } = useLanguage();
  
  // Form state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<PhoneCountryOption | null>(getDefaultPhoneCountry());
  const [phoneCountryQuery, setPhoneCountryQuery] = useState('');
  const [showPhoneCountryModal, setShowPhoneCountryModal] = useState(false);
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  
  // Nuevos campos de dirección
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
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  
  // Estados para geocodificación
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<any[]>([]);
  const [showGeocodingResults, setShowGeocodingResults] = useState(false);
  const [selectedGeocodingResult, setSelectedGeocodingResult] = useState<any>(null);
  
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(currentUser?.photoURL || null);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    // Load existing user data
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setEmail(currentUser.email || '');
      const parsedPhone = parseStoredPhone(currentUser.phone || '');
      setSelectedPhoneCountry(parsedPhone.country);
      setPhoneNumber(parsedPhone.phoneNumber);
      setLocation(currentUser.location || '');
      setBio(currentUser.bio || '');
      setProfileImage(currentUser.photoURL || null);
    }
    
    // Cargar países y datos de dirección
    loadCountries();
    loadUserAddressData();
  }, [currentUser]);

  const loadCountries = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('countries')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCountries(data || []);
      
      // Seleccionar Uruguay por defecto si no hay país seleccionado
      if (!selectedCountry && data && data.length > 0) {
        const uruguay = data.find(country => country.code === 'UY');
        if (uruguay) {
          setSelectedCountry(uruguay);
          loadDepartments(uruguay.id);
        }
      }
    } catch (error) {
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
    }
  };

  const loadUserAddressData = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
          *,
          countries(*),
          departments(*)
        `)
        .eq('id', currentUser.id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const parsedPhone = parseStoredPhone(data.phone || currentUser.phone || '');
        setSelectedPhoneCountry(parsedPhone.country);
        setPhoneNumber(parsedPhone.phoneNumber);
        setCalle(data.calle || '');
        setNumero(data.numero || '');
        setBarrio(data.barrio || '');
        setCodigoPostal(data.codigo_postal || '');
        setLatitud(data.latitud || '');
        setLongitud(data.longitud || '');
        
        if (data.countries) {
          setSelectedCountry(data.countries);
          // Cargar departamentos del país seleccionado
          await loadDepartments(data.countries.id);
        }
        
        if (data.departments) {
          setSelectedDepartment(data.departments);
          setDepartmentQuery(data.departments.name);
        }
      }
    } catch (error) {
    }
  };

  const handleCountrySelect = async (country: any) => {
    setSelectedCountry(country);
    setSelectedDepartment(null); // Reset department when country changes
    setDepartmentQuery(''); // Reset department query
    setShowCountryModal(false);
    
    // Cargar departamentos del país seleccionado
    await loadDepartments(country.id);
  };

  const handleDepartmentSelect = (department: any) => {
    setSelectedDepartment(department);
    setDepartmentQuery(department.name);
    setShowDepartmentSuggestions(false);
  };

  const handleDepartmentInputChange = (text: string) => {
    setDepartmentQuery(text);
    
    // Filter departments based on input
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
    
    // Check if the text matches exactly a department
    const exactMatch = departments.find(dept => 
      dept.name.toLowerCase() === text.toLowerCase()
    );
    if (exactMatch && selectedDepartment?.id !== exactMatch.id) {
      setSelectedDepartment(exactMatch);
    } else if (!exactMatch && selectedDepartment) {
      setSelectedDepartment(null);
    }
  };

  // Función para realizar geocodificación con Nominatim
  const filteredPhoneCountries = phoneCountries.filter((country) => {
    const query = phoneCountryQuery.trim().toLowerCase();
    if (!query) return true;

    const name = String(country.name || '').toLowerCase();
    const nativeName = String(country.nativeName || '').toLowerCase();
    const iso2 = String(country.iso2 || '').toLowerCase();
    const phoneCode = String(country.phoneCode || '').toLowerCase();

    return (
      name.includes(query) ||
      nativeName.includes(query) ||
      iso2.includes(query) ||
      phoneCode.includes(query)
    );
  });

  const performGeocoding = async () => {
    if (!calle.trim() || !numero.trim() || !selectedDepartment || !selectedCountry) {
      Alert.alert('Información incompleta', 'Por favor completa calle, número, departamento y país para buscar la ubicación');
      return;
    }

    setIsGeocoding(true);
    setGeocodingResults([]);
    setShowGeocodingResults(false);

    try {
      // Construir la query de búsqueda
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
        Alert.alert('Sin resultados', 'No se encontraron ubicaciones para la dirección ingresada. Verifica los datos e intenta nuevamente.');
        return;
      }

      // Filtrar resultados que sean de tipo "house" y contengan la calle y número
      const houseResults = results.filter((result: any) => {
        const isHouse = result.type === 'house' || result.class === 'place';
        const containsStreetAndNumber = result.display_name && 
          result.display_name.toLowerCase().includes(calle.toLowerCase()) &&
          result.display_name.includes(numero);
        
        return isHouse && containsStreetAndNumber;
      });


      if (houseResults.length === 0) {
        // Si no hay resultados de tipo "house", mostrar todos los resultados
        setGeocodingResults(results.slice(0, 5));
      } else {
        setGeocodingResults(houseResults.slice(0, 5));
      }

      setShowGeocodingResults(true);
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Función para seleccionar un resultado de geocodificación
  const handleSelectGeocodingResult = (result: any) => {
    
    // Extraer información del display_name
    const displayName = result.display_name || '';
    const parts = displayName.split(',').map((part: string) => part.trim());
    
    
    // Buscar código postal (patrón de 5 dígitos)
    const postalCodeMatch = displayName.match(/\b\d{5}\b/);
    if (postalCodeMatch) {
      setCodigoPostal(postalCodeMatch[0]);
    }
    
    // Extraer barrio - buscar el elemento que viene después de la calle
    // Formato típico: "Número, Calle, Barrio, Departamento, País"
    let barrioFound = '';
    
    // Buscar el índice del elemento que contiene la calle
    const streetIndex = parts.findIndex((part: string) => 
      part.toLowerCase().includes(calle.toLowerCase())
    );
    
    
    if (streetIndex >= 0 && streetIndex + 1 < parts.length) {
      // El barrio debería estar en el siguiente elemento después de la calle
      const possibleBarrio = parts[streetIndex + 1];
      
      // Verificar que no sea el departamento, país o código postal
      if (possibleBarrio && 
          possibleBarrio !== selectedDepartment?.name && 
          possibleBarrio !== selectedCountry?.name &&
          !possibleBarrio.match(/\b\d{5}\b/) && // No es código postal
          possibleBarrio.length > 2) { // Tiene longitud razonable
        barrioFound = possibleBarrio;
      }
    }
    
    // Si no se encontró barrio con el método anterior, buscar en address details
    if (!barrioFound && result.address) {
      const address = result.address;
      barrioFound = address.neighbourhood || 
                   address.suburb || 
                   address.quarter || 
                   address.district || 
                   address.city_district || '';
    }
    
    // Si aún no se encontró, intentar con el tercer elemento (método original como fallback)
    if (!barrioFound && parts.length >= 3) {
      const possibleBarrio = parts[2];
      if (possibleBarrio && 
          possibleBarrio !== selectedDepartment?.name && 
          possibleBarrio !== selectedCountry?.name &&
          !possibleBarrio.match(/\b\d{5}\b/)) {
        barrioFound = possibleBarrio;
      }
    }
    
    if (barrioFound) {
      setBarrio(barrioFound);
    }
    
    // Establecer coordenadas
    setLatitud(result.lat);
    setLongitud(result.lon);
    
    setSelectedGeocodingResult(result);
    setShowGeocodingResults(false);
    
    Alert.alert(
      'Ubicación encontrada',
      `Se ha encontrado la ubicación exacta de tu dirección.${barrioFound ? `\n\nBarrio: ${barrioFound}` : ''}\n\nLa información se ha completado automáticamente.`,
      [{ text: 'Perfecto' }]
    );
  };

  const handleSelectPhoto = async () => {
    try {
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
        setSelectedImage(result.assets[0]);
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      setUploadingImage(true);
      const filename = `profiles/${currentUser!.id}/${Date.now()}.jpg`;
      return await uploadImage(imageAsset.uri, filename);
    } catch (error) {
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const updateUserPostsAndComments = async (newPhotoURL: string, newDisplayName: string) => {
    try {
      // Update all posts by this user
      const { error: postsError } = await supabaseClient
        .from('posts')
        .update({
          // Posts table doesn't have author column, it uses user_id reference
          // The author info is fetched via join with profiles table
        })
        .eq('user_id', currentUser!.id);
      
      if (postsError) {
      } else {
      }

      // Comments table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table

      // Pet albums table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table

    } catch (error) {
      // Don't throw error here as profile update was successful
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }


    setLoading(true);
    try {
      let photoURL = profileImage;

      // Upload new image if selected
      if (selectedImage) {
        try {
          photoURL = await uploadImageToStorage(selectedImage);
        } catch (uploadError) {
          setLoading(false);
          Alert.alert('Error', 'No se pudo subir la imagen. ¿Deseas continuar sin cambiar la foto?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => {
              setLoading(true);
              proceedWithoutImageUpload();
            }}
          ]);
          return;
        }
      }

      await saveProfileData(photoURL);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `No se pudo actualizar el perfil: ${message}`);
    } finally {
      // ALWAYS clear loading state
      setLoading(false);
    }
  };

  const proceedWithoutImageUpload = async () => {
    try {
      await saveProfileData(profileImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `No se pudo actualizar el perfil: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveProfileData = async (photoURL: string | null) => {
    try {
      
      // Prepare update data
      const updateData = {
        display_name: displayName.trim(),
        photo_url: photoURL || null,
        phone: buildStoredPhone(selectedPhoneCountry, phoneNumber),
        location: address.trim() || null, // Mantener para compatibilidad
        bio: bio.trim() || null,
        // Nuevos campos de dirección
        country_id: selectedCountry?.id || null,
        department_id: selectedDepartment?.id || null,
        calle: calle.trim() || null,
        numero: numero.trim() || null,
        barrio: barrio.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        latitud: latitud.trim() || null,
        longitud: longitud.trim() || null,
        updated_at: new Date().toISOString(),
      };


      // Update Supabase user profile
      const { error } = await supabaseClient
        .from('profiles')
        .update(updateData)
        .eq('id', currentUser!.id);

      if (error) {
        throw new Error(`Error de base de datos: ${error.message}`);
      }

      // Update the current user in the auth context immediately
      const updatedUser = {
        ...currentUser!,
        displayName: displayName.trim(),
        photoURL: photoURL || currentUser!.photoURL,
        phone: buildStoredPhone(selectedPhoneCountry, phoneNumber) || currentUser!.phone,
        location: address.trim() || currentUser!.location,
        bio: bio.trim() || currentUser!.bio,
      };
      
      updateCurrentUser(updatedUser);

      
      // Success - navigate immediately
      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') }
      ]);
      
    } catch (error) {
      throw error;
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Foto de perfil',
      'Selecciona una opción',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Elegir de galería', onPress: handleSelectPhoto },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Perfil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Foto de Perfil</Text>
            <View style={styles.photoContainer}>
              <TouchableOpacity onPress={showImageOptions} style={styles.photoButton}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.placeholderPhoto}>
                    <User size={40} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.photoOverlay}>
                  <Camera size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Toca para cambiar la foto</Text>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Básica</Text>
            
            <Input
              label="Nombre completo *"
              placeholder="Tu nombre completo"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon={<User size={20} color="#6B7280" />}
            />

            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              leftIcon={<Mail size={20} color="#6B7280" />}
              style={styles.disabledInput}
            />

            <View style={styles.phoneFieldGroup}>
              <Text style={styles.phoneFieldLabel}>Teléfono</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={styles.phoneCountryButton}
                  onPress={() => {
                    setPhoneCountryQuery('');
                    setShowPhoneCountryModal(true);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.phoneCountryFlagWrap}>
                    {selectedPhoneCountry?.flagPng ? (
                      <Image
                        source={{ uri: selectedPhoneCountry.flagPng }}
                        style={styles.phoneCountryFlag}
                      />
                    ) : (
                      <Text style={styles.phoneCountryEmoji}>{selectedPhoneCountry?.emoji || '🌐'}</Text>
                    )}
                  </View>
                  <Text style={styles.phoneCountryCode}>
                    {selectedPhoneCountry?.phoneCode || '+598'}
                  </Text>
                  <ChevronDown size={16} color="#6B7280" />
                </TouchableOpacity>

                <View style={styles.phoneNumberInputContainer}>
                  <View style={styles.phoneInputIcon}>
                    <Phone size={20} color="#6B7280" />
                  </View>
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="095148335"
                    placeholderTextColor="#9CA3AF"
                    value={phoneNumber}
                    onChangeText={(text) => setPhoneNumber(sanitizePhoneNumber(text))}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={() => setShowCountryModal(true)}>
              <Input
                label="País"
                placeholder="Selecciona tu país"
                value={selectedCountry?.name || ''}
                editable={false}
                leftIcon={<MapPin size={20} color="#6B7280" />}
                rightIcon={<ChevronDown size={20} color="#6B7280" />}
              />
            </TouchableOpacity>

            <View style={styles.departmentInputGroup}>
              <Input
                label="Departamento"
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
              label="Calle"
              placeholder="Nombre de la calle"
              value={calle}
              onChangeText={setCalle}
              editable={!!selectedDepartment}
              style={!selectedDepartment ? styles.disabledInput : undefined}
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input
                  label="Número"
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
                  Esto completará automáticamente el código postal y barrio
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
                      Tipo: {result.type}
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

            <Input
              label="Biografía"
              placeholder="Cuéntanos sobre ti..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Botón de guardar */}
          <View style={styles.saveButtonContainer}>
            <Button
              title={loading ? "Guardando..." : "Guardar Cambios"}
              onPress={handleSaveProfile}
              loading={loading || uploadingImage}
              size="large"
              disabled={loading || uploadingImage || !displayName.trim()}
            />
          </View>
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

      {/* Modal de selección de código telefónico */}
      <Modal
        visible={showPhoneCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Código telefónico</Text>
              <TouchableOpacity onPress={() => setShowPhoneCountryModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Buscar país"
              placeholder="Nombre, ISO o código"
              value={phoneCountryQuery}
              onChangeText={setPhoneCountryQuery}
              autoCapitalize="none"
              leftIcon={<Search size={20} color="#6B7280" />}
            />

            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filteredPhoneCountries.map((country) => {
                const isSelected = selectedPhoneCountry?.id === country.id;

                return (
                  <TouchableOpacity
                    key={country.id}
                    style={[
                      styles.phoneCountryOptionItem,
                      isSelected && styles.selectedPhoneCountryOptionItem,
                    ]}
                    onPress={() => {
                      setSelectedPhoneCountry(country);
                      setShowPhoneCountryModal(false);
                    }}
                  >
                    <View style={styles.phoneCountryOptionLeft}>
                      <View style={styles.phoneCountryFlagWrap}>
                        {country.flagPng ? (
                          <Image source={{ uri: country.flagPng }} style={styles.phoneCountryFlag} />
                        ) : (
                          <Text style={styles.phoneCountryEmoji}>{country.emoji || '🌐'}</Text>
                        )}
                      </View>
                      <View style={styles.phoneCountryOptionTextGroup}>
                        <Text
                          style={[
                            styles.phoneCountryOptionName,
                            isSelected && styles.selectedPhoneCountryOptionName,
                          ]}
                        >
                          {country.name}
                        </Text>
                        <Text style={styles.phoneCountryOptionCode}>
                          {country.iso2 || '--'} · {country.phoneCode || ''}
                        </Text>
                      </View>
                    </View>

                    {isSelected && <Check size={16} color="#2D6A6F" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de selección de departamento */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30, // Add padding at the top to show status bar
    paddingBottom: 20,
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
    minHeight: 60,
  },
  backButton: {
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flexShrink: 1,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  formCard: {
    margin: 16,
  },
  photoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 16,
  },
  photoContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  photoButton: {
    position: 'relative',
    marginBottom: 8,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photoHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 10,
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
  saveButtonContainer: {
    marginTop: 24,
    marginBottom: 20,
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
  phoneFieldGroup: {
    marginBottom: 16,
  },
  phoneFieldLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  phoneCountryButton: {
    minWidth: 128,
    maxWidth: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phoneCountryFlagWrap: {
    width: 24,
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  phoneCountryFlag: {
    width: '100%',
    height: '100%',
  },
  phoneCountryEmoji: {
    fontSize: 15,
  },
  phoneCountryCode: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#111827',
  },
  phoneNumberInputContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  phoneInputIcon: {
    marginRight: 12,
  },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    paddingVertical: 0,
  },
  phoneCountryOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedPhoneCountryOptionItem: {
    backgroundColor: '#F0F9FF',
  },
  phoneCountryOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneCountryOptionTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  phoneCountryOptionName: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  selectedPhoneCountryOptionName: {
    color: '#2D6A6F',
    fontFamily: 'Inter-Medium',
  },
  phoneCountryOptionCode: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
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
});
