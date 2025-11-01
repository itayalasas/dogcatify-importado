export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isOwner: boolean;
  isPartner: boolean;
  createdAt: Date;
  location?: string;
  bio?: string;
  phone?: string;
  followers?: string[];
  following?: string[];
  followersCount?: number;
  followingCount?: number;
}

export interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  breedInfo?: any;
  age: number;
  ageDisplay?: {
    value: number;
    unit: 'years' | 'months' | 'days';
  };
  gender: 'male' | 'female';
  weight: number;
  weightDisplay?: {
    value: number;
    unit: 'kg' | 'lb';
  };
  isNeutered?: boolean;
  hasChip?: boolean;
  chipNumber?: string;
  photoURL: string;
  ownerId: string;
  personality: string[];
  medicalNotes?: string;
  createdAt: Date;
  isShared?: boolean;
  permissionLevel?: 'view' | 'edit' | 'full';
  photo_url?: string;
}

export interface Post {
  id: string;
  userId: string;
  petId: string;
  content: string;
  imageURL: string;
  albumImages?: string[]; // For posts with multiple images
  likes: string[];
  comments: Comment[];
  createdAt: Date;
  author: {
    name: string;
    avatar: string;
  };
  pet: {
    name: string;
    species: string;
  };
  timeAgo: string;
  type?: 'single' | 'album'; // To distinguish post types
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  author?: {
    name: string;
    avatar: string;
  };
  likes?: string[];
  parentId?: string; // For replies
  replies?: Comment[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'food' | 'toys' | 'accessories' | 'health' | 'grooming';
  imageURL: string;
  sellerId: string;
  rating: number;
  reviews: number;
  inStock: boolean;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: 'veterinary' | 'grooming' | 'walking' | 'boarding' | 'hotel' | 'camping';
  price: number;
  duration: number;
  providerId: string;
  rating: number;
  reviews: number;
  imageURL: string;
  partnerLogo?: string;
  location: string;
  availability: string[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}