import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabaseClient } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export function GamePromotionsAdminCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    level3: { percent: 10, target: 'products', active: true },
    level5: { percent: 15, target: 'products', active: true },
    level10: { percent: 20, target: 'services', active: true }
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('admin_settings')
        .select('value')
        .eq('key', 'game_promotions_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (err) {
      console.error('Error loading game promos config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from('admin_settings')
        .upsert({
          key: 'game_promotions_config',
          value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      Alert.alert('Éxito', 'Configuración de promociones del juego guardada correctamente.');
    } catch (err) {
      console.error('Error saving game promos config:', err);
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const updateLevel = (level: 'level3' | 'level5' | 'level10', field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [level]: { ...prev[level], [field]: value }
    }));
  };

  if (loading) return <ActivityIndicator style={{ margin: 20 }} />;

  const renderLevelConfig = (level: 'level3' | 'level5' | 'level10', title: string) => {
    const levelData = config[level];
    
    return (
      <View style={styles.levelContainer}>
        <Text style={styles.levelTitle}>{title}</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Porcentaje (%)</Text>
            <Input
              value={String(levelData.percent)}
              onChangeText={(text) => {
                const val = parseInt(text) || 0;
                updateLevel(level, 'percent', val);
              }}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Aplicable a</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, levelData.target === 'products' && styles.toggleBtnActive]}
                onPress={() => updateLevel(level, 'target', 'products')}
              >
                <Text style={[styles.toggleText, levelData.target === 'products' && styles.toggleTextActive]}>Tienda</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, levelData.target === 'services' && styles.toggleBtnActive]}
                onPress={() => updateLevel(level, 'target', 'services')}
              >
                <Text style={[styles.toggleText, levelData.target === 'services' && styles.toggleTextActive]}>Servicios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, levelData.target === 'both' && styles.toggleBtnActive]}
                onPress={() => updateLevel(level, 'target', 'both')}
              >
                <Text style={[styles.toggleText, levelData.target === 'both' && styles.toggleTextActive]}>Ambos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>🎮 Promo Juego: Patitas al Rescate</Text>
      <Text style={styles.cardDesc}>
        Configura los descuentos que los usuarios ganan al superar hitos en el juego.
      </Text>
      
      {renderLevelConfig('level3', 'Recompensa Nivel 3')}
      {renderLevelConfig('level5', 'Recompensa Nivel 5')}
      {renderLevelConfig('level10', 'Recompensa Nivel 10')}

      <Button
        title="Guardar Configuración"
        onPress={saveConfig}
        disabled={saving}
        style={{ marginTop: 16 }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  levelContainer: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 16 },
  levelTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  toggleGroup: { flexDirection: 'row', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F9FAFB', borderRightWidth: 1, borderRightColor: '#D1D5DB' },
  toggleBtnActive: { backgroundColor: '#2D6A6F' },
  toggleText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
  toggleTextActive: { color: '#FFFFFF', fontWeight: 'bold' }
});
