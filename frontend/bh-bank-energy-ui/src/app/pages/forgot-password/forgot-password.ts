import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

type ResetAdmin = 'hedi' | 'fedi';
type ResetStep = 'identity' | 'reset';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, TranslateModule, NgIf, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent implements OnInit {
  selectedAdmin: ResetAdmin = 'hedi';
  email = '';
  verificationCode = '';
  newPassword = '';
  confirmPassword = '';
  captchaAnswer = '';
  currentStep: ResetStep = 'identity';

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

  onAdminChange(): void {
    this.email = '';
    this.verificationCode = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.currentStep = 'identity';
  }

  generateCaptcha(): void {
    this.captchaNum1 = Math.floor(Math.random() * 9) + 1;
    this.captchaNum2 = Math.floor(Math.random() * 9) + 1;
    this.correctCaptcha = this.captchaNum1 + this.captchaNum2;
    this.captchaAnswer = '';
  }

  sendVerificationCode(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.captchaAnswer) {
      this.errorMessage = this.translate.instant('forgotPassword.error.allFieldsRequired');
      return;
    }

    if (!this.isSelectedAdminEmailValid()) {
      this.errorMessage = this.translate.instant('forgotPassword.error.adminEmailMismatch');
      return;
    }

    if (!this.isCaptchaValid()) {
      return;
    }

    this.isLoading = true;

    this.auth.requestPasswordResetCode(this.selectedAdmin, this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.currentStep = 'reset';
        this.successMessage = this.translate.instant('forgotPassword.codeSent');
        this.generateCaptcha();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        const msg = err?.error?.error || this.translate.instant('forgotPassword.error.codeSendFailed');
        this.errorMessage = msg;
        this.generateCaptcha();
      }
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.verificationCode || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = this.translate.instant('forgotPassword.error.allFieldsRequired');
      return;
    }

    if (!this.isSelectedAdminEmailValid()) {
      this.errorMessage = this.translate.instant('forgotPassword.error.adminEmailMismatch');
      return;
    }

    if (!/^\d{6}$/.test(this.verificationCode.trim())) {
      this.errorMessage = this.translate.instant('forgotPassword.error.invalidCode');
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

    this.auth.resetPassword(this.selectedAdmin, this.email, this.verificationCode, this.newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = this.translate.instant('forgotPassword.success');
        this.email = '';
        this.verificationCode = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.captchaAnswer = '';
        this.currentStep = 'identity';
        this.generateCaptcha();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        const msg = err?.error?.error || this.translate.instant('forgotPassword.error.generic');
        this.errorMessage = msg;
      }
    });
  }

  private isCaptchaValid(): boolean {
    const captchaValue = parseInt(this.captchaAnswer, 10);
    if (isNaN(captchaValue) || captchaValue !== this.correctCaptcha) {
      this.errorMessage = this.translate.instant('forgotPassword.error.invalidCaptcha');
      this.generateCaptcha();
      return false;
    }

    return true;
  }

  private isSelectedAdminEmailValid(): boolean {
    const adminEmails: Record<ResetAdmin, string> = {
      hedi: 'medhedibousnina01@gmail.com',
      fedi: 'mansourfedi38@gmail.com'
    };
    return this.email.trim().toLowerCase() === adminEmails[this.selectedAdmin];
  }
}
