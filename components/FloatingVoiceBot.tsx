import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
  PanResponder,
  Keyboard,
} from 'react-native';
import { X, Send, PawPrint, HelpCircle, ChevronRight, Sparkles } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { supabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

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
  const [isExpanded, setIsExpanded] = useState(showWelcome);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isDottyEnabled, setIsDottyEnabled] = useState(true);

  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 90, y: SCREEN_HEIGHT - 200 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        if (isExpanded) return;
        pan.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isExpanded) return;
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isExpanded) return;

        pan.flattenOffset();

        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        let finalX = currentX;
        let finalY = currentY;

        finalX = Math.max(10, Math.min(SCREEN_WIDTH - 74, finalX));
        finalY = Math.max(60, Math.min(SCREEN_HEIGHT - 200, finalY));

        if (finalY > SCREEN_HEIGHT - 250) {
          checkDismissZone(finalX, finalY);
        }

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
      },
    })
  ).current;

  const checkDismissZone = async (x: number, y: number) => {
    if (y > SCREEN_HEIGHT - 250) {
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
    }
  };

  useEffect(() => {
    checkDottyStatus();
    startPulseAnimation();
    startPawRotation();

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {});
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {});

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const checkDottyStatus = async () => {
    if (currentUser) {
      try {
        const { data } = await supabaseClient
          .from('profiles')
          .select('dotty_enabled')
          .eq('id', currentUser.id)
          .single();

        if (data) {
          setIsDottyEnabled(data.dotty_enabled);
        }
      } catch (error) {
        console.error('Error checking Dotty status:', error);
      }
    }
  };

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
      }, 100);
    }
  }, [messages]);

  const sendWelcomeMessage = async () => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '¡Hola! Soy Dotty, tu asistente personal en DogCatiFy.\n\nEstoy aquí para guiarte en cada paso. ¿En qué puedo ayudarte hoy?',
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

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);

    if (!isExpanded && !currentSessionId) {
      createNewSession();
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

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      audioUsed: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    await saveMessage('assistant', response, false);

    setIsProcessing(false);
  };

  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'action' ? 'assistant' : m.role,
        content: m.content
      }));

      const { data: { session } } = await supabaseClient.auth.getSession();

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
    setIsExpanded(false);
    Keyboard.dismiss();
    Animated.spring(expandAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.75],
  });

  if (!isDottyEnabled) return null;

  return (
    <>
      {isExpanded && (
        <View style={styles.chatOverlay}>
          <Animated.View style={[styles.chatContainer, { height: expandedHeight }]}>
            <View style={styles.chatHeader}>
              <View style={styles.headerLeft}>
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
              <View style={styles.inputRow}>
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
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  disabled={!inputText.trim()}
                >
                  <Send size={18} color={inputText.trim() ? '#FFFFFF' : '#D1D5DB'} />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.floatingButtonContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={toggleExpand}
          activeOpacity={0.9}
          style={styles.floatingButton}
        >
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
        </TouchableOpacity>
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
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    width: SCREEN_WIDTH - 24,
    maxWidth: 480,
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
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 24,
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
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2D6A6F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  floatingButtonContainer: {
    position: 'absolute',
    width: 68,
    height: 68,
    zIndex: 1000,
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
