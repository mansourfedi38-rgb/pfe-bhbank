import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { SupportedLanguageCode } from '../../language/supported-languages';
import { supportedLanguages } from '../../language/supported-languages';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, TranslateModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  notificationsEnabled: 'enabled' | 'disabled' = 'enabled';
  theme: 'default' | 'light' | 'dark' = 'default';

  // App UI language
  selectedLanguage: SupportedLanguageCode = 'en';

  readonly supported = supportedLanguages;

  constructor(
    private router: Router,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    const stored =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('language') as SupportedLanguageCode | null)
        : null;
    this.selectedLanguage = stored ?? 'en';
  }

  logout() {
    this.router.navigate(['/login']);
  }

  manageSecurity() {
    // Placeholder: security settings is not implemented yet.
    console.warn('Security settings page is not implemented yet.');
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

  private applyDirection(lang: SupportedLanguageCode) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}