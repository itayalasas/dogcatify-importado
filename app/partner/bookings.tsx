import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function PartnerBookingsRedirect() {
  const params = useLocalSearchParams<{ businessId?: string | string[]; partnerId?: string | string[] }>();

  useEffect(() => {
    const businessId = Array.isArray(params.businessId) ? params.businessId[0] : params.businessId;
    const partnerId = Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId;
    const resolvedBusinessId = businessId || partnerId;

    router.replace(
      resolvedBusinessId
        ? {
            pathname: '/(partner-tabs)/bookings',
            params: { businessId: resolvedBusinessId },
          }
        : '/(partner-tabs)/bookings'
    );
  }, [params.businessId, params.partnerId]);

  return null;
}
