import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Platform, Linking } from 'react-native';
import PostCard from '../../components/PostCard';
import PromotionCard from '../../components/PromotionCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '../../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchFeedData();
    }
  }, [currentUser]);

  const fetchFeedData = async () => {
    try {
      await Promise.all([
        fetchPosts(),
        fetchPromotions()
      ]);
    } catch (error) {
      console.error('Error fetching feed data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

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
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchPromotions = async () => {
    try {
      const now = new Date().toISOString();
      
      const { data: promotionsData, error } = await supabaseClient
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false });

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

      setPromotions(processedPromotions);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  // Intercalar promociones en el feed cada 3 posts
  useEffect(() => {
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

    if (posts.length > 0 || promotions.length > 0) {
      interleaveFeedItems();
    }
  }, [posts, promotions]);

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

    try {
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
      
      const { error } = await supabaseClient
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);
      
      if (error) throw error;
      
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, likes: newLikes }
            : post
        )
      );
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handlePromotionLike = async (promotionId: string) => {
    if (!currentUser) {
      Alert.alert('Error', 'Debes iniciar sesión para dar me gusta');
      return;
    }

    try {
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
      
      const { error } = await supabaseClient
        .from('promotions')
        .update({ likes: newLikes })
        .eq('id', promotionId);
      
      if (error) throw error;
      
      // Update local state
      setPromotions(prevPromotions => 
        prevPromotions.map(promo => 
          promo.id === promotionId 
            ? { ...promo, likes: newLikes }
            : promo
        )
      );
    } catch (error) {
      console.error('Error updating promotion like:', error);
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
      console.log('Incrementing clicks for promotion:', promotion.id);
      const { error } = await supabaseClient
        .from('promotions')
        .update({ 
          clicks: (promotion.clicks || 0) + 1 
        })
        .eq('id', promotion.id);

      if (error) throw error;
      
      // Update local state to reflect the click increment
      setPromotions(prevPromotions => 
        prevPromotions.map(promo => 
          promo.id === promotion.id 
            ? { ...promo, clicks: (promo.clicks || 0) + 1 }
            : promo
        )
      );

      // Handle promotion CTA URL
      if (promotion.ctaUrl) {
        console.log('Opening promotion URL:', promotion.ctaUrl);
        
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
              const { Linking } = require('react-native');
              const supported = await Linking.canOpenURL(promotion.ctaUrl);
              if (supported) {
                await Linking.openURL(promotion.ctaUrl);
              } else {
                Alert.alert('Error', 'No se puede abrir este enlace');
              }
            }
          } catch (error) {
            console.error('Error opening external link:', error);
            Alert.alert('Error', 'No se pudo abrir el enlace');
          }
        }
      } else if (promotion.partnerId) {
        // Fallback: Navigate to partner profile if no CTA URL
        router.push(`/services/partner/${promotion.partnerId}`);
      } else {
        // No action defined
        Alert.alert('Información', 'Esta promoción no tiene enlace configurado');
      }
    } catch (error) {
      console.error('Error handling promotion press:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedData();
    setRefreshing(false);
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>¡Bienvenido a DogCatiFy! 🐾</Text>
          <Text style={styles.authSubtitle}>
            Inicia sesión para ver el feed de la comunidad
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DogCatiFy</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando feed...</Text>
          </View>
        ) : feedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('noPostsYet')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('beFirstToPost')}
            </Text>
          </View>
        ) : (
          feedItems.map((item, index) => {
            if (item.type === 'promotion') {
              return (
                <PromotionWrapper
                  key={`promotion-${item.data.id}`}
                  promotion={item.data}
                  onPress={() => handlePromotionPress(item.data)}
                  onLike={handlePromotionLike}
                />
              );
            } else {
              return (
                <PostCard
                  key={`post-${item.data.id}`}
                  post={item.data}
                  onLike={handleLike}
                  onComment={handleComment}
                  onShare={handleShare}
                />
              );
            }
          })
        )}
      </ScrollView>
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
});