/** Etiquetas en español para categorías de lugares y tipos de negocio. */

const PLACE_CATEGORY_LABELS: Record<string, string> = {
  park: 'Parque',
  parks: 'Parques',
  restaurant: 'Restaurante',
  restaurants: 'Restaurantes',
  hotel: 'Hotel',
  hotels: 'Hoteles',
  store: 'Tienda',
  stores: 'Tiendas',
  shop: 'Tienda',
  shopping: 'Compras',
  mall: 'Centro comercial',
  beach: 'Playa',
  beaches: 'Playas',
  cafe: 'Cafetería',
  coffee: 'Cafetería',
  bar: 'Bar',
  vet: 'Veterinaria',
  veterinary: 'Veterinaria',
  grooming: 'Peluquería',
  boarding: 'Pensión',
  walking: 'Paseo',
  shelter: 'Refugio',
  pet_store: 'Tienda de mascotas',
  petshop: 'Tienda de mascotas',
  entertainment: 'Entretenimiento',
  nature: 'Naturaleza',
  outdoor: 'Aire libre',
  plaza: 'Plaza',
  services: 'Servicios',
  other: 'Otro',
};

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/** "shopping" → "Compras". Si no hay traducción, devuelve el texto con mayúscula inicial. */
export const getPlaceCategoryLabel = (category?: string | null): string => {
  if (!category) return 'Lugar';
  const key = category.trim().toLowerCase();
  return PLACE_CATEGORY_LABELS[key] ?? capitalize(category.trim().replace(/_/g, ' '));
};

/** Etiqueta del tipo de negocio de un aliado (veterinary → Veterinaria). */
export const getBusinessTypeLabel = (type?: string | null): string => {
  switch (type) {
    case 'veterinary':
      return 'Veterinaria';
    case 'grooming':
      return 'Peluquería';
    case 'boarding':
      return 'Pensión';
    case 'walking':
      return 'Paseo';
    case 'shelter':
      return 'Albergue';
    default:
      return 'Servicio';
  }
};

