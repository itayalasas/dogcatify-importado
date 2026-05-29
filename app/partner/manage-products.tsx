import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function ManageProductsRedirect() {
  const params = useLocalSearchParams<{ partnerId?: string | string[]; businessId?: string | string[] }>();

  useEffect(() => {
    const partnerId = Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId;
    const businessId = Array.isArray(params.businessId) ? params.businessId[0] : params.businessId;
    const resolvedBusinessId = partnerId || businessId;

    router.replace(
      resolvedBusinessId
        ? {
            pathname: '/(partner-tabs)/products',
            params: { businessId: resolvedBusinessId },
          }
        : '/(partner-tabs)/products'
    );
  }, [params.partnerId, params.businessId]);

  return null;
}
