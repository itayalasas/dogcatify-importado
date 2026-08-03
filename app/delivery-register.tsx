import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Truck, Store, Check } from 'lucide-react-native';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../lib/supabase';

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
			Alert.alert('Iniciar sesión', 'Debes iniciar sesión para continuar.');
			return;
		}

		if (stores.length === 0) {
			Alert.alert('Sin tiendas', 'No hay tiendas verificadas disponibles para asociar.');
			return;
		}

		if (selectedStoreIds.length === 0) {
			Alert.alert('Selecciona tiendas', 'Debes seleccionar al menos una tienda.');
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
						is_active: false,
						approval_status: 'pending',
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

			Alert.alert('Listo', 'Tu perfil de repartidor quedó configurado.', [
				{ text: 'OK', onPress: () => router.back() },
			]);
		} catch (error) {
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
				<View style={styles.loadingContainer}>
					<LoadingSpinner message="Cargando configuración de reparto..." size="medium" />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<ArrowLeft size={24} color="#111827" />
				</TouchableOpacity>
				<Text style={styles.title}>Perfil de Repartidor</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				<Card style={styles.introCard}>
					<View style={styles.introTitleRow}>
						<Truck size={22} color="#2D6A6F" />
						<Text style={styles.introTitle}>Configura tu modalidad de reparto</Text>
					</View>
					<Text style={styles.introDescription}>
						Elige si repartirás para una sola tienda o para múltiples tiendas y asócialas para poder gestionar pedidos.
					</Text>
				</Card>

				<Card style={styles.modeCard}>
					<Text style={styles.sectionTitle}>Tipo de repartidor</Text>

					<TouchableOpacity
						style={[styles.modeOption, deliveryMode === 'single_store' && styles.modeOptionActive]}
						onPress={() => {
							setDeliveryMode('single_store');
							if (selectedStoreIds.length > 1) {
								setSelectedStoreIds([selectedStoreIds[0]]);
							}
						}}
					>
						<View>
							<Text style={styles.modeTitle}>Una tienda específica</Text>
							<Text style={styles.modeDescription}>Trabajas con un solo negocio.</Text>
						</View>
						{deliveryMode === 'single_store' && <Check size={18} color="#2D6A6F" />}
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.modeOption, deliveryMode === 'multi_store' && styles.modeOptionActive]}
						onPress={() => setDeliveryMode('multi_store')}
					>
						<View>
							<Text style={styles.modeTitle}>Multi-tienda</Text>
							<Text style={styles.modeDescription}>Repartes para varios negocios.</Text>
						</View>
						{deliveryMode === 'multi_store' && <Check size={18} color="#2D6A6F" />}
					</TouchableOpacity>
				</Card>

				<Card style={styles.storesCard}>
					<Text style={styles.sectionTitle}>Tiendas asociadas</Text>
					<Text style={styles.sectionSubtitle}>{selectedCountLabel}</Text>

					{stores.length === 0 ? (
						<View style={styles.emptyStores}>
							<Text style={styles.emptyStoresText}>No hay tiendas verificadas disponibles.</Text>
						</View>
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
									>
										<View style={styles.storeRowInfo}>
											<Store size={16} color="#6B7280" />
											<View style={styles.storeTextGroup}>
												<Text style={styles.storeName}>{store.business_name}</Text>
												<Text style={styles.storeType}>{businessTypeName(store.business_type)}</Text>
											</View>
										</View>
										<View style={[styles.checkbox, selected && styles.checkboxSelected]}>
											{selected && <Check size={14} color="#FFFFFF" />}
										</View>
									</TouchableOpacity>
								);
							})}
						</View>
					)}
				</Card>

				<View style={styles.bottomActions}>
					<Button
						title={saving ? 'Guardando...' : 'Guardar configuración'}
						onPress={handleSave}
						disabled={saving}
						size="large"
					/>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
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
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
		backgroundColor: '#FFFFFF',
	},
	backButton: {
		padding: 4,
	},
	title: {
		fontSize: 18,
		fontFamily: 'Inter-Bold',
		color: '#111827',
	},
	placeholder: {
		width: 28,
	},
	content: {
		flex: 1,
		paddingHorizontal: 16,
	},
	introCard: {
		marginTop: 12,
		marginBottom: 12,
		padding: 14,
	},
	introTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 6,
	},
	introTitle: {
		fontSize: 16,
		fontFamily: 'Inter-SemiBold',
		color: '#111827',
		flex: 1,
	},
	introDescription: {
		fontSize: 13,
		fontFamily: 'Inter-Regular',
		color: '#6B7280',
		lineHeight: 20,
	},
	modeCard: {
		marginBottom: 12,
		padding: 14,
	},
	sectionTitle: {
		fontSize: 15,
		fontFamily: 'Inter-SemiBold',
		color: '#111827',
		marginBottom: 8,
	},
	sectionSubtitle: {
		fontSize: 12,
		fontFamily: 'Inter-Regular',
		color: '#6B7280',
		marginBottom: 10,
	},
	modeOption: {
		borderWidth: 1,
		borderColor: '#E5E7EB',
		borderRadius: 10,
		padding: 12,
		marginBottom: 10,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#FFFFFF',
	},
	modeOptionActive: {
		borderColor: '#2D6A6F',
		backgroundColor: '#F0FDFA',
	},
	modeTitle: {
		fontSize: 14,
		fontFamily: 'Inter-SemiBold',
		color: '#111827',
		marginBottom: 2,
	},
	modeDescription: {
		fontSize: 12,
		fontFamily: 'Inter-Regular',
		color: '#6B7280',
	},
	storesCard: {
		marginBottom: 12,
		padding: 14,
	},
	emptyStores: {
		paddingVertical: 12,
	},
	emptyStoresText: {
		fontSize: 13,
		fontFamily: 'Inter-Regular',
		color: '#6B7280',
	},
	storeList: {
		gap: 8,
	},
	storeRow: {
		borderWidth: 1,
		borderColor: '#E5E7EB',
		borderRadius: 10,
		padding: 10,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#FFFFFF',
	},
	storeRowSelected: {
		borderColor: '#2D6A6F',
		backgroundColor: '#F0FDFA',
	},
	storeRowInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		flex: 1,
	},
	storeTextGroup: {
		flex: 1,
	},
	storeName: {
		fontSize: 13,
		fontFamily: 'Inter-SemiBold',
		color: '#111827',
	},
	storeType: {
		fontSize: 12,
		fontFamily: 'Inter-Regular',
		color: '#6B7280',
		marginTop: 1,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: '#D1D5DB',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
	},
	checkboxSelected: {
		borderColor: '#2D6A6F',
		backgroundColor: '#2D6A6F',
	},
	bottomActions: {
		marginTop: 4,
		marginBottom: 24,
	},
});
