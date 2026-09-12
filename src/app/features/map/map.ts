import { AfterViewInit, Component, OnDestroy, computed, signal, NgZone } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AuthService } from '../../core/auth.service';
import { Souvenir } from '../../data/souvenirs.data';
import { MemorySavePayload, SouvenirsService } from '../../data/souvenirs.service';
import { MemoryDetail } from '../memory-detail/memory-detail';
import { MemoryForm } from '../memory-form/memory-form';

@Component({
  selector: 'app-map',
  imports: [MemoryDetail, MemoryForm, RouterLink],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit, OnDestroy {
  readonly selected = signal<Souvenir | null>(null);
  readonly detailOpen = signal(false);
  readonly editing = signal<Souvenir | null | undefined>(undefined);
  readonly menuOpen = signal(false);
  readonly isMobile = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pickingLocation = signal(false);
  private draft?: Souvenir;
  readonly isAdmin = computed(() => this.auth.isAdmin());
  private map?: L.Map;
  private markers = L.layerGroup();
  private breakpointSubscription?: Subscription;

  private lastSelectTime = 0;

  constructor(
    readonly auth: AuthService,
    readonly souvenirsService: SouvenirsService,
    private readonly breakpoints: BreakpointObserver,
    private readonly ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.map = L.map('paris-map', { 
      zoomControl: false,
      attributionControl: false
    }).setView([48.8566, 2.3522], 13);

    // Contrôles de zoom en bas à gauche pour laisser le bas droit au FAB et haut droit au hamburger
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);

    this.markers.addTo(this.map);

    // Détection clic sur carte pour choix de position
    this.map.on('click', (event: L.LeafletMouseEvent) => 
      this.ngZone.run(() => this.setPickedLocation(event.latlng))
    );
    
    this.breakpointSubscription = this.breakpoints.observe([Breakpoints.Handset]).subscribe(({ matches }) => {
      this.isMobile.set(matches);
      if (!matches) this.menuOpen.set(false);
      setTimeout(() => this.map?.invalidateSize());
    });

    void this.loadMemories();
  }

  ngOnDestroy(): void { 
    this.breakpointSubscription?.unsubscribe(); 
    this.map?.remove(); 
  }
  
  select(souvenir: Souvenir): void {
    const now = Date.now();
    // Évite les doubles déclenchements touchstart + click
    if (now - this.lastSelectTime < 300) return;
    this.lastSelectTime = now;

    this.selected.set(souvenir);
    this.detailOpen.set(true);

    // Recentrage intelligent : sur mobile, décaler la carte pour que le pin reste au-dessus de la Bottom Sheet
    if (this.map && souvenir.coordinates) {
      if (this.isMobile()) {
        const offsetLat = souvenir.coordinates[0] - 0.0075;
        this.map.panTo([offsetLat, souvenir.coordinates[1]], { animate: true, duration: 0.45 });
      } else {
        this.map.panTo(souvenir.coordinates, { animate: true, duration: 0.35 });
      }
    }
  }
  
  closeDetail(): void {
    this.detailOpen.set(false);
    setTimeout(() => this.selected.set(null), 300);
  }
  
  readonly isSaving = signal(false);
  readonly saveProgress = signal('');
  readonly saveError = signal<string | null>(null);

  openEditor(souvenir: Souvenir | null = null): void { 
    this.pickingLocation.set(false); 
    this.saveError.set(null);
    this.isSaving.set(false);
    this.saveProgress.set('');
    this.editing.set(souvenir); 
  }

  selectLocation(draft: Souvenir): void { 
    this.draft = draft; 
    this.editing.set(undefined); 
    this.pickingLocation.set(true); 
  }
  
  async delete(souvenir: Souvenir): Promise<void> {
    if (confirm(`Supprimer « ${souvenir.title} » ?`)) {
      try { 
        await this.souvenirsService.remove(souvenir); 
        this.closeDetail(); 
        this.drawMarkers(); 
      } catch (error) { 
        this.error.set(this.message(error)); 
      }
    }
  }
  
  async save(payload: MemorySavePayload): Promise<void> {
    this.isSaving.set(true);
    this.saveProgress.set('Préparation…');
    this.saveError.set(null);

    payload.onProgress = (msg: string) => {
      this.ngZone.run(() => this.saveProgress.set(msg));
    };

    try {
      if (payload.souvenir.id) {
        await this.souvenirsService.edit(payload);
      } else {
        await this.souvenirsService.create(payload);
      }
      this.editing.set(undefined); 
      this.selected.set(null); 
      this.drawMarkers();
    } catch (error) { 
      const errMsg = this.message(error);
      this.saveError.set(errMsg);
      this.error.set(errMsg);
    } finally {
      this.isSaving.set(false);
      this.saveProgress.set('');
    }
  }

  private drawMarkers(): void {
    this.markers.clearLayers();
    const currentSelectedId = this.selected()?.id;

    this.souvenirsService.souvenirs().forEach((souvenir) => {
      const isSelected = souvenir.id === currentSelectedId;
      const marker = L.marker(souvenir.coordinates, { 
        icon: this.markerIcon(isSelected) 
      });
      
      // Écoute instantanée au touchstart et fallback click avec arrêt de propagation
      marker.on('touchstart', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e);
        this.ngZone.run(() => this.select(souvenir));
      });

      marker.on('click', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e);
        this.ngZone.run(() => this.select(souvenir));
      });
      
      marker.addTo(this.markers);
    });
  }

  private async loadMemories(): Promise<void> {
    try { 
      await this.souvenirsService.load(); 
      this.drawMarkers(); 
    } catch (error) { 
      this.error.set(this.message(error)); 
    } finally { 
      this.loading.set(false); 
    }
  }

  private setPickedLocation(latLng: L.LatLng): void {
    if (!this.pickingLocation() || !this.draft) return;
    this.draft = { ...this.draft, coordinates: [latLng.lat, latLng.lng] };
    this.pickingLocation.set(false);
    this.editing.set(this.draft);
  }

  private message(error: unknown): string { 
    return error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.'; 
  }

  private markerIcon(isSelected = false): L.DivIcon {
    const pinSvg = `
      <div class="memory-marker-wrapper">
        <div class="memory-marker-pulse"></div>
        <div class="relative flex items-center justify-center text-rose-600 transition-transform active:scale-125 ${isSelected ? 'scale-110 text-rose-500' : ''}">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-11 filter drop-shadow-[0_4px_6px_rgba(244,63,94,0.35)]">
            <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    `;

    return L.divIcon({ 
      className: 'bg-transparent border-none', 
      html: pinSvg, 
      iconSize: [48, 48],
      iconAnchor: [24, 46]
    });
  }
}