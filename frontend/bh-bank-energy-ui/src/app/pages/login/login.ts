import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { NgIf } from '@angular/common';
import { timeout } from 'rxjs';

const LOGIN_TIMEOUT_MS = 8000;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, TranslateModule, NgIf],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    this.errorMessage = '';
    this.isLoading = true;

    this.auth.login(this.email, this.password).pipe(
      timeout(LOGIN_TIMEOUT_MS)
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = this.translate.instant('login.error');
        this.cdr.detectChanges();
      }
    });
  }
}
