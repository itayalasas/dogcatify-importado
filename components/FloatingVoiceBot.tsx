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
} from 'react-native';
import { Mic, X, Volume2, MessageCircle, Send } from 'lucide-react-native';
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
}

export const FloatingVoiceBot: React.FC<FloatingVoiceBotProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribedText, setTranscribedText] = useState('');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    startPulseAnimation();
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
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
            toValue: 1.2,
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
      setTranscribedText(transcript);
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
          setTranscribedText(transcribedText);
          handleUserMessage(transcribedText, true);
        }

        setRecording(null);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
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
    setTranscribedText('');

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
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('vacuna') || lowerMessage.includes('vacunación')) {
      return 'Para gestionar las vacunas de tu mascota, ve a la pestaña "Mascotas", selecciona a tu mascota y luego "Historial Médico". Ahí podrás agregar todas las vacunas con fechas y recordatorios automáticos.';
    }

    if (lowerMessage.includes('veterinario') || lowerMessage.includes('veterinaria')) {
      return 'En la pestaña "Servicios" encontrarás veterinarios cerca de ti. Puedes ver sus perfiles, horarios disponibles y agendar citas directamente desde la app.';
    }

    if (lowerMessage.includes('producto') || lowerMessage.includes('comprar') || lowerMessage.includes('tienda')) {
      return 'Ve a la pestaña "Tienda" para explorar productos para tu mascota. Tenemos alimento, juguetes, accesorios y más. Puedes agregar productos al carrito y pagar de forma segura.';
    }

    if (lowerMessage.includes('lugar') || lowerMessage.includes('restaurante') || lowerMessage.includes('parque')) {
      return 'En la pestaña "Lugares" encontrarás restaurantes, cafés, parques y otros sitios pet-friendly donde puedes ir con tu mascota. Cada lugar tiene valoraciones y fotos de otros usuarios.';
    }

    if (lowerMessage.includes('adopción') || lowerMessage.includes('adoptar')) {
      return 'Si estás buscando adoptar, revisa la sección de adopciones en la app. También puedes publicar mascotas en adopción si eres un refugio o particular autorizado.';
    }

    if (lowerMessage.includes('ayuda') || lowerMessage.includes('cómo') || lowerMessage.includes('como')) {
      return 'Estoy aquí para ayudarte. Puedo orientarte sobre cómo usar el historial médico, encontrar veterinarios, comprar productos, descubrir lugares pet-friendly y mucho más. ¿Qué necesitas saber?';
    }

    return `Entiendo tu pregunta sobre "${userMessage}". Te recomiendo explorar las diferentes secciones de DogCatiFy: Mascotas para gestionar el historial médico, Servicios para encontrar veterinarios y peluquerías, Tienda para productos, y Lugares para sitios pet-friendly. ¿Hay algo específico en lo que pueda ayudarte?`;
  };

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      await Speech.speak(text, {
        language: 'es-ES',
        pitch: 1.0,
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
    if (onClose) {
      onClose();
    }
  };

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.6],
  });

  return (
    <View style={styles.container}>
      {isExpanded && (
        <Animated.View style={[styles.chatContainer, { height: expandedHeight }]}>
          <View style={styles.chatHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <MessageCircle size={20} color="#2D6A6F" />
              </View>
              <View>
                <Text style={styles.chatTitle}>Dotty Assistant</Text>
                <Text style={styles.chatSubtitle}>Asistente con IA</Text>
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
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Hola! Soy Dotty, tu asistente virtual. Puedes hablarme o escribirme.
                </Text>
              </View>
            )}
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
                <Text style={styles.processingText}>Dotty está pensando...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            {isSpeaking && (
              <TouchableOpacity onPress={stopSpeaking} style={styles.stopSpeakingButton}>
                <Volume2 size={20} color="#DC2626" />
                <Text style={styles.stopSpeakingText}>Detener</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      <TouchableOpacity
        onPress={isListening ? stopListening : (isExpanded ? startListening : toggleExpand)}
        activeOpacity={0.8}
        style={styles.floatingButton}
      >
        <Animated.View
          style={[
            styles.buttonContent,
            {
              transform: [{ scale: isListening ? scaleAnim : pulseAnim }],
            },
          ]}
        >
          {isListening ? (
            <View style={styles.listeningIndicator}>
              <Mic size={28} color="#FFFFFF" />
            </View>
          ) : (
            <Mic size={28} color="#FFFFFF" />
          )}
        </Animated.View>
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
    width: 64,
    height: 64,
    borderRadius: 32,
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
  listeningIndicator: {
    backgroundColor: '#DC2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    position: 'absolute',
    bottom: 80,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 16,
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
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: '#F3F4F6',
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
    fontSize: 12,
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
  stopSpeakingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  stopSpeakingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
});
