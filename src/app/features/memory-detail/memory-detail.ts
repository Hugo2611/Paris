import { Component, effect, input, output, signal } from '@angular/core';
import { Souvenir } from '../../data/souvenirs.data';

@Component({
  selector: 'app-memory-detail',
  imports: [],
  templateUrl: './memory-detail.html',
  styleUrl: './memory-detail.css',
})
export class MemoryDetail {
  readonly souvenir = input.required<Souvenir>();
  readonly close = output<void>();
  readonly edit = output<void>();
  readonly delete = output<void>();
  readonly canEdit = input(false);
  readonly open = input(false);

  readonly currentIndex = signal(0);
  readonly sheetDragY = signal(0);
  readonly isDragging = signal(false);

  // Variables pour le swipe du carrousel
  private touchStartX = 0;
  private touchStartY = 0;

  // Variables pour le pull-down de la Bottom Sheet
  private handleStartY = 0;

  constructor() {
    // Réinitialise la photo affichée lors du changement de souvenir
    effect(() => {
      this.souvenir();
      this.currentIndex.set(0);
      this.sheetDragY.set(0);
    });
  }

  nextMedia(): void {
    const media = this.souvenir().media;
    if (!media || media.length === 0) return;
    this.currentIndex.update(i => (i + 1) % media.length);
  }

  prevMedia(): void {
    const media = this.souvenir().media;
    if (!media || media.length === 0) return;
    this.currentIndex.update(i => (i - 1 + media.length) % media.length);
  }

  setIndex(index: number): void {
    this.currentIndex.set(index);
  }

  // --- Gestion du swipe horizontal sur le carrousel ---
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length === 1) {
      const touchEndX = event.changedTouches[0].clientX;
      const touchEndY = event.changedTouches[0].clientY;
      const deltaX = touchEndX - this.touchStartX;
      const deltaY = touchEndY - this.touchStartY;

      // On s'assure que le geste est majoritairement horizontal et dépasse le seuil
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
        if (deltaX < 0) {
          this.nextMedia();
        } else {
          this.prevMedia();
        }
      }
    }
  }

  // --- Gestion du pull-down (glisser vers le bas pour fermer la Bottom Sheet) ---
  onHandleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.handleStartY = event.touches[0].clientY;
      this.isDragging.set(true);
    }
  }

  onHandleTouchMove(event: TouchEvent): void {
    if (!this.isDragging() || event.touches.length !== 1) return;
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - this.handleStartY;
    
    // On n'autorise que le déplacement vers le bas
    if (deltaY > 0) {
      this.sheetDragY.set(deltaY);
    }
  }

  onHandleTouchEnd(): void {
    if (!this.isDragging()) return;
    this.isDragging.set(false);
    
    // Si glissé vers le bas de plus de 80px, on ferme
    if (this.sheetDragY() > 80) {
      this.sheetDragY.set(0);
      this.close.emit();
    } else {
      // Sinon on réinitialise avec une animation douce
      this.sheetDragY.set(0);
    }
  }
}