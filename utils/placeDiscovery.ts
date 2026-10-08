import * as FileSystem from 'expo-file-system/legacy';
import { envConfig } from './envConfig';
import { supabaseClient } from '../lib/supabase';
import { uploadImage } from './imageUpload';

export interface PlaceAiSuggestion {
  success: boolean;
  source: 'ai_vision+google_places' | 'ai_vision_only';
  name: string;
  category: string;
  address: string;
  phone: string;
  rating: number | null;
  description: string;
  coordinates: { latitude: number; longitude: number } | null;
  googlePlaceId: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Sends a photo of a place to the analyze-place-photo Edge Function, which
 * reads visible text with OpenAI Vision and cross-checks it against Google
 * Places to auto-fill the place registration form.
 */
export const analyzePlacePhoto = async (
  imageUri: string,
  coords?: { latitude: number; longitude: number }
): Promise<PlaceAiSuggestion> => {
  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64Image) {
    throw new Error('No se pudo leer la imagen');
  }

  const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration not found');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-place-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      imageBase64: base64Image,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || result.error || 'No se pudo analizar la foto');
  }

  return result as PlaceAiSuggestion;
};

export interface PlaceRequestPayload {
  requestedBy: string;
  submissionMethod: 'photo_ai' | 'manual';
  name: string;
  category: string;
  address: string;
  phone?: string;
  description: string;
  petAmenities: string[];
  coordinates?: { latitude: number; longitude: number } | null;
  rating?: number | null;
  sourcePhotoUri?: string | null;
  googlePlaceId?: string | null;
  aiRawResponse?: unknown;
}

/**
 * Uploads the source photo (if any) and inserts the pending place_requests
 * row that will show up in the admin approval inbox.
 */
export const submitPlaceRequest = async (payload: PlaceRequestPayload): Promise<void> => {
  let sourcePhotoUrl: string | null = null;

  if (payload.sourcePhotoUri) {
    const path = `place-requests/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    sourcePhotoUrl = await uploadImage(payload.sourcePhotoUri, path);
  }

  const { error } = await supabaseClient.from('place_requests').insert([{
    requested_by: payload.requestedBy,
    submission_method: payload.submissionMethod,
    name: payload.name,
    category: payload.category,
    address: payload.address,
    phone: payload.phone || null,
    description: payload.description,
    pet_amenities: payload.petAmenities,
    coordinates: payload.coordinates || null,
    rating: payload.rating ?? null,
    source_photo_url: sourcePhotoUrl,
    images: sourcePhotoUrl ? [sourcePhotoUrl] : [],
    google_place_id: payload.googlePlaceId || null,
    ai_raw_response: payload.aiRawResponse ?? null,
  }]);

  if (error) {
    throw error;
  }
};
