import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, TranslateModule, NgIf, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent implements OnInit {
  email = '';
  newPassword = '';
  confirmPassword = '';
  captchaAnswer = '';

  captchaNum1 = 0;
  captchaNum2 = 0;
  correctCaptcha = 0;

  errorMessage = '';
  successMessage = '';
  isLoading = false;

  constructor(
    private router: Router,
    private translate: TranslateService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.generateCaptcha();
  }

  generateCaptcha(): void {
    this.captchaNum1 = Math.floor(Math.random() * 9) + 1;
    this.captchaNum2 = Math.floor(Math.random() * 9) + 1;
    this.correctCaptcha = this.captchaNum1 + this.captchaNum2;
    this.captchaAnswer = '';
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.newPassword || !this.confirmPassword || !this.captchaAnswer) {
      this.errorMessage = this.translate.instant('forgotPassword.error.allFieldsRequired');
      return;
    }

    const captchaValue = parseInt(this.captchaAnswer, 10);
    if (isNaN(captchaValue) || captchaValue !== this.correctCaptcha) {
      this.errorMessage = this.translate.instant('forgotPassword.error.invalidCaptcha');
      this.generateCaptcha();
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = this.translate.instant('forgotPassword.error.passwordTooShort');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = this.translate.instant('forgotPassword.error.passwordsDoNotMatch');
      return;
    }

    this.isLoading = true;

    this.auth.resetPassword(this.email, this.newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = this.translate.instant('forgotPassword.success');
        this.email = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.captchaAnswer = '';
        this.generateCaptcha();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        const msg = err?.error?.error || this.translate.instant('forgotPassword.error.generic');
        this.errorMessage = msg;
      }
    });
  }
}
