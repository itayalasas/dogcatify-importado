import { supabaseClient } from '../lib/supabase';
import jsPDF from 'jspdf';

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
 * Generar PDF de factura
 */
export const generateInvoicePDF = (invoice: PromotionInvoice): jsPDF => {
  const doc = new jsPDF();

  // Colores corporativos
  const primaryColor: [number, number, number] = [220, 38, 38]; // #DC2626
  const secondaryColor: [number, number, number] = [107, 114, 128]; // #6B7280
  const bgGray: [number, number, number] = [249, 250, 251]; // #F9FAFB

  // Header con logo y título
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('DogCatify', 15, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Factura de Promoción', 15, 30);

  // Información de la factura
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Factura No: ${invoice.invoiceNumber}`, 140, 20);

  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-UY')}`, 140, 26);
  doc.text(`Estado: ${invoice.status.toUpperCase()}`, 140, 32);

  // Información del aliado
  let yPos = 55;
  doc.setFillColor(...bgGray);
  doc.rect(15, yPos - 5, 180, 25, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturar a:', 20, yPos);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.partnerName, 20, yPos + 7);
  doc.text(invoice.partnerEmail, 20, yPos + 13);

  // Información de la promoción
  yPos += 35;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalles de la Promoción:', 15, yPos);

  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Promoción: ${invoice.promotionTitle}`, 15, yPos);

  yPos += 6;
  const startDate = invoice.billingPeriodStart.toLocaleDateString('es-UY');
  const endDate = invoice.billingPeriodEnd.toLocaleDateString('es-UY');
  doc.text(`Período: ${startDate} - ${endDate}`, 15, yPos);

  // Tabla de conceptos
  yPos += 15;
  doc.setFillColor(...primaryColor);
  doc.rect(15, yPos, 180, 10, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Concepto', 20, yPos + 7);
  doc.text('Cantidad', 100, yPos + 7);
  doc.text('Precio Unit.', 130, yPos + 7);
  doc.text('Subtotal', 165, yPos + 7);

  // Filas de la tabla
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  yPos += 15;

  // Clicks
  if (invoice.totalClicks > 0) {
    doc.text('Clicks en la promoción', 20, yPos);
    doc.text(invoice.totalClicks.toString(), 100, yPos);
    doc.text(`$${invoice.costPerClick.toFixed(2)}`, 130, yPos);
    doc.text(`$${invoice.clicksAmount.toFixed(2)}`, 165, yPos);
    yPos += 8;
  }

  // Vistas
  if (invoice.totalViews > 0) {
    doc.text('Vistas de la promoción', 20, yPos);
    doc.text(invoice.totalViews.toString(), 100, yPos);
    doc.text(`$${invoice.pricePerView.toFixed(2)}`, 130, yPos);
    doc.text(`$${invoice.viewsAmount.toFixed(2)}`, 165, yPos);
    yPos += 8;
  }

  // Likes
  if (invoice.totalLikes > 0) {
    doc.text('Likes en la promoción', 20, yPos);
    doc.text(invoice.totalLikes.toString(), 100, yPos);
    doc.text(`$${invoice.pricePerLike.toFixed(2)}`, 130, yPos);
    doc.text(`$${invoice.likesAmount.toFixed(2)}`, 165, yPos);
    yPos += 8;
  }

  // Línea separadora
  yPos += 5;
  doc.setDrawColor(...secondaryColor);
  doc.line(15, yPos, 195, yPos);

  // Totales
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, yPos);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, 165, yPos);

  yPos += 8;
  doc.text(`IVA (${invoice.taxPercentage}%):`, 130, yPos);
  doc.text(`$${invoice.taxAmount.toFixed(2)}`, 165, yPos);

  yPos += 10;
  doc.setFillColor(...bgGray);
  doc.rect(125, yPos - 5, 70, 10, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 130, yPos + 2);
  doc.text(`$${invoice.totalAmount.toFixed(2)}`, 165, yPos + 2);

  // Notas
  if (invoice.notes) {
    yPos += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', 15, yPos);

    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const notes = doc.splitTextToSize(invoice.notes, 180);
    doc.text(notes, 15, yPos);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'italic');
  doc.text('Gracias por confiar en DogCatify para promocionar sus servicios', 105, pageHeight - 20, { align: 'center' });
  doc.text('Para consultas: admin@dogcatify.com', 105, pageHeight - 15, { align: 'center' });

  return doc;
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
    console.error('Error creating invoice:', error);
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
      console.error('Error saving to database:', error);
      throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in saveInvoiceToDatabase:', error);
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
    console.error('Error updating invoice status:', error);
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
    console.error('Error getting invoices from database:', error);
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
    console.error('Error getting partner invoices:', error);
    return [];
  }
};
