import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Shield, AlertTriangle, CheckCircle, XCircle, Search, Filter, Download } from 'lucide-react-native';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
      }
    } catch (error) {
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
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} color="#10B981" />;
      case 'error':
        return <XCircle size={16} color="#EF4444" />;
      case 'warning':
        return <AlertTriangle size={16} color="#F59E0B" />;
      default:
        return null;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('ERROR')) {
      return '#EF4444';
    }
    if (action.includes('LOGIN') || action.includes('LOGOUT')) {
      return '#3B82F6';
    }
    if (action.includes('PAYMENT')) {
      return '#10B981';
    }
    if (action.includes('ADMIN')) {
      return '#8B5CF6';
    }
    return '#6B7280';
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

    // Aquí podrías implementar la descarga del archivo
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Shield size={32} color="#3B82F6" />
          <Text style={styles.title}>Panel de Seguridad</Text>
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
            <Text style={styles.statLabel}>Acciones Totales</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.unique_users}</Text>
            <Text style={styles.statLabel}>Usuarios Únicos</Text>
          </View>
          <View style={[styles.statCard, styles.errorCard]}>
            <Text style={[styles.statValue, styles.errorText]}>{stats.errors}</Text>
            <Text style={styles.statLabel}>Errores</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.login_attempts - stats.login_failures}/{stats.login_attempts}
            </Text>
            <Text style={styles.statLabel}>Logins Exitosos</Text>
          </View>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar logs..."
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
                >
                  <Text style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}>
                    {status === 'all' ? 'Todos' : status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.exportButton} onPress={exportLogs}>
          <Download size={20} color="#3B82F6" />
          <Text style={styles.exportButtonText}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Logs */}
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
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
                  👤 {log.user_email || 'Anónimo'}
                </Text>
                {log.resource_type && (
                  <Text style={styles.logResource}>
                    📁 {log.resource_type} {log.resource_id && `(${log.resource_id.slice(0, 8)}...)`}
                  </Text>
                )}
                {log.error_message && (
                  <Text style={styles.logError}>❌ {log.error_message}</Text>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <Text style={styles.logDetails}>
                    ℹ️ {JSON.stringify(log.details).slice(0, 100)}...
                  </Text>
                )}
              </View>
            </View>
          ))}

          {filteredLogs.length === 0 && (
            <View style={styles.emptyState}>
              <AlertTriangle size={48} color="#6B7280" />
              <Text style={styles.emptyStateText}>No se encontraron logs</Text>
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
    backgroundColor: '#F9FAFB'
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827'
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280'
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  errorCard: {
    backgroundColor: '#FEF2F2'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  errorText: {
    color: '#EF4444'
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center'
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
    gap: 16
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827'
  },
  filterRow: {
    gap: 16
  },
  filterGroup: {
    gap: 8
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6'
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize'
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF'
  },
  exportButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600'
  },
  loader: {
    marginTop: 40
  },
  logsContainer: {
    padding: 16,
    gap: 12
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
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
    marginBottom: 12
  },
  logStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600'
  },
  logTime: {
    fontSize: 12,
    color: '#6B7280'
  },
  logBody: {
    gap: 6
  },
  logUser: {
    fontSize: 13,
    color: '#374151'
  },
  logResource: {
    fontSize: 13,
    color: '#6B7280'
  },
  logError: {
    fontSize: 13,
    color: '#EF4444'
  },
  logDetails: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'monospace'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280'
  }
});
