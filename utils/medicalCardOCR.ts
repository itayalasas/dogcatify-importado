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
 * Process a vaccination or deworming card image and extract information using OpenAI Vision
 */
export const extractMedicalRecordFromImage = async (
  imageUri: string,
  recordType: 'vaccine' | 'deworming',
  petInfo?: {
    species?: 'dog' | 'cat';
    name?: string;
  }
): Promise<ExtractedMedicalRecord> => {
  try {
    console.log(`Processing ${recordType} card image:`, imageUri);

    // Convert image to base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

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

    console.log('Extracted data:', result.data);

    return result.data as ExtractedMedicalRecord;
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
