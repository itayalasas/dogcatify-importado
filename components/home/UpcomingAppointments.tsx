import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarClock, ChevronRight, Clock, PawPrint } from 'lucide-react-native';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { SectionTitle } from './SectionTitle';
import { supabaseClient } from '../../lib/supabase';
import { colors, radius, shadows, spacing } from '../../constants/theme';

interface Booking {
  id: string;
  pet_id: string | null;
  pet_name: string | null;
  service_name: string | null;
  partner_name: string | null;
  date: string;
  time: string | null;
  status: string;
}

interface Props {
  userId?: string | null;
  /** Cambia cuando el usuario tira para actualizar el inicio. */
  refreshKey?: number;
}

const MAX_ITEMS = 3;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha y hora real del turno (la hora viene aparte, como "14:30"). Sin hora, cuenta todo el día. */
const getDateTime = (b: Booking) => {
  const d = new Date(b.date);
  const match = typeof b.time === 'string' ? b.time.match(/^(\d{1,2}):(\d{2})/) : null;
  if (match) d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  else d.setHours(23, 59, 59, 999);
  return d;
};

const relativeDay = (d: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff < 7) return WEEKDAYS[d.getDay()].charAt(0).toUpperCase() + WEEKDAYS[d.getDay()].slice(1);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

type Urgency = {
  /** Texto corto de cuánto falta. */
  label: string;
  fg: string;
  bg: string;
};

/**
 * Color según cuánto falta para el turno: rojo en las próximas 24 h,
 * ámbar hasta 3 días, verde marca hasta una semana y gris después.
 */
const getUrgency = (when: Date, hasTime: boolean): Urgency => {
  const hours = (when.getTime() - Date.now()) / 3600000;
  const days = Math.round(hours / 24);
  let label: string;
  if (hasTime && hours < 1) label = 'En minutos';
  else if (hasTime && hours < 12) label = `En ${Math.max(1, Math.round(hours))} h`;
  else if (relativeDay(when) === 'Hoy') label = 'Hoy';
  else if (relativeDay(when) === 'Mañana') label = 'Mañana';
  else label = `En ${days} días`;

  if (hours <= 24) return { label, fg: colors.danger, bg: colors.dangerSoft };
  if (hours <= 72) return { label, fg: colors.warning, bg: colors.warningSoft };
  if (hours <= 24 * 7) return { label, fg: colors.primary, bg: colors.primarySoft };
  return { label, fg: colors.textSecondary, bg: colors.surfaceAlt };
};

/**
 * "Próximos turnos" del inicio: las reservas pendientes o confirmadas que todavía no pasaron,
 * de todas las mascotas del usuario. Solo lectura; tocar un turno abre las citas de esa mascota.
 */
export function UpcomingAppointments({ userId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data, error } = await supabaseClient
        .from('bookings')
        .select('id, pet_id, pet_name, service_name, partner_name, date, time, status')
        .eq('customer_id', userId)
        .in('status', ['pending', 'confirmed'])
        .gte('date', startOfToday.toISOString())
        .order('date', { ascending: true })
        .limit(10);
      if (error) throw error;
      const now = new Date();
      const upcoming = ((data as Booking[]) || [])
        .filter((b) => getDateTime(b) >= now)
        .sort((a, b) => getDateTime(a).getTime() - getDateTime(b).getTime())
        .slice(0, MAX_ITEMS);
      if (mounted.current) setItems(upcoming);
    } catch (e) {
      console.warn('No se pudieron cargar los próximos turnos:', e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Al volver al inicio (por ejemplo, después de reservar) se vuelve a leer
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (refreshKey > 0) load();
  }, [refreshKey, load]);

  if (!userId) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title="Próximos turnos" />

      {loading ? (
        <View style={styles.list}>
          <Skeleton height={76} borderRadius={radius.lg} />
        </View>
      ) : items.length === 0 ? (
        <TouchableOpacity
          style={[styles.card, styles.emptyCard]}
          onPress={() => router.push('/(tabs)/explore')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="No tenés turnos próximos. Reservar un servicio"
        >
          <View style={styles.emptyIcon}>
            <CalendarClock size={22} color={colors.primary} />
          </View>
          <View style={styles.body}>
            <AppText variant="bodyStrong">No tenés turnos próximos</AppText>
            <AppText variant="bodySmall" color="textSecondary">
              Reservá veterinaria, peluquería o paseos en Explorar.
            </AppText>
          </View>
          <ChevronRight size={20} color={colors.icon} />
        </TouchableOpacity>
      ) : (
        <View style={styles.list}>
          {items.map((b) => {
            const when = getDateTime(b);
            const hasTime = typeof b.time === 'string' && /^\d{1,2}:\d{2}/.test(b.time);
            const timeLabel = hasTime ? b.time!.slice(0, 5) : null;
            const dayLabel = relativeDay(when);
            const confirmed = b.status === 'confirmed';
            const urgency = getUrgency(when, hasTime);
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.card, { borderLeftColor: urgency.fg }]}
                activeOpacity={0.8}
                disabled={!b.pet_id}
                onPress={() => b.pet_id && router.push(`/pets/appointments/${b.pet_id}`)}
                accessibilityRole="button"
                accessibilityLabel={[
                  b.service_name || 'Turno',
                  b.partner_name ? `en ${b.partner_name}` : null,
                  b.pet_name ? `para ${b.pet_name}` : null,
                  `${dayLabel}${timeLabel ? ` a las ${timeLabel}` : ''}`,
                  urgency.label,
                  confirmed ? 'confirmado' : 'pendiente de confirmación',
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <View style={[styles.dateTile, { backgroundColor: urgency.bg }]}>
                  <AppText variant="title" color={urgency.fg} style={styles.dateDay}>
                    {when.getDate()}
                  </AppText>
                  <AppText variant="captionStrong" color={urgency.fg}>
                    {MONTHS[when.getMonth()].toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.body}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {b.service_name || 'Turno'}
                  </AppText>
                  {b.partner_name ? (
                    <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
                      {b.partner_name}
                    </AppText>
                  ) : null}
                  <View style={styles.metaRow}>
                    <Clock size={14} color={colors.textTertiary} />
                    <AppText variant="caption" color="textTertiary">
                      {dayLabel}
                      {timeLabel ? ` · ${timeLabel}` : ''}
                    </AppText>
                    {b.pet_name ? (
                      <>
                        <PawPrint size={14} color={colors.textTertiary} style={styles.metaGap} />
                        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                          {b.pet_name}
                        </AppText>
                      </>
                    ) : null}
                  </View>
                </View>
                <View style={styles.trailing}>
                  <View style={[styles.countdown, { backgroundColor: urgency.bg }]}>
                    <AppText variant="captionStrong" color={urgency.fg}>
                      {urgency.label}
                    </AppText>
                  </View>
                  <Badge label={confirmed ? 'Confirmado' : 'Pendiente'} tone={confirmed ? 'success' : 'warning'} size="small" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  emptyCard: { marginHorizontal: spacing.lg, borderLeftWidth: StyleSheet.hairlineWidth },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
  countdown: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTile: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { lineHeight: 26 },
  body: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  metaGap: { marginLeft: spacing.sm },
});
