import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { LanguageSwitcherComponent } from '../../components/language-switcher/language-switcher';

import type { SupportedLanguageCode } from '../../language/supported-languages';
import { supportedLanguages } from '../../language/supported-languages';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, TranslateModule, LanguageSwitcherComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  notificationsEnabled: 'enabled' | 'disabled' = 'enabled';
  theme: 'default' | 'light' | 'dark' = 'default';

  // App UI language
  selectedLanguage: SupportedLanguageCode = 'en';

  readonly supported = supportedLanguages;

  constructor(
    private translate: TranslateService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const storedLanguage =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('language') as SupportedLanguageCode | null)
        : null;

    const currentLanguage = this.translate.currentLang as SupportedLanguageCode | undefined;
    const candidate = storedLanguage ?? currentLanguage ?? 'en';
    const safeLang = supportedLanguages.includes(candidate as SupportedLanguageCode)
      ? (candidate as SupportedLanguageCode)
      : 'en';

    this.selectedLanguage = safeLang;
    this.translate.use(safeLang);
    this.applyDirection(safeLang);

    // Load saved theme
    const storedTheme =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('theme') as 'default' | 'light' | 'dark' | null)
        : null;

    if (storedTheme && ['default', 'light', 'dark'].includes(storedTheme)) {
      this.theme = storedTheme;
      this.applyTheme(storedTheme);
    }
  }

  logout() {
    this.auth.logout();
  }

  onLanguageChange(lang: SupportedLanguageCode | string) {
    const safeLang = supportedLanguages.includes(lang as SupportedLanguageCode)
      ? (lang as SupportedLanguageCode)
      : 'en';
    this.selectedLanguage = safeLang;
    this.translate.use(safeLang);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('language', safeLang);
    }

    this.applyDirection(safeLang);
  }

  onThemeChange(newTheme: 'default' | 'light' | 'dark') {
    this.theme = newTheme;
    this.applyTheme(newTheme);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  }

  private applyDirection(lang: SupportedLanguageCode) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  private applyTheme(theme: 'default' | 'light' | 'dark') {
    if (typeof document === 'undefined') return;

    const body = document.body;
    
    // Remove all theme classes first
    body.classList.remove('theme-light', 'theme-dark');

    // Apply the selected theme
    if (theme === 'light') {
      body.classList.add('theme-light');
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
    }
    // 'default' theme means no extra classes (uses base styles)
  }
}
