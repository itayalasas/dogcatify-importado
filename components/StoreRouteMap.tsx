import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { ExternalLink, Navigation, X } from 'lucide-react-native';
import { Button } from './ui/Button';
import { envConfig } from '../utils/envConfig';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface StoreRouteMapProps {
  storeName?: string;
  storeAddress: string;
  destinationCoordinates?: Coordinates | null;
}

const hasValidCoordinates = (coordinates?: Coordinates | null): coordinates is Coordinates => {
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude)
  );
};

const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    return null;
  }

  const nominatimBaseUrl = envConfig.getOrDefault('EXPO_PUBLIC_NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org');
  const searchUrl = `${nominatimBaseUrl}/search?q=${encodeURIComponent(trimmedAddress)}&format=json&limit=1&addressdetails=1`;

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'DogCatiFy/1.0 (contact@dogcatify.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo geocodificar la dirección (${response.status})`);
  }

  const results = await response.json();
  const firstResult = Array.isArray(results) ? results[0] : null;

  if (!firstResult?.lat || !firstResult?.lon) {
    return null;
  }

  const latitude = Number(firstResult.lat);
  const longitude = Number(firstResult.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const getCurrentLocation = async (): Promise<Coordinates | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return null;
  }

  const currentPosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
  };
};

const buildDirectionsUrl = (origin: Coordinates | null, destination: Coordinates | null, fallbackAddress: string) => {
  if (origin && destination) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  }

  if (destination) {
    return `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`;
  }

  if (fallbackAddress.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress.trim())}`;
  }

  return null;
};

const buildRouteHtml = (
  origin: Coordinates,
  destination: Coordinates,
  storeName: string,
  storeAddress: string,
) => {
  const escapeHtmlText = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const safeStoreName = escapeHtmlText(storeName || 'la tienda');
  const safeStoreAddress = escapeHtmlText(storeAddress || '');
  const safeOrigin = JSON.stringify(origin);
  const safeDestination = JSON.stringify(destination);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #map {
      width: 100%;
    }
    .info-card {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 1000;
      background: rgba(17, 24, 39, 0.92);
      color: #FFFFFF;
      border-radius: 18px;
      padding: 14px 16px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
      backdrop-filter: blur(10px);
    }
    .title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 4px;
    }
    .subtitle {
      font-size: 12px;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.84);
    }
    .badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #10B981;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 700;
    }
    .status-card {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.96);
      color: #111827;
      border-radius: 16px;
      padding: 12px 14px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
      font-size: 12px;
      line-height: 1.45;
    }
    .legend {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #374151;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info-card">
    <div class="title">Ruta hacia ${safeStoreName}</div>
    <div class="subtitle">${safeStoreAddress}</div>
    <div class="badge">Tu ubicación a la tienda</div>
  </div>
  <div class="status-card" id="status-card">
    Calculando la ruta...
    <div class="legend">
      <div class="legend-item"><span class="dot" style="background:#2563EB"></span>Tu ubicación</div>
      <div class="legend-item"><span class="dot" style="background:#EF4444"></span>Tienda</div>
      <div class="legend-item"><span class="dot" style="background:#10B981"></span>Ruta</div>
    </div>
  </div>
  <script>
    (function () {
      const origin = ${safeOrigin};
      const destination = ${safeDestination};
      const map = L.map('map', { zoomControl: true });
      const statusCard = document.getElementById('status-card');

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const currentIcon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(37,99,235,0.18);"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const destinationIcon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:999px;background:#EF4444;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(239,68,68,0.18);"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      L.marker([origin.latitude, origin.longitude], { icon: currentIcon })
        .addTo(map)
        .bindPopup('Tu ubicación actual');

      L.marker([destination.latitude, destination.longitude], { icon: destinationIcon })
        .addTo(map)
        .bindPopup('Tienda');

      const bounds = L.latLngBounds([
        [origin.latitude, origin.longitude],
        [destination.latitude, destination.longitude]
      ]);
      map.fitBounds(bounds, { padding: [42, 42] });

      const fallbackLine = L.polyline([
        [origin.latitude, origin.longitude],
        [destination.latitude, destination.longitude]
      ], {
        color: '#CBD5E1',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 10'
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 250);

      fetch('https://router.project-osrm.org/route/v1/driving/' + origin.longitude + ',' + origin.latitude + ';' + destination.longitude + ',' + destination.latitude + '?overview=full&geometries=geojson&steps=false')
        .then((response) => response.json())
        .then((data) => {
          const route = data && data.routes && data.routes[0];
          if (route && route.geometry) {
            map.removeLayer(fallbackLine);
            L.geoJSON(route.geometry, {
              style: {
                color: '#10B981',
                weight: 5,
                opacity: 0.95
              }
            }).addTo(map);

            const distanceKm = (route.distance / 1000).toFixed(1);
            const durationMin = Math.max(1, Math.round(route.duration / 60));
            statusCard.innerHTML = 'Ruta lista: ' + distanceKm + ' km · ' + durationMin + ' min aprox.<div class="legend"><div class="legend-item"><span class="dot" style="background:#2563EB"></span>Tu ubicación</div><div class="legend-item"><span class="dot" style="background:#EF4444"></span>Tienda</div><div class="legend-item"><span class="dot" style="background:#10B981"></span>Ruta</div></div>';
          } else {
            statusCard.innerHTML = 'Se muestran los puntos de inicio y destino, pero no fue posible calcular la ruta exacta.<div class="legend"><div class="legend-item"><span class="dot" style="background:#2563EB"></span>Tu ubicación</div><div class="legend-item"><span class="dot" style="background:#EF4444"></span>Tienda</div><div class="legend-item"><span class="dot" style="background:#10B981"></span>Ruta</div></div>';
          }
        })
        .catch(() => {
          statusCard.innerHTML = 'No pudimos calcular la ruta exacta. Puedes intentarlo de nuevo o abrirla en Maps.<div class="legend"><div class="legend-item"><span class="dot" style="background:#2563EB"></span>Tu ubicación</div><div class="legend-item"><span class="dot" style="background:#EF4444"></span>Tienda</div><div class="legend-item"><span class="dot" style="background:#10B981"></span>Ruta</div></div>';
        });
    })();
  </script>
</body>
</html>`;
};

export const StoreRouteMap: React.FC<StoreRouteMapProps> = ({
  storeName,
  storeAddress,
  destinationCoordinates,
}) => {
  const [visible, setVisible] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [webViewReady, setWebViewReady] = useState(false);
  const [mapHtml, setMapHtml] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [originCoordinates, setOriginCoordinates] = useState<Coordinates | null>(null);
  const [geocodedDestination, setGeocodedDestination] = useState<Coordinates | null>(null);

  const effectiveDestination = hasValidCoordinates(destinationCoordinates)
    ? destinationCoordinates
    : geocodedDestination;

  const resolveDestination = async (): Promise<Coordinates | null> => {
    if (hasValidCoordinates(destinationCoordinates)) {
      return destinationCoordinates;
    }

    if (hasValidCoordinates(geocodedDestination)) {
      return geocodedDestination;
    }

    const geocoded = await geocodeAddress(storeAddress);
    if (geocoded) {
      setGeocodedDestination(geocoded);
    }
    return geocoded;
  };

  const resetState = () => {
    setVisible(false);
    setLoadingRoute(false);
    setWebViewReady(false);
    setMapHtml('');
    setMapError(null);
  };

  const handleOpenRoute = async () => {
    setVisible(true);
    setLoadingRoute(true);
    setWebViewReady(false);
    setMapError(null);
    setMapHtml('');

    try {
      const destination = await resolveDestination();
      if (!destination) {
        throw new Error('No pudimos ubicar la tienda en el mapa.');
      }

      const origin = await getCurrentLocation();
      if (!origin) {
        throw new Error('Necesitamos permiso de ubicación para mostrar la ruta desde donde estás.');
      }

      setOriginCoordinates(origin);
      setMapHtml(buildRouteHtml(origin, destination, storeName || 'la tienda', storeAddress));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir la ruta.';
      setMapError(message);
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleOpenExternalMaps = async () => {
    try {
      const destination = effectiveDestination || (await resolveDestination());
      const url = buildDirectionsUrl(originCoordinates, destination, storeAddress);

      if (!url) {
        Alert.alert('Ruta no disponible', 'No pudimos generar una ruta para esta tienda.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening external maps:', error);
      Alert.alert('Error', 'No se pudo abrir el mapa externo.');
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title="Ver ruta a la tienda"
        onPress={handleOpenRoute}
        icon={<Navigation size={16} color="#FFFFFF" />}
        iconPosition="left"
        style={styles.routeButton}
      />
      <Text style={styles.helperText}>
        Te mostramos la ruta desde tu ubicación actual hasta la tienda.
      </Text>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={resetState}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Ruta a la tienda</Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {storeName || 'Tienda'} · {storeAddress}
              </Text>
            </View>

            <TouchableOpacity onPress={resetState} style={styles.closeButton}>
              <X size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapWrapper}>
            {loadingRoute ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Cargando tu ruta...</Text>
              </View>
            ) : mapError ? (
              <View style={styles.errorState}>
                <Text style={styles.errorTitle}>No pudimos mostrar la ruta</Text>
                <Text style={styles.errorText}>{mapError}</Text>
                <View style={styles.errorActions}>
                  <Button
                    title="Abrir en Maps"
                    onPress={handleOpenExternalMaps}
                    variant="outline"
                    icon={<ExternalLink size={16} color="#2D6A6F" />}
                    iconPosition="left"
                    style={styles.errorButton}
                  />
                  <Button
                    title="Cerrar"
                    onPress={resetState}
                    style={styles.errorButton}
                  />
                </View>
              </View>
            ) : mapHtml ? (
              <View style={styles.webViewContainer}>
                <WebView
                  source={{ html: mapHtml }}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  allowsInlineMediaPlayback
                  onLoadStart={() => setWebViewReady(false)}
                  onLoadEnd={() => setWebViewReady(true)}
                  style={styles.webView}
                />
                {!webViewReady && (
                  <View style={styles.webViewLoadingOverlay}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Preparando el mapa...</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Preparando el mapa...</Text>
              </View>
            )}
          </View>

          <View style={styles.footerActions}>
            <Button
              title="Abrir en Maps"
              onPress={handleOpenExternalMaps}
              variant="outline"
              icon={<ExternalLink size={16} color="#2D6A6F" />}
              iconPosition="left"
              style={styles.footerButton}
            />
            <Button
              title="Cerrar"
              onPress={resetState}
              style={styles.footerButton}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  routeButton: {
    backgroundColor: '#2D6A6F',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closeButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  webViewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249, 250, 251, 0.88)',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorActions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  errorButton: {
    width: '100%',
  },
  footerActions: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  footerButton: {
    width: '100%',
  },
});
