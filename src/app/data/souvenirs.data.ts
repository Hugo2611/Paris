export type UserRole = 'admin' | 'viewer';

export interface MediaItem {
  path: string;
  type: 'image' | 'video';
  url: string; // L'URL signée pour afficher l'image/vidéo
}

export interface Souvenir {
  id: string;
  title: string;
  description: string;
  coordinates: [number, number];
  date: string;
  media: MediaItem[]; // 👈 La grande nouveauté : un tableau de médias !
}

export const SOUVENIRS: Souvenir[] = [];