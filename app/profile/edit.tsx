import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, Platform, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Camera, Upload, User, Phone, MapPin, Mail, ChevronDown, Check, Search, X, LocateFixed } from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { toast } from '../../components/ui/Toast';
import { colors, fonts, radius, spacing, touchTarget, typography } from '../../constants/theme';
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
      console.error('Error loading user address data:', error);
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
      Alert.alert('Información incompleta', 'Completá calle, número, departamento y país para buscar la ubicación');
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
      
      console.log('Geocoding query:', query);
      console.log('Search URL:', searchUrl);

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'DogCatiFy/1.0 (contact@dogcatify.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`Error en la API de geocodificación: ${response.status}`);
      }

      const results = await response.json();
      console.log('Geocoding results:', results);

      if (!results || results.length === 0) {
        Alert.alert('Sin resultados', 'No encontramos ubicaciones para esa dirección. Revisá los datos e intentá de nuevo.');
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

      console.log('Filtered house results:', houseResults);

      if (houseResults.length === 0) {
        // Si no hay resultados de tipo "house", mostrar todos los resultados
        setGeocodingResults(results.slice(0, 5));
      } else {
        setGeocodingResults(houseResults.slice(0, 5));
      }

      setShowGeocodingResults(true);
    } catch (error) {
      console.error('Error en geocodificación:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Función para seleccionar un resultado de geocodificación
  const handleSelectGeocodingResult = (result: any) => {
    console.log('Selected geocoding result:', result);
    
    // Extraer información del display_name
    const displayName = result.display_name || '';
    const parts = displayName.split(',').map((part: string) => part.trim());
    
    console.log('Display name parts:', parts);
    console.log('Current street:', calle);
    console.log('Current number:', numero);
    console.log('Current department:', selectedDepartment?.name);
    console.log('Current country:', selectedCountry?.name);
    
    // Buscar código postal (patrón de 5 dígitos)
    const postalCodeMatch = displayName.match(/\b\d{5}\b/);
    if (postalCodeMatch) {
      setCodigoPostal(postalCodeMatch[0]);
      console.log('Found postal code:', postalCodeMatch[0]);
    }
    
    // Extraer barrio - buscar el elemento que viene después de la calle
    // Formato típico: "Número, Calle, Barrio, Departamento, País"
    let barrioFound = '';
    
    // Buscar el índice del elemento que contiene la calle
    const streetIndex = parts.findIndex((part: string) => 
      part.toLowerCase().includes(calle.toLowerCase())
    );
    
    console.log('Street found at index:', streetIndex);
    
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
        console.log('Barrio found:', barrioFound);
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
      console.log('Barrio from address details:', barrioFound);
    }
    
    // Si aún no se encontró, intentar con el tercer elemento (método original como fallback)
    if (!barrioFound && parts.length >= 3) {
      const possibleBarrio = parts[2];
      if (possibleBarrio && 
          possibleBarrio !== selectedDepartment?.name && 
          possibleBarrio !== selectedCountry?.name &&
          !possibleBarrio.match(/\b\d{5}\b/)) {
        barrioFound = possibleBarrio;
        console.log('Barrio from fallback method:', barrioFound);
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
    
    toast.success(
      'Ubicación encontrada',
      `Completamos los datos automáticamente.${barrioFound ? ` Barrio: ${barrioFound}.` : ''}`
    );
  };

  const handleSelectPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitamos permiso para acceder a tu galería');
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
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Necesitamos permiso para usar la cámara');
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
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset): Promise<string> => {
    try {
      setUploadingImage(true);
      const filename = `profiles/${currentUser!.id}/${Date.now()}.jpg`;
      return await uploadImage(imageAsset.uri, filename);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const updateUserPostsAndComments = async (newPhotoURL: string, newDisplayName: string) => {
    try {
      console.log('Updating user posts with new data...');
      // Update all posts by this user
      const { error: postsError } = await supabaseClient
        .from('posts')
        .update({
          // Posts table doesn't have author column, it uses user_id reference
          // The author info is fetched via join with profiles table
        })
        .eq('user_id', currentUser!.id);
      
      if (postsError) {
        console.error('Error updating posts:', postsError);
      } else {
        console.log('Posts updated successfully');
      }

      console.log('Updating user comments with new data...');
      // Comments table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table
      console.log('Comments use user_id reference, no direct update needed');

      console.log('Updating user pet albums with new data...');
      // Pet albums table doesn't have author column, it uses user_id reference
      // The author info is fetched via join with profiles table
      console.log('Pet albums use user_id reference, no direct update needed');

      console.log('Successfully updated all user posts and comments');
    } catch (error) {
      console.error('Error updating user posts and comments:', error);
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

    console.log('Starting profile save process...');
    console.log('Current user ID:', currentUser.id);
    console.log('Display name:', displayName.trim());
    console.log('Selected image:', selectedImage ? 'Yes' : 'No');

    setLoading(true);
    try {
      let photoURL = profileImage;

      // Upload new image if selected
      if (selectedImage) {
        console.log('Uploading new image...');
        try {
          photoURL = await uploadImageToStorage(selectedImage);
          console.log('Image uploaded successfully:', photoURL);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          setLoading(false);
          Alert.alert('Error', 'No se pudo subir la imagen. ¿Querés continuar sin cambiar la foto?', [
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
      console.error('Error in handleSaveProfile:', error);
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
      console.error('Error saving profile without image:', error);
      Alert.alert('Error', `No se pudo actualizar el perfil: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveProfileData = async (photoURL: string | null) => {
    try {
      console.log('Updating Supabase profile...');
      
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

      console.log('Update data:', updateData);

      // Update Supabase user profile
      const { error } = await supabaseClient
        .from('profiles')
        .update(updateData)
        .eq('id', currentUser!.id);

      if (error) {
        console.error('Supabase profile update error:', error);
        throw new Error(`Error de base de datos: ${error.message}`);
      }
      console.log('Supabase profile updated successfully');

      // Update the current user in the auth context immediately
      const updatedUser = {
        ...currentUser!,
        displayName: displayName.trim(),
        photoURL: photoURL || currentUser!.photoURL,
        phone: buildStoredPhone(selectedPhoneCountry, phoneNumber) || currentUser!.phone,
        location: address.trim() || currentUser!.location,
        bio: bio.trim() || currentUser!.bio,
      };
      
      console.log('Updating current user in context...');
      updateCurrentUser(updatedUser);

      console.log('Profile save completed successfully');
      
      // Success - navigate immediately
      toast.success('Perfil actualizado');
      router.replace('/(tabs)/profile');
      
    } catch (error) {
      console.error('Error in saveProfileData:', error);
      throw error;
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Foto de perfil',
      'Elegí una opción',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Elegir de galería', onPress: handleSelectPhoto },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Editar perfil" onBack={() => router.push('/(tabs)/profile')} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.photoContainer}>
              <TouchableOpacity
                onPress={showImageOptions}
                style={styles.photoButton}
                accessibilityRole="button"
                accessibilityLabel="Cambiar foto de perfil"
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.placeholderPhoto}>
                    <User size={40} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.photoOverlay}>
                  <Camera size={20} color={colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tocá para cambiar la foto</Text>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Información básica</Text>
            
            <Input
              label="Nombre completo *"
              placeholder="Tu nombre completo"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon={<User size={20} color={colors.textTertiary} />}
            />

            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              leftIcon={<Mail size={20} color={colors.textTertiary} />}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Código de país ${selectedPhoneCountry?.phoneCode || '+598'}. Cambiar`}
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
                  <ChevronDown size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                <View style={styles.phoneNumberInputContainer}>
                  <View style={styles.phoneInputIcon}>
                    <Phone size={20} color={colors.textTertiary} />
                  </View>
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="095148335"
                    placeholderTextColor={colors.textTertiary}
                    value={phoneNumber}
                    onChangeText={(text) => setPhoneNumber(sanitizePhoneNumber(text))}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    accessibilityLabel="Número de teléfono"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={() => setShowCountryModal(true)} accessibilityRole="button" accessibilityLabel={`País: ${selectedCountry?.name || 'sin elegir'}`}>
              <View pointerEvents="none">
              <Input
                label="País"
                placeholder="Seleccioná tu país"
                value={selectedCountry?.name || ''}
                editable={false}
                leftIcon={<MapPin size={20} color={colors.textTertiary} />}
                rightIcon={<ChevronDown size={20} color={colors.icon} />}
              />
              </View>
            </TouchableOpacity>

            <View style={styles.departmentInputGroup}>
              <Input
                label="Departamento"
                placeholder={selectedCountry ? "Departamento..." : "Primero seleccioná un país"}
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

            {/* Botón de geocodificación */}
            {calle.trim() && numero.trim() && selectedDepartment && selectedCountry && (
              <View style={styles.geocodingSection}>
                <Button
                  title={isGeocoding ? "Buscando ubicación..." : "Buscar ubicación exacta"}
                  icon={<LocateFixed size={18} color={colors.primary} />}
                  onPress={performGeocoding}
                  loading={isGeocoding}
                  variant="outline"
                  size="medium"
                />
                <Text style={styles.geocodingHint}>
                  Completa automáticamente el código postal y el barrio
                </Text>
              </View>
            )}

            {/* Resultados de geocodificación */}
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
              placeholder="Contanos sobre vos..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Botón de guardar */}
          <View style={styles.saveButtonContainer}>
            <Button
              title={loading ? "Guardando..." : "Guardar cambios"}
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
              <Text style={styles.modalTitle} accessibilityRole="header">Seleccionar país</Text>
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
              <Text style={styles.modalTitle} accessibilityRole="header">Código telefónico</Text>
              <IconButton
                icon={<X size={22} color={colors.textSecondary} />}
                onPress={() => setShowPhoneCountryModal(false)}
                accessibilityLabel="Cerrar"
              />
            </View>

            <Input
              label="Buscar país"
              placeholder="Nombre, ISO o código"
              value={phoneCountryQuery}
              onChangeText={setPhoneCountryQuery}
              autoCapitalize="none"
              leftIcon={<Search size={20} color={colors.textTertiary} />}
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

                    {isSelected && <Check size={16} color={colors.primary} />}
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
    backgroundColor: colors.background,
    paddingTop: 30, // Add padding at the top to show status bar
    paddingBottom: spacing.xl,
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
    fontFamily: fonts.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  formCard: {
    margin: spacing.lg,
  },
  photoSection: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  photoContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  photoButton: {
    position: 'relative',
    marginBottom: spacing.sm,
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
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  photoHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xxl,
    paddingHorizontal: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
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
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  saveButtonContainer: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  modalCloseText: {
    fontSize: 18,
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
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    flex: 1,
  },
  selectedOptionText: {
    color: colors.primary,
    fontFamily: fonts.medium,
  },
  phoneFieldGroup: {
    marginBottom: spacing.lg,
  },
  phoneFieldLabel: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  phoneCountryButton: {
    minWidth: 128,
    maxWidth: 160,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  phoneCountryFlagWrap: {
    width: 24,
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
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
    fontFamily: fonts.medium,
    color: colors.text,
  },
  phoneNumberInputContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  phoneInputIcon: {
    marginRight: spacing.md,
  },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: 0,
  },
  phoneCountryOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  selectedPhoneCountryOptionItem: {
    backgroundColor: colors.primarySoft,
  },
  phoneCountryOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneCountryOptionTextGroup: {
    marginLeft: spacing.md,
    flex: 1,
  },
  phoneCountryOptionName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  selectedPhoneCountryOptionName: {
    color: colors.primary,
    fontFamily: fonts.medium,
  },
  phoneCountryOptionCode: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  geocodingSection: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  geocodingHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.primaryStrong,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  geocodingResults: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  geocodingResultsTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
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
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  geocodingResultType: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
  cancelGeocodingButton: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  cancelGeocodingText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textTertiary,
  },
  coordinatesDisplay: {
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successSoft,
    marginBottom: spacing.lg,
  },
  coordinatesTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  coordinatesText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.success,
    marginBottom: 2,
  },
  coordinatesNote: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.success,
    marginTop: spacing.sm,
  },
});
