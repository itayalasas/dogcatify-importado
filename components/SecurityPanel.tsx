import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Shield, AlertTriangle, CheckCircle, XCircle, Search, Filter, Download } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { colors, radius, spacing } from '../constants/theme';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  status: 'success' | 'error' | 'warning';
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  error_message: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface SecurityStats {
  total_actions: number;
  unique_users: number;
  errors: number;
  login_attempts: number;
  login_failures: number;
}

export default function SecurityPanel() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'warning'>('all');
  const [filterAction, setFilterAction] = useState('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Verificar que el usuario sea admin
  useEffect(() => {
    if (currentUser) {
      checkAdminPermission();
    }
  }, [currentUser]);

  const checkAdminPermission = async () => {
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', currentUser?.id)
        .single();

      if (profile?.role !== 'admin') {
        // No es admin, redirigir
        console.error('Acceso denegado: No eres administrador');
      }
    } catch (error) {
      console.error('Error verificando permisos:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [timeRange, filterStatus, filterAction]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const hoursMap = {
        '24h': 24,
        '7d': 168,
        '30d': 720
      };
      
      let query = supabaseClient
        .from('audit_logs_with_user')
        .select('*')
        .gte('created_at', new Date(Date.now() - hoursMap[timeRange] * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const hoursMap = {
        '24h': 24,
        '7d': 168,
        '30d': 720
      };

      const { data, error } = await supabaseClient
        .rpc('get_audit_stats', {
          time_range: `${hoursMap[timeRange]} hours`
        });

      if (error) throw error;
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} color={colors.success} />;
      case 'error':
        return <XCircle size={16} color={colors.danger} />;
      case 'warning':
        return <AlertTriangle size={16} color={colors.warning} />;
      default:
        return null;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('ERROR')) {
      return colors.danger;
    }
    if (action.includes('LOGIN') || action.includes('LOGOUT')) {
      return colors.primary;
    }
    if (action.includes('PAYMENT')) {
      return colors.success;
    }
    if (action.includes('ADMIN')) {
      return colors.info;
    }
    return colors.textSecondary;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      log.resource_type?.toLowerCase().includes(search) ||
      log.resource_id?.toLowerCase().includes(search)
    );
  });

  const exportLogs = () => {
    // Exportar logs a CSV
    const csv = [
      ['Fecha', 'Usuario', 'Acción', 'Estado', 'Recurso', 'Detalles'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.user_email || 'Anónimo',
        log.action,
        log.status,
        `${log.resource_type || ''} ${log.resource_id || ''}`,
        log.error_message || JSON.stringify(log.details)
      ].join(','))
    ].join('\n');

    console.log('Exportar CSV:', csv);
    // Aquí podrías implementar la descarga del archivo
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Shield size={32} color={colors.primary} />
          <Text style={styles.title} accessibilityRole="header">Panel de seguridad</Text>
        </View>
        <Text style={styles.subtitle}>
          Monitoreo de actividad y auditoría del sistema
        </Text>
      </View>

      {/* Estadísticas */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_actions}</Text>
            <Text style={styles.statLabel}>Acciones totales</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.unique_users}</Text>
            <Text style={styles.statLabel}>Usuarios únicos</Text>
          </View>
          <View style={[styles.statCard, styles.errorCard]}>
            <Text style={[styles.statValue, styles.errorText]}>{stats.errors}</Text>
            <Text style={styles.statLabel}>Errores</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.login_attempts - stats.login_failures}/{stats.login_attempts}
            </Text>
            <Text style={styles.statLabel}>Ingresos exitosos</Text>
          </View>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar registros..."
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Buscar registros"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Período:</Text>
            <View style={styles.filterButtons}>
              {(['24h', '7d', '30d'] as const).map(range => (
                <TouchableOpacity
                  key={range}
                  style={[styles.filterButton, timeRange === range && styles.filterButtonActive]}
                  onPress={() => setTimeRange(range)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: timeRange === range }}
                >
                  <Text style={[styles.filterButtonText, timeRange === range && styles.filterButtonTextActive]}>
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Estado:</Text>
            <View style={styles.filterButtons}>
              {(['all', 'success', 'error', 'warning'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
                  onPress={() => setFilterStatus(status)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filterStatus === status }}
                >
                  <Text style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}>
                    {status === 'all' ? 'Todos' : status === 'success' ? 'Éxito' : status === 'error' ? 'Error' : 'Aviso'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.exportButton} onPress={exportLogs} accessibilityRole="button">
          <Download size={20} color={colors.primary} />
          <Text style={styles.exportButtonText}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Logs */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.logsContainer}>
          {filteredLogs.map(log => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logStatus}>
                  {getStatusIcon(log.status)}
                  <Text style={[styles.logAction, { color: getActionColor(log.action) }]}>
                    {log.action}
                  </Text>
                </View>
                <Text style={styles.logTime}>
                  {new Date(log.created_at).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </Text>
              </View>

              <View style={styles.logBody}>
                <Text style={styles.logUser}>
                  Usuario: {log.user_email || 'Anónimo'}
                </Text>
                {log.resource_type && (
                  <Text style={styles.logResource}>
                    Recurso: {log.resource_type} {log.resource_id && `(${log.resource_id.slice(0, 8)}...)`}
                  </Text>
                )}
                {log.error_message && (
                  <Text style={styles.logError}>Error: {log.error_message}</Text>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <Text style={styles.logDetails}>
                    Detalles: {JSON.stringify(log.details).slice(0, 100)}...
                  </Text>
                )}
              </View>
            </View>
          ))}

          {filteredLogs.length === 0 && (
            <View style={styles.emptyState}>
              <AlertTriangle size={48} color={colors.textTertiary} />
              <Text style={styles.emptyStateText}>No se encontraron registros</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  errorCard: {
    backgroundColor: colors.dangerSoft
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs
  },
  errorText: {
    color: colors.danger
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center'
  },
  filtersContainer: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.lg
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.text
  },
  filterRow: {
    gap: spacing.lg
  },
  filterGroup: {
    gap: spacing.sm
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary
  },
  filterButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textTertiary,
    textTransform: 'capitalize'
  },
  filterButtonTextActive: {
    color: colors.white,
    fontWeight: '600'
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface
  },
  exportButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  loader: {
    marginTop: 40
  },
  logsContainer: {
    padding: spacing.lg,
    gap: spacing.md
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  logStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600'
  },
  logTime: {
    fontSize: 12,
    color: colors.textTertiary
  },
  logBody: {
    gap: 6
  },
  logUser: {
    fontSize: 13,
    color: colors.textSecondary
  },
  logResource: {
    fontSize: 13,
    color: colors.textTertiary
  },
  logError: {
    fontSize: 13,
    color: colors.danger
  },
  logDetails: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: 'monospace'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyStateText: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.textTertiary
  }
});
