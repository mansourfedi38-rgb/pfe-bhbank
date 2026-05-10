import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
  access: string;
  refresh: string;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REMEMBER_LOGIN_KEY = 'remember_login';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login(email: string, password: string, rememberMe = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login/', { email, password }).pipe(
      tap((res) => {
        this.clearStoredTokens();

        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem(ACCESS_TOKEN_KEY, res.access);
        storage.setItem(REFRESH_TOKEN_KEY, res.refresh);
        localStorage.setItem(REMEMBER_LOGIN_KEY, rememberMe ? 'true' : 'false');
      })
    );
  }

  resetPassword(email: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/reset-password/', { email, new_password: newPassword });
  }

  logout(): void {
    this.clearStoredTokens();
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRememberLogin(): boolean {
    return localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true';
  }

  private clearStoredTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
