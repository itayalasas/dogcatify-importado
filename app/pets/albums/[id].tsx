import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Modal, ActivityIndicator, Dimensions, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Trash2, Share, X, CreditCard as Edit, Video as VideoIcon, Play, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react-native';
import { ScreenHeader, EmptyState, Skeleton, IconButton, toast } from '../../../components/ui';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { detectPetInVideo, validateVideoDuration } from '../../../utils/petDetection';
import { envConfig } from '../../../utils/envConfig';
import { resolveSubscriptionPlanLimits } from '../../../utils/subscriptionPlanLimits';
import { useVideoPlayer, VideoView } from 'expo-video';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';

import { colors, radius, spacing, typography, hitSlop } from '../../../constants/theme';
// Keyed by the caller on the media index/url so React fully unmounts the
// old player and mounts a fresh one when navigating between media items —
// useVideoPlayer releases its player automatically on unmount, so no
// manual pause-before-navigating call is needed the way the old expo-av
// <Video> ref required.
const FullscreenVideoView = ({ uri, style }: { uri: string; style: any }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.play();
  });

  return <VideoView player={player} style={style} contentFit="contain" nativeControls />;
};

const ZoomableImage = ({ uri, onSwipeLeft, onSwipeRight }: { uri: string; onSwipeLeft?: () => void; onSwipeRight?: () => void }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (Math.abs(e.translationX) > 100 && Math.abs(e.velocityX) > 500) {
          if (e.translationX > 0 && onSwipeRight) {
            runOnJS(onSwipeRight)();
          } else if (e.translationX < 0 && onSwipeLeft) {
            runOnJS(onSwipeLeft)();
          }
        }
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.zoomableContainer]}>
        <Animated.Image
          source={{ uri }}
          style={[styles.fullscreenMedia, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default function AlbumDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [validatingVideo, setValidatingVideo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [showMediaTypeModal, setShowMediaTypeModal] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const ensureDailyPostLimit = async () => {
    if (!currentUser) {
      return false;
    }

    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .select(`
        status,
        subscription_plans (
          tier,
          audience_target,
          limits
        )
      `)
      .eq('user_id', currentUser.id)
      .in('status', ['active', 'trialing', 'pending', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    const userPlanLimits = resolveSubscriptionPlanLimits(subscriptionData?.subscription_plans || null);
    const maxPostsPerDay = userPlanLimits.users.maxPostsPerDay;

    if (maxPostsPerDay === null) {
      return true;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { count, error: countError } = await supabaseClient
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString());

    if (countError) {
      throw countError;
    }

    if ((count || 0) >= maxPostsPerDay) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    fetchAlbumDetails();
  }, [id]);

  const fetchAlbumDetails = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pet_albums')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Process media URLs (images and videos) to ensure they're complete
        let processedMedia = data.images || [];
        if (processedMedia.length > 0) {
          processedMedia = processedMedia.map((media: string) => {
            // Check if it's a video (has VIDEO: prefix)
            const isVideo = media.startsWith('VIDEO:');
            const actualUrl = isVideo ? media.replace('VIDEO:', '') : media;

            // Process URL if it's a relative path
            if (actualUrl && actualUrl.startsWith('/storage/v1/object/public/')) {
              const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL') || '';
              const fullUrl = `${supabaseUrl}${actualUrl}`;
              return isVideo ? `VIDEO:${fullUrl}` : fullUrl;
            }
            return media;
          });
        }

        setAlbum({
          ...data,
          images: processedMedia,
          createdAt: new Date(data.created_at)
        });

        setTitle(data.title || '');
        setDescription(data.description || '');
        setIsShared(data.is_shared || false);
      }
    } catch (error) {
      console.error('Error fetching album details:', error);
      Alert.alert('Error', 'No se pudo cargar la información del álbum');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhotos = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [1, 1],
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets) {
        setSelectedImages(result.assets);
      }
    } catch (error) {
      console.error('Error selecting photos:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las fotos');
    }
  };

  const handleSelectVideo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 1,
        videoMaxDuration: 180,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const video = result.assets[0];

        setValidatingVideo(true);

        try {
          const durationValidation = await validateVideoDuration(video.uri);

          if (!durationValidation.isValid) {
            Alert.alert(
              'Video muy largo',
              `El video dura ${Math.floor(durationValidation.duration / 60)}:${(durationValidation.duration % 60).toString().padStart(2, '0')} minutos.\n\nDuración máxima: 3 minutos (180 segundos)`,
              [{ text: 'OK' }]
            );
            setValidatingVideo(false);
            return;
          }

          const hasPet = await detectPetInVideo(video.uri);

          if (!hasPet) {
            Alert.alert(
              'No se detectó mascota',
              '¿Querés subir el video de todos modos?',
              [
                { text: 'Cancelar', style: 'cancel', onPress: () => setValidatingVideo(false) },
                {
                  text: 'Subir',
                  onPress: () => {
                    setSelectedVideo(video);
                    setValidatingVideo(false);
                  }
                }
              ]
            );
          } else {
            setSelectedVideo(video);
            setValidatingVideo(false);
          }
        } catch (error) {
          console.error('Error validating video:', error);
          Alert.alert('Error', 'No se pudo validar el video');
          setValidatingVideo(false);
        }
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert('Error', 'No se pudo seleccionar el video');
      setValidatingVideo(false);
    }
  };

  const handleAddMediaClick = () => {
    setShowMediaTypeModal(true);
  };

  const uploadImageToStorage = async (imageAsset: ImagePicker.ImagePickerAsset) => {
    try {
      console.log('Starting upload for album image:', imageAsset.uri);

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filename = `pets/albums/${album.pet_id}/${timestamp}-${randomId}.jpg`;

      console.log('Uploading to Supabase with filename:', filename);

      const formData = new FormData();
      formData.append('file', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: filename,
      } as any);

      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, formData, {
          contentType: 'image/jpeg',
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
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const uploadVideoToStorage = async (videoAsset: ImagePicker.ImagePickerAsset) => {
    try {
      console.log('Starting upload for album video:', videoAsset.uri);

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filename = `pets/albums/${album.pet_id}/${timestamp}-${randomId}.mp4`;

      console.log('Uploading video to Supabase with filename:', filename);

      const formData = new FormData();
      formData.append('file', {
        uri: videoAsset.uri,
        type: 'video/mp4',
        name: filename,
      } as any);

      const { data, error } = await supabaseClient.storage
        .from('dogcatify')
        .upload(filename, formData, {
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
      console.error('Error uploading video:', error);
      throw error;
    }
  };

  const handleAddVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('Error', 'Seleccioná un video');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setUploadingVideo(true);
    try {
      console.log('Starting to upload video...');

      const videoUrl = await uploadVideoToStorage(selectedVideo);

      const currentImages = album.images || [];

      const videoUrlWithMarker = `VIDEO:${videoUrl}`;

      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          images: [...currentImages, videoUrlWithMarker]
        })
        .eq('id', id);

      if (error) throw error;

      setAlbum({
        ...album,
        images: [...currentImages, videoUrlWithMarker]
      });

      setSelectedVideo(null);

      if (album.is_shared) {
        console.log('Album is shared, creating new post for added video...');

        try {
          const { data: petData, error: petError } = await supabaseClient
            .from('pets')
            .select('*')
            .eq('id', album.pet_id)
            .maybeSingle();

          if (petData && !petError) {
            const { data: userData, error: userError } = await supabaseClient
              .from('profiles')
              .select('display_name, photo_url')
              .eq('id', currentUser.id)
              .maybeSingle();

            const postData = {
              user_id: currentUser.id,
              pet_id: album.pet_id,
              content: `Nuevo video agregado al \u00e1lbum "${album.title}" \ud83c\udfa5`,
              image_url: videoUrl,
              album_images: [videoUrl],
              type: 'album_video',
              author: {
                name: userData?.display_name || currentUser.displayName || 'Usuario',
                avatar: userData?.photo_url || currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
              },
              pet: {
                name: petData.name,
                species: petData.species === 'dog' ? 'Perro' : 'Gato'
              },
              likes: [],
              created_at: new Date().toISOString()
            };

            const { error: postError } = await supabaseClient
              .from('posts')
              .insert(postData);

            if (postError) {
              console.error('Error creating feed post:', postError);
              toast.success('Video agregado correctamente');
            } else {
              toast.success('Video agregado y compartido en el feed 🎥');
            }
          }
        } catch (feedError) {
          console.error('Error creating feed post:', feedError);
          toast.success('Video agregado correctamente');
        }
      } else {
        toast.success('Video agregado correctamente');
      }
    } catch (error) {
      console.error('Error adding video:', error);
      Alert.alert('Error', 'No se pudo agregar el video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleAddPhotos = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Seleccioná al menos una foto');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setUploadingImages(true);
    try {
      console.log('Starting to upload', selectedImages.length, 'images...');
      
      // Upload images sequentially to avoid connection issues
      const imageUrls: string[] = [];
      
      for (let i = 0; i < selectedImages.length; i++) {
        try {
          console.log(`Uploading image ${i + 1} of ${selectedImages.length}...`);
          const imageUrl = await uploadImageToStorage(selectedImages[i]);
          imageUrls.push(imageUrl);
          console.log(`Image ${i + 1} uploaded successfully`);
          
          // Small delay between uploads
          if (i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (uploadError) {
          console.error(`Error uploading image ${i + 1}:`, uploadError);
          
          // Ask user if they want to continue
          const shouldContinue = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Error al subir imagen',
              `No se pudo subir la imagen ${i + 1}.\n\n¿Querés continuar con las imágenes restantes?`,
              [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Continuar', onPress: () => resolve(true) }
              ]
            );
          });
          
          if (!shouldContinue) {
            throw new Error('Subida cancelada por el usuario');
          }
        }
      }
      
      if (imageUrls.length === 0) {
        throw new Error('No se pudo subir ninguna imagen');
      }

      // Get current images
      const currentImages = album.images || [];
      
      // Update album with new images
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          images: [...currentImages, ...imageUrls]
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAlbum({
        ...album,
        images: [...currentImages, ...imageUrls]
      });
      
      setSelectedImages([]);
      
      const successMessage = imageUrls.length === selectedImages.length 
        ? 'Todas las fotos se agregaron correctamente'
        : `Se agregaron ${imageUrls.length} de ${selectedImages.length} fotos`;
      
      // If album is shared, create a new post in the feed
      if (album.is_shared && imageUrls.length > 0) {
        console.log('Album is shared, creating new post for added photos...');
        
        try {
          const canCreateFeedPost = await ensureDailyPostLimit();
          if (!canCreateFeedPost) {
            Alert.alert(
              'Límite alcanzado',
              'Las fotos se guardaron en el álbum, pero no se compartieron en el feed porque ya alcanzaste el limite diario de publicaciones.',
              [{ text: 'Entendido' }]
            );
          } else {
            // Get pet data
          const { data: petData, error: petError } = await supabaseClient
            .from('pets')
            .select('*')
            .eq('id', album.pet_id)
            .single();
          
          if (petData && !petError) {
            // Get current user data for author info
            const { data: userData, error: userError } = await supabaseClient
              .from('profiles')
              .select('display_name, photo_url')
              .eq('id', currentUser.id)
              .single();
            
            // Create new post with the added photos
            const postData = {
              user_id: currentUser.id,
              pet_id: album.pet_id,
              content: `Nuevas fotos agregadas al álbum "${album.title}" 📸`,
              image_url: imageUrls[0],
              album_images: imageUrls,
              type: 'album',
              author: {
                name: userData?.display_name || currentUser.displayName || 'Usuario',
                avatar: userData?.photo_url || currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
              },
              pet: {
                name: petData.name,
                species: petData.species === 'dog' ? 'Perro' : 'Gato'
              },
              likes: [],
              created_at: new Date().toISOString()
            };
            
            const { error: postError } = await supabaseClient
              .from('posts')
              .insert(postData);
            
            if (postError) {
              console.error('Error creating feed post:', postError);
              toast.warning(
                `${successMessage}. Las fotos se guardaron, pero no se pudieron compartir automáticamente en el feed.`
              );
            } else {
              console.log('Feed post created successfully');
              toast.success(`${successMessage}. 📸 También se compartieron en el feed.`);
            }
          }
          }
        } catch (feedError) {
          console.error('Error creating feed post:', feedError);
          toast.success(successMessage);
        }
      } else {
        toast.success(successMessage);
      }
    } catch (error: unknown) {
      console.error('Error adding photos:', error);
      
      const errorMessage = error instanceof Error
        ? (error.message.includes('conexión')
            ? 'Error de conexión. Verificá tu internet e intenta nuevamente.'
            : error.message.includes('cancelada')
              ? 'Subida cancelada.'
              : error.message)
        : 'No se pudieron agregar las fotos';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleUpdateAlbum = async () => {
    try {
      const wasShared = album.is_shared;
      const willBeShared = isShared;
      
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          title: title.trim() || 'Álbum sin título',
          description: description.trim() || '',
          is_shared: isShared
        })
        .eq('id', id);

      if (error) throw error;

      // Handle sharing status change
      if (!wasShared && willBeShared) {
        // Album is now being shared - create post in feed
        console.log('Album is now shared, creating feed post...');
        const sharedInFeed = await createFeedPostFromAlbum();
        if (!sharedInFeed) {
          Alert.alert(
            'Límite alcanzado',
            'El álbum se guardó correctamente, pero no se compartió en el feed porque ya alcanzaste el limite diario de publicaciones.'
          );
        }
      } else if (wasShared && !willBeShared) {
        // Album is no longer shared - remove from feed
        console.log('Album is no longer shared, removing from feed...');
        await removeFeedPostFromAlbum();
      } else if (wasShared && willBeShared) {
        // Album was already shared and still is - update existing post
        console.log('Album still shared, updating existing post...');
        await updateExistingFeedPost();
      }

      // Update local state
      setAlbum({
        ...album,
        title: title.trim() || 'Álbum sin título',
        description: description.trim() || '',
        is_shared: isShared
      });
      
      setShowEditModal(false);
      toast.success('Álbum actualizado correctamente');
    } catch (error) {
      console.error('Error updating album:', error);
      Alert.alert('Error', 'No se pudo actualizar el álbum');
    }
  };

  const createFeedPostFromAlbum = async () => {
    try {
      if (!currentUser) {
        return false;
      }

      // Get pet data
      const { data: petData, error: petError } = await supabaseClient
        .from('pets')
        .select('*')
        .eq('id', album.pet_id)
        .single();
      
      if (petError || !petData) {
        console.error('Error fetching pet data:', petError);
        return;
      }
      
      // Get user data for author info
      const { data: userData, error: userError } = await supabaseClient
        .from('profiles')
        .select('display_name, photo_url')
        .eq('id', currentUser.id)
        .single();
      
      if (userError) {
        console.error('Error fetching user data:', userError);
      }
      
      const canCreateFeedPost = await ensureDailyPostLimit();
      if (!canCreateFeedPost) {
        return false;
      }
      
      // Create post from album
      const postData = {
        user_id: currentUser.id,
        pet_id: album.pet_id,
        content: description.trim() || `Álbum compartido: ${title.trim()} 📸`,
        image_url: album.images?.[0] || null,
        album_images: album.images || [],
        type: 'album',
        album_id: album.id, // Reference to the album
        author: {
          name: userData?.display_name || currentUser.displayName || 'Usuario',
          avatar: userData?.photo_url || currentUser.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100'
        },
        pet: {
          name: petData.name,
          species: petData.species === 'dog' ? 'Perro' : 'Gato'
        },
        likes: [],
        created_at: new Date().toISOString()
      };
      
      const { error: postError } = await supabaseClient
        .from('posts')
        .insert(postData);
      
      if (postError) {
        console.error('Error creating feed post:', postError);
        return false;
      } else {
        console.log('Feed post created successfully');
        return true;
      }
    } catch (error) {
      console.error('Error creating feed post from album:', error);
      return false;
    }
  };

  const removeFeedPostFromAlbum = async () => {
    try {
      // Delete posts related to this album using album_id
      const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('album_id', album.id);
      
      if (error) {
        console.error('Error removing feed post:', error);
      } else {
        console.log('Feed post removed successfully');
      }
    } catch (error) {
      console.error('Error removing feed post from album:', error);
    }
  };

  const updateExistingFeedPost = async () => {
    try {
      // Update existing post with new album info
      const { error } = await supabaseClient
        .from('posts')
        .update({
          content: description.trim() || `Álbum actualizado: ${title.trim()} 📸`,
          album_images: album.images || [],
          image_url: album.images?.[0] || null
        })
        .eq('album_id', album.id);
      
      if (error) {
        console.error('Error updating feed post:', error);
      } else {
        console.log('Feed post updated successfully');
      }
    } catch (error) {
      console.error('Error updating feed post from album:', error);
    }
  };
  const handleDeleteAlbum = async () => {
    try {
      // First remove any related posts from feed
      await removeFeedPostFromAlbum();
      
      // Then delete the album
      const { error } = await supabaseClient
        .from('pet_albums')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Álbum eliminado correctamente');
      router.push({
        pathname: '/pets/[id]',
        params: { id: album.pet_id, refresh: 'true', activeTab: 'albums' }
      });
    } catch (error) {
      console.error('Error deleting album:', error);
      Alert.alert('Error', 'No se pudo eliminar el álbum');
    }
  };

  const confirmDeleteImage = (imageUrl: string) => {
    setImageToDelete(imageUrl);
    setShowDeleteConfirm(true);
  };

  const handleDeleteImage = async () => {
    if (!imageToDelete) return;
    
    try {
      // Remove image from album's images array
      const updatedImages = album.images.filter((img: string) => img !== imageToDelete);
      
      // Update album with new images array
      const { error } = await supabaseClient
        .from('pet_albums')
        .update({
          images: updatedImages
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAlbum({
        ...album,
        images: updatedImages
      });
      
      setShowDeleteConfirm(false);
      setImageToDelete(null);
      toast.success('Imagen eliminada correctamente');
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'No se pudo eliminar la imagen');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Álbum" onBack={() => router.back()} />
        <View style={styles.skeletonGrid} accessibilityLabel="Cargando álbum">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="48%" height={160} borderRadius={12} style={styles.skeletonTile} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (!album) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<ImageIcon size={32} color={colors.primary} />}
          title="No encontramos este álbum"
          description="Puede que se haya eliminado."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={album.title || 'Álbum sin título'}
        onBack={() => router.back()}
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon={<Edit size={20} color={colors.primary} />}
              onPress={() => setShowEditModal(true)}
              accessibilityLabel="Editar álbum"
            />
            <IconButton
              icon={<Trash2 size={20} color={colors.danger} />}
              onPress={() => Alert.alert(
                'Eliminar álbum',
                '¿Seguro que querés eliminar este álbum?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: handleDeleteAlbum }
                ]
              )}
              accessibilityLabel="Eliminar álbum"
            />
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {album.description && (
          <Card style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{album.description}</Text>
          </Card>
        )}

        <View style={styles.addPhotosSection}>
          <View style={styles.addMediaButtons}>
            <TouchableOpacity style={styles.addPhotosButton} onPress={handleSelectPhotos} accessibilityRole="button" accessibilityLabel="Agregar fotos al álbum" hitSlop={hitSlop}>
              <Camera size={24} color={colors.primary} />
              <Text style={styles.addPhotosText}>Agregar fotos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addVideoButton} onPress={handleSelectVideo} disabled={validatingVideo} accessibilityRole="button" accessibilityLabel="Agregar video al álbum" hitSlop={hitSlop}>
              {validatingVideo ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <VideoIcon size={24} color={colors.success} />
              )}
              <Text style={styles.addVideoText}>
                {validatingVideo ? 'Validando...' : 'Agregar video'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedVideo && (
            <View style={styles.selectedPhotosContainer}>
              <Text style={styles.selectedPhotosTitle}>Video seleccionado:</Text>
              <View style={styles.selectedVideoContainer}>
                <View style={styles.selectedVideoPreview}>
                  <VideoIcon size={40} color={colors.success} />
                  <Text style={styles.videoFileName}>
                    {selectedVideo.fileName || 'video.mp4'}
                  </Text>
                  <Text style={styles.videoDurationText}>
                    {selectedVideo.duration ? `${Math.floor(selectedVideo.duration / 1000)}s` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeSelectedPhoto}
                  onPress={() => setSelectedVideo(null)} accessibilityRole="button" accessibilityLabel="Quitar video seleccionado" hitSlop={hitSlop}>
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              </View>

              <Button
                title="Subir video al álbum"
                onPress={handleAddVideo}
                loading={uploadingVideo}
                size="medium"
              />
            </View>
          )}

          {selectedImages.length > 0 && (
            <View style={styles.selectedPhotosContainer}>
              <Text style={styles.selectedPhotosTitle}>
                Fotos seleccionadas ({selectedImages.length}):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPhotosScroll}>
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.selectedPhotoContainer}>
                    <Image source={{ uri: image.uri }} style={styles.selectedPhoto} />
                    <TouchableOpacity 
                      style={styles.removeSelectedPhoto}
                      onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel="Quitar foto seleccionada" hitSlop={hitSlop}>
                      <X size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              
              <Button
                title="Agregar al álbum"
                onPress={handleAddPhotos}
                loading={uploadingImages}
                size="medium"
              />
            </View>
          )}
        </View>

        <View style={styles.photosGrid}>
          {album.images && album.images.map((mediaUrl: string, index: number) => {
            const isVideo = mediaUrl.startsWith('VIDEO:');
            const actualUrl = isVideo ? mediaUrl.replace('VIDEO:', '') : mediaUrl;

            return (
              <TouchableOpacity
                key={index}
                style={styles.photoContainer}
                onPress={() => {
                  setCurrentMediaIndex(index);
                  setShowMediaViewer(true);
                }}
                activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={isVideo ? `Ver video ${index + 1}` : `Ver foto ${index + 1}`} hitSlop={hitSlop}>
                {isVideo ? (
                  <View style={styles.videoThumbnailContainer}>
                    <View style={styles.videoPlaceholder}>
                      <VideoIcon size={48} color={colors.success} />
                      <Text style={styles.videoLabel}>Video</Text>
                    </View>
                    <View style={styles.videoOverlay}>
                      <Play size={32} color={colors.white} />
                    </View>
                  </View>
                ) : (
                  <Image source={{ uri: actualUrl }} style={styles.photo} />
                )}
                <TouchableOpacity
                  style={styles.deletePhotoButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDeleteImage(mediaUrl);
                  }} accessibilityRole="button" accessibilityLabel={isVideo ? 'Eliminar video' : 'Eliminar foto'} hitSlop={hitSlop}>
                  <Trash2 size={16} color={colors.white} />
                </TouchableOpacity>
                {isVideo && (
                  <View style={styles.videoBadge}>
                    <VideoIcon size={12} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Media Viewer Modal */}
      <Modal
        visible={showMediaViewer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowMediaViewer(false);
        }}
      >
        <StatusBar hidden />
        <View style={styles.mediaViewerContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeViewerButton}
            onPress={() => {
              setShowMediaViewer(false);
            }} accessibilityRole="button" accessibilityLabel="Cerrar visor" hitSlop={hitSlop}>
            <X size={28} color={colors.white} />
          </TouchableOpacity>

          {/* Media Counter */}
          <View style={styles.mediaCounter}>
            <Text style={styles.mediaCounterText}>
              {currentMediaIndex + 1} / {album?.images?.length || 0}
            </Text>
          </View>

          {/* Media Content */}
          {album?.images && album.images[currentMediaIndex] && (() => {
            const mediaUrl = album.images[currentMediaIndex];
            const isVideo = mediaUrl.startsWith('VIDEO:');
            const actualUrl = isVideo ? mediaUrl.replace('VIDEO:', '') : mediaUrl;

            const handleSwipeLeft = () => {
              if (currentMediaIndex < album.images.length - 1) {
                setCurrentMediaIndex(currentMediaIndex + 1);
              }
            };

            const handleSwipeRight = () => {
              if (currentMediaIndex > 0) {
                setCurrentMediaIndex(currentMediaIndex - 1);
              }
            };

            return (
              <View style={styles.mediaContent}>
                {isVideo ? (
                  <FullscreenVideoView
                    key={currentMediaIndex}
                    uri={actualUrl}
                    style={styles.fullscreenMedia}
                  />
                ) : (
                  <ZoomableImage
                    uri={actualUrl}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                  />
                )}
              </View>
            );
          })()}

          {/* Navigation Buttons */}
          {album?.images && album.images.length > 1 && (
            <>
              {currentMediaIndex > 0 && (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonLeft]}
                  onPress={() => setCurrentMediaIndex(currentMediaIndex - 1)} accessibilityRole="button" accessibilityLabel="Anterior" hitSlop={hitSlop}>
                  <ChevronLeft size={32} color={colors.white} />
                </TouchableOpacity>
              )}

              {currentMediaIndex < album.images.length - 1 && (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonRight]}
                  onPress={() => setCurrentMediaIndex(currentMediaIndex + 1)} accessibilityRole="button" accessibilityLabel="Siguiente" hitSlop={hitSlop}>
                  <ChevronRight size={32} color={colors.white} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Edit Album Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar álbum</Text>
            
            <Input
              label="Título del álbum"
              placeholder="Ej: Primer día en casa, Cumpleaños..."
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Descripción"
              placeholder="Describí este momento especial..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.shareOption}>
              <Text style={styles.shareOptionLabel}>Compartir en el feed</Text>
              <TouchableOpacity 
                style={[styles.shareToggle, isShared && styles.shareToggleActive]}
                onPress={() => setIsShared(!isShared)} accessibilityRole="button" accessibilityLabel="Compartir en el feed" hitSlop={hitSlop}>
                <View style={[styles.shareToggleHandle, isShared && styles.shareToggleHandleActive]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowEditModal(false)}
                variant="outline"
                size="medium"
              />
              <Button
                title="Guardar cambios"
                onPress={handleUpdateAlbum}
                size="medium"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmModal}>
            <Text style={styles.confirmTitle}>
              {imageToDelete?.startsWith('VIDEO:') ? 'Eliminar video' : 'Eliminar imagen'}
            </Text>
            <Text style={styles.confirmText}>
              {imageToDelete?.startsWith('VIDEO:')
                ? '¿Seguro que querés eliminar este video?'
                : '¿Seguro que querés eliminar esta imagen?'}
            </Text>

            <View style={styles.confirmActions}>
              <Button
                title="Cancelar"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="small"
                style={styles.confirmButton}
              />
              <Button
                title="Eliminar"
                onPress={handleDeleteImage}
                variant="danger"
                size="small"
                style={styles.confirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  skeletonTile: {
    marginBottom: spacing.md,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  descriptionCard: {
    marginBottom: spacing.lg,
  },
  descriptionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  addPhotosSection: {
    marginBottom: spacing.lg,
  },
  addMediaButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addPhotosButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addPhotosText: {
    ...typography.label,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  addVideoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.success,
    borderStyle: 'dashed',
  },
  addVideoText: {
    ...typography.label,
    color: colors.success,
    marginLeft: spacing.sm,
  },
  selectedPhotosContainer: {
    marginTop: spacing.lg,
  },
  selectedPhotosTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  selectedPhotosScroll: {
    marginBottom: spacing.lg,
  },
  selectedPhotoContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  selectedPhoto: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
  },
  removeSelectedPhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoContainer: {
    width: '48%',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: radius.sm,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: radius.lg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.xl,
    paddingBottom: 40,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  shareOptionLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
  },
  shareToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: spacing.xxs,
  },
  shareToggleActive: {
    backgroundColor: colors.primary,
  },
  shareToggleHandle: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  shareToggleHandleActive: {
    transform: [{ translateX: 22 }],
  },
  modalActions: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  confirmText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  deleteConfirmModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '80%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  confirmButton: {
    width: '100%',
  },
  selectedVideoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  selectedVideoPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  videoFileName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  videoDurationText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  videoThumbnailContainer: {
    width: '100%',
    height: 150,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.success,
    marginTop: spacing.sm,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: radius.md,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeViewerButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCounter: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  mediaCounterText: {
    ...typography.bodyStrong,
    color: colors.white,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  mediaContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomableContainer: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 40,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
});
