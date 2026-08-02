import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Send, PawPrint, CircleHelp as HelpCircle, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react-native';
import { supabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { envConfig } from '@/utils/envConfig';
import { type AppRole, getStoredActivePartnerBusinessId } from '@/utils/onboarding';
import { resolveSubscriptionPlanLimits } from '@/utils/subscriptionPlanLimits';
import { router, usePathname, useSegments } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'action';
  content: string;
  audioUsed: boolean;
  timestamp: Date;
  actionButtons?: ActionButton[];
  sections?: MessageSection[];
}

interface MessageSection {
  title?: string;
  items: string[];
  icon?: string;
}

interface ActionButton {
  label: string;
  action: () => void;
  icon?: string;
}

interface FloatingVoiceBotProps {
  onClose?: () => void;
  showWelcome?: boolean;
}

type DottyQuickAction = {
  id: string;
  label: string;
  description: string;
};

type PetSummaryState = {
  loading: boolean;
  hasPets: boolean;
  petNames: string[];
  petCount: number;
};

const OWNER_PROMPTS_WITH_PETS = (petNames: string[]) => {
  const firstPet = petNames[0] || 'mi mascota';

  return [
    `¿Qué le recomendarías hoy a ${firstPet}?`,
    `¿Qué vacunas o controles faltan para ${firstPet}?`,
    `¿Está bien el peso de ${firstPet}?`,
    `¿Qué hago si ${firstPet} tiene vómitos o decaimiento?`,
    '¿Cómo comparto el historial con un veterinario?',
  ];
};

const OWNER_PROMPTS_WITHOUT_PETS = [
  '¿Cómo registro mi primera mascota?',
  '¿Qué puedo hacer en Mascotas?',
  '¿Cómo empiezo con el historial médico?',
  '¿Qué servicios me recomienda la app?',
  '¿Cómo funciona el cuidado inteligente?',
];

const PARTNER_PROMPTS = [
  '¿Qué clientes debo reactivar hoy?',
  '¿Qué clientes están en riesgo de irse?',
  '¿Cómo veo mis reservas de hoy?',
  '¿Cómo reviso mis pedidos?',
  '¿Qué puedo hacer desde mi dashboard?',
  '¿Qué puedo hacer o no con mi plan actual?',
  '¿Cómo publico una mascota en adopción?',
  '¿Qué módulos tengo habilitados?',
  '¿Qué oportunidades de retención tengo esta semana?',
];

const ADMIN_PROMPTS = [
  '¿Cómo reviso los analytics de la plataforma?',
  '¿Qué solicitudes pendientes tengo?',
  '¿Cómo veo el estado de los partners?',
  '¿Qué alertas importantes debo revisar?',
  '¿Qué puedo gestionar desde admin?',
  '¿Qué partners necesito revisar primero?',
  '¿Cómo veo la actividad reciente de la plataforma?',
];

const getQuickActions = (role: AppRole | null, hasPets: boolean, loading = false): DottyQuickAction[] => {
  if (loading) {
    return role === 'partner' || role === 'admin'
      ? [
          {
            id: 'partner-dashboard',
            label: '📊 Ir al dashboard',
            description: 'Ver métricas, accesos y estado del negocio',
          },
          {
            id: 'partner-clients',
            label: '🤝 Clientes y retención',
            description: 'CRM, seguimiento y reactivación de clientes',
          },
          {
            id: 'partner-bookings',
            label: '📅 Reservas',
            description: 'Ver reservas, agenda y próximos turnos',
          },
          {
            id: 'partner-adoptions',
            label: '🏡 Adopciones',
            description: 'Gestionar publicaciones y disponibilidad',
          },
        ]
      : [
          {
            id: 'care-hub',
            label: '🧠 Cuidado inteligente',
            description: 'IA, recomendaciones, alertas y modo emergencia',
          },
          {
            id: 'find-vet',
            label: '🏥 Encontrar veterinario',
            description: 'Servicios veterinarios cerca de ti',
          },
          {
            id: 'explore-app',
            label: '🎯 Explorar funcionalidades',
            description: 'Tour completo de DogCatiFy',
          },
        ];
  }

  if (role === 'partner' || role === 'admin') {
    return [
      {
        id: 'partner-dashboard',
        label: '📊 Ir al dashboard',
        description: 'Ver métricas, accesos y estado del negocio',
      },
      {
        id: 'partner-clients',
        label: '🤝 Clientes y retención',
        description: 'CRM, seguimiento y reactivación de clientes',
      },
      {
        id: 'partner-bookings',
        label: '📅 Reservas',
        description: 'Ver reservas, agenda y próximos turnos',
      },
      {
        id: 'partner-adoptions',
        label: '🏡 Adopciones',
        description: 'Gestionar publicaciones y disponibilidad',
      },
    ];
  }

  return hasPets
    ? [
        {
          id: 'medical-history',
          label: '📋 Historial médico',
          description: 'Gestiona salud, vacunas y seguimiento',
        },
        {
          id: 'care-hub',
          label: '🧠 Cuidado inteligente',
          description: 'IA, recomendaciones, alertas y modo emergencia',
        },
        {
          id: 'find-vet',
          label: '🏥 Encontrar veterinario',
          description: 'Servicios veterinarios cerca de ti',
        },
        {
          id: 'explore-app',
          label: '🎯 Explorar funcionalidades',
          description: 'Tour completo de DogCatiFy',
        },
      ]
    : [
        {
          id: 'add-pet',
          label: '🐕 Registrar mi primera mascota',
          description: 'Guía paso a paso para agregar tu mascota',
        },
        {
          id: 'care-hub',
          label: '🧠 Cuidado inteligente',
          description: 'IA, recomendaciones, alertas y modo emergencia',
        },
        {
          id: 'find-vet',
          label: '🏥 Encontrar veterinario',
          description: 'Servicios veterinarios cerca de ti',
        },
        {
          id: 'explore-app',
          label: '🎯 Explorar funcionalidades',
          description: 'Tour completo de DogCatiFy',
        },
      ];
};

const getStarterPrompts = (role: AppRole | null, hasPets: boolean, petNames: string[], loading = false) => {
  if (loading) {
    return role === 'partner' || role === 'admin'
      ? [
          '¿Qué debo revisar en mi dashboard?',
          '¿Qué clientes debo priorizar hoy?',
          '¿Cómo veo mis reservas y pedidos?',
          '¿Qué puedo hacer con mi plan actual?',
        ]
      : [
          '¿Qué puede hacer Dotty por mí?',
          '¿Cómo veo mis mascotas?',
          '¿Cómo reviso alertas y recordatorios?',
          '¿Cómo comparto el historial con un veterinario?',
        ];
  }

  if (role === 'partner') {
    return PARTNER_PROMPTS;
  }

  if (role === 'admin') {
    return ADMIN_PROMPTS;
  }

  return hasPets ? OWNER_PROMPTS_WITH_PETS(petNames) : OWNER_PROMPTS_WITHOUT_PETS;
};

export const FloatingVoiceBot: React.FC<FloatingVoiceBotProps> = ({ onClose, showWelcome = false }) => {
  const { currentUser, activeRole } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();

  const [isExpanded, setIsExpanded] = useState(showWelcome);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isDottyEnabled, setIsDottyEnabled] = useState<boolean | null>(null);
  const [dottyPlanEnabled, setDottyPlanEnabled] = useState<boolean | null>(null);
  const [activePartnerBusinessId, setActivePartnerBusinessId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [petSummary, setPetSummary] = useState<PetSummaryState>({
    loading: true,
    hasPets: false,
    petNames: [],
    petCount: 0,
  });

  const position = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 90, y: SCREEN_HEIGHT - 300 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;
  const keyboardOffsetAnim = useRef(new Animated.Value(0)).current;

  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });
  const gestureStartTime = useRef(0);
  const resolvedRole: AppRole = activeRole ?? (currentUser?.isAdmin ? 'admin' : currentUser?.isPartner ? 'partner' : 'owner');
  const visibleQuickActions = useMemo(
    () => getQuickActions(resolvedRole, petSummary.hasPets, petSummary.loading),
    [resolvedRole, petSummary.hasPets, petSummary.loading]
  );
  const visibleStarterPrompts = useMemo(
    () => getStarterPrompts(resolvedRole, petSummary.hasPets, petSummary.petNames, petSummary.loading),
    [resolvedRole, petSummary.hasPets, petSummary.petNames, petSummary.loading]
  );

  // Funciones para guardar/cargar posición
  const savePosition = async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem('dotty_position', JSON.stringify({ x, y }));
    } catch (error) {
    }
  };

  const loadPosition = async () => {
    try {
      const saved = await AsyncStorage.getItem('dotty_position');
      if (saved) {
        const { x, y } = JSON.parse(saved);
        position.setValue({ x, y });
      }
    } catch (error) {
    }
  };

  // Crear PanResponder para manejar el arrastre
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpanded,
      onMoveShouldSetPanResponder: () => !isExpanded,

      onPanResponderGrant: () => {
        if (isExpanded) return;

        isDragging.current = true;
        gestureStartTime.current = Date.now();

        // Obtener posición actual
        position.stopAnimation((value) => {
          startPosition.current = { x: value.x, y: value.y };
        });
      },

      onPanResponderMove: (_, gestureState) => {
        if (isExpanded || !isDragging.current) return;

        const dx = gestureState.dx || 0;
        const dy = gestureState.dy || 0;

        // Calcular nueva posición
        let newX = startPosition.current.x + dx;
        let newY = startPosition.current.y + dy;

        // Límites de la pantalla (dejando espacio para el botón)
        const buttonSize = 70;
        const minX = 0;
        const maxX = SCREEN_WIDTH - buttonSize;
        const minY = 50; // Dejar espacio para el notch/status bar
        const maxY = SCREEN_HEIGHT - buttonSize - 100; // Dejar espacio para tabs

        // Aplicar límites
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        position.setValue({ x: newX, y: newY });
      },

      onPanResponderRelease: (_, gestureState) => {
        if (isExpanded) return;

        const dragDuration = Date.now() - gestureStartTime.current;
        const dragDistance = Math.sqrt(
          Math.pow(gestureState.dx || 0, 2) + Math.pow(gestureState.dy || 0, 2)
        );


        // Si fue un tap rápido (< 200ms y < 10px), expandir
        if (dragDuration < 200 && dragDistance < 10) {
          isDragging.current = false;
          toggleExpand();
        } else {
          // Si fue un drag, guardar la posición
          position.stopAnimation((value) => {
            savePosition(value.x, value.y);
          });
          isDragging.current = false;
        }
      },
    })
  ).current;

  // Calcular si Dotty debe mostrarse (useMemo para que React detecte cambios)
  const dottyVisible = useMemo(() => {
    // Check 0: Estado cargando
    if (isDottyEnabled === null) {
      return false;
    }

    // Check 1: Usuario autenticado
    if (!currentUser) {
      return false;
    }

    // Check 2: Dotty debe estar incluido en el plan activo
    if (dottyPlanEnabled !== true) {
      return false;
    }

    // Check 3: Dotty habilitado por el usuario
    if (isDottyEnabled === false) {
      return false;
    }

    // Rutas donde NO debe aparecer Dotty
    const hiddenRoutes = [
      'auth/login',
      'auth/register',
      'auth/forgot-password',
      'auth/reset-password',
      'auth/biometric-setup',
      'auth/confirm',
      'auth/callback',
    ];

    // Verificar si estamos en una ruta oculta
    const currentPath = pathname || '';
    const isHiddenRoute = hiddenRoutes.some(route => currentPath.includes(route));

    // También verificar usando segments
    const firstSegment = segments?.[0];
    const isAuthRoute = firstSegment === 'auth';

    // Check 4: Ruta permitida
    if (isAuthRoute || isHiddenRoute) {
      return false;
    }


    return true;
  }, [dottyPlanEnabled, isDottyEnabled, currentUser, pathname, segments]);

  useEffect(() => {
    loadPosition(); // Cargar posición guardada
    checkDottyStatus();
    startPulseAnimation();
    startPawRotation();

    // Listeners para el teclado
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      Keyboard.dismiss();
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const checkDottyStatus = async () => {
    if (currentUser) {
      try {
        const { data: subscriptionData, error: subscriptionError } = await supabaseClient
          .from('user_subscriptions')
          .select(`
            status,
            subscription_plans (
              tier,
              audience_target,
              limits
            )
          `)
          .eq('user_id', currentUser.id)
          .in('status', ['active', 'trialing', 'pending', 'paused'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscriptionError) {
        }

        const userPlanLimits = resolveSubscriptionPlanLimits(subscriptionData?.subscription_plans || null);
        const planAllowsDotty = userPlanLimits.users.dottyEnabled;
        setDottyPlanEnabled(planAllowsDotty);

        const { data, error } = await supabaseClient
          .from('profiles')
          .select('dotty_enabled')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          // En caso de error, mantener null (no mostrar hasta confirmar)
          setIsDottyEnabled(null);
          return;
        }

        if (data) {
          // Si dotty_enabled es null o undefined, tratar como false hasta que el plan lo permita
          // y el usuario lo habilite explícitamente desde su perfil.
          const isEnabled = planAllowsDotty && data.dotty_enabled !== false;
          setIsDottyEnabled(isEnabled);
        } else {
          setIsDottyEnabled(false);
        }
      } catch (error) {
        // En caso de excepción, mantener null (no mostrar hasta confirmar)
        setIsDottyEnabled(null);
        setDottyPlanEnabled(false);
      }
    } else {
      setIsDottyEnabled(false);
      setDottyPlanEnabled(false);
    }
  };

  // Escuchar cambios en tiempo real de la configuración de Dotty
  useEffect(() => {
    if (!currentUser?.id) return;


    // Usar un canal único por usuario
    const channelName = `dotty-config-${currentUser.id}`;

    const subscription = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {

          if (payload.new && 'dotty_enabled' in payload.new) {
            // Si dotty_enabled es null o undefined, tratar como true (activado por defecto)
            // Si es explícitamente false, respetar esa configuración
            const isEnabled = payload.new.dotty_enabled !== false;
            setIsDottyEnabled(isEnabled);

            // Si se deshabilitó, cerrar el modal si está abierto
            if (!isEnabled) {
              Keyboard.dismiss();
              setIsExpanded(false);
              // Animar el cierre
              Animated.spring(expandAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: false,
              }).start();
            } else {
            }
          }
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabaseClient.removeChannel(subscription);
    };
  }, [currentUser?.id]);

  // Escuchar cambios en la suscripción del usuario para ocultar/mostrar Dotty según el plan
  useEffect(() => {
    if (!currentUser?.id) return;


    const channelName = `dotty-plan-${currentUser.id}`;

    const subscription = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          checkDottyStatus();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabaseClient.removeChannel(subscription);
    };
  }, [currentUser?.id]);

  // Recargar estado cuando cambia el usuario
  useEffect(() => {
    if (currentUser?.id) {
      checkDottyStatus();
    } else {
      setIsDottyEnabled(false);
      setDottyPlanEnabled(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadActivePartnerBusiness = async () => {
      if (!currentUser?.id) {
        setActivePartnerBusinessId(null);
        return;
      }

      try {
        const storedBusinessId = await getStoredActivePartnerBusinessId(currentUser.id);
        if (isMounted) {
          setActivePartnerBusinessId(storedBusinessId);
        }
      } catch (error) {
        if (isMounted) {
          setActivePartnerBusinessId(null);
        }
      }
    };

    void loadActivePartnerBusiness();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadPetSummary = async () => {
      if (!currentUser?.id) {
        setPetSummary({
          loading: false,
          hasPets: false,
          petNames: [],
          petCount: 0,
        });
        return;
      }

      setPetSummary((prev) => ({
        ...prev,
        loading: true,
      }));

      try {
        const [ownedResponse, sharedResponse] = await Promise.all([
          supabaseClient
            .from('pets')
            .select('id, name, species, breed, owner_id, created_at')
            .eq('owner_id', currentUser.id)
            .order('created_at', { ascending: false }),
          supabaseClient
            .from('pet_shares')
            .select(`
              pet_id,
              pets!inner (
                id,
                name,
                species,
                breed,
                owner_id,
                created_at
              )
            `)
            .eq('shared_with_user_id', currentUser.id)
            .eq('status', 'accepted'),
        ]);

        const petMap = new Map<string, any>();

        (ownedResponse.data || []).forEach((pet: any) => {
          if (pet?.id && !petMap.has(pet.id)) {
            petMap.set(pet.id, pet);
          }
        });

        (sharedResponse.data || []).forEach((share: any) => {
          const sharedPet = Array.isArray(share?.pets) ? share.pets[0] : share?.pets;
          if (sharedPet?.id && !petMap.has(sharedPet.id)) {
            petMap.set(sharedPet.id, sharedPet);
          }
        });

        const petNames = Array.from(petMap.values())
          .map((pet: any) => pet?.name)
          .filter(Boolean)
          .slice(0, 5);

        if (isMounted) {
          setPetSummary({
            loading: false,
            hasPets: petNames.length > 0,
            petNames,
            petCount: petMap.size,
          });
        }
      } catch (error) {
        if (isMounted) {
          setPetSummary({
            loading: false,
            hasPets: false,
            petNames: [],
            petCount: 0,
          });
        }
      }
    };

    void loadPetSummary();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Log cuando cambia isDottyEnabled
  useEffect(() => {
  }, [isDottyEnabled]);

  useEffect(() => {
    if (showWelcome && !currentSessionId) {
      setTimeout(() => {
        if (!isExpanded) {
          toggleExpand();
        }
        sendWelcomeMessage();
      }, 500);
    }
  }, [showWelcome]);

  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

  const sendWelcomeMessage = async () => {
    const userName = currentUser?.displayName || 'Usuario';
    const welcomeContent = (() => {
      if (resolvedRole === 'partner' || resolvedRole === 'admin') {
        return `¡Hola, ${userName}! Soy Dotty, tu asistente para negocio.\n\nPuedo ayudarte con clientes, retención, reservas, pedidos, adopciones, métricas y con lo que tu plan permite hacer o no.\n\n¿Qué quieres revisar primero?`;
      }

      if (petSummary.loading) {
        return `¡Hola, ${userName}! Soy Dotty, tu asistente personal.\n\nEstoy cargando tu contexto para darte recomendaciones personalizadas, alertas y próximos pasos. Dame un segundo y empezamos.`;
      }

      if (petSummary.hasPets) {
        return `¡Hola, ${userName}! Veo ${petSummary.petCount} mascota(s) registrada(s): ${petSummary.petNames.join(', ')} 🐾\n\nPuedo ayudarte con recomendaciones de hoy, vacunas, peso, alertas, historial médico y cuidado inteligente.\n\n¿Qué necesitas revisar primero?`;
      }

      return `¡Hola, ${userName}! Soy Dotty, tu asistente personal.\n\nAún no veo mascotas registradas en tu cuenta. Si quieres, te guío para crear tu primera mascota o puedo mostrarte las funciones principales de la app.`;
    })();

    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: welcomeContent,
      audioUsed: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    if (currentSessionId) {
      await saveMessage('assistant', welcomeMessage.content, false);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startPawRotation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pawRotation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(pawRotation, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const rotation = pawRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  const handleDismiss = async () => {
    setIsDottyEnabled(false);
    if (currentUser) {
      try {
        await supabaseClient
          .from('profiles')
          .update({ dotty_enabled: false })
          .eq('id', currentUser.id);
      } catch (error) {
      }
    }
  };

  const toggleExpand = () => {

    if (isExpanded) {
      // Cerrar: primero animar, luego actualizar estado
      Animated.spring(expandAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }).start(() => {
        setIsExpanded(false);
      });
    } else {
      // Abrir: primero actualizar estado, luego animar
      setIsExpanded(true);

      // Esperar un frame para que React renderice
      requestAnimationFrame(() => {
        Animated.spring(expandAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }).start(() => {
        });
      });

      if (!currentSessionId) {
        createNewSession();
      }
    }
  };

  const createNewSession = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabaseClient
        .from('ai_chat_sessions')
        .insert({
          user_id: currentUser.id,
          started_at: new Date().toISOString(),
          message_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentSessionId(data.id);
    } catch (error) {
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string, audioUsed: boolean) => {
    if (!currentUser || !currentSessionId) return;

    try {
      await supabaseClient.from('ai_chat_messages').insert({
        session_id: currentSessionId,
        user_id: currentUser.id,
        role,
        content,
        audio_used: audioUsed,
      });
    } catch (error) {
    }
  };

  const handleBackToMenu = () => {
    setShowQuickActions(true);
    setMessages([]);
    sendWelcomeMessage();
  };

  // Función para manejar acciones detectadas en las respuestas de la IA
  const handleAction = (action: string) => {
    // Reutilizar la lógica de handleQuickAction
    handleQuickAction(action);
  };

  const handleQuickAction = (actionId: string) => {
      setShowQuickActions(false);

    const openPartnerDashboard = () => {
      if (activePartnerBusinessId) {
        router.push({
          pathname: '/(partner-tabs)/dashboard',
          params: { businessId: activePartnerBusinessId },
        });
        return;
      }

      router.push('/(partner-tabs)/business-selector');
    };

    const openPartnerClients = () => {
      if (activePartnerBusinessId) {
        router.push({
          pathname: '/partner/clients',
          params: { partnerId: activePartnerBusinessId },
        });
        return;
      }

      router.push('/(partner-tabs)/business-selector');
    };

    const openPartnerBookings = () => {
      if (activePartnerBusinessId) {
        router.push({
          pathname: '/(partner-tabs)/bookings',
          params: { businessId: activePartnerBusinessId },
        });
        return;
      }

      router.push('/(partner-tabs)/business-selector');
    };

    const openPartnerAdoptions = () => {
      if (activePartnerBusinessId) {
        router.push({
          pathname: '/partner/manage-adoptions',
          params: { partnerId: activePartnerBusinessId },
        });
        return;
      }

      router.push('/(partner-tabs)/business-selector');
    };

    const isBusinessRole = resolvedRole === 'partner' || resolvedRole === 'admin';

    const actionMessages: { [key: string]: Message } = {
      'add-pet': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Te guiaré para registrar tu primera mascota',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Pasos a seguir',
            items: [
              'Navega a la pestaña "Mascotas"',
              'Toca el botón "+" en la esquina superior',
              'Completa el formulario con los datos',
              'Guarda el perfil de tu mascota'
            ],
            icon: '📝'
          }
        ],
        actionButtons: [
          {
            label: 'Ir a Mascotas →',
            action: () => {
              router.push('/(tabs)/pets');
              const msg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Perfecto, ahora busca el botón "+" en la parte superior derecha para agregar tu mascota.',
                audioUsed: false,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, msg]);
            },
          },
        ],
      },
      'medical-history': {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'El historial médico es el corazón de DogCatiFy',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Qué puedes registrar',
            items: [
              'Vacunas con recordatorios automáticos',
              'Desparasitaciones internas y externas',
              'Alergias e intolerancias',
              'Enfermedades y tratamientos',
              'Seguimiento de peso y crecimiento'
            ],
            icon: '📋'
          },
          {
            title: 'Beneficios',
            items: [
              'Genera PDF del historial completo',
              'Comparte con veterinarios',
              'Recordatorios de próximas vacunas',
              'Todo organizado en un solo lugar'
            ],
            icon: '✨'
          }
        ],
      },
      'care-hub': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Abramos el centro de cuidado inteligente de tu mascota',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Qué encontrarás',
            items: [
              'Recomendaciones personalizadas según edad, raza y peso',
              'Modo emergencia con acceso rápido al historial',
              'Alertas médicas y atajos para salud',
            ],
            icon: '🧠',
          },
        ],
        actionButtons: [
          {
            label: 'Abrir centro de cuidado →',
            action: () => {
              router.push('/pets/care');
              const msg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content:
                  'Perfecto, abre una mascota para ver sus recomendaciones personalizadas y el modo emergencia.',
                audioUsed: false,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, msg]);
            },
          },
        ],
      },
      'find-vet': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Encuentra servicios profesionales cerca de ti',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Servicios disponibles',
            items: [
              'Veterinarias y clínicas',
              'Peluquerías caninas',
              'Entrenadores profesionales',
              'Guarderías y hoteles para mascotas'
            ],
            icon: '🏥'
          }
        ],
        actionButtons: [
          {
            label: 'Ver Servicios →',
            action: () => {
              router.push('/(tabs)/services');
              const msg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Aquí puedes explorar todos los servicios. Usa los filtros para encontrar exactamente lo que necesitas.',
                audioUsed: false,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, msg]);
            },
          },
        ],
      },
      'explore-app': {
        id: Date.now().toString(),
        role: 'assistant',
        content: isBusinessRole
          ? 'Tus funciones de negocio están organizadas para que revises lo importante sin perder tiempo'
          : 'DogCatiFy es tu compañero integral para el cuidado de mascotas',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          isBusinessRole
            ? {
                title: 'Secciones del negocio',
                items: [
                  '📊 Dashboard con métricas y accesos',
                  '🤝 CRM de clientes y retención',
                  '📅 Reservas y agenda',
                  '🏡 Adopciones y publicaciones',
                  '⚙️ Configuración de negocio y plan',
                ],
              }
            : {
                title: 'Secciones principales',
                items: [
                  '🏠 Inicio - Red social de mascotas',
                  '🐾 Mascotas - Perfiles e historial médico',
                  '🛒 Tienda - Productos de calidad',
                  '🏥 Servicios - Profesionales certificados',
                  '📍 Lugares - Espacios pet-friendly'
                ],
              }
        ],
        actionButtons: isBusinessRole
          ? [
              {
                label: 'Ir al Dashboard →',
                action: openPartnerDashboard,
              },
              {
                label: 'Ver Clientes →',
                action: openPartnerClients,
              },
            ]
          : undefined,
      },
      'partner-bookings': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Abramos tus reservas para revisar agenda, turnos y próximos movimientos',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Qué puedes revisar',
            items: [
              'Reservas pendientes, confirmadas y completadas',
              'Agenda del negocio con detalles de cada turno',
              'Cambios de estado y seguimiento rápido',
            ],
            icon: '📅',
          },
        ],
        actionButtons: [
          {
            label: 'Ir a Reservas →',
            action: openPartnerBookings,
          },
        ],
      },
      'partner-adoptions': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Abramos adopciones para publicar o revisar mascotas disponibles',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
            title: 'Qué puedes hacer',
            items: [
              'Publicar nuevas mascotas en adopción',
              'Revisar disponibilidad y requisitos',
              'Gestionar el catálogo de adopciones del negocio',
            ],
            icon: '🏡',
          },
        ],
        actionButtons: [
          {
            label: 'Ir a Adopciones →',
            action: openPartnerAdoptions,
          },
        ],
      },
      'profile': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Te llevo a tu perfil para gestionar tu cuenta y accesos',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Perfil →',
            action: () => {
              router.push('/(tabs)/profile');
            },
          },
        ],
      },
      'partner-register': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Vamos a crear o editar tu perfil de aliado',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Registro de Aliado →',
            action: () => {
              router.push('/(tabs)/partner-register');
            },
          },
        ],
      },
      'partner-dashboard': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Te llevo al dashboard de aliado para gestionar tu negocio',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir al Dashboard de Aliado →',
            action: () => {
              openPartnerDashboard();
            },
          },
        ],
      },
      'partner-clients': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Abramos tu CRM para revisar clientes, seguimiento y reactivación',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ver Clientes →',
            action: () => {
              openPartnerClients();
            },
          },
        ],
      },
      'shop': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Abramos la tienda para buscar productos y comprar',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Tienda →',
            action: () => {
              router.push('/(tabs)/shop');
            },
          },
        ],
      },
      'services': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Te llevo a Servicios para encontrar y reservar',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Servicios →',
            action: () => {
              router.push('/(tabs)/services');
            },
          },
        ],
      },
      'orders': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Revisemos el estado de tus pedidos',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Mis Pedidos →',
            action: () => {
              router.push('/orders');
            },
          },
        ],
      },
      'delivery-register': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Vamos a configurar tu perfil de repartidor',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Gestionar Reparto →',
            action: () => {
              router.push('/delivery-register');
            },
          },
        ],
      },
      'delivery-orders': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Te llevo a los pedidos de reparto',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ver Pedidos de Reparto →',
            action: () => {
              router.push('/delivery/orders');
            },
          },
        ],
      },
    };

    const message = actionMessages[actionId];
    if (message) {
      setMessages(prev => [...prev, message]);
      saveMessage('assistant', message.content, false);
    }
  };

  // Función para limpiar las acciones del texto mostrado al usuario
  const cleanResponseText = (text: string): string => {
    // Elimina todas las ocurrencias de [ACCIÓN: ...] del texto
    // Soporte para múltiples espacios y líneas vacías resultantes
    return text
      .replace(/\[ACCIÓN:\s*[^\]]+\]/gi, '')
      .replace(/\n{3,}/g, '\n\n') // Elimina líneas vacías múltiples
      .trim();
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      handleUserMessage(inputText.trim(), false);
      setInputText('');
      Keyboard.dismiss();
    }
  };

  const handleUserMessage = async (text: string, fromVoice: boolean = false) => {
    if (!text.trim()) return;

    setShowQuickActions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      audioUsed: fromVoice,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage('user', text, fromVoice);

    setIsProcessing(true);

    const response = await getAIResponse(text);

    // Detectar acciones antes de limpiar el texto
    const actionMatch = response.match(/\[ACCIÓN:\s*([^\]]+)\]/i);
    if (actionMatch) {
      const action = actionMatch[1].trim();
      handleAction(action);
    }

    // Limpiar el texto de acciones antes de mostrarlo al usuario
    const cleanedResponse = cleanResponseText(response);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: cleanedResponse,
      audioUsed: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    // Guardar la respuesta limpia (sin acciones visibles)
    await saveMessage('assistant', cleanedResponse, false);

    setIsProcessing(false);
  };

  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'action' ? 'assistant' : m.role,
        content: m.content
      }));

      const { data: { session } } = await supabaseClient.auth.getSession();

      // Obtener el perfil del usuario para pasar su nombre
      let userName = 'Usuario';
      if (currentUser?.id) {
        try {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('display_name')
            .eq('id', currentUser.id)
            .single();

          if (profile?.display_name) {
            userName = profile.display_name;
          }
        } catch (error) {
        }
      }

      const response = await fetch(
        `${envConfig.get('EXPO_PUBLIC_SUPABASE_URL')}/functions/v1/dotty-assistant`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            conversationHistory,
            userId: currentUser?.id,
            userName, // Pasar el nombre del usuario
            activeRole: resolvedRole,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error en la respuesta del asistente');
      }

      const data = await response.json();
      return data.response || 'Lo siento, no pude procesar tu mensaje. ¿Podrías reformularlo?';
    } catch (error) {
      return 'Disculpa, estoy teniendo dificultades para responder en este momento. Puedes usar las acciones rápidas o intentar de nuevo en unos segundos.';
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();

    // Animar primero, luego actualizar estado
    Animated.spring(expandAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start(() => {
      setIsExpanded(false);
    });
  };

  // Calcular altura máxima del modal considerando el teclado
  const maxModalHeight = keyboardHeight > 0
    ? Math.max(400, SCREEN_HEIGHT - keyboardHeight - 60) // Mínimo 400px de altura
    : SCREEN_HEIGHT * 0.75;

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxModalHeight],
  });

  // Animar el desplazamiento vertical cuando aparece el teclado
  useEffect(() => {
    // Balance perfecto: sube lo suficiente pero mantiene espaciado profesional
    const TOP_MARGIN = 60; // Margen desde la parte superior
    const offset = keyboardHeight > 0
      ? Math.max(-(keyboardHeight / 2.5), -(SCREEN_HEIGHT / 2 - TOP_MARGIN - maxModalHeight / 2))
      : 0;

    Animated.spring(keyboardOffsetAnim, {
      toValue: offset,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();

  }, [keyboardHeight, maxModalHeight]);

  const overlayOpacity = expandAnim.interpolate({
    inputRange: [0, 0.01, 1],
    outputRange: [0, 1, 1],
  });

  // Log para debug
  useEffect(() => {
    const listenerId = expandAnim.addListener(({ value }) => {
    });
    return () => expandAnim.removeListener(listenerId);
  }, []);

  // Log de visibilidad
  if (!dottyVisible) {
    return null;
  }


  return (
    <>
      {isExpanded && (() => {
        return (
        <Animated.View style={[styles.chatOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleClose}
          >
            <View />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.keyboardAvoidContainer,
              {
                transform: [{ translateY: keyboardOffsetAnim }],
              }
            ]}
          >
            <Animated.View style={[styles.chatContainer, { height: expandedHeight }]}>
            <View style={styles.chatHeader}>
              <View style={styles.headerLeft}>
                {!showQuickActions && (
                  <TouchableOpacity onPress={handleBackToMenu} style={styles.backButton}>
                    <ArrowLeft size={20} color="#2D6A6F" />
                  </TouchableOpacity>
                )}
                <View style={styles.headerIconContainer}>
                  <PawPrint size={22} color="#2D6A6F" />
                </View>
                <View>
                  <Text style={styles.chatTitle}>Dotty Assistant</Text>
                  <Text style={styles.chatSubtitle}>
                    {resolvedRole === 'partner' || resolvedRole === 'admin'
                      ? 'Tu guía de negocio'
                      : 'Tu guía personal'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {messages.map((message) => (
                <View key={message.id}>
                  <View
                    style={[
                      styles.messageBubble,
                      message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    {message.role !== 'user' && (
                      <View style={styles.assistantHeader}>
                        <Sparkles size={14} color="#2D6A6F" />
                        <Text style={styles.assistantLabel}>Dotty</Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.messageText,
                        message.role === 'user' ? styles.userText : styles.assistantText,
                      ]}
                    >
                      {message.content}
                    </Text>
                    {message.sections && (
                      <View style={styles.sectionsContainer}>
                        {message.sections.map((section, idx) => (
                          <View key={idx} style={styles.section}>
                            {section.title && (
                              <Text style={styles.sectionTitle}>
                                {section.icon && `${section.icon} `}{section.title}
                              </Text>
                            )}
                            {section.items.map((item, itemIdx) => (
                              <View key={itemIdx} style={styles.sectionItem}>
                                <View style={styles.bullet} />
                                <Text style={styles.sectionItemText}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {message.actionButtons && (
                    <View style={styles.actionButtonsContainer}>
                      {message.actionButtons.map((btn, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={btn.action}
                          style={styles.actionButton}
                        >
                          <Text style={styles.actionButtonText}>{btn.label}</Text>
                          <ChevronRight size={18} color="#2D6A6F" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {isProcessing && (
                <View style={styles.processingIndicator}>
                  <ActivityIndicator size="small" color="#2D6A6F" />
                  <Text style={styles.processingText}>Dotty está pensando...</Text>
                </View>
              )}
              {showQuickActions && (
                <View style={styles.quickActionsContainer}>
                  <Text style={styles.quickActionsTitle}>
                    {resolvedRole === 'partner' || resolvedRole === 'admin'
                      ? '¿Qué quieres revisar sobre tu negocio?'
                      : '¿Qué te gustaría preguntarme o hacer?'}
                  </Text>
                  {visibleQuickActions.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      onPress={() => handleQuickAction(action.id)}
                      style={styles.quickActionCard}
                    >
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionLabel}>{action.label}</Text>
                        <Text style={styles.quickActionDescription}>{action.description}</Text>
                      </View>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showQuickActions && (
                <View style={styles.promptContainer}>
                  <Text style={styles.promptTitle}>
                    {resolvedRole === 'partner' || resolvedRole === 'admin'
                      ? 'Preguntas para aliados'
                      : 'Prueba con una pregunta'}
                  </Text>
                  <View style={styles.promptWrap}>
                    {visibleStarterPrompts.map((prompt) => (
                      <TouchableOpacity
                        key={prompt}
                        style={styles.promptChip}
                        onPress={() => handleUserMessage(prompt, false)}
                        activeOpacity={0.86}
                      >
                        <Text style={styles.promptChipText}>{prompt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputContainer}>
      <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder={resolvedRole === 'partner' || resolvedRole === 'admin'
                    ? 'Pregúntame sobre clientes, reservas o módulos...'
                    : 'Pregúntame algo sobre tu mascota...'}
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendMessage}
                  returnKeyType="send"
                  multiline
                  maxLength={500}
                  blurOnSubmit={false}
                  underlineColorAndroid="transparent"
                  autoCorrect={true}
                  autoCapitalize="sentences"
                  textAlignVertical="center"
                  selectionColor="#2D6A6F"
                />
              </View>
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                disabled={!inputText.trim()}
                activeOpacity={0.7}
              >
                <Send size={20} color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
        );
      })()}

      <Animated.View
        style={[
          styles.floatingButtonContainer,
          {
            left: position.x,
            top: position.y,
            zIndex: isExpanded ? 9998 : 9999,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.floatingButton}>
          <Animated.View
            style={[
              styles.buttonContent,
              {
                transform: [
                  { scale: pulseAnim },
                  { rotate: rotation }
                ],
              },
            ]}
          >
            <PawPrint size={30} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>
          {!isExpanded && (
            <View style={styles.badge}>
              <HelpCircle size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  chatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardAvoidContainer: {
    width: SCREEN_WIDTH - 24,
    maxWidth: 480,
    zIndex: 10001,
  },
  chatContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F0FDFA',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  chatSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D6A6F',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  assistantLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#111827',
  },
  sectionsContainer: {
    marginTop: 12,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginBottom: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingLeft: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2D6A6F',
    marginTop: 7,
  },
  sectionItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  actionButtonsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2D6A6F',
    shadowColor: '#2D6A6F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    flex: 1,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 12,
  },
  processingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  quickActionsContainer: {
    marginTop: 8,
  },
  promptContainer: {
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  promptWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  promptChipText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#065F46',
    lineHeight: 18,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginBottom: 16,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionContent: {
    flex: 1,
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  quickActionDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 70,
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#000000',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    lineHeight: 22,
    includeFontPadding: false,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D6A6F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  floatingButtonContainer: {
    position: 'absolute',
    width: 68,
    height: 68,
    zIndex: 9999,
  },
  floatingButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F59E0B',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
