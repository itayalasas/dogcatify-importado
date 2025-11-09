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
