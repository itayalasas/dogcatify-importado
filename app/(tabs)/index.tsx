import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, Alert, RefreshControl, Image, Animated, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Platform, Linking, InteractionManager } from 'react-native';
import Constants from 'expo-constants';
import PostCard from '../../components/PostCard';
import PromotionCard from '../../components/PromotionCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationPermissionPrompt } from '../../components/NotificationPermissionPrompt';
import { LocationPermissionPrompt } from '../../components/LocationPermissionPrompt';
import { MedicalAlertsWidget } from '../../components/MedicalAlertsWidget';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabaseClient } from '@/lib/supabase';

// Debug component for production notification testing
const NotificationDebugInfo = () => {
  const { expoPushToken } = useNotifications();
  const isExpoGo = Constants.appOwnership === 'expo';
  
  // Only show in development or when there are issues
  if (!__DEV__ && expoPushToken) return null;
  
  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>🔔 Estado de Notificaciones</Text>
      <Text style={styles.debugText}>
        Entorno: {isExpoGo ? 'Expo Go' : 'Build nativo'}
      </Text>
      <Text style={styles.debugText}>
        Token: {expoPushToken ? '✅ Configurado' : '❌ No disponible'}
      </Text>
      <Text style={styles.debugText}>
        Plataforma: {Platform.OS}
      </Text>
      {!expoPushToken && !isExpoGo && (
        <Text style={styles.debugWarning}>
          ⚠️ Las notificaciones no están funcionando. Verifica la configuración.
        </Text>
      )}
    </View>
  );
};

// Loading component with app logo
const FeedLoader = () => {
  const fadeAnim = new Animated.Value(0.3);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    const animate = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => animate());
    };

    animate();
  }, []);

  return (
    <View style={styles.loaderContainer}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/logo.jpg')}
          style={styles.loaderLogo}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={styles.loaderText}>Cargando tu feed...</Text>
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
    </View>
  );
};

// Componente wrapper para manejar las vistas de promociones
const PromotionWrapper = ({ promotion, onPress, onLike }: { promotion: any; onPress: () => void; onLike: (promotionId: string) => void }) => {
  useEffect(() => {
    // Incrementar vistas cuando la promoción se renderiza
    const incrementViews = async () => {
      try {
        const { error } = await supabaseClient
          .from('promotions')
          .update({ 
            views: (promotion.views || 0) + 1 
          })
          .eq('id', promotion.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error incrementing promotion views:', error);
      }
    };

    incrementViews();
  }, [promotion.id]);

  return (
    <PromotionCard
      promotion={promotion}
      onPress={onPress}
      onLike={onLike}
    />
  );
};

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [allPostsLoaded, setAllPostsLoaded] = useState(false);
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  // Configuración de paginación
  const POSTS_PER_PAGE = 5; // Cargar 5 posts por página
  const INITIAL_LOAD = 3; // Carga inicial más pequeña

  useEffect(() => {
    if (currentUser) {
      // Defer heavy operations until after initial render
      InteractionManager.runAfterInteractions(() => {
        fetchFeedData();
      });
    }
  }, [currentUser]);

  const fetchFeedData = async () => {
    setLoading(true);
    try {
      // Reset pagination for fresh load
      setCurrentPage(0);
      setHasMorePosts(true);
      setAllPostsLoaded(false);
      
      // Load initial posts and promotions
      await fetchInitialPosts();
      // Small delay to prevent blocking
      setTimeout(() => {
        fetchPromotions();
      }, 100);
    } catch (error) {
      console.error('Error fetching feed data:', error);
    } finally {
      setLoading(false);
      // Reduce initial loading time
      setTimeout(() => {
        setInitialLoading(false);
      }, 800);
    }
  };

  const fetchInitialPosts = async () => {
    try {
      console.log('🔄 Fetching initial posts...');
      const { data: postsData, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(INITIAL_LOAD); // Carga inicial muy pequeña

      if (error) throw error;

      const processedPosts = postsData?.map(post => ({
        id: post.id,
        userId: post.user_id,
        petId: post.pet_id,
        content: post.content,
        imageURL: post.image_url,
        albumImages: post.album_images || [],
        likes: post.likes || [],
        createdAt: new Date(post.created_at),
        author: post.author || { name: 'Usuario', avatar: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' },
        pet: post.pet || { name: 'Mascota', species: 'Perro' },
        timeAgo: getTimeAgo(new Date(post.created_at)),
        type: post.type || 'single'
      })) || [];

      setPosts(processedPosts);
      setCurrentPage(1); // Ya cargamos la primera "página"
      setHasMorePosts(processedPosts.length === INITIAL_LOAD);
      setPostsLoaded(true);
      
      console.log(`✅ Initial posts loaded: ${processedPosts.length}`);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setPostsLoaded(true);
    }
  };

  const fetchMorePosts = async () => {
    if (loadingMore || !hasMorePosts || allPostsLoaded) {
      console.log('⏭️ Skipping fetch more posts:', { loadingMore, hasMorePosts, allPostsLoaded });
      return;
    }

    console.log(`🔄 Fetching more posts - Page ${currentPage + 1}...`);
    setLoadingMore(true);
    
    try {
      const offset = currentPage * POSTS_PER_PAGE;
      
      const { data: morePosts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1);

      if (error) throw error;

      if (!morePosts || morePosts.length === 0) {
        console.log('📄 No more posts to load');
        setHasMorePosts(false);
        setAllPostsLoaded(true);
        return;
      }

      const processedNewPosts = morePosts.map(post => ({
        id: post.id,
        userId: post.user_id,
        petId: post.pet_id,
        content: post.content,
        imageURL: post.image_url,
        albumImages: post.album_images || [],
        likes: post.likes || [],
        createdAt: new Date(post.created_at),
        author: post.author || { name: 'Usuario', avatar: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=100' },
        pet: post.pet || { name: 'Mascota', species: 'Perro' },
        timeAgo: getTimeAgo(new Date(post.created_at)),
        type: post.type || 'single'
      }));

      // Append new posts to existing ones
      setPosts(prevPosts => [...prevPosts, ...processedNewPosts]);
      setCurrentPage(prev => prev + 1);
      
      // Check if we got fewer posts than requested (end of data)
      if (morePosts.length < POSTS_PER_PAGE) {
        console.log('📄 Reached end of posts');
        setHasMorePosts(false);
        setAllPostsLoaded(true);
      }
      
      console.log(`✅ Loaded ${morePosts.length} more posts. Total: ${posts.length + processedNewPosts.length}`);
    } catch (error) {
      console.error('Error fetching more posts:', error);
      setHasMorePosts(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchPromotions = async () => {
    try {
      console.log('🎯 Fetching promotions...');
      const now = new Date();
      const nowISO = now.toISOString();
      
      const { data: promotionsData, error } = await supabaseClient
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', nowISO)
        .gte('end_date', nowISO)
        .order('created_at', { ascending: false })
        .limit(5); // Limit promotions

      if (error) throw error;

      const processedPromotions = promotionsData?.map(promo => ({
        id: promo.id,
        title: promo.title,
        description: promo.description,
        imageURL: promo.image_url,
        ctaText: promo.cta_text || 'Más información',
        ctaUrl: promo.cta_url,
        partnerId: promo.partner_id,
        views: promo.views || 0,
        clicks: promo.clicks || 0,
        likes: promo.likes || []
      })) || [];

      console.log(`✅ Promotions loaded: ${processedPromotions.length}`);
      setPromotions(processedPromotions);
      setPromotionsLoaded(true);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setPromotionsLoaded(true);
    }
  };

  // Intercalar promociones en el feed cada 3 posts
  useEffect(() => {
    // Only process when both data sources are loaded
    if (!postsLoaded || !promotionsLoaded) return;
    
    console.log(`🔄 Interleaving feed: ${posts.length} posts, ${promotions.length} promotions`);
    
    const interleaveFeedItems = () => {
      const items = [];
      
      if (promotions.length > 0) {
        // Crear una copia aleatoria de promociones para variar el orden
        const shuffledPromotions = [...promotions].sort(() => Math.random() - 0.5);
        let promoIndex = 0;

        // Determinar intervalo dinámico basado en cantidad de posts
        let interval;
        if (posts.length <= 5) {
          interval = 2; // Con pocos posts, mostrar cada 2 posts
        } else if (posts.length <= 10) {
          interval = 3; // Con posts moderados, cada 3 posts
        } else {
          interval = 5; // Con muchos posts, cada 5 posts
        }

        for (let i = 0; i < posts.length; i++) {
          items.push({ type: 'post', data: posts[i] });
          
          // Insertar promoción según el intervalo dinámico
          if ((i + 1) % interval === 0 && promoIndex < shuffledPromotions.length) {
            items.push({ type: 'promotion', data: shuffledPromotions[promoIndex] });
            promoIndex++;
            
            // Si se acabaron las promociones, reiniciar con orden aleatorio
            if (promoIndex >= shuffledPromotions.length) {
              shuffledPromotions.sort(() => Math.random() - 0.5);
              promoIndex = 0;
            }
          }
        }
        
        // Si no se insertó ninguna promoción y hay posts, agregar una al final
        if (posts.length > 0 && !items.some(item => item.type === 'promotion')) {
          items.push({ type: 'promotion', data: shuffledPromotions[0] });
        }
      } else {
        // Si no hay promociones, solo agregar posts
        posts.forEach(post => {
          items.push({ type: 'post', data: post });
        });
      }

      setFeedItems(items);
    };

    // Defer processing to avoid blocking UI
    InteractionManager.runAfterInteractions(() => {
      interleaveFeedItems();
    });
  }, [posts, promotions, postsLoaded, promotionsLoaded]);

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Ahora';
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString();
  };

  const handleLike = async (postId: string, doubleTap: boolean = false) => {
    if (!currentUser) {
      Alert.alert('Error', 'Debes iniciar sesión para dar me gusta');
      return;
    }

    // Optimistic update for better UX
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId) {
          const likes = post.likes || [];
          const isLiked = likes.includes(currentUser.id);
          let newLikes;
          
          if (doubleTap && !isLiked) {
            newLikes = [...likes, currentUser.id];
          } else if (!doubleTap) {
            newLikes = isLiked
              ? likes.filter((id: string) => id !== currentUser.id)
              : [...likes, currentUser.id];
          } else {
            return post;
          }
          
          return { ...post, likes: newLikes };
        }
        return post;
      })
    );

    try {
      // Get fresh data from database to avoid stale state
      const { data: postData, error: fetchError } = await supabaseClient
        .from('posts')
        .select('likes')
        .eq('id', postId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const likes = postData.likes || [];
      const isLiked = likes.includes(currentUser.id);
      
      let newLikes;
      if (doubleTap && !isLiked) {
        newLikes = [...likes, currentUser.id];
      } else if (!doubleTap) {
        newLikes = isLiked
          ? likes.filter((id: string) => id !== currentUser.id)
          : [...likes, currentUser.id];
      } else {
        return;
      }
      
      // Update database first
      const { error } = await supabaseClient
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);
      
      if (error) {
        // Revert optimistic update on error
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, likes: postData.likes }
              : post
          )
        );
        throw error;
      }
      
      // Also update feedItems state to keep consistency
      setFeedItems(prevItems => 
        prevItems.map(item => 
          item.type === 'post' && item.data.id === postId
            ? { ...item, data: { ...item.data, likes: newLikes } }
            : item
        )
      );
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'No se pudo actualizar el me gusta. Intenta nuevamente.');
    }
  };

  const handlePromotionLike = async (promotionId: string) => {
    if (!currentUser) {
      Alert.alert('Error', 'Debes iniciar sesión para dar me gusta');
      return;
    }

    // Optimistic update for promotions too
    setPromotions(prevPromotions => 
      prevPromotions.map(promo => {
        if (promo.id === promotionId) {
          const likes = promo.likes || [];
          const isLiked = likes.includes(currentUser.id);
          const newLikes = isLiked
            ? likes.filter((id: string) => id !== currentUser.id)
            : [...likes, currentUser.id];
          return { ...promo, likes: newLikes };
        }
        return promo;
      })
    );

    try {
      // Get fresh data from database
      const { data: promotionData, error: fetchError } = await supabaseClient
        .from('promotions')
        .select('likes')
        .eq('id', promotionId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const likes = promotionData.likes || [];
      const isLiked = likes.includes(currentUser.id);
      
      const newLikes = isLiked
        ? likes.filter((id: string) => id !== currentUser.id)
        : [...likes, currentUser.id];
      
      // Update database first
      const { error } = await supabaseClient
        .from('promotions')
        .update({ likes: newLikes })
        .eq('id', promotionId);
      
      if (error) {
        // Revert optimistic update on error
        setPromotions(prevPromotions => 
          prevPromotions.map(promo => 
            promo.id === promotionId 
              ? { ...promo, likes: promotionData.likes }
              : promo
          )
        );
        throw error;
      }
      
      // Also update feedItems state
      setFeedItems(prevItems => 
        prevItems.map(item => 
          item.type === 'promotion' && item.data.id === promotionId
            ? { ...item, data: { ...item.data, likes: newLikes } }
            : item
        )
      );
    } catch (error) {
      console.error('Error updating promotion like:', error);
      Alert.alert('Error', 'No se pudo actualizar el me gusta. Intenta nuevamente.');
    }
  };

  const handleComment = (postId: string, post?: any) => {
    // Navigate to comments screen or open comments modal
    console.log('Open comments for post:', postId);
  };

  const handleShare = (postId: string) => {
    // Handle share functionality
    console.log('Share post:', postId);
  };

  const handlePromotionPress = async (promotion: any) => {
    try {
      // Increment clicks
      const newClicksCount = (promotion.clicks || 0) + 1;
      
      // Update clicks asynchronously without blocking navigation
      supabaseClient
        .from('promotions')
        .update({ clicks: newClicksCount })
        .eq('id', promotion.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error incrementing clicks:', error);
          }
        });
      
      // Update local state to reflect the click increment
      setPromotions(prevPromotions => 
        prevPromotions.map(promo => 
          promo.id === promotion.id 
            ? { ...promo, clicks: newClicksCount }
            : promo
        )
      );
      
      // Also update feedItems state
      setFeedItems(prevItems => 
        prevItems.map(item => 
          item.type === 'promotion' && item.data.id === promotion.id
            ? { ...item, data: { ...item.data, clicks: newClicksCount } }
            : item
        )
      );

      // Handle promotion CTA URL
      if (promotion.ctaUrl) {
        if (promotion.ctaUrl.startsWith('dogcatify://')) {
          // Handle internal app links
          const urlParts = promotion.ctaUrl.replace('dogcatify://', '').split('/');
          const type = urlParts[0]; // 'services', 'products', 'partners'
          const id = urlParts[1];
          
          switch (type) {
            case 'services':
              router.push(`/services/${id}`);
              break;
            case 'products':
              router.push(`/products/${id}`);
              break;
            case 'partners':
              router.push(`/services/partner/${id}`);
              break;
            default:
              console.warn('Unknown internal link type:', type);
          }
        } else if (promotion.ctaUrl.startsWith('http')) {
          // Handle external links
          try {
            if (Platform.OS === 'web') {
              window.open(promotion.ctaUrl, '_blank');
            } else {
              const supported = await Linking.canOpenURL(promotion.ctaUrl);
              if (supported) {
                await Linking.openURL(promotion.ctaUrl);
              } else {
                Alert.alert('Error', 'No se puede abrir este enlace');
              }
            }
          } catch (error) {
            Alert.alert('Error', 'No se pudo abrir el enlace');
          }
        }
      }
    } catch (error) {
    try {
      // Faster refresh - load in parallel
      await Promise.all([
        fetchPosts(),
        fetchPromotions()
      ]);
    } catch (error) {
      console.error('Error refreshing feed:', error);
    }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Reset pagination
      setCurrentPage(0);
      setHasMorePosts(true);
      setAllPostsLoaded(false);
      
      // Fetch fresh data
      await Promise.all([
        fetchInitialPosts(),
        fetchPromotions()
      ]);
    } catch (error) {
      console.error('Error refreshing feed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEndReached = () => {
    console.log('🔚 End reached, loading more posts...');
    fetchMorePosts();
  };

  const renderFeedItem = ({ item, index }: { item: any; index: number }) => {
    if (item.type === 'promotion') {
      return (
        <PromotionWrapper
          key={`promotion-${item.data.id}-${index}`}
          promotion={item.data}
          onPress={() => handlePromotionPress(item.data)}
          onLike={handlePromotionLike}
        />
      );
    } else {
      return (
        <PostCard
          key={`post-${item.data.id}-${index}`}
          post={item.data}
          onLike={handleLike}
          onComment={handleComment}
          onShare={handleShare}
        />
      );
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2D6A6F" />
        <Text style={styles.footerLoaderText}>Cargando más publicaciones...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading || initialLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('noPostsYet')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('beFirstToPost')}
        </Text>
      </View>
    );
  };

  // Manejar redirección cuando no hay usuario - FUERA del render condicional
  useEffect(() => {
    if (!currentUser) {
      const timer = setTimeout(() => {
        router.replace('/auth/login');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  // Show initial loader while feed is loading
  if (initialLoading) {
    return <FeedLoader />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <NotificationPermissionPrompt />
      <LocationPermissionPrompt />
      {__DEV__ && <NotificationDebugInfo />}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DogCatiFy</Text>
      </View>

      <FlatList
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item, index) => `${item.type}-${item.data.id}-${index}`}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2D6A6F']}
            tintColor="#2D6A6F"
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3} // Cargar más cuando esté al 70% del scroll
        ListHeaderComponent={<MedicalAlertsWidget />}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        initialNumToRender={INITIAL_LOAD}
        maxToRenderPerBatch={POSTS_PER_PAGE}
        windowSize={10}
        removeClippedSubviews={true}
        getItemLayout={undefined} // Let FlatList calculate automatically
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  authTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2D6A6F',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Loader styles
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
  },
  logoContainer: {
    marginBottom: 32,
  },
  loaderLogo: {
    width: 120,
    height: 120,
  },
  loaderText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#2D6A6F',
    marginBottom: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D6A6F',
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  debugContainer: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  debugTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#92400E',
    marginBottom: 4,
  },
  debugWarning: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    marginTop: 8,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});