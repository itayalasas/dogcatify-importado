import * as FileSystem from 'expo-file-system';

/**
 * Extracted medical record information
 */
export interface ExtractedMedicalRecord {
  type: 'vaccine' | 'deworming';
  name?: string;
  productName?: string;
  applicationDate?: string;
  nextDueDate?: string;
  veterinarian?: string;
  clinic?: string;
  batchNumber?: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Response from the extraction API with multiple records
 */
export interface ExtractedMedicalRecords {
  records: ExtractedMedicalRecord[];
  totalFound: number;
}

/**
 * Process a vaccination or deworming card image and extract ALL records using OpenAI Vision
 */
export const extractMedicalRecordsFromImage = async (
  imageUri: string,
  recordType: 'vaccine' | 'deworming',
  petInfo?: {
    species?: 'dog' | 'cat';
    name?: string;
  }
): Promise<ExtractedMedicalRecords> => {
  try {
    console.log(`Processing ${recordType} card image:`, imageUri);

    if (!imageUri) {
      throw new Error('No se proporcionó una imagen válida');
    }

    // Validate FileSystem module
    if (!FileSystem || !FileSystem.EncodingType) {
      throw new Error('Módulo FileSystem no disponible');
    }

    console.log('Reading image as base64...');
    console.log('FileSystem available:', !!FileSystem);
    console.log('FileSystem.EncodingType available:', !!FileSystem?.EncodingType);
    console.log('FileSystem.EncodingType.Base64:', FileSystem?.EncodingType?.Base64);

    // Convert image to base64
    let base64Image: string;
    try {
      base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('Image converted to base64, length:', base64Image?.length || 0);
    } catch (readError: any) {
      console.error('Error reading image file:', readError);
      console.error('Error details:', JSON.stringify(readError, null, 2));
      throw new Error(`No se pudo leer la imagen: ${readError.message || 'Error desconocido'}`);
    }

    if (!base64Image || base64Image.length === 0) {
      throw new Error('La imagen está vacía o no se pudo leer');
    }

    // Get Supabase URL and anon key from environment
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }

    // Call our Edge Function
    const functionUrl = `${supabaseUrl}/functions/v1/extract-medical-card-info`;

    console.log('Calling Edge Function:', functionUrl);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        imageBase64: base64Image,
        recordType,
        petSpecies: petInfo?.species,
        petName: petInfo?.name,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge Function error:', errorText);
      throw new Error(`Edge Function error: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract information');
    }

    console.log(`Extracted ${result.totalFound} records:`, result.records);

    return {
      records: result.records as ExtractedMedicalRecord[],
      totalFound: result.totalFound || result.records.length
    };
  } catch (error) {
    console.error('Error extracting medical record from image:', error);
    throw error;
  }
};

/**
 * Simulate OCR extraction for demo purposes (when API is not available)
 */
export const simulateOCRExtraction = async (
  recordType: 'vaccine' | 'deworming'
): Promise<ExtractedMedicalRecord> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const result: ExtractedMedicalRecord = {
    type: recordType,
    confidence: 'medium'
  };

  // Generate sample data
  const today = new Date();
  const applicationDate = new Date(today);
  applicationDate.setDate(applicationDate.getDate() - 30);

  const nextDate = new Date(applicationDate);
  nextDate.setMonth(nextDate.getMonth() + (recordType === 'vaccine' ? 12 : 3));

  result.applicationDate = formatDate(applicationDate);
  result.nextDueDate = formatDate(nextDate);
  result.veterinarian = 'Dr. García';
  result.clinic = 'Clínica Veterinaria San Martín';

  if (recordType === 'vaccine') {
    result.name = 'DHPP (Quíntuple)';
    result.batchNumber = 'VAC2024-001';
    result.notes = 'Vacuna aplicada sin reacciones adversas';
  } else {
    result.productName = 'Drontal Plus';
    result.notes = 'Desparasitación interna completa. Parásitos: Lombrices intestinales';
  }

  return result;
};

/**
 * Format date as DD/MM/YYYY
 */
const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
