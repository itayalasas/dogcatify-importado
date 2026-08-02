import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function ConfigureScheduleRedirect() {
  const params = useLocalSearchParams<{ partnerId?: string | string[] }>();

  useEffect(() => {
    const partnerId = Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId;

    router.replace(
      partnerId
        ? {
            pathname: '/partner/configure-schedule-page',
            params: { partnerId },
          }
        : '/partner/configure-schedule-page'
    );
  }, [params.partnerId]);

  return null;
}
