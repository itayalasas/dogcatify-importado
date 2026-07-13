export type PartnerDisplayData = {
  id: string;
  businessName: string;
  businessAddress: string;
  phone: string;
  logo: string | null;
  description: string;
  businessType: string | null;
};

const cleanText = (value: unknown) => String(value || '').trim();

const buildBusinessAddress = (partner: any) => {
  const directAddress = cleanText(
    partner?.businessAddress ||
      partner?.address ||
      partner?.location
  );

  if (directAddress) {
    return directAddress;
  }

  const street = cleanText(partner?.calle);
  const number = cleanText(partner?.numero);
  const neighborhood = cleanText(partner?.barrio);

  const streetLine = [street, number].filter(Boolean).join(' ').trim();
  const addressParts = [streetLine, neighborhood].filter(Boolean);

  return addressParts.join(', ');
};

export const normalizePartnerDisplayData = (partner: any): PartnerDisplayData => ({
  id: cleanText(partner?.id),
  businessName: cleanText(partner?.businessName || partner?.business_name) || 'Tienda',
  businessAddress: buildBusinessAddress(partner),
  phone: cleanText(partner?.phone || partner?.business_phone || partner?.contact_phone),
  logo: partner?.logo || partner?.business_logo || null,
  description: cleanText(partner?.description),
  businessType: cleanText(partner?.businessType || partner?.business_type) || null,
});
