import { supabaseClient } from '@/lib/supabase';
import jsPDF from 'jspdf';

/**
 * Configuración de precios para facturación de promociones
 */
export interface PromotionPricingConfig {
  pricePerView: number;
  pricePerLike: number;
  billingMode: 'views' | 'likes' | 'both';
  minimumCharge: number;
  taxPercentage: number;
}

/**
 * Datos de una factura de promoción
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
  totalViews: number;
  totalLikes: number;
  pricePerView: number;
  pricePerLike: number;
  viewsAmount: number;
  likesAmount: number;
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  pdfUrl?: string;
  sentAt?: Date;
  paidAt?: Date;
  notes?: string;
  createdAt?: Date;
}

/**
 * Obtener configuración de precios activa
 */
export const getActivePricingConfig = async (): Promise<PromotionPricingConfig> => {
  // Por ahora, retornamos una configuración por defecto
  // En producción, esto vendría de la base de datos
  return {
    pricePerView: 0.10,
    pricePerLike: 0.50,
    billingMode: 'both',
    minimumCharge: 10.00,
    taxPercentage: 22.0
  };
};

/**
 * Calcular totales de una factura
 */
export const calculateInvoiceTotals = (
  views: number,
  likes: number,
  config: PromotionPricingConfig
): { viewsAmount: number; likesAmount: number; subtotal: number; taxAmount: number; total: number } => {
  let viewsAmount = 0;
  let likesAmount = 0;

  if (config.billingMode === 'views' || config.billingMode === 'both') {
    viewsAmount = views * config.pricePerView;
  }

  if (config.billingMode === 'likes' || config.billingMode === 'both') {
    likesAmount = likes * config.pricePerLike;
  }

  let subtotal = viewsAmount + likesAmount;

  // Aplicar cargo mínimo
  if (subtotal < config.minimumCharge) {
    subtotal = config.minimumCharge;
  }

  const taxAmount = subtotal * (config.taxPercentage / 100);
  const total = subtotal + taxAmount;

  return {
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
 * Crear una factura para una promoción
 */
export const createPromotionInvoice = async (
  promotionId: string,
  billingPeriodStart: Date,
  billingPeriodEnd: Date
): Promise<{ success: boolean; invoice?: PromotionInvoice; error?: string }> => {
  try {
    // Obtener datos de la promoción desde localStorage (simulado)
    // En producción, esto vendría de Supabase
    const promotionsStr = localStorage.getItem('promotions_data');
    if (!promotionsStr) {
      throw new Error('No se encontraron datos de promociones');
    }

    const promotions = JSON.parse(promotionsStr);
    const promotion = promotions.find((p: any) => p.id === promotionId);

    if (!promotion) {
      throw new Error('Promoción no encontrada');
    }

    if (!promotion.partnerId) {
      throw new Error('La promoción no tiene un aliado asociado');
    }

    // Obtener configuración de precios
    const config = await getActivePricingConfig();

    // Calcular totales
    const totalViews = promotion.views || 0;
    const totalLikes = Array.isArray(promotion.likes) ? promotion.likes.length : 0;

    const totals = calculateInvoiceTotals(totalViews, totalLikes, config);

    // Crear objeto de factura
    const invoice: PromotionInvoice = {
      invoiceNumber: generateInvoiceNumber(),
      promotionId: promotion.id,
      promotionTitle: promotion.title,
      partnerId: promotion.partnerId,
      partnerName: promotion.partnerInfo?.businessName || 'Aliado',
      partnerEmail: promotion.partnerInfo?.email || 'partner@example.com',
      billingPeriodStart,
      billingPeriodEnd,
      totalViews,
      totalLikes,
      pricePerView: config.pricePerView,
      pricePerLike: config.pricePerLike,
      viewsAmount: totals.viewsAmount,
      likesAmount: totals.likesAmount,
      subtotal: totals.subtotal,
      taxPercentage: config.taxPercentage,
      taxAmount: totals.taxAmount,
      totalAmount: totals.total,
      status: 'draft',
      createdAt: new Date()
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
 * Guardar factura en localStorage (simulación)
 * En producción esto se guardaría en Supabase
 */
export const saveInvoice = (invoice: PromotionInvoice): void => {
  try {
    const invoicesStr = localStorage.getItem('promotion_invoices');
    const invoices = invoicesStr ? JSON.parse(invoicesStr) : [];

    // Agregar o actualizar factura
    const existingIndex = invoices.findIndex((inv: PromotionInvoice) =>
      inv.invoiceNumber === invoice.invoiceNumber
    );

    if (existingIndex >= 0) {
      invoices[existingIndex] = invoice;
    } else {
      invoices.push(invoice);
    }

    localStorage.setItem('promotion_invoices', JSON.stringify(invoices));
  } catch (error) {
    console.error('Error saving invoice:', error);
    throw error;
  }
};

/**
 * Obtener todas las facturas
 */
export const getAllInvoices = (): PromotionInvoice[] => {
  try {
    const invoicesStr = localStorage.getItem('promotion_invoices');
    return invoicesStr ? JSON.parse(invoicesStr) : [];
  } catch (error) {
    console.error('Error getting invoices:', error);
    return [];
  }
};

/**
 * Obtener facturas de un partner específico
 */
export const getPartnerInvoices = (partnerId: string): PromotionInvoice[] => {
  const allInvoices = getAllInvoices();
  return allInvoices.filter(inv => inv.partnerId === partnerId);
};
