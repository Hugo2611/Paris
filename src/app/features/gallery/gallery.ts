import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SouvenirsService } from '../../data/souvenirs.service';
import { MediaItem, Souvenir } from '../../data/souvenirs.data';

export interface GalleryItem {
  media: MediaItem;
  souvenir: Souvenir;
}

export type GalleryFilter = 'all' | 'image' | 'video';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  templateUrl: './gallery.html',
})
export class Gallery implements OnInit {
  readonly items = signal<GalleryItem[]>([]);
  readonly loading = signal(true);
  readonly activeFilter = signal<GalleryFilter>('all');
  readonly selectedItem = signal<GalleryItem | null>(null);

  readonly filteredItems = computed(() => {
    const filter = this.activeFilter();
    const all = this.items();
    if (filter === 'all') return all;
    return all.filter(item => item.media.type === filter);
  });

  readonly totalImages = computed(() => 
    this.items().filter(item => item.media.type === 'image').length
  );

  readonly totalVideos = computed(() => 
    this.items().filter(item => item.media.type === 'video').length
  );

  constructor(private readonly souvenirsService: SouvenirsService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.souvenirsService.load();
      const allItems: GalleryItem[] = [];
      for (const souvenir of this.souvenirsService.souvenirs()) {
        for (const media of souvenir.media) {
          allItems.push({ media, souvenir });
        }
      }
      this.items.set(allItems);
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(filter: GalleryFilter): void {
    this.activeFilter.set(filter);
  }

  openMedia(item: GalleryItem): void {
    this.selectedItem.set(item);
  }

  closeMedia(): void {
    this.selectedItem.set(null);
  }
}