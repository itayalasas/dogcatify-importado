import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabaseClient } from '../lib/supabase';
import { NotificationService } from '@/utils/notifications';

const businessTypes = [
  { id: 'veterinary', name: 'Veterinaria', icon: '🏥', description: 'Servicios médicos para mascotas' },
  { id: 'grooming', name: 'Peluquería', icon: '✂️', description: 'Servicios de estética y cuidado' },
  { id: 'training', name: 'Entrenamiento', icon: '🎾', description: 'Adiestramiento y educación' },
  { id: 'boarding', name: 'Guardería', icon: '🏠', description: 'Cuidado temporal de mascotas' },
  { id: 'walking', name: 'Paseo', icon: '🚶', description: 'Servicios de paseo' },
  { id: 'store', name: 'Tienda', icon: '🛍️', description: 'Venta de productos para mascotas' },
];

export default function PartnerRegister() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setDocuments([...documents, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const uploadDocument = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `documents/${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!selectedType || !businessName || !ownerName || !email || !phone || !address) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      // Upload documents
      const documentUrls = await Promise.all(
        documents.map(doc => uploadDocument(doc))
      );

      // Create partner request
      const docRef = await addDoc(collection(db, 'partnerRequests'), {
        businessType: selectedType,
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim(),
        documents: documentUrls,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send partner registration confirmation email
      try {
        const businessTypeName = businessTypes.find(type => type.id === selectedType)?.name || selectedType;
        await NotificationService.sendPartnerRegistrationEmail(
          email.trim(),
          businessName.trim(),
          businessTypeName
        );
      } catch (emailError) {
        console.error('Error sending partner registration email:', emailError);
        // Continue with registration process even if email fails
      }

      Alert.alert(
        'Registro exitoso',
        'Tu solicitud para ser aliado ha sido enviada. Te notificaremos cuando sea aprobada.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error submitting partner request:', error);
      Alert.alert('Error', 'No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Registro de Aliado</Text>
        <Text style={styles.subtitle}>
          Únete a nuestra red de proveedores de servicios para mascotas
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Tipo de Negocio</Text>
        <View style={styles.businessTypes}>
          {businessTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.businessType,
                selectedType === type.id && styles.selectedBusinessType,
              ]}
              onPress={() => setSelectedType(type.id)}
            >
              <Text style={styles.businessTypeIcon}>{type.icon}</Text>
              <Text style={styles.businessTypeName}>{type.name}</Text>
              <Text style={styles.businessTypeDescription}>{type.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Información del Negocio</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nombre del negocio *"
          value={businessName}
          onChangeText={setBusinessName}
        />

        <TextInput
          style={styles.input}
          placeholder="Nombre del propietario *"
          value={ownerName}
          onChangeText={setOwnerName}
        />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico *"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Teléfono *"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Dirección *"
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descripción de servicios"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.sectionTitle}>Documentos</Text>
        <TouchableOpacity style={styles.documentButton} onPress={pickDocument}>
          <Text style={styles.documentButtonText}>Agregar Documento</Text>
        </TouchableOpacity>

        {documents.map((doc, index) => (
          <View key={index} style={styles.documentPreview}>
            <Image source={{ uri: doc }} style={styles.documentImage} />
            <TouchableOpacity
              style={styles.removeDocument}
              onPress={() => setDocuments(documents.filter((_, i) => i !== index))}
            >
              <Text style={styles.removeDocumentText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2D6A6F',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 20,
  },
  businessTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  businessType: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  selectedBusinessType: {
    borderColor: '#2D6A6F',
    backgroundColor: '#f0f8f8',
  },
  businessTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  businessTypeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessTypeDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  documentButton: {
    backgroundColor: '#2D6A6F',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  documentButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  documentPreview: {
    position: 'relative',
    marginBottom: 10,
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  removeDocument: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeDocumentText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#2D6A6F',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});