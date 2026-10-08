import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Modal, TextInput, FlatList, ActivityIndicator, ScrollView, Image, Share, Platform, KeyboardAvoidingView } from 'react-native';
import { useVideoPlayer, VideoView, VideoPlayer as ExpoVideoPlayer } from 'expo-video';
import { Heart, MessageCircle, Share2, Ellipsis as MoreHorizontal, UserMinus, Play, Pause, TriangleAlert as AlertTriangle, MapPin, Phone } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';
import { useFollowing } from '../hooks/useFollowing';
import { colors, spacing, hitSlop as themeHitSlop } from '../constants/theme';
import { toast } from './ui/Toast';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
// Rojo del corazón de "me gusta" (convención social), del tema.
const LIKE_COLOR = colors.danger;
const QUICK_COMMENT_EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

const ZoomableImage = ({ uri, style, onDoubleTap }: { uri: string; style?: any; onDoubleTap?: () => void }) => {
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
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(false)
    .manualActivation(true)
    .enableTrackpadTwoFingerGesture(true)
    .onTouchesDown((e) => {
      if (savedScale.value > 1) {
        (panGesture as any).activate();
      }
    })
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (savedScale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    })
    .onFinalize(() => {
      if (savedScale.value <= 1) {
        panGesture.enabled(false);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // Trigger like on double tap
      if (onDoubleTap) {
        runOnJS(onDoubleTap)();
      }
    });

  const composedGesture = Gesture.Exclusive(
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
      <Animated.Image
        source={{ uri }}
        resizeMode="cover"
        style={[style, animatedStyle]}
      />
    </GestureDetector>
  );
};

// Memoized video component to prevent unnecessary re-renders.
//
// Only one of these is ever mounted at a time per post (the carousel below
// renders a placeholder for every slide except the current one), so
// useVideoPlayer's automatic release-on-unmount already handles cleanup
// when switching slides — no manual pause/unload needed the way the old
// expo-av <Video> ref required.
const VideoPlayer = memo(({
  videoRef,
  source,
  style,
  onTogglePlay,
  onChangeSpeed,
  isPlaying,
  playbackRate,
  isInViewport,
  index
}: {
  videoRef: (player: ExpoVideoPlayer | null) => void;
  source: { uri: string };
  style: any;
  onTogglePlay: () => void;
  onChangeSpeed: () => void;
  isPlaying: boolean;
  playbackRate: number;
  isInViewport: boolean;
  index: number;
}) => {
  const player = useVideoPlayer(source.uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Mirrors the old shouldPlay={isInViewport && isPlaying} declarative prop,
  // which expo-video's VideoView doesn't have — play/pause are now
  // imperative calls on the player instead.
  useEffect(() => {
    if (isInViewport && isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isInViewport, isPlaying, player]);

  useEffect(() => {
    player.playbackRate = playbackRate;
  }, [playbackRate, player]);

  useEffect(() => {
    videoRef(player);
    return () => videoRef(null);
  }, [player, videoRef]);

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      onTogglePlay();
    });
    return () => subscription.remove();
  }, [player, onTogglePlay]);

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={style}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.videoControlsOverlay}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onTogglePlay}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pausar video' : 'Reproducir video'}
        >
          {isPlaying ? (
            <Pause size={32} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.speedButton}
          onPress={onChangeSpeed}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Velocidad de reproducción ${playbackRate}x`}
        >
          <Text style={styles.speedButtonText}>{playbackRate}x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian props críticas
  return prevProps.index === nextProps.index &&
         prevProps.isPlaying === nextProps.isPlaying &&
         prevProps.isInViewport === nextProps.isInViewport &&
         prevProps.playbackRate === nextProps.playbackRate &&
         prevProps.source.uri === nextProps.source.uri;
});
VideoPlayer.displayName = 'VideoPlayer';

interface PostCardProps {
  post: any;
  isMock?: boolean;
  isInViewport?: boolean;
  onLike: (postId: string, doubleTap?: boolean) => void;
  onComment: (postId: string, post?: any) => void;
  onShare: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  isMock = false,
  isInViewport = true,
  onLike,
  onComment,
  onShare
}) => {
  const { currentUser } = useAuth();
  const { canFollow, ready: followReady, isFollowing, follow, unfollow } = useFollowing(post.userId);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [playingVideos, setPlayingVideos] = useState<{[key: number]: boolean}>({});
  const [videoSpeeds, setVideoSpeeds] = useState<{[key: number]: number}>({});
  const [videosInitialized, setVideosInitialized] = useState<{[key: number]: boolean}>({});
  const commentInputRef = useRef<TextInput>(null);
  const videoRefs = useRef<{[key: number]: ExpoVideoPlayer | null}>({});

  useEffect(() => {
    // Reset carousel state when the card starts representing a different post.
    setCurrentImageIndex(0);
    setPlayingVideos({});
    setVideoSpeeds({});
    setVideosInitialized({});
    videoRefs.current = {};
  }, [post.id]);

  useEffect(() => {
    if (currentUser && post.likes) {
      setLiked(post.likes.includes(currentUser.id));
    }
    setLikesCount(post.likes?.length || 0);

    console.log('PostCard useEffect - Post likes updated:', {
      postId: post.id,
      likesArray: post.likes,
      isLiked: post.likes?.includes(currentUser?.id),
      likesCount: post.likes?.length || 0
    });

    // Always fetch comments count for display
    fetchCommentsCount();
  }, [post.likes, currentUser]);

  // Reset play/speed UI state when changing slides. Freeing the previous
  // slide's video resources no longer needs explicit handling here: only
  // the current carousel slide ever mounts a <VideoPlayer>, so switching
  // slides unmounts the old one and useVideoPlayer releases it
  // automatically (that unmount also clears its videoRefs.current entry
  // via the ref-callback cleanup in VideoPlayer itself).
  useEffect(() => {
    setPlayingVideos({});
    setVideoSpeeds({});
  }, [currentImageIndex]);

  useEffect(() => {
    if (!post.albumImages || post.albumImages.length === 0) {
      return;
    }

    post.albumImages.forEach((mediaUrl: string) => {
      if (!mediaUrl || isVideoUrl(mediaUrl)) {
        return;
      }

      const cleanUrl = getCleanUrl(mediaUrl);
      Image.prefetch(cleanUrl).catch(() => {});
    });
  }, [post.albumImages]);

  // Pause videos when post is not in viewport
  useEffect(() => {
    if (!isInViewport) {
      Object.values(videoRefs.current).forEach((ref) => {
        if (ref) {
          try {
            ref.pause();
          } catch {}
        }
      });
      setPlayingVideos({});
    }
  }, [isInViewport]);

  // Cleanup when component unmounts. The mounted <VideoPlayer> (if any)
  // releases its own player automatically via useVideoPlayer; this just
  // clears the ref map for hygiene.
  useEffect(() => {
    return () => {
      videoRefs.current = {};
    };
  }, []);

  // Separate effect for modal comments (removed duplicate)
  useEffect(() => {
    if (showCommentsModal) {
      fetchComments();
    }
  }, [showCommentsModal]);

  const fetchCommentsCount = async () => {
    try {
      const { count, error } = await supabaseClient
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      
      if (error) throw error;
      setCommentsCount(count || 0);
    } catch (error) {
      console.error('Error fetching comments count:', error);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      console.log('Fetching comments for post:', post.id);
      const { data: commentsData, error } = await supabaseClient
        .from('comments')
        .select(`
          id,
          post_id,
          user_id,
          content,
          parent_id,
          likes,
          created_at,
          profiles:user_id(display_name, photo_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log('Raw comments data:', commentsData);
      
      // Process comments data (profiles are already joined)
      const commentsWithProfiles = (commentsData || []).map(comment => ({
        ...comment,
        likes: comment.likes || [], // Ensure likes array exists
        profiles: comment.profiles || null
      }));
      
      console.log('Comments with profiles:', commentsWithProfiles);
      
      // Organize comments into threads (parent comments with their replies)
      const organizedComments = organizeCommentsIntoThreads(commentsWithProfiles);
      console.log('Organized comments:', organizedComments);
      setComments(organizedComments);
      setCommentsCount(commentsWithProfiles.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const organizeCommentsIntoThreads = (comments: any[]) => {
    console.log('Organizing comments into threads:', comments);
    
    if (!comments || comments.length === 0) {
      console.log('No comments to organize');
      return [];
    }
    
    const parentComments = comments.filter(comment => !comment.parent_id);
    const replies = comments.filter(comment => comment.parent_id);
    
    console.log('Parent comments:', parentComments.length);
    console.log('Replies:', replies.length);
    
    // Add replies to their parent comments
    const threaded = parentComments.map(parent => {
      const parentReplies = replies.filter(reply => reply.parent_id === parent.id);
      return {
        ...parent,
        replies: parentReplies.map(reply => ({
          ...reply,
          likes: reply.likes || [] // Ensure likes array exists for replies
        }))
      };
    });
    
    console.log('Threaded comments result:', threaded);
    return threaded;
  };

  const getCommentAuthorName = (comment: any) => {
    // Verificar que comment existe
    if (!comment) return 'Usuario';
    
    // Priorizar el display_name del perfil actual
    if (comment.profiles && comment.profiles.display_name) {
      return comment.profiles.display_name;
    }
    
    // Si es el usuario actual, usar su información
    if (comment.user_id === currentUser?.id && currentUser?.displayName) {
      return currentUser.displayName;
    }
    
    // Fallback al author guardado en el comentario
    if (comment.author && comment.author.name) {
      return comment.author.name;
    }
    
    // Último recurso
    return 'Usuario';
  };

  const getCommentAuthorAvatar = (comment: any) => {
    // Verificar que comment existe
    if (!comment) return 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100';
    
    // Priorizar la photo_url del perfil actual
    if (comment.profiles && comment.profiles.photo_url) {
      return comment.profiles.photo_url;
    }
    
    // Si es el usuario actual, usar su información
    if (comment.user_id === currentUser?.id && currentUser?.photoURL) {
      return currentUser.photoURL;
    }
    
    // Fallback al avatar guardado en el comentario
    if (comment.author && comment.author.avatar) {
      return comment.author.avatar;
    }
    
    // Imagen por defecto
    return 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100';
  };

  // Keep the keyboard up across quick actions (emoji tap, publish): refocus
  // right away and once more after the current update settles, since the
  // tap itself or a list refresh can otherwise drop focus from the input.
  const keepCommentInputFocused = () => {
    commentInputRef.current?.focus();
    requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    try {
      const commentData: any = {
        post_id: post.id,
        user_id: currentUser.id,
        content: newComment.trim(),
        likes: [],
        created_at: new Date().toISOString()
      };
      
      // Add parent_id if replying to a comment
      if (replyTo) {
        commentData.parent_id = replyTo.id;
      }

      const { error } = await supabaseClient
        .from('comments')
        .insert(commentData);

      if (error) throw error;

      setNewComment('');
      setReplyTo(null);

      // Keep focus on input after sending
      keepCommentInputFocused();
      setTimeout(keepCommentInputFocused, 150);

      // Refresh both comments and count
      fetchComments();
      fetchCommentsCount();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'No se pudo agregar el comentario');
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUser) return;

    try {
      console.log('=== COMMENT LIKE DEBUG START ===');
      console.log('Comment ID:', commentId);
      console.log('User ID:', currentUser.id);
      
      // Check current session before making the update
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        console.error('No valid session for comment like');
        Alert.alert('Error', 'Tu sesión expiró. Iniciá sesión de nuevo.');
        return;
      }
      
      // Get fresh comment data from database
      const { data: commentData, error: fetchError } = await supabaseClient
        .from('comments')
        .select('likes')
        .eq('id', commentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      console.log('Current comment likes from DB:', commentData.likes);
      
      const likes = commentData.likes || [];
      const isLiked = likes.includes(currentUser.id);
      
      console.log('Is currently liked:', isLiked);
      
      let newLikes;
      if (isLiked) {
        newLikes = likes.filter((id: string) => id !== currentUser.id);
      } else {
        newLikes = [...likes, currentUser.id];
      }
      
      console.log('New likes array:', newLikes);
      
      // Use RPC function to update likes with proper permissions
      console.log('Updating comment likes using direct update...');
      // Update database first
      const { error } = await supabaseClient
        .from('comments')
        .update({ likes: newLikes })
        .eq('id', commentId);
      
      if (error) {
        console.error('Database update error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('Database updated successfully');
      
      // Verify the update worked by fetching again
      const { data: verifyData, error: verifyError } = await supabaseClient
        .from('comments')
        .select('likes')
        .eq('id', commentId)
        .single();
      
      if (verifyError) {
        console.error('Verification failed:', verifyError);
      } else {
        console.log('Verification - likes in DB after update:', verifyData.likes);
        if (JSON.stringify(verifyData.likes) !== JSON.stringify(newLikes)) {
          console.error('❌ Update not persisted! Expected:', newLikes, 'Got:', verifyData.likes);
          Alert.alert('Error', 'Los likes no se guardaron correctamente');
          return;
        } else {
          console.log('✅ Update verified successfully');
        }
      }
      
      // Update local state for both main comments and replies
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, likes: newLikes };
        }
        // Also check replies
        if (comment.replies && comment.replies.length > 0) {
          const updatedReplies = comment.replies.map((reply: any) => 
            reply.id === commentId 
              ? { ...reply, likes: newLikes }
              : reply
          );
          return { ...comment, replies: updatedReplies };
        }
        return comment;
      }));
      
      console.log('Local comment state updated');
      console.log('=== COMMENT LIKE DEBUG END ===');
    } catch (error) {
      console.error('Error updating comment like:', error);
      // Show user feedback on error
      Alert.alert('Error', 'No se pudo actualizar el me gusta del comentario');
    }
  };

  const handleReply = (comment: any) => {
    setReplyTo(comment);
    setExpandedReplies((prev) => ({ ...prev, [comment.id]: true }));
    commentInputRef.current?.focus();
    setNewComment(`@${comment.profiles?.display_name || comment.author?.name || 'Usuario'} `);
  };

  const renderCommentRow = (comment: any, isReply = false) => {
    const liked = (comment.likes || []).includes(currentUser?.id);
    const likesCount = (comment.likes || []).length;

    return (
      <View key={comment.id} style={[styles.commentRow, isReply && styles.replyRow]}>
        <Image
          source={{ uri: getCommentAuthorAvatar(comment) || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }}
          style={isReply ? styles.replyAvatar : styles.commentAvatar}
        />
        <View style={styles.commentBody}>
          <Text style={styles.commentHeadline}>
            <Text style={styles.commentAuthor}>{getCommentAuthorName(comment) || 'Usuario'}</Text>
            <Text style={styles.commentTime}>{`  ${formatDate(comment.created_at)}`}</Text>
          </Text>
          <Text style={styles.commentText}>{comment.content}</Text>
          {!isReply && (
            <TouchableOpacity
              onPress={() => handleReply(comment)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={`Responder a ${getCommentAuthorName(comment) || 'Usuario'}`}
            >
              <Text style={styles.replyButtonText}>Responder</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.commentLikeColumn}
          onPress={() => handleCommentLike(comment.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Quitar me gusta del comentario' : 'Me gusta el comentario'}
          accessibilityState={{ selected: liked }}
        >
          <Heart
            size={16}
            color={liked ? LIKE_COLOR : colors.textTertiary}
            fill={liked ? LIKE_COLOR : 'none'}
          />
          {likesCount > 0 && (
            <Text style={[styles.commentLikeText, liked && styles.commentLikedText]}>{likesCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCommentThread = ({ item }: { item: any }) => {
    if (!item) return null;

    const replies: any[] = item.replies || [];
    const repliesExpanded = !!expandedReplies[item.id];

    return (
      <View>
        {renderCommentRow(item)}

        {replies.length > 0 && (
          <View style={styles.repliesContainer}>
            <TouchableOpacity
              style={styles.toggleRepliesButton}
              onPress={() => setExpandedReplies((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            >
              <View style={styles.toggleRepliesLine} />
              <Text style={styles.toggleRepliesText}>
                {repliesExpanded
                  ? 'Ocultar respuestas'
                  : `Ver ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}`}
              </Text>
            </TouchableOpacity>

            {repliesExpanded && replies.map((reply: any) => renderCommentRow(reply, true))}
          </View>
        )}
      </View>
    );
  };

  const handleSharePost = async () => {
    try {
      // Determine if it's an album or regular post
      const isAlbum = post.type === 'album';
      const isLostPet = post.type === 'lost_pet';
      const contentType = isAlbum ? 'álbum' : 'publicación';

      // Create Universal Link (web URL que abre la app automáticamente)
      const webLink = isAlbum
        ? `https://app-dogcatify.netlify.app/album/${post.album_id || post.id}`
        : `https://app-dogcatify.netlify.app/post/${post.id}`;

      // Prepare share message with clickable universal link
      const shareMessage = isLostPet
        ? `🚨 ALERTA MASCOTA PERDIDA 🚨\n\n${post.pet?.name || 'Esta mascota'} se encuentra perdida.\n\n📍 ${post.pet?.lostPetAlert?.lastSeenLocation || 'Ubicación no especificada'}\n📞 ${post.pet?.lostPetAlert?.contactPhone || 'Sin contacto'}\n\n${webLink}\n\n🙏 Si tenés información, por favor comunicate.`
        : isAlbum
        ? `🐾 ¡Mirá este ${contentType} de ${post.pet?.name || 'mascota'} compartido por ${post.author?.name} en DogCatiFy!\n\n📸 ${post.album_images?.length || 1} foto(s)\n\n${webLink}\n\n✨ Abrí el link para ver el contenido directo en la app DogCatiFy`
        : `🐾 ¡Mirá esta ${contentType} de ${post.author?.name} en DogCatiFy!\n\n${webLink}\n\n✨ Abrí el link para ver el contenido directo en la app DogCatiFy`;

      // Share implementation
      if (Platform.OS === 'web') {
        // For web, try to use Web Share API or fallback to clipboard
        if (navigator.share) {
          await navigator.share({
            title: `DogCatiFy - ${contentType}`,
            text: shareMessage,
          });
        } else {
          // Copy to clipboard
          await navigator.clipboard.writeText(shareMessage);
          toast.success('El enlace se copió al portapapeles');
        }
      } else {
        // For mobile, use native share
        await Share.share({
          message: shareMessage,
          title: `DogCatiFy - ${contentType}`,
        });
      }

      // Call the onShare callback
      onShare(post.id);
    } catch (error) {
      console.error('Error sharing post:', error);
      // Don't show error alert, just log it
      console.log('Share was cancelled or failed');
    }
  };

  const handleDoubleTap = async () => {
    if (isMock) {
      Alert.alert('Publicación de muestra', 'No podés interactuar con las publicaciones de muestra');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Tenés que iniciar sesión para dar me gusta');
      return;
    }
    
    // Show heart animation
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 1000);

    // Call the like function with doubleTap=true
    onLike(post.id, true);
  };
  
  const isVideoUrl = (url: string): boolean => {
    return url.startsWith('VIDEO:');
  };

  const getCleanUrl = (url: string): string => {
    return url.replace('VIDEO:', '');
  };

  const toggleVideoPlayback = useCallback((index: number) => {
    const videoRef = videoRefs.current[index];
    if (videoRef) {
      try {
        if (videoRef.playing) {
          videoRef.pause();
          setPlayingVideos(prev => ({ ...prev, [index]: false }));
        } else {
          videoRef.play();
          setPlayingVideos(prev => ({ ...prev, [index]: true }));
        }
      } catch (error) {}
    }
  }, []);

  const changeVideoSpeed = useCallback((index: number) => {
    const videoRef = videoRefs.current[index];
    if (videoRef) {
      try {
        const currentSpeed = videoSpeeds[index] || 1;
        const speeds = [1, 1.5, 2, 0.5];
        const currentIndex = speeds.indexOf(currentSpeed);
        const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
        videoRef.playbackRate = nextSpeed;
        setVideoSpeeds(prev => ({ ...prev, [index]: nextSpeed }));
      } catch (error) {}
    }
  }, [videoSpeeds]);

  const handleNextImage = () => {
    if (post.albumImages && post.albumImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === post.albumImages.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  const handlePrevImage = () => {
    if (post.albumImages && post.albumImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === 0 ? post.albumImages.length - 1 : prevIndex - 1
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace un momento';
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInHours < 48) return 'Ayer';
    return date.toLocaleDateString();
  };

  const isLostPetAlert = post.type === 'lost_pet';
  const lostPetAlert = post.pet?.lostPetAlert || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={{ uri: post.author?.avatar || 'https://via.placeholder.com/40' }}
          style={styles.authorAvatar}
        />
        <View style={styles.headerText}>
          <View style={styles.authorNameContainer}>
            <Text style={styles.authorName}>{post.author?.name || 'Usuario'}</Text>
            {canFollow && followReady && !isFollowing && (
              <>
                <Text style={styles.followDot}>•</Text>
                <TouchableOpacity
                  onPress={follow}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Seguir a ${post.author?.name || 'este usuario'}`}
                >
                  <Text style={styles.followLink}>Seguir</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.petName}>
            {isLostPetAlert ? '🚨 Alerta de mascota perdida' : `con ${post.pet?.name || 'mascota'}`}
          </Text>
          <Text style={styles.timestamp}>{post.timeAgo || formatDate(post.createdAt)}</Text>
        </View>
        {canFollow && isFollowing && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => setShowPostMenu(true)}
            hitSlop={themeHitSlop}
            accessibilityRole="button"
            accessibilityLabel="Más opciones de la publicación"
          >
            <MoreHorizontal size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showPostMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPostMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowPostMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowPostMenu(false);
                void unfollow();
              }}
            >
              <UserMinus size={22} color={colors.danger} />
              <Text style={styles.menuItemTextDanger}>
                Dejar de seguir a {post.author?.name || 'este usuario'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {isLostPetAlert && (
        <View style={styles.lostAlertContainer}>
          <View style={styles.lostAlertHeader}>
            <AlertTriangle size={18} color="#B91C1C" />
            <Text style={styles.lostAlertTitle}>Se busca a {post.pet?.name || 'esta mascota'}</Text>
          </View>

          {!!lostPetAlert.lastSeenLocation && (
            <View style={styles.lostAlertRow}>
              <MapPin size={14} color="#B91C1C" />
              <Text style={styles.lostAlertText}>Última ubicación: {lostPetAlert.lastSeenLocation}</Text>
            </View>
          )}

          {!!lostPetAlert.contactPhone && (
            <View style={styles.lostAlertRow}>
              <Phone size={14} color="#B91C1C" />
              <Text style={styles.lostAlertText}>Contacto: {lostPetAlert.contactPhone}</Text>
            </View>
          )}

          {!!lostPetAlert.reward && (
            <Text style={styles.lostAlertReward}>💰 Recompensa: {lostPetAlert.reward}</Text>
          )}
        </View>
      )}

      {/* Content */}
      {post.content && (
        <Text style={styles.content}>{post.content}</Text>
      )}

      {/* Images */}
      <View style={styles.imageContainer}>
        {/* Single Image or Video */}
        {(!post.albumImages || post.albumImages.length === 0) && post.imageURL && (
          <>
            {isVideoUrl(post.imageURL) ? (
              <VideoPlayer
                key={`video-${post.id}-single`}
                videoRef={(ref) => {
                  videoRefs.current[0] = ref;
                  // Initialize as playing if in viewport
                  if (ref && isInViewport && playingVideos[0] === undefined) {
                    setPlayingVideos(prev => ({ ...prev, [0]: true }));
                  }
                }}
                source={{ uri: getCleanUrl(post.imageURL) }}
                style={styles.singleImage}
                onTogglePlay={() => toggleVideoPlayback(0)}
                onChangeSpeed={() => changeVideoSpeed(0)}
                isPlaying={playingVideos[0] ?? true}
                playbackRate={videoSpeeds[0] || 1}
                isInViewport={isInViewport}
                index={0}
              />
            ) : (
              <View>
                <ZoomableImage
                  uri={post.imageURL}
                  style={styles.singleImage}
                  onDoubleTap={handleDoubleTap}
                />
                {showLikeAnimation && (
                  <View style={styles.likeAnimationContainer}>
                    <Heart size={80} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Album Images */}
        {post.albumImages && post.albumImages.length > 0 && (
          <View style={styles.albumContainer}>
            <ScrollView
              key={`album-${post.id}`}
              style={styles.albumScrollView}
              contentContainerStyle={styles.albumScrollContent}
              horizontal
              pagingEnabled
              snapToInterval={width}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              scrollEnabled={true}
              directionalLockEnabled={true}
              nestedScrollEnabled={true}
              removeClippedSubviews={false}
              onMomentumScrollEnd={(e) => {
                const contentOffset = e.nativeEvent.contentOffset;
                const viewSize = e.nativeEvent.layoutMeasurement;
                const pageNum = Math.round(contentOffset.x / viewSize.width);
                setCurrentImageIndex(pageNum);
              }}
              onScrollBeginDrag={() => {
                // Pause all videos when user starts scrolling
                Object.values(videoRefs.current).forEach((ref) => {
                  if (ref) {
                    try {
                      ref.pause();
                    } catch {}
                  }
                });
                setPlayingVideos({});
              }}
            >
              {post.albumImages.map((mediaUrl: string, index: number) => {
                const isVideo = isVideoUrl(mediaUrl);
                const cleanUrl = getCleanUrl(mediaUrl);
                const isCurrent = index === currentImageIndex;

                return (
                  <View
                    key={index}
                    style={styles.albumImageWrapper}
                  >
                    {isVideo ? (
                      isCurrent ? (
                        <VideoPlayer
                          key={`video-${post.id}-${index}-${currentImageIndex}`}
                          videoRef={(ref) => {
                            videoRefs.current[index] = ref;
                            if (ref && isInViewport && playingVideos[index] === undefined) {
                              setPlayingVideos(prev => ({ ...prev, [index]: true }));
                            }
                          }}
                          source={{ uri: cleanUrl }}
                          style={styles.albumMainImage}
                          onTogglePlay={() => toggleVideoPlayback(index)}
                          onChangeSpeed={() => changeVideoSpeed(index)}
                          isPlaying={playingVideos[index] ?? true}
                          playbackRate={videoSpeeds[index] || 1}
                          isInViewport={isInViewport}
                          index={index}
                        />
                      ) : (
                        <View style={[styles.albumMainImage, styles.videoPlaceholder]}>
                          <Play size={48} color="#FFFFFF" />
                        </View>
                      )
                    ) : (
                      <View>
                        <ZoomableImage
                          uri={cleanUrl}
                          style={styles.albumMainImage}
                          onDoubleTap={handleDoubleTap}
                        />
                      </View>
                    )}
                    {showLikeAnimation && currentImageIndex === index && (
                      <View style={styles.likeAnimationContainer}>
                        <Heart size={80} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            
            {post.albumImages.length > 1 && (
              <View style={styles.albumPagination}>
                {post.albumImages.map((_: string, index: number) => (
                  <View 
                    key={index} 
                    style={[
                      styles.paginationDot, 
                      currentImageIndex === index && styles.paginationDotActive
                    ]} 
                  />
                ))}
              </View>
            )}
                        
            <View style={styles.albumOverlay}>
              <Text style={styles.albumCount}>
                {((post.albumImages[currentImageIndex] || post.albumImages[0] || '') as string).startsWith('VIDEO:') ? '🎥 ' : '📸 '}
                {currentImageIndex + 1}/{post.albumImages.length}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onLike(post.id)}
          accessibilityRole="button"
          accessibilityLabel={`${liked ? 'Quitar me gusta' : 'Me gusta'}, ${likesCount} en total`}
          accessibilityState={{ selected: liked }}
        >
          <Heart
            size={24}
            color={liked ? LIKE_COLOR : colors.textSecondary}
            fill={liked ? LIKE_COLOR : 'none'}
          />
          <Text style={[styles.actionText, liked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowCommentsModal(true)}
          accessibilityRole="button"
          accessibilityLabel={`Ver comentarios, ${commentsCount} ${commentsCount === 1 ? 'comentario' : 'comentarios'}`}
        >
          <MessageCircle size={24} color={colors.textSecondary} />
          <Text style={styles.actionText}>{commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleSharePost}
          accessibilityRole="button"
          accessibilityLabel="Compartir publicación"
        >
          <Share2 size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      {/* Comments bottom sheet */}
      <Modal
        visible={showCommentsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetRoot}
        >
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowCommentsModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar comentarios"
          />

          <View style={styles.commentsSheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Comentarios</Text>
            </View>

            {loadingComments && comments.length === 0 ? (
              <View style={styles.loadingCommentsContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderCommentThread({ item })}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Text style={styles.emptyCommentsTitle}>Aún no hay comentarios</Text>
                    <Text style={styles.emptyCommentsSubtitle}>Empezá la conversación.</Text>
                  </View>
                }
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
              />
            )}

            <View style={styles.addCommentContainer}>
              {replyTo && (
                <View style={styles.replyingToContainer}>
                  <Text style={styles.replyingToText}>
                    Respondiendo a <Text style={styles.replyingToName}>{getCommentAuthorName(replyTo)}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setReplyTo(null);
                      setNewComment('');
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar respuesta"
                  >
                    <Text style={styles.cancelReplyText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={styles.quickEmojiRow}
                contentContainerStyle={styles.quickEmojiContent}
              >
                {QUICK_COMMENT_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => {
                      setNewComment((current) => `${current}${emoji}`);
                      keepCommentInputFocused();
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Agregar ${emoji} al comentario`}
                  >
                    <Text style={styles.quickEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.commentInputContainer}>
                <Image
                  source={{ uri: currentUser?.photoURL || 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' }}
                  style={styles.currentUserAvatar}
                />
                <View style={styles.commentInputPill}>
                  <TextInput
                    ref={commentInputRef}
                    style={styles.commentInput}
                    placeholder="Agregá un comentario..."
                    placeholderTextColor={colors.placeholder}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      keepCommentInputFocused();
                      void handleAddComment();
                    }}
                    disabled={!newComment.trim()}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Publicar comentario"
                    accessibilityState={{ disabled: !newComment.trim() }}
                  >
                    <Text style={[styles.publishText, !newComment.trim() && styles.publishTextDisabled]}>
                      Publicar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  authorNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followDot: {
    marginHorizontal: 6,
    fontSize: 14,
    color: colors.textTertiary,
  },
  followLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuItemTextDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  petName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  moreButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  lostAlertContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  lostAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lostAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B91C1C',
  },
  lostAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lostAlertText: {
    fontSize: 13,
    color: '#7F1D1D',
    flex: 1,
  },
  lostAlertReward: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  singleImage: {
    width: width,
    height: width,
    resizeMode: 'cover',
  },
  albumContainer: {
    position: 'relative',
    width: width,
    height: width, 
  },
  albumScrollView: {
    width: width,
    height: width,
  },
  albumScrollContent: {
    alignItems: 'stretch',
  },
  albumImageWrapper: {
    width: width,
    height: width,
  },
  albumMainImage: {
    width: width,
    height: width,
    resizeMode: 'cover',
  },
  albumPagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: colors.white,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  albumNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumNavLeft: {
    left: 10,
  },
  albumNavRight: {
    right: 10,
  },
  albumOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  albumCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  likeAnimationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  videoContainer: {
    width: width,
    height: width,
    position: 'relative',
  },
  videoPlaceholder: {
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  videoControlsOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column',
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  speedButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    marginRight: spacing.lg,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  likedText: {
    color: LIKE_COLOR,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  commentsSheet: {
    height: '75%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  replyRow: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentHeadline: {
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  commentTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
    marginBottom: 6,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  commentLikeColumn: {
    alignItems: 'center',
    marginLeft: 12,
    paddingTop: 4,
    minWidth: 24,
  },
  commentLikeText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  commentLikedText: {
    color: LIKE_COLOR,
  },
  repliesContainer: {
    marginLeft: 64,
    marginRight: 16,
  },
  toggleRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleRepliesLine: {
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textTertiary,
    marginRight: 10,
  },
  toggleRepliesText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  loadingCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyComments: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyCommentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptyCommentsSubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  addCommentContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
  },
  replyingToText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  replyingToName: {
    fontWeight: '700',
    color: colors.text,
  },
  cancelReplyText: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  quickEmojiRow: {
    flexGrow: 0,
  },
  quickEmojiContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 18,
    alignItems: 'center',
  },
  quickEmoji: {
    fontSize: 24,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  currentUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentInputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 14,
    minHeight: 42,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    maxHeight: 96,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginRight: 10,
  },
  publishText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  publishTextDisabled: {
    opacity: 0.4,
  },
});

export default PostCard;
