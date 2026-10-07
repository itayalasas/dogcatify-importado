import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Truck, Store, Check } from 'lucide-react-native';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../components/ui/Toast';
import { FormSkeleton } from '../components/partner-setup/FormSkeleton';
import { FormFooter } from '../components/partner-setup/FormFooter';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';
import { colors, radius, spacing, typography } from '../constants/theme';

type DeliveryMode = 'single_store' | 'multi_store';

type PartnerOption = {
	id: string;
	business_name: string;
	business_type: string;
};

export default function DeliveryRegister() {
	const { currentUser } = useAuth();
	const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('single_store');
	const [stores, setStores] = useState<PartnerOption[]>([]);
	const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
	const [deliveryProfileId, setDeliveryProfileId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (currentUser?.id) {
			loadData();
		} else {
			setLoading(false);
		}
	}, [currentUser?.id]);

	const businessTypeName = (type: string) => {
		const types: Record<string, string> = {
			veterinary: 'Veterinaria',
			grooming: 'Peluquería',
			walking: 'Paseador',
			boarding: 'Pensión',
			shop: 'Tienda',
			shelter: 'Albergue',
		};
		return types[type] || 'Negocio';
	};

	const loadData = async () => {
		try {
			setLoading(true);

			const { data: storesData, error: storesError } = await supabaseClient
				.from('partners')
				.select('id, business_name, business_type')
				.eq('is_active', true)
				.eq('is_verified', true)
				.eq('business_type', 'shop')
				.order('business_name', { ascending: true });

			if (storesError) throw storesError;
			setStores(storesData || []);

			const { data: profileData, error: profileError } = await supabaseClient
				.from('delivery_profiles')
				.select('id, delivery_mode')
				.eq('user_id', currentUser!.id)
				.maybeSingle();

			if (profileError) {
				const profileErrorMessage = String(profileError.message || '').toLowerCase();
				const relationMissing = profileErrorMessage.includes('delivery_profiles');
				if (!relationMissing) throw profileError;
			}

			if (profileData?.id) {
				setDeliveryProfileId(profileData.id);
				setDeliveryMode(profileData.delivery_mode as DeliveryMode);

				const { data: linkedStores, error: linkedError } = await supabaseClient
					.from('delivery_profile_stores')
					.select('partner_id')
					.eq('delivery_profile_id', profileData.id);

				if (linkedError) throw linkedError;

				const ids = (linkedStores || []).map((item: { partner_id: string }) => item.partner_id);
				setSelectedStoreIds(ids);
			}
		} catch (error) {
			console.error('Error loading delivery register data:', error);
			Alert.alert('Error', 'No se pudo cargar la información de reparto.');
		} finally {
			setLoading(false);
		}
	};

	const toggleStore = (storeId: string) => {
		if (deliveryMode === 'single_store') {
			setSelectedStoreIds([storeId]);
			return;
		}

		setSelectedStoreIds((prev) =>
			prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
		);
	};

	const selectedCountLabel = useMemo(() => {
		if (deliveryMode === 'single_store') {
			return selectedStoreIds.length > 0 ? '1 tienda seleccionada' : 'Sin tienda seleccionada';
		}

		return `${selectedStoreIds.length} tiendas seleccionadas`;
	}, [deliveryMode, selectedStoreIds.length]);

	const handleSave = async () => {
		if (!currentUser?.id) {
			Alert.alert('Iniciar sesión', 'Tenés que iniciar sesión para continuar.');
			return;
		}

		if (stores.length === 0) {
			Alert.alert('Sin tiendas', 'No hay tiendas verificadas disponibles para asociar.');
			return;
		}

		if (selectedStoreIds.length === 0) {
			Alert.alert('Elegí tiendas', 'Tenés que seleccionar al menos una tienda.');
			return;
		}

		const normalizedStoreIds = deliveryMode === 'single_store'
			? [selectedStoreIds[0]]
			: selectedStoreIds;

		try {
			setSaving(true);

			let profileId = deliveryProfileId;

			if (!profileId) {
				const { data: insertedProfile, error: insertError } = await supabaseClient
					.from('delivery_profiles')
					.insert({
						user_id: currentUser.id,
						delivery_mode: deliveryMode,
						is_active: true,
						approval_status: 'approved',
					})
					.select('id')
					.single();

				if (insertError) throw insertError;
				profileId = insertedProfile.id;
				setDeliveryProfileId(profileId);
			} else {
				const { error: updateError } = await supabaseClient
					.from('delivery_profiles')
					.update({
						delivery_mode: deliveryMode,
						is_active: true,
						updated_at: new Date().toISOString(),
					})
					.eq('id', profileId)
					.eq('user_id', currentUser.id);

				if (updateError) throw updateError;
			}

			const { error: deleteLinksError } = await supabaseClient
				.from('delivery_profile_stores')
				.delete()
				.eq('delivery_profile_id', profileId);

			if (deleteLinksError) throw deleteLinksError;

			const storeLinks = normalizedStoreIds.map((partnerId) => ({
				delivery_profile_id: profileId,
				partner_id: partnerId,
			}));

			const { error: insertLinksError } = await supabaseClient
				.from('delivery_profile_stores')
				.insert(storeLinks);

			if (insertLinksError) throw insertLinksError;

			const { error: profileFlagError } = await supabaseClient
				.from('profiles')
				.update({
					is_delivery: true,
					updated_at: new Date().toISOString(),
				})
				.eq('id', currentUser.id);

			if (profileFlagError) throw profileFlagError;

			toast.success('Listo', 'Tu perfil de repartidor quedó configurado.');
			router.back();
		} catch (error) {
			console.error('Error saving delivery profile:', error);
			Alert.alert('Error', 'No se pudo guardar tu perfil de repartidor.');
		} finally {
			setSaving(false);
		}
	};

	if (!currentUser) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<LoadingSpinner message="Cargando..." size="medium" />
				</View>
			</SafeAreaView>
		);
	}

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<ScreenHeader title="Perfil de repartidor" />
				<FormSkeleton sections={2} />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScreenHeader title="Perfil de repartidor" />

			<ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Card style={styles.introCard}>
					<View style={styles.introTitleRow}>
						<Truck size={22} color={colors.primary} />
						<Text style={styles.introTitle}>Configurá tu modalidad de reparto</Text>
					</View>
					<Text style={styles.introDescription}>
						Elegí si vas a repartir para una sola tienda o para varias, y asociálas para poder gestionar pedidos.
					</Text>
				</Card>

				<Card style={styles.modeCard}>
					<Text style={styles.sectionTitle}>Tipo de repartidor</Text>

					<TouchableOpacity
						style={[styles.modeOption, deliveryMode === 'single_store' && styles.modeOptionActive]}
						accessibilityRole="radio"
						accessibilityState={{ selected: deliveryMode === 'single_store' }}
						onPress={() => {
							setDeliveryMode('single_store');
							if (selectedStoreIds.length > 1) {
								setSelectedStoreIds([selectedStoreIds[0]]);
							}
						}}
					>
						<View>
							<Text style={styles.modeTitle}>Una tienda específica</Text>
							<Text style={styles.modeDescription}>Trabajás con un solo negocio.</Text>
						</View>
						{deliveryMode === 'single_store' && <Check size={18} color={colors.primary} />}
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.modeOption, deliveryMode === 'multi_store' && styles.modeOptionActive]}
						accessibilityRole="radio"
						accessibilityState={{ selected: deliveryMode === 'multi_store' }}
						onPress={() => setDeliveryMode('multi_store')}
					>
						<View>
							<Text style={styles.modeTitle}>Multi-tienda</Text>
							<Text style={styles.modeDescription}>Repartís para varios negocios.</Text>
						</View>
						{deliveryMode === 'multi_store' && <Check size={18} color={colors.primary} />}
					</TouchableOpacity>
				</Card>

				<Card style={styles.storesCard}>
					<Text style={styles.sectionTitle}>Tiendas asociadas</Text>
					<Text style={styles.sectionSubtitle}>{selectedCountLabel}</Text>

					{stores.length === 0 ? (
						<EmptyState
							icon={<Store size={28} color={colors.primary} />}
							title="No hay tiendas verificadas disponibles"
							description="Cuando haya tiendas verificadas vas a poder asociarte acá."
						/>
					) : (
						<View style={styles.storeList}>
							{stores.map((store) => {
								const selected = selectedStoreIds.includes(store.id);
								return (
									<TouchableOpacity
										key={store.id}
										style={[styles.storeRow, selected && styles.storeRowSelected]}
										onPress={() => toggleStore(store.id)}
										activeOpacity={0.8}
										accessibilityRole="checkbox"
										accessibilityState={{ checked: selected }}
										accessibilityLabel={store.business_name}
									>
										<View style={styles.storeRowInfo}>
											<Store size={16} color={colors.textTertiary} />
											<View style={styles.storeTextGroup}>
												<Text style={styles.storeName}>{store.business_name}</Text>
												<Text style={styles.storeType}>{businessTypeName(store.business_type)}</Text>
											</View>
										</View>
										<View style={[styles.checkbox, selected && styles.checkboxSelected]}>
											{selected && <Check size={14} color={colors.white} />}
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
					)}
				</Card>

			</ScrollView>

			<FormFooter>
				<Button
					title="Guardar configuración"
					onPress={handleSave}
					loading={saving}
					disabled={saving}
					size="large"
				/>
			</FormFooter>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
		backgroundColor: colors.surface,
	},
	backButton: {
		padding: spacing.xs,
	},
	title: {
		...typography.heading,
		color: colors.text,
	},
	placeholder: {
		width: 28,
	},
	content: {
		flex: 1,
		paddingHorizontal: spacing.lg,
	},
	scrollContent: {
		paddingBottom: spacing.xxxl,
	},
	introCard: {
		marginTop: spacing.md,
		marginBottom: spacing.md,
		padding: 14,
	},
	introTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: 6,
	},
	introTitle: {
		...typography.bodyStrong,
		color: colors.text,
		flex: 1,
	},
	introDescription: {
		...typography.bodySmall,
		color: colors.textTertiary,
	},
	modeCard: {
		marginBottom: spacing.md,
		padding: 14,
	},
	sectionTitle: {
		...typography.bodyStrong,
		color: colors.text,
		marginBottom: spacing.sm,
	},
	sectionSubtitle: {
		...typography.caption,
		color: colors.textTertiary,
		marginBottom: 10,
	},
	modeOption: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		padding: spacing.md,
		marginBottom: 10,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: colors.surface,
	},
	modeOptionActive: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	modeTitle: {
		...typography.label,
		color: colors.text,
		marginBottom: spacing.xxs,
	},
	modeDescription: {
		...typography.caption,
		color: colors.textTertiary,
	},
	storesCard: {
		marginBottom: spacing.md,
		padding: 14,
	},
	emptyStores: {
		paddingVertical: spacing.md,
	},
	emptyStoresText: {
		...typography.bodySmall,
		color: colors.textTertiary,
	},
	storeList: {
		gap: spacing.sm,
	},
	storeRow: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		padding: spacing.md,
		minHeight: 56,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: colors.surface,
	},
	storeRowSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	storeRowInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		flex: 1,
	},
	storeTextGroup: {
		flex: 1,
	},
	storeName: {
		...typography.label,
		color: colors.text,
	},
	storeType: {
		...typography.caption,
		color: colors.textTertiary,
		marginTop: 1,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: colors.borderStrong,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.surface,
	},
	checkboxSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primary,
	},
	bottomActions: {
		marginTop: spacing.xs,
		marginBottom: spacing.xxl,
	},
});
