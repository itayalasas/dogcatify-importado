import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Briefcase, MapPin, Plus } from 'lucide-react-native';
import { AppText, IconButton, SegmentedControl } from '../../components/ui';
import { OneTimeTooltip } from '../../components/ui/OneTimeTooltip';
import ServicesExplorer from '../../components/explore/ServicesExplorer';
import PlacesExplorer from '../../components/explore/PlacesExplorer';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing } from '../../constants/theme';

type Section = 'services' | 'places';

/**
 * Pestaña Explorar: reúne Servicios y Lugares pet-friendly con un selector arriba.
 * Cada sección se monta la primera vez que se abre y queda montada, así no se
 * pierden la búsqueda ni el filtro al ir y volver.
 */
export default function Explore() {
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const initial: Section = params.section === 'places' ? 'places' : 'services';
  const [section, setSection] = useState<Section>(initial);
  const [visited, setVisited] = useState<Record<Section, boolean>>({ services: initial === 'services', places: initial === 'places' });

  useEffect(() => {
    if (params.section === 'places' || params.section === 'services') {
      setSection(params.section);
    }
  }, [params.section]);

  useEffect(() => {
    setVisited((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
  }, [section]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <AppText variant="title" accessibilityRole="header">
            Explorar
          </AppText>
          {section === 'places' ? (
            <OneTimeTooltip
              hintKey="places_register_button"
              userId={currentUser?.id}
              text="Tip: ¿conocés un lugar pet-friendly? Registralo acá y ayudá a la comunidad"
              placement="bottom"
            >
              <IconButton
                variant="filled"
                icon={<Plus size={22} color={colors.onPrimary} />}
                onPress={() => router.push('/places/register')}
                accessibilityLabel="Registrar un lugar pet-friendly"
              />
            </OneTimeTooltip>
          ) : (
            <View style={styles.titleSpacer} />
          )}
        </View>
        <SegmentedControl<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'services', label: 'Servicios', icon: (c) => <Briefcase size={18} color={c} /> },
            { value: 'places', label: 'Lugares', icon: (c) => <MapPin size={18} color={c} /> },
          ]}
        />
      </View>

      <View style={styles.body}>
        {visited.services && (
          <View style={[styles.section, section !== 'services' && styles.hidden]}>
            <ServicesExplorer embedded />
          </View>
        )}
        {visited.places && (
          <View style={[styles.section, section !== 'places' && styles.hidden]}>
            <PlacesExplorer embedded />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titleSpacer: { width: 44, height: 44 },
  body: { flex: 1 },
  section: { flex: 1 },
  hidden: { display: 'none' },
});
