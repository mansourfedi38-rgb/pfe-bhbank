import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'default' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_MODES: ThemeMode[] = ['default', 'light', 'dark'];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly themeSubject = new BehaviorSubject<ThemeMode>(this.loadTheme());

  readonly theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  get theme(): ThemeMode {
    return this.themeSubject.value;
  }

  setTheme(theme: ThemeMode | string): void {
    const safeTheme = this.normalize(theme);
    this.themeSubject.next(safeTheme);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
    }

    this.applyTheme(safeTheme);
  }

  init(): void {
    this.applyTheme(this.themeSubject.value);
  }

  private applyTheme(theme: ThemeMode): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('theme-light', 'theme-dark');
    body.classList.remove('theme-light', 'theme-dark');

    if (theme === 'light') {
      root.classList.add('theme-light');
      body.classList.add('theme-light');
    }

    if (theme === 'dark') {
      root.classList.add('theme-dark');
      body.classList.add('theme-dark');
    }
  }

  private loadTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'default';
    }

    return this.normalize(localStorage.getItem(THEME_STORAGE_KEY));
  }

  private normalize(theme: ThemeMode | string | null): ThemeMode {
    return THEME_MODES.includes(theme as ThemeMode) ? (theme as ThemeMode) : 'default';
  }
}
