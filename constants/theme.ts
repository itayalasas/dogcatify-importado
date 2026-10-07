/**
 * Sistema de diseño de DogCatiFy.
 *
 * Toda pantalla nueva o modificada toma colores, tipografía, espaciados y radios
 * de acá, en lugar de escribir valores sueltos. Los colores de texto sobre blanco
 * cumplen WCAG AA (4,5:1) salvo `textDisabled`, que solo va en elementos
 * deshabilitados.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

const palette = {
  teal50: '#EEF6F6',
  teal100: '#D5E8E9',
  teal200: '#AACFD1',
  teal500: '#3C8086',
  teal600: '#2D6A6F', // marca, 6,2:1 sobre blanco
  teal700: '#24565A',
  teal800: '#1C4245',

  amber100: '#FEF3C7',
  amber400: '#FBBF24',
  amber700: '#B45309',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',

  green50: '#ECFDF5',
  green700: '#047857',
  red50: '#FEF2F2',
  red600: '#DC2626',
  blue50: '#EFF6FF',
  blue700: '#1D4ED8',

  white: '#FFFFFF',
  black: '#000000',
};

export const colors = {
  // Marca: único color de acción principal
  primary: palette.teal600,
  primaryPressed: palette.teal700,
  primaryStrong: palette.teal800,
  primarySoft: palette.teal50,
  primaryMuted: palette.teal100,
  primaryBorder: palette.teal200,
  onPrimary: palette.white,

  // Acento cálido para destacar (promos, novedades). Texto oscuro encima.
  accent: palette.amber400,
  accentSoft: palette.amber100,
  onAccent: palette.gray900,

  // Superficies
  background: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.gray100,
  border: palette.gray200,
  borderStrong: palette.gray300,
  overlay: 'rgba(17, 24, 39, 0.5)',

  // Texto
  text: palette.gray900, // 17,7:1
  textSecondary: palette.gray600, // 7,6:1
  textTertiary: palette.gray500, // 4,8:1, mínimo para texto chico
  textDisabled: palette.gray400, // solo deshabilitados
  textInverse: palette.white,
  placeholder: palette.gray500,
  icon: palette.gray500,

  // Estados (texto sobre blanco o sobre su versión Soft)
  success: palette.green700,
  successSoft: palette.green50,
  warning: palette.amber700,
  warningSoft: palette.amber100,
  danger: palette.red600,
  dangerSoft: palette.red50,
  info: palette.blue700,
  infoSoft: palette.blue50,

  white: palette.white,
  black: palette.black,
  transparent: 'transparent',
} as const;

/** Paleta oscura con las mismas claves, lista para cuando se active el modo oscuro. */
export const darkColors: { [K in keyof typeof colors]: string } = {
  ...colors,
  primary: '#5FA8AE',
  primaryPressed: '#7DBBC0',
  primaryStrong: '#A6D2D5',
  primarySoft: '#16302F',
  primaryMuted: '#1F4244',
  primaryBorder: '#2D6A6F',
  onPrimary: '#0B1A1B',
  accentSoft: '#3A2E0B',
  background: '#0B0F14',
  surface: '#151A21',
  surfaceAlt: '#1E242C',
  border: '#2A313B',
  borderStrong: '#3A424E',
  overlay: 'rgba(0, 0, 0, 0.6)',
  text: '#F3F4F6',
  textSecondary: '#C4C9D1',
  textTertiary: '#9AA1AC',
  textDisabled: '#5F6773',
  textInverse: '#111827',
  placeholder: '#8A919C',
  icon: '#9AA1AC',
  success: '#34D399',
  successSoft: '#0E2A21',
  warning: '#FBBF24',
  warningSoft: '#2E2408',
  danger: '#F87171',
  dangerSoft: '#2E1212',
  info: '#93C5FD',
  infoSoft: '#0F1E36',
};

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

/**
 * Escala tipográfica (7 tamaños). Cada estilo incluye fontWeight para que el peso
 * se vea bien aunque la fuente todavía no haya cargado.
 */
export const typography = {
  display: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 18, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontWeight: '500', fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

/** Espaciado en múltiplos de 4. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8, // chips chicos, badges
  md: 12, // botones, inputs
  lg: 16, // tarjetas
  xl: 24, // hojas inferiores, modales
  pill: 999,
} as const;

/** Área táctil mínima (Apple 44 pt, Google 48 dp). */
export const touchTarget = 44;
export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const shadow = (height: number, opacity: number, blur: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${height}px ${blur}px rgba(17, 24, 39, ${opacity})` } as ViewStyle,
    default: {
      shadowColor: palette.gray900,
      shadowOffset: { width: 0, height },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      elevation,
    },
  }) as ViewStyle;

export const shadows = {
  none: {} as ViewStyle,
  sm: shadow(1, 0.06, 4, 1),
  md: shadow(2, 0.08, 12, 3),
  lg: shadow(8, 0.12, 24, 8),
};

/** Texto que no debe crecer sin límite con la letra grande del sistema. */
export const maxFontScale = { compact: 1.2, default: 1.6 } as const;

export const theme = { colors, darkColors, fonts, typography, fontSize, spacing, radius, shadows, touchTarget, hitSlop };
export type Theme = typeof theme;
export default theme;
