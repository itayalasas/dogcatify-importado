export type ScheduleClosureEntry = {
  id?: string | null;
  partner_id?: string | null;
  closed_date?: string | null;
  closure_date?: string | null;
  date?: string | null;
  reason?: string | null;
  closure_type?: string | null;
  source_year?: number | null;
};

export type ScheduleClosureSeed = {
  closed_date: string;
  reason: string;
  closure_type: 'holiday' | 'manual';
  source_year: number;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function toLocalDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function formatDateLabel(value: Date | string | null | undefined): string {
  const key = toLocalDateKey(value);
  if (!key) return '';

  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString('es-UY', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isDateClosed(date: Date, closures: ScheduleClosureEntry[] = []): boolean {
  const dateKey = toLocalDateKey(date);
  if (!dateKey) return false;

  return closures.some((closure) => {
    const closureKey = toLocalDateKey(
      closure.closed_date || closure.closure_date || closure.date || null,
    );
    return closureKey === dateKey;
  });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month, day);
}

function createHolidaySeed(date: Date, reason: string, sourceYear: number): ScheduleClosureSeed {
  return {
    closed_date: toLocalDateKey(date)!,
    reason,
    closure_type: 'holiday',
    source_year: sourceYear,
  };
}

export function generateUruguayHolidayClosures(year: number): ScheduleClosureSeed[] {
  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
  const easterSunday = getEasterSunday(safeYear);

  const holidays: ScheduleClosureSeed[] = [
    createHolidaySeed(new Date(safeYear, 0, 1), 'Año Nuevo', safeYear),
    createHolidaySeed(new Date(safeYear, 0, 6), 'Día de Reyes', safeYear),
    createHolidaySeed(addDays(easterSunday, -48), 'Carnaval', safeYear),
    createHolidaySeed(addDays(easterSunday, -47), 'Carnaval', safeYear),
    createHolidaySeed(addDays(easterSunday, -6), 'Semana de Turismo', safeYear),
    createHolidaySeed(addDays(easterSunday, -5), 'Semana de Turismo', safeYear),
    createHolidaySeed(addDays(easterSunday, -4), 'Semana de Turismo', safeYear),
    createHolidaySeed(addDays(easterSunday, -3), 'Semana de Turismo', safeYear),
    createHolidaySeed(addDays(easterSunday, -2), 'Semana de Turismo', safeYear),
    createHolidaySeed(addDays(easterSunday, -1), 'Semana de Turismo', safeYear),
    createHolidaySeed(easterSunday, 'Semana de Turismo', safeYear),
    createHolidaySeed(new Date(safeYear, 3, 19), 'Desembarco de los Treinta y Tres Orientales', safeYear),
    createHolidaySeed(new Date(safeYear, 4, 1), 'Día de los Trabajadores', safeYear),
    createHolidaySeed(new Date(safeYear, 4, 18), 'Batalla de las Piedras', safeYear),
    createHolidaySeed(new Date(safeYear, 5, 19), 'Natalicio de Artigas', safeYear),
    createHolidaySeed(new Date(safeYear, 6, 18), 'Jura de la Constitución', safeYear),
    createHolidaySeed(new Date(safeYear, 7, 25), 'Declaratoria de la Independencia', safeYear),
    createHolidaySeed(new Date(safeYear, 9, 12), 'Día de la Diversidad Cultural', safeYear),
    createHolidaySeed(new Date(safeYear, 10, 2), 'Día de los Difuntos', safeYear),
    createHolidaySeed(new Date(safeYear, 11, 25), 'Día de la Familia', safeYear),
  ];

  const seen = new Set<string>();
  return holidays.filter((holiday) => {
    if (seen.has(holiday.closed_date)) {
      return false;
    }
    seen.add(holiday.closed_date);
    return true;
  });
}
