import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabaseClient } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { colors, radius, spacing, typography } from '../../constants/theme';

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
      toast.success('Configuración guardada', 'Las recompensas del juego se actualizaron.');
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

  if (loading) {
    return (
      <Card style={styles.card} accessibilityLabel="Cargando configuración del juego">
        <Skeleton width="60%" height={18} />
        <Skeleton width="90%" height={14} style={{ marginTop: spacing.sm }} />
        <Skeleton height={72} borderRadius={radius.md} style={{ marginTop: spacing.lg }} />
        <Skeleton height={72} borderRadius={radius.md} style={{ marginTop: spacing.md }} />
      </Card>
    );
  }

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
                accessibilityRole="radio"
                accessibilityState={{ selected: levelData.target === 'products' }}
                accessibilityLabel={`${title}: aplicable a Tienda`}
              >
                <Text style={[styles.toggleText, levelData.target === 'products' && styles.toggleTextActive]}>Tienda</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, levelData.target === 'services' && styles.toggleBtnActive]}
                onPress={() => updateLevel(level, 'target', 'services')}
                accessibilityRole="radio"
                accessibilityState={{ selected: levelData.target === 'services' }}
                accessibilityLabel={`${title}: aplicable a Servicios`}
              >
                <Text style={[styles.toggleText, levelData.target === 'services' && styles.toggleTextActive]}>Servicios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, styles.toggleBtnLast, levelData.target === 'both' && styles.toggleBtnActive]}
                onPress={() => updateLevel(level, 'target', 'both')}
                accessibilityRole="radio"
                accessibilityState={{ selected: levelData.target === 'both' }}
                accessibilityLabel={`${title}: aplicable a Ambos`}
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
      <Text style={styles.cardTitle} accessibilityRole="header">Promo del juego: Patitas al Rescate</Text>
      <Text style={styles.cardDesc}>
        Configurá los descuentos que los usuarios ganan al superar hitos en el juego.
      </Text>
      
      {renderLevelConfig('level3', 'Recompensa Nivel 3')}
      {renderLevelConfig('level5', 'Recompensa Nivel 5')}
      {renderLevelConfig('level10', 'Recompensa Nivel 10')}

      <Button
        title="Guardar configuración"
        onPress={saveConfig}
        disabled={saving}
        loading={saving}
        style={{ marginTop: spacing.lg }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, marginBottom: spacing.xl },
  cardTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
  cardDesc: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  levelContainer: { marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.lg },
  levelTitle: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  toggleGroup: { flexDirection: 'row', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, overflow: 'hidden' },
  toggleBtn: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.borderStrong },
  toggleBtnLast: { borderRightWidth: 0 },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { ...typography.captionStrong, color: colors.textSecondary },
  toggleTextActive: { color: colors.onPrimary }
});
