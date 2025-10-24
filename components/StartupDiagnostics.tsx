import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface DiagnosticStep {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
}

let diagnosticsData: DiagnosticStep[] = [];

export function logDiagnostic(name: string, status: 'success' | 'error', message?: string) {
  const step: DiagnosticStep = {
    name,
    status,
    message,
    timestamp: Date.now(),
  };
  diagnosticsData.push(step);
  console.log(`[DIAGNOSTIC] ${name}: ${status}${message ? ` - ${message}` : ''}`);
}

export function StartupDiagnostics() {
  const [steps, setSteps] = useState<DiagnosticStep[]>([]);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    logDiagnostic('StartupDiagnostics', 'success', 'Component mounted');

    // Update diagnostics every 500ms
    const interval = setInterval(() => {
      setSteps([...diagnosticsData]);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = () => {
    return ((Date.now() - startTime) / 1000).toFixed(1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Diagnóstico de Inicio</Text>
        <Text style={styles.time}>Tiempo: {getElapsedTime()}s</Text>
      </View>
      <ScrollView style={styles.list}>
        {steps.map((step, index) => (
          <View key={index} style={styles.step}>
            <Text style={styles.stepStatus}>
              {step.status === 'success' ? '✅' : step.status === 'error' ? '❌' : '⏳'}
            </Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepName}>{step.name}</Text>
              {step.message && <Text style={styles.stepMessage}>{step.message}</Text>}
            </View>
          </View>
        ))}
        {steps.length === 0 && (
          <Text style={styles.empty}>Esperando información de diagnóstico...</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#2D6A6F',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D6A6F',
    marginBottom: 5,
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stepStatus: {
    fontSize: 20,
    marginRight: 10,
  },
  stepContent: {
    flex: 1,
  },
  stepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepMessage: {
    fontSize: 12,
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
});
