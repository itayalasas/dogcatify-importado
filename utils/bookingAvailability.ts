import { isDateClosed, type ScheduleClosureEntry } from './scheduleExceptions';

export type BookingSlotEntry = {
  appointment_time?: string | null;
  appointment_date?: string | null;
  service_duration?: number | null;
  time?: string | null;
  duration?: number | null;
};

export type ScheduleSlotEntry = {
  id?: string | null;
  partner_id?: string | null;
  partnerId?: string | null;
  day_of_week?: number | null;
  dayOfWeek?: number | null;
  start_time?: string | null;
  startTime?: string | null;
  end_time?: string | null;
  endTime?: string | null;
  max_slots?: number | null;
  maxSlots?: number | null;
  slot_duration?: number | null;
  slotDuration?: number | null;
  break_start_time?: string | null;
  breakStartTime?: string | null;
  break_end_time?: string | null;
  breakEndTime?: string | null;
  is_active?: boolean | null;
  isActive?: boolean | null;
};

export type AvailableTimeOption = {
  time: string;
  availableSlots: number;
  maxSlots: number;
  bookedCount: number;
};

type TimeWindow = {
  startMinutes: number;
  endMinutes: number;
};

const DAY_MINUTES = 24 * 60;

function getTimeWindow(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): TimeWindow | null {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes < 0 || endMinutes <= startMinutes) {
    return null;
  }

  return { startMinutes, endMinutes };
}

export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return -1;

  const [rawHours, rawMinutes] = String(time).trim().split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (
    !Number.isInteger(hours)
    || !Number.isInteger(minutes)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
  ) {
    return -1;
  }

  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getScheduleForDate(date: Date, schedules: ScheduleSlotEntry[] = []): ScheduleSlotEntry | null {
  const dayOfWeek = date.getDay();
  return schedules.find((schedule) => Number(schedule.day_of_week ?? schedule.dayOfWeek) === dayOfWeek) || null;
}

export function getSlotDuration(schedule: ScheduleSlotEntry | null | undefined, fallback = 60): number {
  return normalizePositiveInteger(schedule?.slot_duration ?? schedule?.slotDuration, fallback);
}

export function getMaxSlots(schedule: ScheduleSlotEntry | null | undefined, fallback = 1): number {
  return normalizePositiveInteger(schedule?.max_slots ?? schedule?.maxSlots, fallback);
}

export function getServiceDuration(duration: unknown, slotDuration: number): number {
  return normalizePositiveInteger(duration, slotDuration);
}

function getScheduleWindow(schedule: ScheduleSlotEntry | null | undefined): TimeWindow | null {
  return getTimeWindow(schedule?.start_time ?? schedule?.startTime, schedule?.end_time ?? schedule?.endTime);
}

function getBreakWindow(schedule: ScheduleSlotEntry | null | undefined): TimeWindow | null {
  return getTimeWindow(
    schedule?.break_start_time ?? schedule?.breakStartTime,
    schedule?.break_end_time ?? schedule?.breakEndTime,
  );
}

function getBookingWindow(
  booking: BookingSlotEntry,
  fallbackDuration: number,
): TimeWindow | null {
  const startTime = booking.appointment_time ?? booking.time ?? null;
  const startMinutes = timeToMinutes(startTime);

  if (startMinutes < 0) {
    return null;
  }

  const duration = getServiceDuration(
    booking.service_duration ?? booking.duration ?? fallbackDuration,
    fallbackDuration,
  );

  return {
    startMinutes,
    endMinutes: startMinutes + duration,
  };
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

function isWithinWindow(
  startMinutes: number,
  endMinutes: number,
  window: TimeWindow,
): boolean {
  return startMinutes >= window.startMinutes && endMinutes <= window.endMinutes;
}

export function countOverlappingBookings(
  bookings: BookingSlotEntry[] = [],
  startMinutes: number,
  endMinutes: number,
  fallbackDuration: number,
): number {
  return bookings.reduce((count, booking) => {
    const bookingWindow = getBookingWindow(booking, fallbackDuration);

    if (!bookingWindow) {
      return count;
    }

    return count + (
      intervalsOverlap(
        startMinutes,
        endMinutes,
        bookingWindow.startMinutes,
        bookingWindow.endMinutes,
      ) ? 1 : 0
    );
  }, 0);
}

export function getCoveredSlots(
  startTime: string | null | undefined,
  durationMinutes: number,
  slotDuration: number,
): string[] {
  const startMinutes = timeToMinutes(startTime);

  if (startMinutes < 0 || slotDuration <= 0) {
    return [];
  }

  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / slotDuration));
  const coveredSlots: string[] = [];

  for (let index = 0; index < slotsNeeded; index += 1) {
    const slotMinutes = startMinutes + (index * slotDuration);
    if (slotMinutes >= DAY_MINUTES) {
      break;
    }

    coveredSlots.push(minutesToTime(slotMinutes));
  }

  return coveredSlots;
}

export function buildOccupiedSlots(
  bookings: BookingSlotEntry[] = [],
  slotDuration: number,
  durationFallback?: number,
): string[] {
  const occupiedSlots: string[] = [];
  const fallbackDuration = normalizePositiveInteger(durationFallback, slotDuration);

  bookings.forEach((booking) => {
    const startTime = booking.appointment_time ?? booking.time ?? null;
    if (!startTime) return;

    const duration = getServiceDuration(
      booking.service_duration ?? booking.duration ?? fallbackDuration,
      slotDuration,
    );

    occupiedSlots.push(...getCoveredSlots(startTime, duration, slotDuration));
  });

  return occupiedSlots;
}

export function countSlotUsage(occupiedSlots: string[] | undefined, timeSlot: string): number {
  return occupiedSlots?.reduce((count, slot) => count + (slot === timeSlot ? 1 : 0), 0) ?? 0;
}

export function getTimeSlotAvailability({
  date,
  selectedTime,
  schedules,
  bookings = [],
  serviceDuration,
  closures = [],
}: {
  date: Date;
  selectedTime: string;
  schedules: ScheduleSlotEntry[];
  bookings?: BookingSlotEntry[];
  serviceDuration?: number;
  closures?: ScheduleClosureEntry[];
}): AvailableTimeOption & { isAvailable: boolean } {
  const schedule = getScheduleForDate(date, schedules);
  const scheduleWindow = getScheduleWindow(schedule);
  const slotDuration = getServiceDuration(serviceDuration, getSlotDuration(schedule, 60));
  const maxSlots = getMaxSlots(schedule, 1);

  if (!schedule || isDateClosed(date, closures) || !scheduleWindow) {
    return {
      time: selectedTime,
      availableSlots: 0,
      maxSlots,
      bookedCount: 0,
      isAvailable: false,
    };
  }

  const selectedMinutes = timeToMinutes(selectedTime);
  if (selectedMinutes < 0) {
    return {
      time: selectedTime,
      availableSlots: 0,
      maxSlots,
      bookedCount: 0,
      isAvailable: false,
    };
  }

  const selectedEndMinutes = selectedMinutes + slotDuration;
  if (!isWithinWindow(selectedMinutes, selectedEndMinutes, scheduleWindow)) {
    return {
      time: selectedTime,
      availableSlots: 0,
      maxSlots,
      bookedCount: 0,
      isAvailable: false,
    };
  }

  const breakWindow = getBreakWindow(schedule);
  if (
    breakWindow &&
    intervalsOverlap(
      selectedMinutes,
      selectedEndMinutes,
      breakWindow.startMinutes,
      breakWindow.endMinutes,
    )
  ) {
    return {
      time: selectedTime,
      availableSlots: 0,
      maxSlots,
      bookedCount: 0,
      isAvailable: false,
    };
  }

  const bookedCount = countOverlappingBookings(
    bookings,
    selectedMinutes,
    selectedEndMinutes,
    slotDuration,
  );
  const availableSlots = Math.max(0, maxSlots - bookedCount);

  return {
    time: selectedTime,
    availableSlots,
    maxSlots,
    bookedCount,
    isAvailable: availableSlots > 0,
  };
}

export function generateAvailableTimeOptions({
  date,
  schedules,
  bookings = [],
  serviceDuration,
  closures = [],
}: {
  date: Date;
  schedules: ScheduleSlotEntry[];
  bookings?: BookingSlotEntry[];
  serviceDuration?: number;
  closures?: ScheduleClosureEntry[];
}): AvailableTimeOption[] {
  const schedule = getScheduleForDate(date, schedules);
  const scheduleWindow = getScheduleWindow(schedule);

  if (!schedule || isDateClosed(date, closures) || !scheduleWindow) {
    return [];
  }

  const slotDuration = getServiceDuration(serviceDuration, getSlotDuration(schedule, 60));
  const maxSlots = getMaxSlots(schedule, 1);
  const breakWindow = getBreakWindow(schedule);

  if (slotDuration <= 0) {
    return [];
  }

  const availableTimes: AvailableTimeOption[] = [];

  for (
    let currentMinutes = scheduleWindow.startMinutes;
    currentMinutes + slotDuration <= scheduleWindow.endMinutes;
    currentMinutes += slotDuration
  ) {
    const selectedEndMinutes = currentMinutes + slotDuration;

    if (
      breakWindow &&
      intervalsOverlap(
        currentMinutes,
        selectedEndMinutes,
        breakWindow.startMinutes,
        breakWindow.endMinutes,
      )
    ) {
      continue;
    }

    const bookedCount = countOverlappingBookings(
      bookings,
      currentMinutes,
      selectedEndMinutes,
      slotDuration,
    );
    const availableSlots = Math.max(0, maxSlots - bookedCount);

    availableTimes.push({
      time: minutesToTime(currentMinutes),
      availableSlots,
      maxSlots,
      bookedCount,
    });
  }

  return availableTimes;
}

export function generateAvailableTimes({
  date,
  schedules,
  bookings = [],
  serviceDuration,
  closures = [],
}: {
  date: Date;
  schedules: ScheduleSlotEntry[];
  bookings?: BookingSlotEntry[];
  serviceDuration?: number;
  closures?: ScheduleClosureEntry[];
}): string[] {
  return generateAvailableTimeOptions({
    date,
    schedules,
    bookings,
    serviceDuration,
    closures,
  }).map((option) => option.time);
}

export function isTimeSlotAvailable({
  date,
  selectedTime,
  schedules,
  bookings = [],
  serviceDuration,
  closures = [],
}: {
  date: Date;
  selectedTime: string;
  schedules: ScheduleSlotEntry[];
  bookings?: BookingSlotEntry[];
  serviceDuration?: number;
  closures?: ScheduleClosureEntry[];
}): boolean {
  return getTimeSlotAvailability({
    date,
    selectedTime,
    schedules,
    bookings,
    serviceDuration,
    closures,
  }).isAvailable;
}
