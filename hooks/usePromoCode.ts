import { useState, useCallback } from 'react';
import { supabaseClient } from '../lib/supabase';

export interface AppliedPromo {
  id: string;
  code: string;
  discountPercent: number;
  title: string;
  description: string;
}

export type PromoValidationStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'used' | 'expired';

interface UsePromoCodeReturn {
  promoCode: string;
  setPromoCode: (code: string) => void;
  status: PromoValidationStatus;
  errorMessage: string;
  appliedPromo: AppliedPromo | null;
  validateAndApply: (userId: string) => Promise<void>;
  removePromo: () => void;
  /** Calcula el total con el descuento aplicado */
  applyDiscountTo: (originalAmount: number) => number;
  /** Monto descontado en pesos */
  discountAmount: (originalAmount: number) => number;
}

/**
 * Hook para manejar códigos de promoción.
 * Valida contra:
 *   1. game_promotions (cupones ganados jugando Patitas al Rescate)
 *   2. promotions (promociones creadas desde el panel de DogCatiFy)
 */
export function usePromoCode(): UsePromoCodeReturn {
  const [promoCode, setPromoCode] = useState('');
  const [status, setStatus] = useState<PromoValidationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const validateAndApply = useCallback(async (userId: string) => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Ingresa un código de promoción');
      setStatus('invalid');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // ── 1. Buscar en game_promotions (cupones del juego) ──────────────────
      const { data: gamePromo } = await supabaseClient
        .from('game_promotions')
        .select('id, title, description, discount_code, discount_percent, is_claimed, expires_at')
        .eq('user_id', userId)
        .ilike('discount_code', code)
        .maybeSingle();

      if (gamePromo) {
        if (gamePromo.is_claimed) {
          setStatus('used');
          setErrorMessage('Este cupón ya fue utilizado anteriormente.');
          return;
        }
        if (gamePromo.expires_at && new Date(gamePromo.expires_at) < new Date()) {
          setStatus('expired');
          setErrorMessage('Este cupón venció. Sigue jugando para ganar más.');
          return;
        }
        setAppliedPromo({
          id: gamePromo.id,
          code,
          discountPercent: gamePromo.discount_percent ?? 0,
          title: gamePromo.title,
          description: gamePromo.description,
        });
        setStatus('valid');
        return;
      }

      // ── 2. Buscar en promotions (promos del panel de DogCatiFy) ──────────
      const now = new Date().toISOString();
      const { data: storePromo } = await supabaseClient
        .from('promotions')
        .select('id, title, description, promo_code, discount_percentage, is_active, start_date, end_date, approval_status')
        .ilike('promo_code', code)
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .lte('start_date', now)
        .gte('end_date', now)
        .maybeSingle();

      if (storePromo) {
        setAppliedPromo({
          id: storePromo.id,
          code,
          discountPercent: storePromo.discount_percentage ?? 0,
          title: storePromo.title,
          description: storePromo.description || '',
        });
        setStatus('valid');
        return;
      }

      // ── 3. No encontrado ─────────────────────────────────────────────────
      setStatus('invalid');
      setErrorMessage('Código no válido o no disponible para tu cuenta.');
    } catch (err) {
      console.error('[PromoCode] Error validando código:', err);
      setStatus('invalid');
      setErrorMessage('No se pudo verificar el código. Intenta de nuevo.');
    }
  }, [promoCode]);

  const removePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoCode('');
    setStatus('idle');
    setErrorMessage('');
  }, []);

  const applyDiscountTo = useCallback((originalAmount: number): number => {
    if (!appliedPromo || appliedPromo.discountPercent <= 0) return originalAmount;
    return Math.max(0, originalAmount * (1 - appliedPromo.discountPercent / 100));
  }, [appliedPromo]);

  const discountAmount = useCallback((originalAmount: number): number => {
    if (!appliedPromo || appliedPromo.discountPercent <= 0) return 0;
    return originalAmount * (appliedPromo.discountPercent / 100);
  }, [appliedPromo]);

  return {
    promoCode,
    setPromoCode,
    status,
    errorMessage,
    appliedPromo,
    validateAndApply,
    removePromo,
    applyDiscountTo,
    discountAmount,
  };
}
