import { Injectable, computed, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { UserRole } from '../data/souvenirs.data';

export interface SessionUser { username: string; role: UserRole; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly current = signal<SessionUser | null>(null);
  readonly ready: Promise<void>;
  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly isAdmin = computed(() => this.current()?.role === 'admin');

  constructor(private readonly supabase: SupabaseService) {
    this.ready = this.restore();
    this.supabase.onAuthStateChange((_event, session) => this.setSession(session));
  }

  async login(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    this.setSession(data.session);
    return null;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.current.set(null);
  }

  private async restore(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (error) {
        this.current.set(null);
        return;
      }
      this.setSession(data.session);
    } catch {
      this.current.set(null);
    }
  }

  private setSession(session: Session | null): void {
    const user = session?.user;
    if (!user) { this.current.set(null); return; }
    const role = user.app_metadata?.['role'] === 'admin' ? 'admin' : 'viewer';
    const username = user.user_metadata?.['display_name'] || user.email?.split('@')[0] || 'Utilisateur';
    this.current.set({ username, role });
  }
}

