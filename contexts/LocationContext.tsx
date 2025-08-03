import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

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
      if (Platform.OS === 'web') {
        // En web, usar la API de geolocalización del navegador
        if ('geolocation' in navigator) {
          setHasLocationPermission(true);
        }
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        // Si ya tiene permisos, obtener ubicación actual
        getCurrentLocation();
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
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
                console.error('Error getting web location:', error);
                setHasLocationPermission(false);
                resolve(false);
              }
            );
          } else {
            resolve(false);
          }
        });
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);
      
      if (granted) {
        await getCurrentLocation();
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
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
                console.error('Error getting web location:', error);
                resolve(null);
              }
            );
          } else {
            resolve(null);
          }
        });
      }

      if (!hasLocationPermission) {
        console.log('No location permission granted');
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
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