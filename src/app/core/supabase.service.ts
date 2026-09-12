import { Injectable } from '@angular/core';
import { AuthChangeEvent, Session, SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface MemoryRow {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  date: string;
  media_url?: string; // On les garde en optionnel pour ne pas casser l'ancien code
  media_type?: 'image' | 'video';
  media?: { url: string; type: 'image' | 'video' }[]; // 👈 La nouvelle colonne JSONB
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): void {
    this.client.auth.onAuthStateChange((event, session) => callback(event, session));
  }

  async listMemories(): Promise<MemoryRow[]> {
    const { data, error } = await this.client.from('memories').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data as MemoryRow[];
  }

  async uploadMedia(file: File, preloadedUserId?: string): Promise<{ path: string; type: 'image' | 'video' }> {
    let userId = preloadedUserId;
    if (!userId) {
      const user = (await this.client.auth.getUser()).data.user;
      if (!user) throw new Error('Session expirée. Veuillez vous reconnecter.');
      userId = user.id;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', '3gp'].includes(ext);
    const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp'].includes(ext);

    if (!isImage && !isVideo) {
      throw new Error(`Format non pris en charge (${file.name}). Utilisez des photos ou vidéos.`);
    }

    const type: 'image' | 'video' = isVideo ? 'video' : 'image';
    const extension = ext || (type === 'video' ? 'mp4' : 'jpg');
    const contentType = file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');
    
    // Fallback : Si crypto.randomUUID n'est pas dispo (HTTP), on crée un ID avec la date et de l'aléatoire
    const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
      
    const path = `${userId}/${uniqueId}.${extension}`;
    const { error } = await this.client.storage.from('media').upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    return { path, type };
  }

  async signedMediaUrl(path: string): Promise<string> {
    // Validité de 24 heures pour une navigation sereine sans coupure
    const { data, error } = await this.client.storage.from('media').createSignedUrl(path, 60 * 60 * 24);
    if (error) throw error;
    return data.signedUrl;
  }

  async insertMemory(memory: Omit<MemoryRow, 'id'>): Promise<void> {
    const { error } = await this.client.from('memories').insert(memory);
    if (error) throw error;
  }

  async updateMemory(id: string, memory: Omit<MemoryRow, 'id'>): Promise<void> {
    const { error } = await this.client.from('memories').update(memory).eq('id', id);
    if (error) throw error;
  }

  async deleteMemory(id: string): Promise<void> {
    const { error } = await this.client.from('memories').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteMedia(path: string): Promise<void> {
    const { error } = await this.client.storage.from('media').remove([path]);
    if (error) throw error;
  }
}
