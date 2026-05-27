export interface Station {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  chargerType: 'CCS2 Fast' | 'Type 2 AC';
  pricing: number;
  isAvailable: boolean;
  ownerId?: string;
  ownerEmail?: string;
  slots?: string[];
}

export interface Booking {
  id: string;
  stationId: string;
  stationName?: string;
  userId: string;
  userEmail: string;
  slotTime: string;
  status: 'pending' | 'confirmed' | 'completed';
  createdAt: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  points: number;
  createdAt: number;
}