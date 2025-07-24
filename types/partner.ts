export interface PartnerProfile {
  id: string;
  userId: string;
  businessName: string;
  businessType: 'veterinary' | 'grooming' | 'walking' | 'boarding' | 'shop' | 'shelter';
  description: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  images: string[];
  isActive: boolean;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerService {
  id: string;
  partnerId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration?: number; // in minutes
  isActive: boolean;
  images: string[];
  createdAt: Date;
}

export interface PartnerSchedule {
  id: string;
  partnerId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  slotDuration: number; // in minutes
  maxSlots: number;
  isActive: boolean;
}

export interface PartnerProduct {
  id: string;
  partnerId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface PartnerBooking {
  id: string;
  partnerId: string;
  serviceId: string;
  customerId: string;
  petId: string;
  date: Date;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  totalAmount: number;
  createdAt: Date;
}

export interface PartnerOrder {
  id: string;
  partnerId: string;
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  shippingAddress: string;
  createdAt: Date;
}

export interface AdoptionPet {
  id: string;
  partnerId: string; // shelter/rescue partner
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  age: number;
  gender: 'male' | 'female';
  size: 'small' | 'medium' | 'large';
  description: string;
  healthStatus: string;
  isVaccinated: boolean;
  isNeutered: boolean;
  images: string[];
  isAvailable: boolean;
  adoptionFee: number;
  createdAt: Date;
}