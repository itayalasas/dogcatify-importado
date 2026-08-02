import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countOverlappingBookings,
  getCoveredSlots,
  minutesToTime,
  normalizePositiveInteger,
  timeToMinutes,
} from '../utils/bookingAvailability';

describe('bookingAvailability', () => {
  it('convierte horas y minutos en ambos sentidos', () => {
    assert.equal(timeToMinutes('09:30'), 570);
    assert.equal(minutesToTime(570), '09:30');
  });

  it('rechaza horarios fuera del rango de un día', () => {
    assert.equal(timeToMinutes('24:00'), -1);
    assert.equal(timeToMinutes('10:60'), -1);
    assert.equal(timeToMinutes('texto'), -1);
  });

  it('usa el valor alternativo para cantidades inválidas', () => {
    assert.equal(normalizePositiveInteger(3.9, 1), 3);
    assert.equal(normalizePositiveInteger(0, 2), 2);
    assert.equal(normalizePositiveInteger('x', 4), 4);
  });

  it('calcula todos los bloques cubiertos por un servicio', () => {
    assert.deepEqual(getCoveredSlots('10:00', 90, 30), ['10:00', '10:30', '11:00']);
  });

  it('cuenta reservas superpuestas sin contar límites adyacentes', () => {
    const bookings = [
      { appointment_time: '09:00', service_duration: 60 },
      { appointment_time: '10:00', service_duration: 30 },
      { appointment_time: '09:30', service_duration: 30 },
    ];

    assert.equal(countOverlappingBookings(bookings, 570, 600, 60), 2);
  });
});
