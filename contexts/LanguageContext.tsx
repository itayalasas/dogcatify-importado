import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  es: {
    // Navigation
    home: 'Inicio',
    myPets: 'Mis Mascotas',
    shop: 'Tienda',
    services: 'Servicios',
    petFriendly: 'Pet Friendly',
    profile: 'Perfil',
    
    // Auth
    welcomeBack: '¡Bienvenido de vuelta a Patitas! 🐾',
    signInSubtitle: 'Inicia sesión para conectar con tu comunidad de mascotas',
    joinPatitas: '¡Únete a Patitas! 🐾',
    createAccountSubtitle: 'Crea tu cuenta y comienza a conectar con amantes de las mascotas',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    fullName: 'Nombre completo',
    signIn: 'Iniciar sesión',
    signUp: 'Registrarse',
    createAccount: 'Crear cuenta',
    dontHaveAccount: '¿No tienes una cuenta?',
    alreadyHaveAccount: '¿Ya tienes una cuenta?',
    signOut: 'Cerrar sesión',
    
    // Home/Feed
    searchPets: 'Buscar mascotas...',
    likesCount: 'me gusta',
    viewComments: 'Ver los {count} comentarios',
    hoursAgo: 'h',
    
    // Pets
    addPet: 'Agregar mascota',
    yearsOld: 'años',
    
    // Shop
    petShop: 'Tienda de Mascotas',
    addToCart: 'Agregar al carrito',
    reviews: 'reseñas',
    all: 'Todo',
    food: 'Comida',
    toys: 'Juguetes',
    accessories: 'Accesorios',
    
    // Services
    petServices: 'Servicios para Mascotas',
    veterinary: 'Veterinario',
    grooming: 'Peluquería',
    walking: 'Paseo',
    boarding: 'Pensión',
    
    // Profile
    editProfile: 'Editar perfil',
    partnerMode: 'Modo Aliado',
    partnerModeOn: 'Estás en modo Aliado. Puedes gestionar tus servicios y reservas.',
    partnerModeOff: 'Cambia a modo Aliado para ofrecer servicios a otros dueños de mascotas.',
    myStats: 'Mis estadísticas',
    pets: 'Mascotas',
    posts: 'Publicaciones',
    followers: 'Seguidores',
    following: 'Siguiendo',
    notifications: 'Notificaciones',
    privacySecurity: 'Privacidad y seguridad',
    helpSupport: 'Ayuda y soporte',
    language: 'Idioma',
    spanish: 'Español',
    english: 'Inglés',
    
    // Common
    loading: 'Cargando...',
    error: 'Error',
    fillAllFields: 'Por favor completa todos los campos',
    passwordsDontMatch: 'Las contraseñas no coinciden',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres',
    min: 'min',
    kg: 'kg',
  },
  en: {
    // Navigation
    home: 'Home',
    myPets: 'My Pets',
    shop: 'Shop',
    services: 'Services',
    petFriendly: 'Pet Friendly',
    profile: 'Profile',
    
    // Auth
    welcomeBack: 'Welcome Back to Patitas! 🐾',
    signInSubtitle: 'Sign in to connect with your pet community',
    joinPatitas: 'Join Patitas! 🐾',
    createAccountSubtitle: 'Create your account and start connecting with pet lovers',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    createAccount: 'Create Account',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    signOut: 'Sign Out',
    
    // Home/Feed
    searchPets: 'Search pets...',
    likesCount: 'likes',
    viewComments: 'View {count} comments',
    hoursAgo: 'h',
    
    // Pets
    addPet: 'Add Pet',
    yearsOld: 'years old',
    
    // Shop
    petShop: 'Pet Shop',
    addToCart: 'Add to Cart',
    reviews: 'reviews',
    all: 'All',
    food: 'Food',
    toys: 'Toys',
    accessories: 'Accessories',
    
    // Services
    petServices: 'Pet Services',
    veterinary: 'Veterinary',
    grooming: 'Grooming',
    walking: 'Walking',
    boarding: 'Boarding',
    
    // Profile
    editProfile: 'Edit Profile',
    partnerMode: 'Partner Mode',
    partnerModeOn: 'You are in Partner mode. You can manage your services and bookings.',
    partnerModeOff: 'Switch to Partner mode to offer services to other pet owners.',
    myStats: 'My Stats',
    pets: 'Pets',
    posts: 'Posts',
    followers: 'Followers',
    following: 'Following',
    notifications: 'Notifications',
    privacySecurity: 'Privacy & Security',
    helpSupport: 'Help & Support',
    language: 'Language',
    spanish: 'Spanish',
    english: 'English',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    fillAllFields: 'Please fill in all fields',
    passwordsDontMatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    min: 'min',
    kg: 'kg',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('language');
      if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};