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

const quickActions = [
  {
    id: 'add-pet',
    label: '🐕 Registrar mi primera mascota',
    description: 'Guía paso a paso para agregar tu mascota',
  },
  {
    id: 'medical-history',
    label: '📋 Historial médico',
    description: 'Aprende a gestionar la salud de tu mascota',
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

export const FloatingVoiceBot: React.FC<FloatingVoiceBotProps> = ({ onClose, showWelcome = false }) => {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();

  const [isExpanded, setIsExpanded] = useState(showWelcome);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isDottyEnabled, setIsDottyEnabled] = useState<boolean | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const position = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 90, y: SCREEN_HEIGHT - 300 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;
  const keyboardOffsetAnim = useRef(new Animated.Value(0)).current;

  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });
  const gestureStartTime = useRef(0);

  // Funciones para guardar/cargar posición
  const savePosition = async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem('dotty_position', JSON.stringify({ x, y }));
      console.log('[Dotty] Position saved:', { x, y });
    } catch (error) {
      console.error('[Dotty] Error saving position:', error);
    }
  };

  const loadPosition = async () => {
    try {
      const saved = await AsyncStorage.getItem('dotty_position');
      if (saved) {
        const { x, y } = JSON.parse(saved);
        console.log('[Dotty] Position loaded:', { x, y });
        position.setValue({ x, y });
      }
    } catch (error) {
      console.error('[Dotty] Error loading position:', error);
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
          console.log('[Dotty] Drag started at:', value);
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

        console.log('[Dotty] Drag ended:', { dragDuration, dragDistance });

        // Si fue un tap rápido (< 200ms y < 10px), expandir
        if (dragDuration < 200 && dragDistance < 10) {
          console.log('[Dotty] Tap detected, toggling expand');
          isDragging.current = false;
          toggleExpand();
        } else {
          // Si fue un drag, guardar la posición
          position.stopAnimation((value) => {
            console.log('[Dotty] Final position:', value);
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
      console.log('[Dotty] shouldShowDotty: NO - Status not loaded yet (null)');
      return false;
    }

    // Check 1: Usuario autenticado
    if (!currentUser) {
      console.log('[Dotty] shouldShowDotty: NO - No user authenticated');
      return false;
    }

    // Check 2: Dotty habilitado por el usuario
    if (isDottyEnabled === false) {
      console.log('[Dotty] shouldShowDotty: NO - Dotty disabled by user (isDottyEnabled=false)');
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

    // Check 3: Ruta permitida
    if (isAuthRoute || isHiddenRoute) {
      console.log('[Dotty] shouldShowDotty: NO - Hidden route', {
        pathname: currentPath,
        isAuthRoute,
        isHiddenRoute
      });
      return false;
    }

    console.log('[Dotty] shouldShowDotty: YES - All checks passed', {
      currentUser: !!currentUser,
      isDottyEnabled,
      pathname: currentPath,
      segments
    });

    return true;
  }, [isDottyEnabled, currentUser, pathname, segments]);

  useEffect(() => {
    loadPosition(); // Cargar posición guardada
    checkDottyStatus();
    startPulseAnimation();
    startPawRotation();

    // Listeners para el teclado
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        console.log('[Dotty] Keyboard will show, height:', e.endCoordinates.height);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        console.log('[Dotty] Keyboard will hide');
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
        console.log('[Dotty] Checking status for user:', currentUser.id);
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('dotty_enabled')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error('[Dotty] Error checking status:', error);
          // En caso de error, mantener null (no mostrar hasta confirmar)
          setIsDottyEnabled(null);
          return;
        }

        if (data) {
          // Si dotty_enabled es null o undefined, tratar como true (activado por defecto)
          // Si es explícitamente false, respetar esa configuración
          const isEnabled = data.dotty_enabled !== false;
          console.log('[Dotty] Status loaded from DB:', {
            raw_value: data.dotty_enabled,
            computed_value: isEnabled,
            is_null: data.dotty_enabled === null,
            is_undefined: data.dotty_enabled === undefined
          });
          setIsDottyEnabled(isEnabled);
        } else {
          console.log('[Dotty] No profile data found, defaulting to enabled');
          setIsDottyEnabled(true);
        }
      } catch (error) {
        console.error('[Dotty] Exception checking Dotty status:', error);
        // En caso de excepción, mantener null (no mostrar hasta confirmar)
        setIsDottyEnabled(null);
      }
    } else {
      console.log('[Dotty] No current user, hiding Dotty');
      setIsDottyEnabled(false);
    }
  };

  // Escuchar cambios en tiempo real de la configuración de Dotty
  useEffect(() => {
    if (!currentUser?.id) return;

    console.log('[Dotty] Setting up real-time subscription for user:', currentUser.id);

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
          console.log('[Dotty] 🔄 Real-time update received:', {
            event: payload.eventType,
            old_value: payload.old?.dotty_enabled,
            new_value: payload.new?.dotty_enabled
          });

          if (payload.new && 'dotty_enabled' in payload.new) {
            // Si dotty_enabled es null o undefined, tratar como true (activado por defecto)
            // Si es explícitamente false, respetar esa configuración
            const isEnabled = payload.new.dotty_enabled !== false;
            console.log('[Dotty] 🔄 Changing state from', isDottyEnabled, 'to', isEnabled, {
              raw_value: payload.new.dotty_enabled,
              is_null: payload.new.dotty_enabled === null,
              is_false: payload.new.dotty_enabled === false
            });
            setIsDottyEnabled(isEnabled);

            // Si se deshabilitó, cerrar el modal si está abierto
            if (!isEnabled) {
              console.log('[Dotty] 🚫 Closing because disabled');
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
              console.log('[Dotty] ✅ Enabled - component should appear now');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Dotty] Subscription status:', status);
      });

    return () => {
      console.log('[Dotty] Cleaning up subscription');
      supabaseClient.removeChannel(subscription);
    };
  }, [currentUser?.id]);

  // Recargar estado cuando cambia el usuario
  useEffect(() => {
    if (currentUser?.id) {
      console.log('[Dotty] User changed, reloading Dotty status for:', currentUser.id);
      checkDottyStatus();
    } else {
      console.log('[Dotty] No user, hiding Dotty');
      setIsDottyEnabled(false);
    }
  }, [currentUser?.id]);

  // Log cuando cambia isDottyEnabled
  useEffect(() => {
    console.log('[Dotty] isDottyEnabled changed to:', isDottyEnabled);
    console.log('[Dotty] Component will', isDottyEnabled ? 'RENDER' : 'HIDE');
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
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '¡Hola! Soy Dotty, tu asistente personal.\n\nEstoy aquí para guiarte en cada paso. ¿En qué puedo ayudarte?',
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
        console.error('Error hiding Dotty:', error);
      }
    }
  };

  const toggleExpand = () => {
    console.log('[Dotty] toggleExpand called. Current isExpanded:', isExpanded);

    if (isExpanded) {
      // Cerrar: primero animar, luego actualizar estado
      console.log('[Dotty] Closing: animating to 0');
      Animated.spring(expandAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: false,
      }).start(() => {
        console.log('[Dotty] Animation complete, setting isExpanded to false');
        setIsExpanded(false);
      });
    } else {
      // Abrir: primero actualizar estado, luego animar
      console.log('[Dotty] Opening: setting isExpanded to true');
      setIsExpanded(true);

      // Esperar un frame para que React renderice
      requestAnimationFrame(() => {
        console.log('[Dotty] Starting animation to 1');
        Animated.spring(expandAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }).start(() => {
          console.log('[Dotty] Animation complete');
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
      console.error('Error creating chat session:', error);
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
      console.error('Error saving message:', error);
    }
  };

  const handleBackToMenu = () => {
    setShowQuickActions(true);
    setMessages([]);
    sendWelcomeMessage();
  };

  // Función para manejar acciones detectadas en las respuestas de la IA
  const handleAction = (action: string) => {
    console.log('[Dotty] Handling action:', action);
    // Reutilizar la lógica de handleQuickAction
    handleQuickAction(action);
  };

  const handleQuickAction = (actionId: string) => {
    setShowQuickActions(false);

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
        content: 'DogCatiFy es tu compañero integral para el cuidado de mascotas',
        audioUsed: false,
        timestamp: new Date(),
        sections: [
          {
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
      console.log('[Dotty] Action detected:', action);
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
          console.error('[Dotty] Error fetching user profile:', error);
        }
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/dotty-assistant`,
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
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error en la respuesta del asistente');
      }

      const data = await response.json();
      return data.response || 'Lo siento, no pude procesar tu mensaje. ¿Podrías reformularlo?';
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'Disculpa, estoy teniendo dificultades para responder en este momento. Puedes usar las acciones rápidas o intentar de nuevo en unos segundos.';
    }
  };

  const handleClose = () => {
    console.log('[Dotty] handleClose called');
    Keyboard.dismiss();

    // Animar primero, luego actualizar estado
    Animated.spring(expandAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start(() => {
      console.log('[Dotty] handleClose: Animation complete, setting isExpanded to false');
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

    console.log('[Dotty] Keyboard visible, adjusting modal:', {
      keyboardHeight,
      maxModalHeight,
      offset,
      topMargin: TOP_MARGIN
    });
  }, [keyboardHeight, maxModalHeight]);

  const overlayOpacity = expandAnim.interpolate({
    inputRange: [0, 0.01, 1],
    outputRange: [0, 1, 1],
  });

  // Log para debug
  useEffect(() => {
    const listenerId = expandAnim.addListener(({ value }) => {
      console.log('[Dotty] expandAnim value:', value, 'height:', SCREEN_HEIGHT * 0.75 * value);
    });
    return () => expandAnim.removeListener(listenerId);
  }, []);

  // Log de visibilidad
  if (!dottyVisible) {
    console.log('[Dotty] ❌ NOT VISIBLE - dottyVisible is false');
    return null;
  }

  console.log('[Dotty] ✅ VISIBLE - Rendering component', {
    isExpanded,
    isDottyEnabled,
    pathname,
    currentUser: !!currentUser
  });

  return (
    <>
      {isExpanded && (() => {
        console.log('[Dotty] Rendering modal overlay');
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
                  <Text style={styles.chatSubtitle}>Tu guía personal</Text>
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
                  <Text style={styles.quickActionsTitle}>¿Qué te gustaría hacer?</Text>
                  {quickActions.map((action) => (
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
            </ScrollView>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Escribe tu pregunta..."
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
