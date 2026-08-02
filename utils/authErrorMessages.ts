type AuthErrorContext = 'general' | 'owner' | 'partner';

const normalize = (value: unknown): string => String(value || '').toLowerCase();

const duplicateAccountMessages: Record<AuthErrorContext, string> = {
  general: 'Ese correo ya está registrado. Inicia sesión o recupera tu cuenta para continuar.',
  owner: 'Ese correo ya tiene una cuenta. Inicia sesión con ese usuario o usa otro correo para registrarte como dueño.',
  partner: 'Ese correo ya tiene una cuenta. Inicia sesión con ese usuario y completa el alta de aliado desde tu perfil.',
};

export function getFriendlyAuthErrorMessage(error: unknown, context: AuthErrorContext = 'general'): string {
  const message = normalize(
    error instanceof Error
      ? error.message
      : (error as any)?.message ?? error
  );
  const code = normalize((error as any)?.code ?? (error as any)?.error_code);

  const isDuplicateAccount =
    code === 'user_already_exists' ||
    code === '23505' ||
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('email address already in use') ||
    message.includes('duplicate key value') ||
    message.includes('unique constraint');

  if (isDuplicateAccount) {
    return duplicateAccountMessages[context];
  }

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'El correo o la contraseña no son correctos. Verifica los datos e inténtalo de nuevo.';
  }

  if (
    message.includes('email not confirmed') ||
    message.includes('correo no confirmado') ||
    message.includes('confirmar tu correo')
  ) {
    return 'Debes confirmar tu correo antes de continuar. Revisa tu bandeja de entrada y la carpeta de spam.';
  }

  if (
    message.includes('too many requests') ||
    message.includes('rate limit')
  ) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo nuevamente.';
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  if (
    message.includes('password should be') ||
    message.includes('password must be') ||
    message.includes('weak password')
  ) {
    return 'La contraseña no cumple con los requisitos mínimos.';
  }

  switch (context) {
    case 'partner':
      return 'No pudimos completar el alta de aliado. Inténtalo nuevamente.';
    case 'owner':
      return 'No pudimos completar el registro. Inténtalo nuevamente.';
    default:
      return 'No pudimos completar la operación. Inténtalo nuevamente.';
  }
}
