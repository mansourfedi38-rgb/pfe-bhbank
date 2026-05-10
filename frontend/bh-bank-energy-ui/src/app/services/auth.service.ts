import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
  access: string;
  refresh?: string;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REMEMBER_LOGIN_KEY = 'remember_login';
const REMEMBERED_EMAIL_KEY = 'remembered_email';

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
        this.storeTokens(res, storage);
        localStorage.setItem(REMEMBER_LOGIN_KEY, rememberMe ? 'true' : 'false');

        if (rememberMe) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      })
    );
  }

  refreshAccessToken(): Observable<LoginResponse> {
    const refresh = this.getRefreshToken();
    const storage = this.getTokenStorage();

    return this.http.post<LoginResponse>('/api/auth/refresh/', { refresh }).pipe(
      tap((res) => this.storeTokens(res, storage))
    );
  }

  resetPassword(email: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/reset-password/', { email, new_password: newPassword });
  }

  logout(): void {
    this.clearStoredTokens();
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getRememberLogin(): boolean {
    return localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true';
  }

  getRememberedEmail(): string {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  }

  private storeTokens(tokens: LoginResponse, storage: Storage): void {
    storage.setItem(ACCESS_TOKEN_KEY, tokens.access);

    if (tokens.refresh) {
      storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    }
  }

  private getTokenStorage(): Storage {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)
      ? localStorage
      : sessionStorage;
  }

  private clearStoredTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
