import { validatePassword, getPasswordStrengthKey, PASSWORD_MIN_LENGTH_EXCLUSIVE } from '../passwordValidation';

describe('validatePassword', () => {
  it('marks a password as invalid when it is missing every rule', () => {
    const result = validatePassword('');

    expect(result.isValid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.hasLowercase).toBe(false);
    expect(result.hasUppercase).toBe(false);
    expect(result.hasNumber).toBe(false);
    expect(result.hasSpecialChar).toBe(false);
    expect(result.hasMinLength).toBe(false);
  });

  it('marks a password as valid when it satisfies every rule', () => {
    const result = validatePassword('Sup3r-Secret!');

    expect(result.hasLowercase).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSpecialChar).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.score).toBe(5);
    expect(result.isValid).toBe(true);
  });

  it('treats the minimum length as exclusive', () => {
    const exactLength = 'Aa1!'.padEnd(PASSWORD_MIN_LENGTH_EXCLUSIVE, 'a');
    const oneLonger = `${exactLength}a`;

    expect(exactLength.length).toBe(PASSWORD_MIN_LENGTH_EXCLUSIVE);
    expect(validatePassword(exactLength).hasMinLength).toBe(false);
    expect(validatePassword(oneLonger).hasMinLength).toBe(true);
  });

  it('scores partially-valid passwords correctly', () => {
    const result = validatePassword('alllowercase');

    expect(result.hasLowercase).toBe(true);
    expect(result.hasUppercase).toBe(false);
    expect(result.hasNumber).toBe(false);
    expect(result.hasSpecialChar).toBe(false);
    expect(result.hasMinLength).toBe(true);
    expect(result.score).toBe(2);
    expect(result.isValid).toBe(false);
  });
});

describe('getPasswordStrengthKey', () => {
  it('classifies low scores as weak', () => {
    expect(getPasswordStrengthKey(0)).toBe('passwordStrengthWeak');
    expect(getPasswordStrengthKey(2)).toBe('passwordStrengthWeak');
  });

  it('classifies mid scores as medium', () => {
    expect(getPasswordStrengthKey(3)).toBe('passwordStrengthMedium');
    expect(getPasswordStrengthKey(4)).toBe('passwordStrengthMedium');
  });

  it('classifies a perfect score as strong', () => {
    expect(getPasswordStrengthKey(5)).toBe('passwordStrengthStrong');
  });
});
