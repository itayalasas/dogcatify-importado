/**
 * Utility for uploading images to Supabase Storage
 * Compatible with React Native
 */

import { supabaseClient } from '../lib/supabase';
import { logger } from './datadogLogger';

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
    logger.info('Starting image upload', { path, bucket: options.bucket || 'dogcatify' });

    // Validate image URI
    if (!imageUri || imageUri.trim() === '') {
      logger.error('Invalid image URI', new Error('URI de imagen inválida'), { path });
      throw new Error('URI de imagen inválida');
    }

    // Extract file extension and determine MIME type
    const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    // Fetch the image and convert to blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      logger.error('Failed to fetch image', new Error(`HTTP ${response.status}`), { path, imageUri });
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    logger.debug('Image fetched successfully', { path, blobSize: blob.size, blobType: blob.type });

    // Verify blob has content
    if (blob.size === 0) {
      logger.error('Empty image blob', new Error('La imagen está vacía'), { path });
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

    logger.debug('ArrayBuffer created', { path, size: arrayBuffer.byteLength });

    // Upload ArrayBuffer to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from(options.bucket || 'dogcatify')
      .upload(path, arrayBuffer, {
        contentType: options.contentType || mimeType,
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert ?? true,
      });

    if (error) {
      logger.error('Supabase storage upload error', error as Error, { path, bucket: options.bucket || 'dogcatify' });
      throw error;
    }

    logger.info('Image uploaded successfully', { path, bucket: options.bucket || 'dogcatify' });

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from(options.bucket || 'dogcatify')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    logger.debug('Generated public URL', { path, publicUrl });

    // Validate URL
    if (!publicUrl || publicUrl.trim() === '') {
      logger.error('Failed to generate public URL', new Error('No se pudo generar la URL pública'), { path });
      throw new Error('No se pudo generar la URL pública');
    }

    logger.info('Image upload completed', { path, publicUrl });
    return publicUrl;
  } catch (error) {
    logger.error('Error in uploadImage', error as Error, { path, imageUri });
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
