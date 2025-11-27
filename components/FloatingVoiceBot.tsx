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
import { X, Volume2, Send, PawPrint, HelpCircle, ChevronRight } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
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
    label: 'Agregar mi primera mascota 🐕',
    description: 'Te guiaré paso a paso para registrar tu mascota',
  },
  {
    id: 'medical-history',
    label: 'Ver historial médico 📋',
    description: 'Aprende a usar el historial de salud',
  },
  {
    id: 'find-vet',
    label: 'Encontrar veterinario 🏥',
    description: 'Busca servicios veterinarios cerca',
  },
  {
    id: 'explore-app',
    label: 'Explorar la app 🎯',
    description: 'Tour completo de funcionalidades',
  },
];

export const FloatingVoiceBot: React.FC<FloatingVoiceBotProps> = ({ onClose, showWelcome = false }) => {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(showWelcome);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);

  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 90, y: SCREEN_HEIGHT - 180 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpanded,
      onMoveShouldSetPanResponder: () => !isExpanded,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        let finalX = (pan.x as any)._value;
        let finalY = (pan.y as any)._value;

        finalX = Math.max(20, Math.min(SCREEN_WIDTH - 90, finalX));
        finalY = Math.max(50, Math.min(SCREEN_HEIGHT - 180, finalY));

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    startPulseAnimation();
    startPawRotation();
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {});
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {});

    return () => {
      stopSpeaking();
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
      content: '¡Hola! 🐾 Soy Dotty, tu asistente personal en DogCatiFy.\n\nEstoy aquí para guiarte paso a paso. ¿Qué te gustaría hacer?',
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
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
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
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pawRotation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const rotation = pawRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '12deg'],
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
        content: '¡Perfecto! Te voy a guiar para agregar tu primera mascota. Aquí están los pasos:',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Paso 1: Ir a Mascotas',
            action: () => {
              const msg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '1️⃣ Primero, toca la pestaña "Mascotas" en el menú inferior. Es el segundo ícono con forma de huella 🐾',
                audioUsed: false,
                timestamp: new Date(),
                actionButtons: [
                  {
                    label: 'Ir a Mascotas ahora →',
                    action: () => {
                      router.push('/(tabs)/pets');
                      const nextMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: '2️⃣ Ahora, busca el botón "+" o "Agregar Mascota" en la parte superior derecha y tócalo.',
                        audioUsed: false,
                        timestamp: new Date(),
                      };
                      setMessages(prev => [...prev, nextMsg]);
                    },
                  },
                ],
              };
              setMessages(prev => [...prev, msg]);
            },
          },
        ],
      },
      'medical-history': {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'El historial médico te permite:\n\n📋 Registrar vacunas\n💊 Desparasitaciones\n⚠️ Alergias\n🏥 Enfermedades y tratamientos\n⚖️ Seguimiento de peso\n\n¿Sobre qué quieres saber más?',
        audioUsed: false,
        timestamp: new Date(),
      },
      'find-vet': {
        id: Date.now().toString(),
        role: 'action',
        content: 'Para encontrar veterinarios cerca de ti:',
        audioUsed: false,
        timestamp: new Date(),
        actionButtons: [
          {
            label: 'Ir a Servicios →',
            action: () => {
              router.push('/(tabs)/services');
              const msg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '¡Perfecto! Ahora puedes ver todos los servicios disponibles cerca de ti. Puedes filtrar por:\n\n🏥 Veterinarias\n✂️ Peluquerías\n🎓 Entrenadores\n🏠 Guarderías',
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
        content: 'La app tiene 5 secciones principales:\n\n🏠 Inicio: Feed de publicaciones\n🐾 Mascotas: Tus mascotas y su historial\n🛒 Tienda: Productos para mascotas\n🏥 Servicios: Veterinarios y más\n📍 Lugares: Sitios pet-friendly\n\n¿Sobre cuál quieres aprender?',
        audioUsed: false,
        timestamp: new Date(),
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
      return data.response || 'Lo siento, no pude procesar tu mensaje. ¿Podrías intentar de nuevo?';
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'Disculpa, estoy teniendo problemas para responder. Puedes usar las acciones rápidas arriba o preguntarme algo específico. 🐾';
    }
  };

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      await Speech.speak(text, {
        language: 'es-ES',
        pitch: 1.1,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error('Error speaking:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const handleClose = () => {
    stopSpeaking();
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
    outputRange: [0, SCREEN_HEIGHT * 0.7],
  });

  return (
    <>
      {isExpanded && (
        <View style={styles.chatOverlay}>
          <Animated.View style={[styles.chatContainer, { height: expandedHeight }]}>
            <View style={styles.chatHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <PawPrint size={20} color="#2D6A6F" />
                </View>
                <View>
                  <Text style={styles.chatTitle}>Dotty Assistant 🐾</Text>
                  <Text style={styles.chatSubtitle}>Tu guía paso a paso</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={22} color="#6B7280" />
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
                    <Text
                      style={[
                        styles.messageText,
                        message.role === 'user' ? styles.userText : styles.assistantText,
                      ]}
                    >
                      {message.content}
                    </Text>
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
                          <ChevronRight size={16} color="#2D6A6F" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {isProcessing && (
                <View style={styles.processingIndicator}>
                  <ActivityIndicator size="small" color="#2D6A6F" />
                  <Text style={styles.processingText}>Dotty está pensando... 🐾</Text>
                </View>
              )}
              {showQuickActions && (
                <View style={styles.quickActionsContainer}>
                  <Text style={styles.quickActionsTitle}>Acciones rápidas:</Text>
                  {quickActions.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      onPress={() => handleQuickAction(action.id)}
                      style={styles.quickActionCard}
                    >
                      <Text style={styles.quickActionLabel}>{action.label}</Text>
                      <Text style={styles.quickActionDescription}>{action.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.inputContainer}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Pregúntame lo que quieras..."
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
                  <Send size={18} color={inputText.trim() ? '#2D6A6F' : '#D1D5DB'} />
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
          activeOpacity={0.8}
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
            <PawPrint size={28} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>
          {!isExpanded && (
            <View style={styles.badge}>
              <HelpCircle size={14} color="#FFFFFF" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F0FDFA',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  chatSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D6A6F',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#111827',
  },
  actionButtonsContainer: {
    marginBottom: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2D6A6F',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#2D6A6F',
    flex: 1,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  processingText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  quickActionsContainer: {
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 12,
  },
  quickActionCard: {
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 21,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CCFBF1',
  },
  sendButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  floatingButtonContainer: {
    position: 'absolute',
    width: 64,
    height: 64,
    zIndex: 1000,
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
