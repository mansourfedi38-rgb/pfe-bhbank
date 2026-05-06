import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  SupportedLanguageCode,
  supportedLanguages
} from '../../language/supported-languages';

const LANGUAGE_STORAGE_KEY = 'language';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss'
})
export class LanguageSwitcherComponent implements OnInit {
  @Input() compact = false;

  supported = supportedLanguages;
  selectedLanguage: SupportedLanguageCode = 'en';

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    const stored =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguageCode | null)
        : null;

    const initial = stored && supportedLanguages.includes(stored) ? stored : 'en';
    this.selectedLanguage = initial;
  }

  onLanguageChange(lang: SupportedLanguageCode | string): void {
    const safeLang = supportedLanguages.includes(lang as SupportedLanguageCode)
      ? (lang as SupportedLanguageCode)
      : 'en';
    this.selectedLanguage = safeLang;

    this.translate.use(safeLang);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, safeLang);
    }

    this.applyDirection(safeLang);
  }

  private applyDirection(lang: SupportedLanguageCode) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}

