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
  notes?: string;
}

/**
 * Process a vaccination or deworming card image and extract information using AI
 * This uses Google Cloud Vision API or a similar service
 */
export const extractMedicalRecordFromImage = async (
  imageUri: string,
  recordType: 'vaccine' | 'deworming'
): Promise<ExtractedMedicalRecord> => {
  try {
    console.log(`Processing ${recordType} card image:`, imageUri);

    // Convert image to base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // TODO: Replace with actual API endpoint
    // This should call Google Cloud Vision API, AWS Textract, or similar service
    const apiEndpoint = process.env.EXPO_PUBLIC_VISION_API_ENDPOINT;
    const apiKey = process.env.EXPO_PUBLIC_VISION_API_KEY;

    if (!apiEndpoint || !apiKey) {
      throw new Error('Vision API not configured. Please set up environment variables.');
    }

    // Make API request to extract text
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 50,
            },
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 50,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const result = await response.json();
    const textAnnotations = result.responses[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';

    console.log('Extracted text:', fullText);

    // Parse the extracted text to find medical record information
    const extractedData = parseExtractedText(fullText, recordType);

    return extractedData;
  } catch (error) {
    console.error('Error extracting medical record from image:', error);
    throw error;
  }
};

/**
 * Parse extracted text to find medical record information
 */
const parseExtractedText = (
  text: string,
  recordType: 'vaccine' | 'deworming'
): ExtractedMedicalRecord => {
  const result: ExtractedMedicalRecord = { type: recordType };

  // Common Spanish keywords for medical records
  const vaccineKeywords = [
    'rabia', 'dhpp', 'parvo', 'moquillo', 'hepatitis', 'leptospirosis',
    'bordetella', 'leucemia', 'rinotraqueitis', 'calicivirus', 'panleucopenia',
    'quintuple', 'sextuple', 'triple', 'vacuna', 'vacunacion'
  ];

  const dewormingKeywords = [
    'desparasitante', 'antiparasitario', 'parasitos', 'gusanos',
    'drontal', 'milbemax', 'panacur', 'advocate', 'revolution',
    'heartgard', 'nexgard', 'bravecto', 'simparica'
  ];

  const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const vetRegex = /(?:vet(?:erinario)?|dr|dra|doctor|doctora)[:\s]*([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+)/i;

  // Extract dates
  const dates = [];
  let dateMatch;
  while ((dateMatch = dateRegex.exec(text)) !== null) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3];

    // Handle 2-digit years
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }

    dates.push(`${day}/${month}/${year}`);
  }

  if (dates.length > 0) {
    result.applicationDate = dates[0];
    if (dates.length > 1) {
      result.nextDueDate = dates[1];
    }
  }

  // Extract veterinarian name
  const vetMatch = text.match(vetRegex);
  if (vetMatch && vetMatch[1]) {
    result.veterinarian = vetMatch[1].trim();
  }

  // Extract vaccine or deworming product name
  const textLower = text.toLowerCase();
  const keywords = recordType === 'vaccine' ? vaccineKeywords : dewormingKeywords;

  for (const keyword of keywords) {
    if (textLower.includes(keyword)) {
      if (recordType === 'vaccine') {
        result.name = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      } else {
        result.productName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
      break;
    }
  }

  // Store full text as notes for reference
  result.notes = text.substring(0, 200);

  return result;
};

/**
 * Simulate OCR extraction for demo purposes (when API is not available)
 */
export const simulateOCRExtraction = async (
  recordType: 'vaccine' | 'deworming'
): Promise<ExtractedMedicalRecord> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const result: ExtractedMedicalRecord = { type: recordType };

  // Generate sample data
  const today = new Date();
  const applicationDate = new Date(today);
  applicationDate.setDate(applicationDate.getDate() - 30);

  const nextDate = new Date(applicationDate);
  nextDate.setMonth(nextDate.getMonth() + (recordType === 'vaccine' ? 12 : 3));

  result.applicationDate = formatDate(applicationDate);
  result.nextDueDate = formatDate(nextDate);
  result.veterinarian = 'Dr. García';

  if (recordType === 'vaccine') {
    result.name = 'DHPP (Quíntuple)';
    result.notes = 'Vacuna aplicada sin reacciones adversas';
  } else {
    result.productName = 'Drontal Plus';
    result.notes = 'Desparasitación interna completa';
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
