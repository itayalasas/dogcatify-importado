// Simple pet detection using image analysis
export const detectPetInImage = async (imageUri: string): Promise<boolean> => {
  try {
    // For now, we'll use a simple approach
    // In a production app, you would use a trained model like MobileNet or COCO-SSD
    // that can detect animals/pets in images

    // Simulate AI detection with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For demo purposes, we'll return true for most images
    // In reality, this would analyze the image for pet features
    const hasPet = Math.random() > 0.2; // 80% chance of detecting a pet

    return hasPet;
  } catch (error) {
    console.error('Error detecting pet in image:', error);
    // If detection fails, allow the image (don't block user)
    return true;
  }
};

// Detect pet in video by extracting and analyzing frames
export const detectPetInVideo = async (videoUri: string): Promise<boolean> => {
  try {
    // Extract a frame from the middle of the video
    // In a production app, you would:
    // 1. Extract multiple frames from the video
    // 2. Run pet detection on each frame
    // 3. Return true if pet is detected in majority of frames

    console.log('Analyzing video for pet detection:', videoUri);

    // Simulate video analysis with a longer delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For demo purposes, use same logic as images
    // In reality, this would extract frames and analyze them
    const hasPet = Math.random() > 0.2; // 80% chance of detecting a pet

    return hasPet;
  } catch (error) {
    console.error('Error detecting pet in video:', error);
    // If detection fails, allow the video (don't block user)
    return true;
  }
};

// Alternative: Use a cloud-based AI service
export const detectPetWithCloudAI = async (imageUri: string): Promise<boolean> => {
  try {
    // This would integrate with services like:
    // - Google Vision AI
    // - AWS Rekognition
    // - Azure Computer Vision
    // - Custom trained models
    
    // Example implementation with Google Vision AI:
    /*
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate?key=YOUR_API_KEY', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64Image
          },
          features: [{
            type: 'LABEL_DETECTION',
            maxResults: 10
          }]
        }]
      })
    });
    
    const result = await response.json();
    const labels = result.responses[0].labelAnnotations || [];
    
    // Check if any labels indicate pets/animals
    const petLabels = ['dog', 'cat', 'pet', 'animal', 'puppy', 'kitten', 'canine', 'feline'];
    return labels.some(label => 
      petLabels.some(petLabel => 
        label.description.toLowerCase().includes(petLabel)
      )
    );
    */
    
    // For demo, return true
    return true;
  } catch (error) {
    console.error('Error with cloud AI detection:', error);
    return true;
  }
};

// Validate multiple images for pets
export const validateImagesForPets = async (imageUris: string[]): Promise<{
  validImages: string[];
  invalidImages: string[];
}> => {
  const validImages: string[] = [];
  const invalidImages: string[] = [];

  for (const imageUri of imageUris) {
    const hasPet = await detectPetInImage(imageUri);
    if (hasPet) {
      validImages.push(imageUri);
    } else {
      invalidImages.push(imageUri);
    }
  }

  return { validImages, invalidImages };
};

// Validate video duration (max 3 minutes = 180 seconds)
export const validateVideoDuration = async (videoUri: string): Promise<{
  isValid: boolean;
  duration: number;
}> => {
  try {
    // In React Native, we would use expo-av to get video duration
    // For now, simulate duration check
    console.log('Checking video duration:', videoUri);

    // Simulate getting video duration
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate random duration between 10 and 200 seconds for demo
    const duration = Math.floor(Math.random() * 190) + 10;
    const isValid = duration <= 180; // Max 3 minutes

    return { isValid, duration };
  } catch (error) {
    console.error('Error validating video duration:', error);
    // If check fails, reject the video to be safe
    return { isValid: false, duration: 0 };
  }
};

// Validate multiple media items (images and videos)
export const validateMediaForPets = async (mediaUris: Array<{ uri: string; type: 'image' | 'video' }>): Promise<{
  validMedia: Array<{ uri: string; type: 'image' | 'video'; duration?: number }>;
  invalidMedia: Array<{ uri: string; type: 'image' | 'video'; reason: string }>;
}> => {
  const validMedia: Array<{ uri: string; type: 'image' | 'video'; duration?: number }> = [];
  const invalidMedia: Array<{ uri: string; type: 'image' | 'video'; reason: string }> = [];

  for (const media of mediaUris) {
    if (media.type === 'video') {
      // Check duration first
      const { isValid, duration } = await validateVideoDuration(media.uri);
      if (!isValid) {
        invalidMedia.push({ ...media, reason: 'Video demasiado largo (máx. 3 minutos)' });
        continue;
      }

      // Check for pet in video
      const hasPet = await detectPetInVideo(media.uri);
      if (hasPet) {
        validMedia.push({ ...media, duration });
      } else {
        invalidMedia.push({ ...media, reason: 'No se detectó mascota en el video' });
      }
    } else {
      // Image validation
      const hasPet = await detectPetInImage(media.uri);
      if (hasPet) {
        validMedia.push(media);
      } else {
        invalidMedia.push({ ...media, reason: 'No se detectó mascota en la imagen' });
      }
    }
  }

  return { validMedia, invalidMedia };
};