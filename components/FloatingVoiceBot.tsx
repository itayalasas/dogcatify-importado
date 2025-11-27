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
} from 'react-native';
import { X, Volume2, Send, PawPrint } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { supabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUsed: boolean;
  timestamp: Date;
}

interface FloatingVoiceBotProps {
  onClose?: () => void;
  showWelcome?: boolean;
}

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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(showWelcome ? 1 : 0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pawRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startPulseAnimation();
    startPawRotation();
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (showWelcome && !currentSessionId) {
      toggleExpand();
      setTimeout(() => {
        sendWelcomeMessage();
      }, 500);
    }
  }, [showWelcome]);

  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendWelcomeMessage = async () => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '¡Hola! 🐾 Soy Dotty, tu asistente en DogCatiFy.\n\nEstoy aquí para ayudarte a:\n\n• 📋 Gestionar el historial médico de tus mascotas\n• 🏥 Encontrar veterinarios y servicios\n• 🛒 Comprar productos\n• 📍 Descubrir lugares pet-friendly\n• 💬 Interactuar en nuestra red social\n\n¿En qué puedo ayudarte hoy?',
      audioUsed: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    await saveMessage('assistant', welcomeMessage.content, false);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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
    outputRange: ['0deg', '15deg'],
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

  const startListening = async () => {
    if (Platform.OS === 'web') {
      startWebSpeechRecognition();
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert('Se necesitan permisos de micrófono para usar esta función');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsListening(true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error al iniciar la grabación');
    }
  };

  const startWebSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleUserMessage(transcript, true);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = async () => {
    setIsListening(false);
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);

    if (Platform.OS === 'web') {
      return;
    }

    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();

        if (uri) {
          const transcribedText = 'Hola, necesito ayuda con mi mascota';
          handleUserMessage(transcribedText, true);
        }

        setRecording(null);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      handleUserMessage(inputText.trim(), false);
      setInputText('');
    }
  };

  const handleUserMessage = async (text: string, fromVoice: boolean = false) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      audioUsed: fromVoice,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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

    setMessages((prev) => [...prev, assistantMessage]);
    await saveMessage('assistant', response, false);

    if (fromVoice) {
      speakText(response);
    }

    setIsProcessing(false);
  };

  const getAIResponse = async (userMessage: string): Promise<string> => {
    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
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
      return 'Disculpa, estoy teniendo problemas para responder en este momento. Por favor, intenta de nuevo en unos segundos. 🐾';
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
    Animated.spring(expandAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.65],
  });

  return (
    <View style={styles.container}>
      {isExpanded && (
        <Animated.View style={[styles.chatContainer, { height: expandedHeight }]}>
          <View style={styles.chatHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <PawPrint size={24} color="#2D6A6F" />
              </View>
              <View>
                <Text style={styles.chatTitle}>Dotty Assistant 🐾</Text>
                <Text style={styles.chatSubtitle}>Tu guía en DogCatiFy</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => (
              <View
                key={message.id}
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
                {message.audioUsed && (
                  <View style={styles.audioIndicator}>
                    <Volume2 size={12} color={message.role === 'user' ? '#FFFFFF' : '#2D6A6F'} />
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
          </ScrollView>

          <View style={styles.inputContainer}>
            {isSpeaking && (
              <TouchableOpacity onPress={stopSpeaking} style={styles.stopSpeakingButton}>
                <Volume2 size={20} color="#DC2626" />
                <Text style={styles.stopSpeakingText}>Detener audio</Text>
              </TouchableOpacity>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={isListening ? stopListening : startListening}
                style={[styles.micButton, isListening && styles.micButtonActive]}
              >
                <PawPrint size={20} color={isListening ? '#DC2626' : '#2D6A6F'} />
              </TouchableOpacity>
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
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                disabled={!inputText.trim()}
              >
                <Send size={20} color={inputText.trim() ? '#2D6A6F' : '#D1D5DB'} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

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
                { scale: isListening ? scaleAnim : pulseAnim },
                { rotate: rotation }
              ],
            },
          ]}
        >
          <PawPrint size={32} color="#FFFFFF" strokeWidth={2.5} />
        </Animated.View>
        {!isExpanded && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>¡Hola!</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    right: 20,
    zIndex: 1000,
  },
  floatingButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2D6A6F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    top: -8,
    right: -8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  chatContainer: {
    position: 'absolute',
    bottom: 85,
    right: 0,
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
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
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
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
  audioIndicator: {
    marginTop: 4,
    alignSelf: 'flex-end',
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
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0FDFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CCFBF1',
  },
  micButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  stopSpeakingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 8,
  },
  stopSpeakingText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
});
