export const PASSWORD_MIN_LENGTH_EXCLUSIVE = 8;

export interface PasswordRuleState {
  key: 'passwordRuleLowercase' | 'passwordRuleUppercase' | 'passwordRuleNumber' | 'passwordRuleSpecialChar' | 'passwordRuleMinLength';
  valid: boolean;
}

export interface PasswordValidationResult {
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasMinLength: boolean;
  score: number;
  isValid: boolean;
  rules: PasswordRuleState[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const hasMinLength = password.length > PASSWORD_MIN_LENGTH_EXCLUSIVE;

  const rules: PasswordRuleState[] = [
    { key: 'passwordRuleLowercase', valid: hasLowercase },
    { key: 'passwordRuleUppercase', valid: hasUppercase },
    { key: 'passwordRuleNumber', valid: hasNumber },
    { key: 'passwordRuleSpecialChar', valid: hasSpecialChar },
    { key: 'passwordRuleMinLength', valid: hasMinLength },
  ];

  const score = rules.filter((rule) => rule.valid).length;
  const isValid = rules.every((rule) => rule.valid);

  return {
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    hasMinLength,
    score,
    isValid,
    rules,
  };
}

export function getPasswordStrengthKey(score: number): 'passwordStrengthWeak' | 'passwordStrengthMedium' | 'passwordStrengthStrong' {
  if (score <= 2) return 'passwordStrengthWeak';
  if (score <= 4) return 'passwordStrengthMedium';
  return 'passwordStrengthStrong';
}