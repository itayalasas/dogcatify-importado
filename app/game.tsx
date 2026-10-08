import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, StatusBar, SafeAreaView, Platform, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabaseClient } from '../lib/supabase';
import { envConfig } from '../utils/envConfig';

// URL fallback por defecto desplegada en Netlify
const DEFAULT_GAME_URL = 'https://game-patitas-al-rescate.netlify.app';

export default function GameScreen() {
  const router = useRouter();
  // ?tab=shelter abre el juego directo en el refugio (aviso de mascota con pocos mimos)
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const webViewRef = useRef<WebView>(null);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function prepareGameSession() {
      try {
        // Asegurarse de que envConfig esté inicializado (consume /get-env)
        if (!envConfig.isInitialized()) {
          await envConfig.initialize();
        }

        // Obtener EXPO_PUBLIC_GAME_URL desde la carga dinámica del API Gateway (/get-env)
        // con fallback a process.env o a la URL de Netlify
        const rawGameUrl =
          envConfig.get('EXPO_PUBLIC_GAME_URL') ||
          process.env.EXPO_PUBLIC_GAME_URL ||
          DEFAULT_GAME_URL;

        let url = rawGameUrl.trim();

        // Obtener sesión activa de DogCatiFy para Single Sign-On (SSO)
        if (supabaseClient) {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.access_token) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token || '')}`;
          }
        }
        if (tab) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}tab=${encodeURIComponent(String(tab))}`;
        }
        setGameUrl(url);
      } catch (err) {
        console.warn('[GameScreen] Error al obtener sesión para el juego:', err);
        setGameUrl(DEFAULT_GAME_URL);
      }
    }

    prepareGameSession();
  }, [tab]);

  /**
   * Mensajes del juego:
   * - DOGCATIFY_GO_HOME: botón "Ir a la App DogCatiFy" → home con pestañas.
   * - DOGCATIFY_OPEN: anuncios del juego → planes de suscripción, una promoción o el home.
   *   Las promociones siguen la misma lógica de enlaces que el home (dogcatify://services|products|partners/<id>).
   */
  const handleGameMessage = (raw: string) => {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg?.type === 'DOGCATIFY_GO_HOME') {
      router.replace('/(tabs)');
      return;
    }
    if (msg?.type !== 'DOGCATIFY_OPEN') return;

    if (msg.route === 'subscription') {
      router.push('/profile/subscription');
      return;
    }

    if (msg.route === 'promotion') {
      const url: string | null = typeof msg.ctaUrl === 'string' ? msg.ctaUrl : null;
      const discount = Number(msg.discountPercent) || 0;

      if (url?.startsWith('dogcatify://')) {
        const [kind, id] = url.replace('dogcatify://', '').split('/');
        if (id && kind === 'services') {
          router.push(discount > 0 ? `/services/${id}?discount=${discount}` : `/services/${id}`);
          return;
        }
        if (id && kind === 'products') {
          router.push(discount > 0 ? `/products/${id}?discount=${discount}` : `/products/${id}`);
          return;
        }
        if (id && kind === 'partners') {
          router.push(`/services/partner/${id}`);
          return;
        }
      } else if (url?.startsWith('http')) {
        Linking.openURL(url).catch(() => {});
        return;
      }
    }

    // Sin enlace específico: al home, donde también está la promoción
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ea580c" />
      
      {/* Barra superior de navegación */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
          <Text style={styles.backText}>Volver a DogCatiFy</Text>
        </TouchableOpacity>
        
        <View style={styles.titleBadge}>
          <Text style={styles.titleText}>🐾 Patitas al Rescate</Text>
        </View>
      </View>

      {/* Contenedor del Juego con WebView */}
      <View style={styles.webviewWrapper}>
        {gameUrl && (
          <WebView
            ref={webViewRef}
            source={{ uri: gameUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState={true}
            onLoadEnd={() => setLoading(false)}
            onMessage={event => handleGameMessage(event.nativeEvent.data)}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ea580c" />
                <Text style={styles.loadingText}>Cargando Patitas al Rescate...</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ea580c',
  },
  header: {
    height: Platform.OS === 'android' ? 52 : 44,
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  titleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  webviewWrapper: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c2d12',
  },
});
