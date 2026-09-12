import { Component, ElementRef, ViewChild, computed, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

export type EasterEggType = 'empanadas' | 'grizou' | 'hub' | null;

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRotation: number;
  shape: 'rect' | 'circle' | 'heart' | 'star';
  opacity: number;
}

@Component({
  selector: 'app-easter-eggs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './easter-eggs.html',
  styleUrl: './easter-eggs.css',
})
export class EasterEggs {
  readonly activeEgg = input<EasterEggType>(null);
  readonly close = output<void>();
  readonly navigateLocation = output<'empanadas' | 'grizou'>();

  @ViewChild('confettiCanvas') confettiCanvasRef?: ElementRef<HTMLCanvasElement>;

  readonly jerseyFlipped = signal(false);
  readonly empanadaAnswer = signal<'yes' | 'treat' | 'maybe' | null>(null);
  readonly grizouAction = signal<'cheer' | 'order' | null>(null);
  readonly secretsUnlocked = signal({ empanadas: false, grizou: false });

  readonly totalFound = computed(() => {
    const s = this.secretsUnlocked();
    return (s.empanadas ? 1 : 0) + (s.grizou ? 1 : 0);
  });

  private confettiAnimationId?: number;

  constructor() {
    effect(() => {
      const current = this.activeEgg();
      if (current === 'empanadas') {
        this.secretsUnlocked.update(s => ({ ...s, empanadas: true }));
      } else if (current === 'grizou') {
        this.secretsUnlocked.update(s => ({ ...s, grizou: true }));
        this.jerseyFlipped.set(false);
      }
    });
  }

  flipJersey(): void {
    this.jerseyFlipped.update(v => !v);
  }

  setEmpanadaAnswer(answer: 'yes' | 'treat' | 'maybe'): void {
    this.empanadaAnswer.set(answer);
    if (answer === 'yes' || answer === 'treat') {
      this.launchConfetti(['#f43f5e', '#fbbf24', '#f97316', '#ec4899', '#ffffff']);
    }
  }

  triggerGrizouAction(action: 'cheer' | 'order'): void {
    this.grizouAction.set(action);
    this.launchConfetti(['#1d4ed8', '#fbbf24', '#3b82f6', '#f59e0b', '#ffffff']);
  }

  selectFromHub(egg: 'empanadas' | 'grizou'): void {
    this.navigateLocation.emit(egg);
  }

  closeModal(): void {
    if (this.confettiAnimationId) {
      cancelAnimationFrame(this.confettiAnimationId);
      this.confettiAnimationId = undefined;
    }
    this.empanadaAnswer.set(null);
    this.grizouAction.set(null);
    this.close.emit();
  }

  launchConfetti(colors: string[]): void {
    const canvas = this.confettiCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: ConfettiParticle[] = [];
    const count = 90;
    const shapes: ('rect' | 'circle' | 'heart' | 'star')[] = ['rect', 'circle', 'heart', 'star'];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
      });
    }

    if (this.confettiAnimationId) {
      cancelAnimationFrame(this.confettiAnimationId);
    }

    const gravity = 0.35;
    const drag = 0.98;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      for (const p of particles) {
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;

        if (p.y > canvas.height * 0.7) {
          p.opacity -= 0.02;
        }

        if (p.opacity > 0 && p.y < canvas.height + 20) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;

          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === 'heart') {
            const s = p.size * 0.6;
            ctx.beginPath();
            ctx.moveTo(0, s * 0.3);
            ctx.bezierCurveTo(-s, -s * 0.6, -s * 1.2, s * 0.4, 0, s * 1.3);
            ctx.bezierCurveTo(s * 1.2, s * 0.4, s, -s * 0.6, 0, s * 0.3);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          }
          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        this.confettiAnimationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.confettiAnimationId = undefined;
      }
    };

    render();
  }
}
