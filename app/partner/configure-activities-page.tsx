import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function ConfigureActivitiesPageRedirect() {
  const params = useLocalSearchParams<{ partnerId?: string | string[]; businessType?: string | string[] }>();

  useEffect(() => {
    const partnerId = Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId;
    const businessType = Array.isArray(params.businessType) ? params.businessType[0] : params.businessType;

    if (partnerId && businessType === 'shelter') {
      router.replace({
        pathname: '/partner/manage-adoptions',
        params: { partnerId },
      });
      return;
    }

    router.replace(
      partnerId
        ? {
            pathname: '/partner/configure-activities',
            params: {
              partnerId,
              ...(businessType ? { businessType } : {}),
            },
          }
        : '/partner/configure-activities'
    );
  }, [params.partnerId, params.businessType]);

  return null;
}
