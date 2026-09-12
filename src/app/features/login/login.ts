import { Component, OnInit, signal, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  constructor(
    private readonly auth: AuthService, 
    private readonly router: Router,
    private readonly ngZone: NgZone 
  ) {}

  async ngOnInit(): Promise<void> {
    await this.auth.ready;
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/');
    }
  }


  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    const error = await this.auth.login(this.email, this.password);
    
    // On force Angular à reprendre le contrôle pour la suite
    this.ngZone.run(() => {
      this.loading.set(false);
      if (error) {
        this.error.set(error);
      } else {
        this.router.navigateByUrl('/');
      }
    });
  }
}