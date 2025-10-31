import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { logger } from '../utils/datadogLogger';

interface LocationContextType {
  location: Location.LocationObject | null;
  hasLocationPermission: boolean;
  getCurrentLocation: () => Promise<Location.LocationObject | null>;
  requestLocationPermission: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      logger.debug('Checking location permission', { platform: Platform.OS });

      if (Platform.OS === 'web') {
        // En web, usar la API de geolocalización del navegador
        if ('geolocation' in navigator) {
          logger.info('Location permission granted (web)');
          setHasLocationPermission(true);
        }
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
      logger.info('Location permission status checked', { status, platform: Platform.OS });

      if (status === 'granted') {
        // Si ya tiene permisos, obtener ubicación actual
        getCurrentLocation();
      }
    } catch (error) {
      logger.error('Error checking location permission', error as Error, { platform: Platform.OS });
      setHasLocationPermission(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // En web, intentar obtener ubicación directamente
        return new Promise((resolve) => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const webLocation: Location.LocationObject = {
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    altitude: position.coords.altitude,
                    accuracy: position.coords.accuracy,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                  },
                  timestamp: position.timestamp,
                };
                setLocation(webLocation);
                setHasLocationPermission(true);
                resolve(true);
              },
              (error) => {
                logger.error('Error getting web location', new Error(error.message), { code: error.code });
                setHasLocationPermission(false);
                resolve(false);
              }
            );
          } else {
            resolve(false);
          }
        });
      }

      logger.info('Requesting location permission', { platform: Platform.OS });
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);

      logger.info('Location permission request result', { status, granted, platform: Platform.OS });

      if (granted) {
        await getCurrentLocation();
      }

      return granted;
    } catch (error) {
      logger.error('Error requesting location permission', error as Error, { platform: Platform.OS });
      setHasLocationPermission(false);
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
    try {
      if (Platform.OS === 'web') {
        // En web, usar la API del navegador
        return new Promise((resolve) => {
          if ('geolocation' in navigator && hasLocationPermission) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const webLocation: Location.LocationObject = {
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    altitude: position.coords.altitude,
                    accuracy: position.coords.accuracy,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                  },
                  timestamp: position.timestamp,
                };
                setLocation(webLocation);
                resolve(webLocation);
              },
              (error) => {
                logger.error('Error getting web location', new Error(error.message), { code: error.code });
                resolve(null);
              }
            );
          } else {
            resolve(null);
          }
        });
      }

      if (!hasLocationPermission) {
        logger.warn('Cannot get location - permission not granted');
        return null;
      }

      logger.debug('Getting current location', { platform: Platform.OS });
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      logger.info('Location obtained successfully', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        platform: Platform.OS
      });

      setLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      logger.error('Error getting current location', error as Error, { platform: Platform.OS });
      return null;
    }
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        hasLocationPermission,
        getCurrentLocation,
        requestLocationPermission,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};