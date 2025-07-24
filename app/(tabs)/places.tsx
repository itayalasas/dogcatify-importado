import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';

export default function PetFriendlyPlaces() {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lugares Pet Friendly</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.comingSoonText}>
          Próximamente encontrarás aquí los mejores lugares pet friendly.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 60,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flexShrink: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  comingSoonText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  }
});