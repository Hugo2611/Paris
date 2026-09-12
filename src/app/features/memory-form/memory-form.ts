import { Component, OnDestroy, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Souvenir } from '../../data/souvenirs.data';
import { MemorySavePayload } from '../../data/souvenirs.service';
import exifr from 'exifr';

export interface MediaPreview {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  name: string;
}

@Component({
  selector: 'app-memory-form',
  imports: [FormsModule],
  templateUrl: './memory-form.html',
})
export class MemoryForm implements OnInit, OnDestroy {
  readonly souvenir = input<Souvenir | null>(null);
  readonly isSaving = input(false);
  readonly saveProgress = input<string>('');
  readonly externalError = input<string | null>(null);

  readonly save = output<MemorySavePayload>();
  readonly cancel = output<void>();
  readonly pickLocation = output<Souvenir>();
  
  model: Souvenir = this.blank();
  lat: number = 48.8566;
  lng: number = 2.3522;

  readonly mediaFiles = signal<File[]>([]);
  readonly previews = signal<MediaPreview[]>([]);
  readonly error = signal<string | null>(null);

  ngOnInit(): void { 
    this.model = this.souvenir() 
      ? { ...this.souvenir()!, media: [...(this.souvenir()!.media || [])] } 
      : this.blank(); 
    this.lat = this.model.coordinates ? this.model.coordinates[0] : 48.8566;
    this.lng = this.model.coordinates ? this.model.coordinates[1] : 2.3522;
  }

  ngOnDestroy(): void {
    // Nettoyage des URLs d'aperçu pour éviter les fuites de mémoire
    this.previews().forEach(p => URL.revokeObjectURL(p.previewUrl));
  }
  
  async selectImage(event: Event): Promise<void> { 
    await this.selectFiles(event, 'image'); 
  }

  async selectVideo(event: Event): Promise<void> { 
    await this.selectFiles(event, 'video'); 
  }

  removeFile(index: number): void {
    const list = this.previews();
    const target = list[index];
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    const updated = list.filter((_, i) => i !== index);
    this.previews.set(updated);
    this.mediaFiles.set(updated.map(p => p.file));
  }

  removeExistingMedia(index: number): void {
    if (this.model.media) {
      this.model.media = this.model.media.filter((_, i) => i !== index);
    }
  }

  submit(): void {
    this.error.set(null);
    if (this.isSaving()) return;

    if (!this.model.title || !this.model.title.trim()) { 
      this.error.set('Veuillez renseigner un titre pour ce souvenir.'); 
      return; 
    }

    const hasExistingMedia = this.model.media && this.model.media.length > 0;
    const hasNewMedia = this.mediaFiles().length > 0;

    if (!hasExistingMedia && !hasNewMedia) { 
      this.error.set('Ajoutez ou conservez au moins une photo ou une vidéo.'); 
      return; 
    }

    // Assure un format de date propre
    const dateVal = this.model.date?.trim() || new Date().toISOString().slice(0, 10);

    this.save.emit({ 
      souvenir: { 
        ...this.model,
        date: dateVal,
        coordinates: [+this.lat, +this.lng] 
      }, 
      files: this.mediaFiles() 
    });
  }

  chooseLocation(): void {
    this.pickLocation.emit({ 
      ...this.model, 
      coordinates: [+this.lat, +this.lng] 
    });
  }

  private async selectFiles(event: Event, kind: 'image' | 'video'): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const filesList = inputEl.files;
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        this.error.set('Chaque fichier doit faire 100 Mo maximum.');
        return;
      }
    }

    this.error.set(null);

    // Création des aperçus
    const newPreviews: MediaPreview[] = files.map(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isVideo = file.type.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
      let previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = '';
      }
      return {
        file,
        previewUrl,
        type: isVideo ? 'video' : 'image',
        name: file.name
      };
    });

    this.previews.update(current => [...current, ...newPreviews]);
    this.mediaFiles.update(current => [...current, ...files]);

    inputEl.value = '';

    // --- Extraction EXIF (GPS et Date) de la première image ---
    if (kind === 'image' && files.length > 0) {
      try {
        const exifData = await exifr.parse(files[0]);
        if (exifData) {
          if (exifData.latitude != null && exifData.longitude != null && !isNaN(exifData.latitude) && !isNaN(exifData.longitude)) {
            this.lat = exifData.latitude;
            this.lng = exifData.longitude;
            this.model.coordinates = [this.lat, this.lng];
          }
          if (exifData.DateTimeOriginal) {
            const d = new Date(exifData.DateTimeOriginal);
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              this.model.date = `${year}-${month}-${day}`;
            }
          }
        }
      } catch (err) {
        console.warn('Pas de données EXIF exploitables.', err);
      }
    }
  }

  private blank(): Souvenir { 
    return { 
      id: '', 
      title: '', 
      description: '', 
      coordinates: [48.8566, 2.3522], 
      media: [], 
      date: new Date().toISOString().slice(0, 10) 
    }; 
  }
}