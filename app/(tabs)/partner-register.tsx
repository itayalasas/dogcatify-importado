import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image , Modal, TextInput, Switch } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Building, Camera, MapPin, Phone, Mail, FileText, DollarSign, Truck , ChevronDown, Check, X } from 'lucide-react-native';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { IconButton } from '../../components/ui/IconButton';
import { toast } from '../../components/ui/Toast';
import { FormSection } from '../../components/partner-setup/FormSection';
import { FormFooter } from '../../components/partner-setup/FormFooter';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import * as ImagePicker from 'expo-image-picker';

import { supabaseClient } from '../../lib/supabase';
import { NotificationService } from '@/utils/notifications';
import { PartnerServiceAgreement } from '../../components/PartnerServiceAgreement';
import { envConfig } from '../../utils/envConfig';
import { resolvePartnerPlanTier } from '../../utils/partnerPlans';
import { resolveSubscriptionPlanLimits } from '../../utils/subscriptionPlanLimits';
import { colors, radius, shadows, spacing, typography } from '../../constants/theme';

const SYSTEM_CONFIG_KEY = 'system_config';

// Mercado Pago credentials now live in partner_payment_credentials, keyed by
// user_id — every business of this user already shares the same row, so
// there's nothing to copy anymore. Just flip mercadopago_connected on the
// newly created business if the user already has credentials on file.
const replicateMercadoPagoConfig = async (userId: string) => {
  try {
    const { data: creds, error } = await supabaseClient
      .from('partner_payment_credentials')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking existing MP credentials:', error);
      return;
    }

    if (!creds) {
      console.log('No existing Mercado Pago configuration found for user');
      return;
    }

    const { data: existingPartners } = await supabaseClient
      .from('partners')
      .select('commission_percentage')
      .eq('user_id', userId)
      .eq('mercadopago_connected', true)
      .limit(1);

    // Get the newly created partner (last one created by this user)
    const { data: newPartners, error: newPartnerError } = await supabaseClient
      .from('partners')
      .select('id, business_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (newPartnerError || !newPartners || newPartners.length === 0) {
      console.error('Error finding new partner:', newPartnerError);
      return;
    }

    const newPartner = newPartners[0];

    const { error: updateError } = await supabaseClient
      .from('partners')
      .update({
        mercadopago_connected: true,
        commission_percentage: existingPartners?.[0]?.commission_percentage ?? 5.0,
        updated_at: new Date().toISOString()
      })
      .eq('id', newPartner.id);

    if (updateError) {
      console.error('Error marking new partner as MP-connected:', updateError);
    } else {
      console.log('New partner marked as Mercado Pago connected:', newPartner.business_name);
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

type RegistrationPlanMeta = {
  effectiveTier: 'starter' | 'growth' | 'pro';
  effectiveStatus: string;
  effectiveStartedAt: string | null;
  effectiveExpiresAt: string | null;
};

export default function PartnerRegister() {
  const { currentUser, updateCurrentUser } = useAuth();
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
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');
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
  const [rut, setRut] = useState('');
  
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
  const registrationPlanMetaRef = useRef<RegistrationPlanMeta | null>(null);

  // Estados para el contrato de servicio
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // Estados para IVA
  const [ivaRate, setIvaRate] = useState('0');
  const [ivaIncludedInPrice, setIvaIncludedInPrice] = useState(false);
  const [autoApprovePartners, setAutoApprovePartners] = useState(false);

  useEffect(() => {
    loadCountries();
    loadSystemConfig();
  }, []);

  const loadSystemConfig = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', SYSTEM_CONFIG_KEY)
        .maybeSingle();

      if (error) throw error;

      setAutoApprovePartners(Boolean(data?.value?.auto_approve_partners));
    } catch (error) {
      console.error('Error loading system config for partner registration:', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!selectedType || !businessName || !description || !calle || !numero || !selectedCountry || !selectedDepartment || !phone || !rut) {
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      return;
    }

    if (!agreementAccepted) {
      Alert.alert(
        'Contrato requerido',
        'Tenés que leer y aceptar el contrato de servicio para continuar',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    try {
      const { data: partnerRows, error: partnerCountError } = await supabaseClient
        .from('partners')
        .select('subscription_plan_tier, subscription_plan_status, subscription_plan_expires_at, subscription_plan_started_at')
        .eq('user_id', currentUser.id);

      if (partnerCountError) {
        throw partnerCountError;
      }

      const order: ('starter' | 'growth' | 'pro')[] = ['starter', 'growth', 'pro'];
      const representativePartner = (partnerRows || []).reduce((best: any, row: any) => {
        const resolvedTier = resolvePartnerPlanTier(
          row.subscription_plan_tier,
          row.subscription_plan_status,
          row.subscription_plan_expires_at
        ) as 'starter' | 'growth' | 'pro';

        if (!best) {
          return row;
        }

        const bestTier = resolvePartnerPlanTier(
          best.subscription_plan_tier,
          best.subscription_plan_status,
          best.subscription_plan_expires_at
        ) as 'starter' | 'growth' | 'pro';

        return order.indexOf(resolvedTier) > order.indexOf(bestTier) ? row : best;
      }, null);

      const effectiveTier = representativePartner
        ? (resolvePartnerPlanTier(
            representativePartner.subscription_plan_tier,
            representativePartner.subscription_plan_status,
            representativePartner.subscription_plan_expires_at
          ) as 'starter' | 'growth' | 'pro')
        : 'starter';
      const effectiveStatus = representativePartner?.subscription_plan_status || (autoApprovePartners ? 'active' : 'pending');
      const effectiveStartedAt = representativePartner?.subscription_plan_started_at || (autoApprovePartners ? new Date().toISOString() : null);
      const effectiveExpiresAt = representativePartner?.subscription_plan_expires_at || null;
      registrationPlanMetaRef.current = {
        effectiveTier,
        effectiveStatus,
        effectiveStartedAt,
        effectiveExpiresAt,
      };

      const partnerLimits = resolveSubscriptionPlanLimits({
        tier: effectiveTier,
        audience_target: 'partners',
      });

      const maxBusinessesAllowed = partnerLimits.partners.maxBusinesses;
      const { count: currentBusinessesCount, error: currentBusinessesError } = await supabaseClient
        .from('partners')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

      if (currentBusinessesError) {
        throw currentBusinessesError;
      }

      if (maxBusinessesAllowed !== null && (currentBusinessesCount || 0) >= maxBusinessesAllowed) {
        Alert.alert(
          'Límite alcanzado',
          `Tu plan actual permite registrar hasta ${maxBusinessesAllowed} negocio${maxBusinessesAllowed === 1 ? '' : 's'}. Actualizá tu suscripción para agregar otro negocio.`,
          [
            { text: 'Ver planes', onPress: () => router.push('/partner/subscription') },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }
    } catch (limitError) {
      console.error('Error validating partner business limit:', limitError);
      Alert.alert('Error', 'No se pudo validar el límite de negocios de tu plan. Intentá nuevamente.');
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
            'No se pudo subir el logo. ¿Querés continuar sin logo?',
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
            'No se pudieron subir las imágenes de la galería. ¿Querés continuar sin galería?',
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
      const currentUserId = currentUser?.id;
      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      let logoUrl = null;
      if (logo) {
        logoUrl = await uploadImage(logo, `partners/${currentUserId}/${Date.now()}_logo.jpg`);
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
      const currentUserId = currentUser?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      const registrationPlanMeta = registrationPlanMetaRef.current;
      if (!registrationPlanMeta) {
        throw new Error('No se pudieron resolver los datos de suscripción para el registro');
      }

      const {
        effectiveTier,
        effectiveStatus,
        effectiveStartedAt,
        effectiveExpiresAt,
      } = registrationPlanMeta;

      const parsedShippingCost = hasShipping ? parseFloat(shippingCost) || 0 : 0;
      const parsedFreeShippingThreshold = hasShipping ? parseFloat(freeShippingThreshold) || 0 : 0;

      const partnerPayload: any = {
        user_id: currentUserId,
        business_name: businessName.trim(),
        business_type: selectedType,
        subscription_plan_tier: effectiveTier,
        subscription_plan_status: effectiveStatus,
        subscription_plan_started_at: effectiveStartedAt,
        subscription_plan_expires_at: effectiveTier === 'starter' ? null : effectiveExpiresAt,
        description: description.trim(),
        address: `${calle.trim()} ${numero.trim()}${barrio ? ', ' + barrio : ''}, ${selectedDepartment?.name || ''}, ${selectedCountry?.name || ''}`,
        phone: phone.trim(),
        email: email.trim(),
        logo: logoUrl,
        images: imageUrls,
        has_shipping: hasShipping,
        shipping_cost: parsedShippingCost,
        country_id: selectedCountry?.id,
        department_id: selectedDepartment?.id,
        calle: calle.trim(),
        numero: numero.trim(),
        barrio: barrio.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        latitud: latitud.trim() || null,
        longitud: longitud.trim() || null,
        rut: rut.trim(),
        iva_rate: parseFloat(ivaRate) || 0,
        iva_included_in_price: ivaIncludedInPrice,
        is_active: true,
        is_verified: autoApprovePartners,
        approval_status: autoApprovePartners ? 'approved' : 'pending',
        rating: 0,
        reviews_count: 0,
        created_at: new Date().toISOString(),
      };

      if (selectedType === 'shop' && hasShipping) {
        partnerPayload.free_shipping_threshold = parsedFreeShippingThreshold;
      }
      
      // Create partner request
      let { error } = await supabaseClient
        .from('partners')
        .insert(partnerPayload);

      const errorText = String(error?.message || '');
      const thresholdColumnMissing =
        !!error &&
        (
          error?.code === '42703' ||
          error?.code === 'PGRST204' ||
          errorText.includes('free_shipping_threshold')
        );

      if (thresholdColumnMissing) {
        console.warn('free_shipping_threshold column missing in partners table. Retrying insert without threshold.');
        delete partnerPayload.free_shipping_threshold;

        const retry = await supabaseClient
          .from('partners')
          .insert(partnerPayload);

        error = retry.error;
      }

      if (error) throw error;
      
      console.log('Partner record created successfully');

      // Check if user has other businesses with Mercado Pago configured
      await replicateMercadoPagoConfig(currentUserId);
      
      // Update user profile to be a partner
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          is_partner: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUserId);

      if (profileError) throw profileError;

      if (currentUser) {
        updateCurrentUser({
          ...currentUser,
          isPartner: true,
        });
      }

      // Enviar notificación push al admin
      try {
        await sendNotificationToAdmin(
          'Nueva solicitud de aliado',
          `${businessName.trim()} ha solicitado unirse como ${businessTypes.find(t => t.id === selectedType)?.name}`,
          {
            type: 'partner_request',
            businessName: businessName.trim(),
            businessType: selectedType,
            userId: currentUserId,
            deepLink: '(admin-tabs)/requests'
          }
        );
        console.log('Push notification sent to admin');
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError);
      }

      toast.success(
        'Registro exitoso',
        autoApprovePartners
          ? 'Tu negocio fue aprobado automáticamente y ya quedó activo dentro de la plataforma.'
          : 'Tu solicitud para ser aliado ha sido enviada. Te notificaremos cuando sea aprobada.'
      );
      router.back();
    } catch (error) {
      console.error('Error creating partner record:', error);
      throw error;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={"Sumate como aliado"} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>Sumá tu negocio a la comunidad</Text>
          <Text style={styles.introDescription}>
            Ofrecé tus servicios a la comunidad de Patitas y hacé crecer tu negocio 🤝
          </Text>
        </Card>


        <FormSection title="Tipo de negocio">
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

          {/* Botón de geocodificación */}
          {calle.trim() && numero.trim() && selectedDepartment && selectedCountry && (
            <View style={styles.geocodingSection}>
              <Button
                title={isGeocoding ? "Buscando ubicación..." : "Buscar ubicación exacta"}
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

          {/* Mostrar coordenadas si están disponibles */}
          {(latitud || longitud) && (
            <View style={styles.coordinatesDisplay}>
              <Text style={styles.coordinatesTitle}>Coordenadas GPS</Text>
              <Text style={styles.coordinatesText}>
                Latitud: {latitud || 'No disponible'}
              </Text>
              <Text style={styles.coordinatesText}>
                Longitud: {longitud || 'No disponible'}
              </Text>
              {selectedGeocodingResult && (
                <Text style={styles.coordinatesNote}>
                  Ubicación verificada automáticamente
                </Text>
              )}
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

        <FormSection title="Fotos">
          <View style={styles.imageSection}>
            <Text style={styles.photoLabel}>Logo</Text>
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

          <View style={styles.imageSection}>
            <Text style={styles.photoLabel}>Galería (máx. 5)</Text>
            <TouchableOpacity
              style={styles.gallerySelector}
              onPress={handleSelectImages}
              accessibilityRole="button"
              accessibilityLabel="Agregar imágenes a la galería"
            >
              <Camera size={24} color={colors.primary} />
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

        </FormSection>

          {selectedType === 'shop' && (
            <FormSection title="Envíos">
            <View style={styles.shippingSection}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextBox}>
                  <Text style={styles.toggleLabel}>Ofrecés servicio de envío</Text>
                  <Text style={styles.toggleHint}>Activalo si entregás pedidos a domicilio</Text>
                </View>
                <Switch
                  value={hasShipping}
                  onValueChange={setHasShipping}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.white}
                  accessibilityLabel="Ofrecés servicio de envío"
                />
              </View>

              {hasShipping && (
                <>
                  <Input
                    label="Costo de envío"
                    placeholder="Ej: 500"
                    value={shippingCost}
                    onChangeText={setShippingCost}
                    keyboardType="numeric"
                    leftIcon={<DollarSign size={20} color={colors.textTertiary} />}
                  />

                  <Input
                    label="Umbral envío gratis"
                    placeholder="Ej: 5000"
                    value={freeShippingThreshold}
                    onChangeText={setFreeShippingThreshold}
                    keyboardType="numeric"
                    leftIcon={<Truck size={20} color={colors.textTertiary} />}
                  />
                </>
              )}
            </View>
            </FormSection>
          )}


        <FormSection title="Contrato">
          <View style={styles.agreementSection}>
            <TouchableOpacity
              style={styles.agreementCheckbox}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreementAccepted }}
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
                <FileText size={16} color={colors.primary} />
                <Text style={styles.readAgreementText}>Leer contrato completo</Text>
              </TouchableOpacity>
            )}
          </View>

        </FormSection>
      </ScrollView>

      <FormFooter>
            <Button
          title="Enviar solicitud"
          onPress={handleSubmit}
          loading={loading}
          size="large"
        />
      </FormFooter>

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
    paddingTop: spacing.lg,
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
  photoLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  introCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryMuted,
  },
  introTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  introDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  formCard: {
    margin: spacing.lg,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.md,
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
  imageSection: {
    marginBottom: spacing.xl,
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
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  gallerySelectorText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  imagePreview: {
    flexDirection: 'row',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
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
  coordinatesNote: {
    ...typography.captionStrong,
    color: colors.success,
    marginTop: spacing.sm,
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
  shippingSection: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shippingHeader: {
    marginBottom: spacing.lg,
  },
  shippingTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  shippingCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    ...typography.captionStrong,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text,
  },
  agreementSection: {
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  agreementCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  agreementTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  agreementText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  agreementLink: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
  readAgreementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  readAgreementText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});
