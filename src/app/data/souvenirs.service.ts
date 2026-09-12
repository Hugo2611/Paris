import { Injectable, computed, signal } from '@angular/core';
import { MemoryRow, SupabaseService } from '../core/supabase.service';
import { Souvenir, MediaItem } from './souvenirs.data';

export interface MemorySavePayload { 
  souvenir: Souvenir; 
  files?: File[]; 
  onProgress?: (msg: string) => void;
}

async function compressImageIfPossible(file: File): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
  
  // On ne compresse pas les vidéos ni les petits fichiers (< 800 Ko)
  if (!isImage || file.size < 800 * 1024) return file;

  try {
    let source: ImageBitmap | HTMLImageElement;
    if (typeof createImageBitmap !== 'undefined') {
      source = await createImageBitmap(file);
    } else {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }

    const maxDimension = 1920;
    let width = source.width;
    let height = source.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('Compression échouée, utilisation du fichier original:', err);
    return file;
  }
}

@Injectable({ providedIn: 'root' })
export class SouvenirsService {
  private readonly items = signal<Souvenir[]>([]);
  readonly souvenirs = computed(() => this.items());

  constructor(private readonly supabase: SupabaseService) {}

  async load(): Promise<void> {
    const rows = await this.supabase.listMemories();
    this.items.set(await Promise.all(rows.map((row) => this.toSouvenir(row))));
  }

  async create(payload: MemorySavePayload): Promise<void> {
    const files = payload.files || [];
    if (files.length === 0) throw new Error('Ajoutez au moins un média.');
    
    const user = (await this.supabase.client.auth.getUser()).data.user;
    if (!user) throw new Error('Session expirée. Veuillez vous reconnecter.');

    // 1. Optimisation des fichiers (compression légère pour mobile)
    const optimizedFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      payload.onProgress?.(`Préparation média ${i + 1}/${files.length}…`);
      optimizedFiles.push(await compressImageIfPossible(files[i]));
    }

    // 2. Upload séquentiel fiable avec suivi de progression
    const uploadedMedia: { path: string; type: 'image' | 'video' }[] = [];
    for (let i = 0; i < optimizedFiles.length; i++) {
      payload.onProgress?.(`Envoi ${i + 1}/${optimizedFiles.length}…`);
      const res = await this.supabase.uploadMedia(optimizedFiles[i], user.id);
      uploadedMedia.push(res);
    }

    payload.onProgress?.('Enregistrement en base…');
    const mediaJson = uploadedMedia.map(m => ({ url: m.path, type: m.type }));

    try { 
      // 3. Sauvegarde dans la base de données
      await this.supabase.insertMemory(this.toRow(payload.souvenir, mediaJson)); 
    } catch (error) { 
      // Rollback de sécurité : on supprime les fichiers si la DB a planté
      await Promise.all(uploadedMedia.map(m => this.supabase.deleteMedia(m.path))); 
      throw error; 
    }
    await this.load();
  }

  async edit(payload: MemorySavePayload): Promise<void> {
    const current = payload.souvenir;
    const originalSouvenir = this.items().find(s => s.id === current.id);
    let mediaJson = (current.media || []).map(m => ({ url: m.path, type: m.type as 'image' | 'video' }));
    let newlyUploaded: { path: string; type: 'image' | 'video' }[] = [];

    // Si on ajoute de nouveaux fichiers lors de l'édition
    if (payload.files && payload.files.length > 0) {
      const user = (await this.supabase.client.auth.getUser()).data.user;
      if (!user) throw new Error('Session expirée. Veuillez vous reconnecter.');

      for (let i = 0; i < payload.files.length; i++) {
        payload.onProgress?.(`Envoi média ${i + 1}/${payload.files.length}…`);
        const opt = await compressImageIfPossible(payload.files[i]);
        const res = await this.supabase.uploadMedia(opt, user.id);
        newlyUploaded.push(res);
      }
      mediaJson = [...mediaJson, ...newlyUploaded.map(m => ({ url: m.path, type: m.type as 'image' | 'video' }))];
    }

    if (mediaJson.length === 0) throw new Error('Un souvenir doit avoir au moins un média.');

    payload.onProgress?.('Mise à jour en base…');
    try {
      await this.supabase.updateMemory(current.id, this.toRow(current, mediaJson));

      // Nettoyage dans le Storage des médias retirés lors de l'édition
      if (originalSouvenir?.media && originalSouvenir.media.length > 0) {
        const keptPaths = new Set((current.media || []).map(m => m.path));
        const removed = originalSouvenir.media.filter(m => !keptPaths.has(m.path));
        if (removed.length > 0) {
          await Promise.allSettled(removed.map(m => this.supabase.deleteMedia(m.path)));
        }
      }
    } catch (error) {
      if (newlyUploaded.length > 0) await Promise.all(newlyUploaded.map(m => this.supabase.deleteMedia(m.path)));
      throw error;
    }
    await this.load();
  }

  async remove(memory: Souvenir): Promise<void> {
    await this.supabase.deleteMemory(memory.id);
    // On supprime TOUTES les photos de ce souvenir dans le Storage Supabase
    if (memory.media && memory.media.length > 0) {
      await Promise.all(memory.media.map(m => this.supabase.deleteMedia(m.path)));
    }
    await this.load();
  }

  private async toSouvenir(row: MemoryRow): Promise<Souvenir> {
    // Rétrocompatibilité : on lit le JSON, ou on récupère l'ancienne photo si le JSON n'existe pas encore
    const rawMedia = row.media || (row.media_url ? [{ url: row.media_url, type: row.media_type || 'image' }] : []);
    
    // On génère les URLs signées pour tous les médias
    const mediaItems: MediaItem[] = await Promise.all(
      rawMedia.map(async (m) => ({
        path: m.url,
        type: m.type as 'image' | 'video',
        url: await this.supabase.signedMediaUrl(m.url)
      }))
    );

    return { 
      id: row.id, 
      title: row.title, 
      description: row.description, 
      coordinates: [row.lat, row.lng], 
      date: row.date, 
      media: mediaItems 
    };
  }

  private toRow(souvenir: Souvenir, media: {url: string, type: 'image'|'video'}[]): Omit<MemoryRow, 'id'> {
    return { 
      lat: souvenir.coordinates[0], 
      lng: souvenir.coordinates[1], 
      title: souvenir.title, 
      description: souvenir.description, 
      date: souvenir.date, 
      media: media,
      // On met des valeurs neutres pour les anciennes colonnes si elles existent encore dans la table
      media_url: media[0]?.url || '',
      media_type: media[0]?.type || 'image'
    };
  }
}