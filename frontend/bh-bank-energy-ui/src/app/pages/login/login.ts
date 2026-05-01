import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { NgIf } from '@angular/common';

const LOGIN_ERROR_MESSAGE = 'Wrong email address or password.';

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
    private auth: AuthService
  ) {}

  onSubmit(): void {
    this.errorMessage = '';
    this.isLoading = true;

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = LOGIN_ERROR_MESSAGE;
      }
    });
  }
}
