import * as FileSystem from 'expo-file-system/legacy';
import { supabaseClient } from '../lib/supabase';

export interface VideoInfo {
  uri: string;
  duration: number;
  size: number;
  width?: number;
  height?: number;
}

export const MAX_VIDEO_DURATION = 180; // 3 minutes in seconds
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export const validateVideo = async (videoUri: string): Promise<{
  isValid: boolean;
  error?: string;
  info?: VideoInfo;
}> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);

    if (!fileInfo.exists) {
      return { isValid: false, error: 'El archivo de video no existe' };
    }

    const fileSize = fileInfo.size || 0;

    if (fileSize > MAX_VIDEO_SIZE) {
      return {
        isValid: false,
        error: `El video es demasiado grande (máx. ${MAX_VIDEO_SIZE / 1024 / 1024}MB)`
      };
    }

    // For now, we'll return success
    // In production, you would get actual duration from expo-av
    const info: VideoInfo = {
      uri: videoUri,
      duration: 60, // Placeholder
      size: fileSize
    };

    return { isValid: true, info };
  } catch (error) {
    return { isValid: false, error: 'Error al validar el video' };
  }
};

export const uploadVideoToStorage = async (
  videoUri: string,
  petId: string,
  albumId: string
): Promise<string> => {
  try {

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `pets/albums/${petId}/${albumId}/${timestamp}-${randomId}.mp4`;


    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(videoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob
    const blob = base64ToBlob(base64, 'video/mp4');

    // Upload to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from('dogcatify')
      .upload(filename, blob, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }


    const { data: { publicUrl } } = supabaseClient.storage
      .from('dogcatify')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    throw error;
  }
};

// Helper function to convert base64 to Blob
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeType });
};

// Generate thumbnail from video
export const generateVideoThumbnail = async (videoUri: string): Promise<string | null> => {
  try {
    // In production, use expo-video-thumbnails or similar
    // For now, return null (will use default video icon)
    return null;
  } catch (error) {
    return null;
  }
};
