import { supabaseClient } from '../lib/supabase';

/**
 * Interface para una promoción activa
 */
export interface ActivePromotion {
  id: string;
  discount_percentage: number;
  discount_amount: number;
  original_price: number;
  discounted_price: number;
  title: string;
  description: string;
  end_date: string;
}

/**
 * Busca una promoción activa para un producto o servicio específico
 * @param itemId - ID del producto o servicio
 * @param itemType - 'product' o 'service'
 * @returns Promoción activa o null si no existe
 */
export async function getActivePromotionForItem(
  itemId: string,
  itemType: 'product' | 'service'
): Promise<ActivePromotion | null> {
  try {
    const now = new Date().toISOString();

    // Buscar promociones activas que incluyan este producto/servicio
    const { data, error } = await supabaseClient
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .or(`cta_url.ilike.%/${itemType === 'product' ? 'products' : 'services'}/${itemId}%`)
      .order('discount_percentage', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching promotion:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const promo = data[0];
    return {
      id: promo.id,
      discount_percentage: promo.discount_percentage || 0,
      discount_amount: promo.discount_amount || 0,
      original_price: promo.original_price || 0,
      discounted_price: promo.discounted_price || 0,
      title: promo.title,
      description: promo.description,
      end_date: promo.end_date,
    };
  } catch (error) {
    console.error('Error in getActivePromotionForItem:', error);
    return null;
  }
}

/**
 * Obtiene promociones activas para múltiples productos/servicios
 * @param itemIds - Array de IDs de productos/servicios
 * @param itemType - 'product' o 'service'
 * @returns Map de itemId -> promoción activa
 */
export async function getActivePromotionsForItems(
  itemIds: string[],
  itemType: 'product' | 'service'
): Promise<Map<string, ActivePromotion>> {
  const promotionsMap = new Map<string, ActivePromotion>();

  if (itemIds.length === 0) {
    return promotionsMap;
  }

  try {
    const now = new Date().toISOString();

    // Buscar todas las promociones activas
    const { data, error } = await supabaseClient
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now);

    if (error || !data) {
      console.error('Error fetching promotions:', error);
      return promotionsMap;
    }

    // Filtrar promociones que apliquen a los items
    const prefix = itemType === 'product' ? '/products/' : '/services/';

    data.forEach((promo) => {
      if (promo.cta_url && promo.cta_url.includes(prefix)) {
        // Extraer el ID del producto/servicio del cta_url
        const match = promo.cta_url.match(new RegExp(`${prefix}([a-f0-9-]+)`));
        if (match && match[1]) {
          const itemId = match[1];

          // Solo agregar si está en la lista de IDs solicitados
          if (itemIds.includes(itemId)) {
            // Si ya existe una promoción para este item, mantener la de mayor descuento
            const existing = promotionsMap.get(itemId);
            const currentDiscount = promo.discount_percentage || 0;
            const existingDiscount = existing?.discount_percentage || 0;

            if (!existing || currentDiscount > existingDiscount) {
              promotionsMap.set(itemId, {
                id: promo.id,
                discount_percentage: promo.discount_percentage || 0,
                discount_amount: promo.discount_amount || 0,
                original_price: promo.original_price || 0,
                discounted_price: promo.discounted_price || 0,
                title: promo.title,
                description: promo.description,
                end_date: promo.end_date,
              });
            }
          }
        }
      }
    });

    console.log(`Found ${promotionsMap.size} active promotions for ${itemIds.length} items`);
    return promotionsMap;
  } catch (error) {
    console.error('Error in getActivePromotionsForItems:', error);
    return promotionsMap;
  }
}

/**
 * Calcula el precio con descuento aplicado
 * @param originalPrice - Precio original
 * @param promotion - Promoción activa
 * @returns Precio con descuento
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  promotion: ActivePromotion | null
): number {
  if (!promotion) {
    return originalPrice;
  }

  if (promotion.discounted_price > 0) {
    return promotion.discounted_price;
  }

  if (promotion.discount_percentage > 0) {
    return originalPrice * (1 - promotion.discount_percentage / 100);
  }

  if (promotion.discount_amount > 0) {
    return Math.max(0, originalPrice - promotion.discount_amount);
  }

  return originalPrice;
}

/**
 * Incrementa el contador de clicks de una promoción
 * Usado cuando un usuario compra desde la tienda/servicios con promoción activa
 * @param promotionId - ID de la promoción
 */
export async function incrementPromotionClicks(promotionId: string): Promise<void> {
  try {
    // Obtener el contador actual
    const { data: promo, error: fetchError } = await supabaseClient
      .from('promotions')
      .select('clicks')
      .eq('id', promotionId)
      .single();

    if (fetchError || !promo) {
      console.error('Error fetching promotion clicks:', fetchError);
      return;
    }

    // Incrementar clicks
    const { error: updateError } = await supabaseClient
      .from('promotions')
      .update({ clicks: (promo.clicks || 0) + 1 })
      .eq('id', promotionId);

    if (updateError) {
      console.error('Error updating promotion clicks:', updateError);
    } else {
      console.log(`Incremented clicks for promotion ${promotionId}`);
    }
  } catch (error) {
    console.error('Error in incrementPromotionClicks:', error);
  }
}
export interface GamePromotion {
  id: string;
  userId: string;
  title: string;
  description: string;
  discountCode: string;
  discountPercent: number;
  discountAmount: number;
  isClaimed: boolean;
  expiresAt: string | null;
  sourceMilestone: string | null;
}

export async function validateGamePromotion(code: string, userId: string, targetType: 'products' | 'services' | 'both' = 'both'): Promise<GamePromotion | null> {
  try {
    const { data: promo, error } = await supabaseClient
      .from('game_promotions')
      .select('*')
      .eq('user_id', userId)
      .eq('discount_code', code)
      .single();

    if (error || !promo) {
      return null;
    }

    if (promo.is_claimed) {
      throw new Error('Este código ya fue utilizado');
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      throw new Error('Este código ya expiró');
    }

    const { data: configData } = await supabaseClient
      .from('admin_settings')
      .select('value')
      .eq('key', 'game_promotions_config')
      .maybeSingle();

    if (configData?.value && promo.source_milestone) {
      const config = configData.value;
      const ms = promo.source_milestone;
      let target = 'both';
      if (ms === 'level_3_completed') target = config.level3?.target || 'products';
      if (ms === 'level_5_completed') target = config.level5?.target || 'products';
      if (ms === 'level_10_completed') target = config.level10?.target || 'services';

      if (target !== 'both' && target !== targetType) {
        throw new Error('Este código solo es válido para ' + (target === 'services' ? 'servicios' : 'la tienda'));
      }
    }

    return {
      id: promo.id,
      userId: promo.user_id,
      title: promo.title,
      description: promo.description,
      discountCode: promo.discount_code,
      discountPercent: promo.discount_percent,
      discountAmount: promo.discount_amount,
      isClaimed: promo.is_claimed,
      expiresAt: promo.expires_at,
      sourceMilestone: promo.source_milestone
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Error al validar c�digo de promoci�n:', error);
    return null;
  }
}

export async function redeemGamePromotion(promoId: string): Promise<void> {
  try {
    await supabaseClient
      .from('game_promotions')
      .update({ is_claimed: true, claimed_at: new Date().toISOString() })
      .eq('id', promoId);
  } catch (error) {
    console.error('Error al redimir el c�digo:', error);
  }
}
