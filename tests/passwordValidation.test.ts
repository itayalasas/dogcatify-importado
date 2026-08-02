import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPasswordStrengthKey, validatePassword } from '../utils/passwordValidation';

describe('validatePassword', () => {
  it('acepta una contraseña que cumple todas las reglas', () => {
    const result = validatePassword('DogCatiFy9!');

    assert.equal(result.isValid, true);
    assert.equal(result.score, 5);
    assert.equal(result.rules.every((rule) => rule.valid), true);
  });

  it('rechaza contraseñas sin mayúscula, número o carácter especial', () => {
    const result = validatePassword('dogcatify');

    assert.equal(result.isValid, false);
    assert.equal(result.hasUppercase, false);
    assert.equal(result.hasNumber, false);
    assert.equal(result.hasSpecialChar, false);
  });

  it('exige más de ocho caracteres', () => {
    assert.equal(validatePassword('Abcdef1!').hasMinLength, false);
    assert.equal(validatePassword('Abcdefg1!').hasMinLength, true);
  });

  it('clasifica la fortaleza a partir del puntaje', () => {
    assert.equal(getPasswordStrengthKey(2), 'passwordStrengthWeak');
    assert.equal(getPasswordStrengthKey(4), 'passwordStrengthMedium');
    assert.equal(getPasswordStrengthKey(5), 'passwordStrengthStrong');
  });
});
