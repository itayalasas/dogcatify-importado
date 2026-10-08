import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Package, Pencil, Trash2 } from 'lucide-react-native';
import { Card, AppText, Badge, IconButton } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatMoney, formatNumber } from './format';

interface PartnerProductCardProps {
  name?: string;
  category?: string;
  weight?: string;
  price?: number | string;
  stock?: number | string;
  imageUrl?: string;
  isActive: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta de producto del inventario del negocio: nombre, categoría, precio, stock y acciones. */
export const PartnerProductCard: React.FC<PartnerProductCardProps> = ({
  name,
  category,
  weight,
  price,
  stock,
  imageUrl,
  isActive,
  onEdit,
  onToggle,
  onDelete,
  style,
}) => {
  const title = name?.trim() || 'Producto sin nombre';
  const secondary = [category, weight].filter(Boolean).join(' · ');
  return (
    <Card padding={false} style={[styles.card, style]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Package size={32} color={colors.primary} />
        </View>
      )}
      <View style={styles.content}>
        <Badge
          label={isActive ? 'Activo' : 'Inactivo'}
          tone={isActive ? 'success' : 'neutral'}
          size="small"
          style={styles.badge}
        />
        <AppText variant="label" numberOfLines={2} style={styles.name}>
          {title}
        </AppText>
        {secondary ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {secondary}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong" color="primary" style={styles.price}>
          {formatMoney(price)}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          Stock: {formatNumber(stock)}
        </AppText>

        <View style={styles.actions}>
          <IconButton
            icon={<Pencil size={18} color={colors.primary} />}
            onPress={onEdit}
            variant="tonal"
            size={36}
            accessibilityLabel={`Editar ${title}`}
          />
          <TouchableOpacity
            style={[styles.toggle, { backgroundColor: isActive ? colors.surfaceAlt : colors.successSoft }]}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={isActive ? `Desactivar ${title}` : `Activar ${title}`}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <AppText
              variant="captionStrong"
              color={isActive ? 'textSecondary' : 'success'}
              numberOfLines={1}
            >
              {isActive ? 'Desactivar' : 'Activar'}
            </AppText>
          </TouchableOpacity>
          <IconButton
            icon={<Trash2 size={18} color={colors.danger} />}
            onPress={onDelete}
            size={36}
            style={styles.deleteButton}
            accessibilityLabel={`Eliminar ${title}`}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
  },
  imagePlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
  },
  badge: {
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.text,
  },
  price: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  toggle: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  deleteButton: {
    backgroundColor: colors.dangerSoft,
  },
});
