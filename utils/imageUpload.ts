/**
 * Utility for uploading images to Supabase Storage
 * Compatible with React Native
 */

import { supabaseClient } from '../lib/supabase';

export interface UploadImageOptions {
  bucket?: string;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

/**
 * Uploads an image to Supabase Storage
 * @param imageUri - Local URI of the image
 * @param path - Storage path where the image will be saved
 * @param options - Optional upload configuration
 * @returns Public URL of the uploaded image
 */
export const uploadImage = async (
  imageUri: string,
  path: string,
  options: UploadImageOptions = {}
): Promise<string> => {
  try {
    console.log(`Uploading image to path: ${path}`);
    console.log(`Image URI: ${imageUri}`);

    // Validate image URI
    if (!imageUri || imageUri.trim() === '') {
      throw new Error('URI de imagen inválida');
    }

    // Extract file extension and determine MIME type
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    // Fetch the image and convert to blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    console.log(`Image blob size: ${blob.size} bytes, type: ${blob.type}`);

    // Verify blob has content
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
      .from(options.bucket || 'dogcatify')
      .upload(path, arrayBuffer, {
        contentType: options.contentType || mimeType,
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert ?? true,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      console.error('Error details:', JSON.stringify(error));
      throw error;
    }

    console.log('Upload successful, data:', data);

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from(options.bucket || 'dogcatify')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    console.log(`Generated public URL: ${publicUrl}`);

    // Validate URL
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

/**
 * Uploads multiple images to Supabase Storage
 * @param imageUris - Array of local image URIs
 * @param pathPrefix - Prefix for storage paths
 * @param options - Optional upload configuration
 * @returns Array of public URLs of uploaded images
 */
export const uploadMultipleImages = async (
  imageUris: string[],
  pathPrefix: string,
  options: UploadImageOptions = {}
): Promise<string[]> => {
  const uploadPromises = imageUris.map((uri, index) => {
    const timestamp = Date.now();
    const path = `${pathPrefix}/${timestamp}_${index}.jpg`;
    return uploadImage(uri, path, options);
  });

  return Promise.all(uploadPromises);
};
