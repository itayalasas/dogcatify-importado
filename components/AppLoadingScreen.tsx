import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export function AppLoadingScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 48,
        friction: 8,
        useNativeDriver: true,
      }),
    ]);

    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    entrance.start();
    breathing.start();

    return () => {
      entrance.stop();
      breathing.stop();
    };
  }, [opacity, pulse, scale]);

  return (
    <View style={styles.container} accessibilityLabel="Iniciando DogCatiFy">
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Image
            source={require('../assets/images/logo-transp.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.title}>Iniciando DogCatiFy</Text>
        <Text style={styles.subtitle}>Preparando todo para ti</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A6F',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 164,
    height: 164,
    marginBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 9,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});
