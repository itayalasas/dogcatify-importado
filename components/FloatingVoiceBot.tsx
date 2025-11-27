import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { X, Send, PawPrint, HelpCircle, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react-native';
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

  const position = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 90, y: SCREEN_HEIGHT - 300 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;

  const isDragging = useRef(false);
  const startPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    checkDottyStatus();
    startPulseAnimation();
    startPawRotation();

    return () => {
      Keyboard.dismiss();
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
          setIsDottyEnabled(data.dotty_enabled !== false);
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

  const onPanResponderGrant = () => {
    if (isExpanded) return;

    isDragging.current = false;
    position.stopAnimation((value) => {
      startPosition.current = { x: value.x, y: value.y };
    });
  };

  const onPanResponderMove = (_: any, gestureState: any) => {
    if (isExpanded || !gestureState) return;

    const dx = gestureState.dx || 0;
    const dy = gestureState.dy || 0;

    const distanceMoved = Math.sqrt(
      Math.pow(dx, 2) + Math.pow(dy, 2)
    );

    if (distanceMoved > 5) {
      isDragging.current = true;
    }

    if (isDragging.current) {
      position.setValue({
        x: startPosition.current.x + dx,
        y: startPosition.current.y + dy,
      });
    }
  };

  const onPanResponderRelease = (_: any, gestureState: any) => {
    if (isExpanded) return;

    if (!isDragging.current) {
      toggleExpand();
      return;
    }

    const dx = gestureState?.dx || 0;
    const dy = gestureState?.dy || 0;

    const finalX = startPosition.current.x + dx;
    const finalY = startPosition.current.y + dy;

    let boundedX = Math.max(-10, Math.min(SCREEN_WIDTH - 58, finalX));
    let boundedY = Math.max(40, Math.min(SCREEN_HEIGHT - 100, finalY));

    if (boundedY > SCREEN_HEIGHT - 250) {
      handleDismiss();
      return;
    }

    Animated.spring(position, {
      toValue: { x: boundedX, y: boundedY },
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();

    isDragging.current = false;
  };

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

  const handleBackToMenu = () => {
    setShowQuickActions(true);
    setMessages([]);
    sendWelcomeMessage();
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

  if (!isDottyEnabled || !currentUser) return null;

  return (
    <>
      {isExpanded && (
        <View style={styles.chatOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
                />
              </View>
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                disabled={!inputText.trim()}
              >
                <Send size={18} color={inputText.trim() ? '#FFFFFF' : '#D1D5DB'} />
              </TouchableOpacity>
            </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      <Animated.View
        style={[
          styles.floatingButtonContainer,
          {
            left: position.x,
            top: position.y,
            zIndex: isExpanded ? 9998 : 9999,
          },
        ]}
        onStartShouldSetResponder={() => !isExpanded}
        onMoveShouldSetResponder={() => !isExpanded}
        onResponderGrant={onPanResponderGrant}
        onResponderMove={onPanResponderMove}
        onResponderRelease={onPanResponderRelease}
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
  keyboardAvoidContainer: {
    width: SCREEN_WIDTH - 24,
    maxWidth: 480,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  chatContainer: {
    flex: 1,
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
    paddingBottom: 24,
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
    alignItems: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
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
