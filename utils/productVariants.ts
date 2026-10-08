import * as Crypto from 'expo-crypto';

type VariantProduct = {
  id: string;
  variant_group_id?: string | null;
  price: number;
  discountedPrice?: number | null;
  stock?: number | null;
};

export const generateVariantGroupId = () => Crypto.randomUUID();

const effectivePrice = (product: VariantProduct) =>
  Number(product.discountedPrice ?? product.price) || 0;

// Presentations of the same product (same variant_group_id) collapse into one
// listing entry. The representative is the cheapest presentation that is in
// stock (or the cheapest overall if none is), so the card's "desde" price is
// something a customer can actually buy.
export const groupProductsByVariant = <T extends VariantProduct>(products: T[]) => {
  const seenGroups = new Map<string, T[]>();
  const result: Array<T & { variantCount: number }> = [];
  const emitted = new Set<string>();

  products.forEach((product) => {
    if (!product.variant_group_id) return;
    const members = seenGroups.get(product.variant_group_id) || [];
    members.push(product);
    seenGroups.set(product.variant_group_id, members);
  });

  products.forEach((product) => {
    const groupId = product.variant_group_id;

    if (!groupId) {
      result.push({ ...product, variantCount: 1 });
      return;
    }

    if (emitted.has(groupId)) return;
    emitted.add(groupId);

    const members = seenGroups.get(groupId) || [product];
    const inStock = members.filter((member) => (member.stock ?? 0) > 0);
    const pool = inStock.length > 0 ? inStock : members;
    const representative = pool.reduce((best, member) =>
      effectivePrice(member) < effectivePrice(best) ? member : best,
    );

    result.push({ ...representative, variantCount: members.length });
  });

  return result;
};
