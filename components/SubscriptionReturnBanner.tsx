import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AlertCircle, Check, Clock, Shield, Sparkles } from 'lucide-react-native';
import { Card } from './ui/Card';
import {
  getSubscriptionReturnCopy,
  getSubscriptionReturnTone,
} from '@/utils/subscriptionReturn';

type SubscriptionReturnBannerProps = {
  scope?: string | string[] | null;
  status?: string | string[] | null;
  message?: string | string[] | null;
  style?: StyleProp<ViewStyle>;
};

const getIcon = (status?: string | string[] | null) => {
  const normalized = String(Array.isArray(status) ? status[0] : status || '').toLowerCase();

  if (normalized === 'active') return Check;
  if (normalized === 'trialing') return Sparkles;
  if (normalized === 'pending') return Clock;
  if (normalized === 'paused') return Shield;
  if (normalized === 'cancelled' || normalized === 'expired' || normalized === 'past_due') {
    return AlertCircle;
  }

  return Shield;
};

export const SubscriptionReturnBanner = ({
  scope,
  status,
  message,
  style,
}: SubscriptionReturnBannerProps) => {
  const copy = getSubscriptionReturnCopy(status, scope, message);
  const tone = getSubscriptionReturnTone(copy.status);
  const Icon = getIcon(copy.status);

  return (
    <Card style={[styles.card, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: tone.iconBackgroundColor }]}>
          <Icon size={18} color={tone.accentColor} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: tone.accentColor }]}>{copy.title}</Text>
          <Text style={[styles.message, { color: tone.textColor }]}>{copy.message}</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
  },
});
