import { supabaseClient } from '../lib/supabase';

/**
 * Configuración de precios para facturación de promociones
 */
export interface PromotionPricingConfig {
  pricePerView: number;
  pricePerLike: number;
  costPerClick: number;
  billingMode: 'views' | 'likes' | 'clicks' | 'both';
  minimumCharge: number;
  taxPercentage: number;
}

/**
 * Datos de una factura de promoción (basado en tabla promotion_billing)
 */
export interface PromotionInvoice {
  id?: string;
  invoiceNumber: string;
  promotionId: string;
  promotionTitle: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  totalClicks: number;
  totalViews: number;
  totalLikes: number;
  costPerClick: number;
  pricePerView: number;
  pricePerLike: number;
  clicksAmount: number;
  viewsAmount: number;
  likesAmount: number;
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  pdfUrl?: string;
  notes?: string;
  createdAt?: Date;
  paidAt?: Date;
  createdBy?: string;
}

/**
 * Obtener configuración de precios activa
 */
export const getActivePricingConfig = async (): Promise<PromotionPricingConfig> => {
  return {
    pricePerView: 0.10,
    pricePerLike: 0.50,
    costPerClick: 0.25,
    billingMode: 'both',
    minimumCharge: 10.00,
    taxPercentage: 22.0
  };
};

/**
 * Calcular totales de una factura
 */
export const calculateInvoiceTotals = (
  clicks: number,
  views: number,
  likes: number,
  config: PromotionPricingConfig
): {
  clicksAmount: number;
  viewsAmount: number;
  likesAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number
} => {
  let clicksAmount = 0;
  let viewsAmount = 0;
  let likesAmount = 0;

  if (config.billingMode === 'clicks' || config.billingMode === 'both') {
    clicksAmount = clicks * config.costPerClick;
  }

  if (config.billingMode === 'views' || config.billingMode === 'both') {
    viewsAmount = views * config.pricePerView;
  }

  if (config.billingMode === 'likes' || config.billingMode === 'both') {
    likesAmount = likes * config.pricePerLike;
  }

  let subtotal = clicksAmount + viewsAmount + likesAmount;

  // Aplicar cargo mínimo
  if (subtotal < config.minimumCharge) {
    subtotal = config.minimumCharge;
  }

  const taxAmount = subtotal * (config.taxPercentage / 100);
  const total = subtotal + taxAmount;

  return {
    clicksAmount,
    viewsAmount,
    likesAmount,
    subtotal,
    taxAmount,
    total
  };
};

/**
 * Generar número de factura único
 */
export const generateInvoiceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};

/**
 * Crear una factura para una promoción usando datos de Supabase
 */
export const createPromotionInvoice = async (
  promotionId: string,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  currentUserId: string
): Promise<{ success: boolean; invoice?: PromotionInvoice; error?: string }> => {
  try {
    // Obtener datos de la promoción desde Supabase
    const { data: promotion, error: promoError } = await supabaseClient
      .from('promotions')
      .select(`
        *,
        partners:partner_id(
          id,
          business_name,
          user_id,
          profiles:user_id(email)
        )
      `)
      .eq('id', promotionId)
      .single();

    if (promoError || !promotion) {
      throw new Error('Promoción no encontrada');
    }

    if (!promotion.partner_id) {
      throw new Error('La promoción no tiene un aliado asociado');
    }

    // Obtener configuración de precios
    const config = await getActivePricingConfig();

    // Calcular totales
    const totalClicks = promotion.clicks || 0;
    const totalViews = promotion.views || 0;
    const totalLikes = Array.isArray(promotion.likes) ? promotion.likes.length : 0;

    const totals = calculateInvoiceTotals(totalClicks, totalViews, totalLikes, config);

    // Generar número de factura
    const invoiceNumber = generateInvoiceNumber();

    // Obtener email del partner
    const partnerEmail = promotion.partners?.profiles?.email || 'partner@example.com';

    // Crear objeto de factura
    const invoice: PromotionInvoice = {
      invoiceNumber,
      promotionId: promotion.id,
      promotionTitle: promotion.title,
      partnerId: promotion.partner_id,
      partnerName: promotion.partners?.business_name || 'Aliado',
      partnerEmail,
      billingPeriodStart,
      billingPeriodEnd,
      totalClicks,
      totalViews,
      totalLikes,
      costPerClick: config.costPerClick,
      pricePerView: config.pricePerView,
      pricePerLike: config.pricePerLike,
      clicksAmount: totals.clicksAmount,
      viewsAmount: totals.viewsAmount,
      likesAmount: totals.likesAmount,
      subtotal: totals.subtotal,
      taxPercentage: config.taxPercentage,
      taxAmount: totals.taxAmount,
      totalAmount: totals.total,
      status: 'draft',
      createdAt: new Date(),
      createdBy: currentUserId
    };

    return {
      success: true,
      invoice
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al crear la factura'
    };
  }
};

/**
 * Guardar factura en Supabase (tabla promotion_billing)
 */
export const saveInvoiceToDatabase = async (
  invoice: PromotionInvoice
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabaseClient
      .from('promotion_billing')
      .insert({
        promotion_id: invoice.promotionId,
        partner_id: invoice.partnerId,
        total_clicks: invoice.totalClicks,
        cost_per_click: invoice.costPerClick,
        total_amount: invoice.totalAmount,
        billing_period_start: invoice.billingPeriodStart.toISOString(),
        billing_period_end: invoice.billingPeriodEnd.toISOString(),
        status: invoice.status,
        invoice_number: invoice.invoiceNumber,
        notes: invoice.notes || `Factura automática - Clicks: ${invoice.totalClicks}, Vistas: ${invoice.totalViews}, Likes: ${invoice.totalLikes}`,
        created_by: invoice.createdBy
      });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al guardar la factura'
    };
  }
};

/**
 * Actualizar estado de factura
 */
export const updateInvoiceStatus = async (
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid' | 'cancelled',
  paidAt?: Date
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = { status };

    if (paidAt && status === 'paid') {
      updateData.paid_at = paidAt.toISOString();
    }

    const { error } = await supabaseClient
      .from('promotion_billing')
      .update(updateData)
      .eq('id', invoiceId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al actualizar estado de factura'
    };
  }
};

/**
 * Obtener todas las facturas desde Supabase
 */
export const getAllInvoicesFromDatabase = async (): Promise<PromotionInvoice[]> => {
  try {
    const { data, error } = await supabaseClient
      .from('promotion_billing')
      .select(`
        *,
        promotions:promotion_id(title),
        partners:partner_id(business_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      invoiceNumber: item.invoice_number || 'N/A',
      promotionId: item.promotion_id,
      promotionTitle: item.promotions?.title || 'Promoción',
      partnerId: item.partner_id,
      partnerName: item.partners?.business_name || 'Aliado',
      partnerEmail: '',
      billingPeriodStart: new Date(item.billing_period_start),
      billingPeriodEnd: new Date(item.billing_period_end),
      totalClicks: item.total_clicks || 0,
      totalViews: 0,
      totalLikes: 0,
      costPerClick: item.cost_per_click || 0,
      pricePerView: 0,
      pricePerLike: 0,
      clicksAmount: 0,
      viewsAmount: 0,
      likesAmount: 0,
      subtotal: item.total_amount || 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: item.total_amount || 0,
      status: item.status || 'draft',
      notes: item.notes,
      createdAt: new Date(item.created_at),
      paidAt: item.paid_at ? new Date(item.paid_at) : undefined,
      createdBy: item.created_by
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Obtener facturas de un partner específico desde Supabase
 */
export const getPartnerInvoicesFromDatabase = async (partnerId: string): Promise<PromotionInvoice[]> => {
  try {
    const { data, error } = await supabaseClient
      .from('promotion_billing')
      .select(`
        *,
        promotions:promotion_id(title),
        partners:partner_id(business_name)
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      invoiceNumber: item.invoice_number || 'N/A',
      promotionId: item.promotion_id,
      promotionTitle: item.promotions?.title || 'Promoción',
      partnerId: item.partner_id,
      partnerName: item.partners?.business_name || 'Aliado',
      partnerEmail: '',
      billingPeriodStart: new Date(item.billing_period_start),
      billingPeriodEnd: new Date(item.billing_period_end),
      totalClicks: item.total_clicks || 0,
      totalViews: 0,
      totalLikes: 0,
      costPerClick: item.cost_per_click || 0,
      pricePerView: 0,
      pricePerLike: 0,
      clicksAmount: 0,
      viewsAmount: 0,
      likesAmount: 0,
      subtotal: item.total_amount || 0,
      taxPercentage: 0,
      taxAmount: 0,
      totalAmount: item.total_amount || 0,
      status: item.status || 'draft',
      notes: item.notes,
      createdAt: new Date(item.created_at),
      paidAt: item.paid_at ? new Date(item.paid_at) : undefined,
      createdBy: item.created_by
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Función simplificada para generar factura de promoción
 * Compatible con el componente de promociones
 */
export const generatePromotionInvoice = async (params: {
  promotionId: string;
  promotionTitle: string;
  partnerInfo: {
    businessName: string;
    businessType: string;
    logo: string | null;
  };
  items: any[];
  discount: number;
  invoiceDate: Date;
}): Promise<void> => {
  try {

    // Por ahora solo registramos el evento
    // En el futuro aquí se puede:
    // 1. Crear la factura usando createPromotionInvoice
    // 2. Guardar el PDF usando saveInvoiceToDatabase
    // 3. Enviar el email con la factura

  } catch (error) {
    throw error;
  }
};
