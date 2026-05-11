import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AutoRefreshInterval, AutoRefreshService } from '../../services/auto-refresh.service';
import { EnergyAlertThresholdService } from '../../services/energy-alert-threshold.service';
import { NotificationMode, NotificationPreferencesService, NotificationSoundMode } from '../../services/notification-preferences.service';
import { TemperatureUnit, TemperatureUnitService } from '../../services/temperature-unit.service';

import type { SupportedLanguageCode } from '../../language/supported-languages';
import { supportedLanguages } from '../../language/supported-languages';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  notificationsEnabled: NotificationMode = 'enabled';
  notificationSound: NotificationSoundMode = 'enabled';
  theme: 'default' | 'light' | 'dark' = 'default';
  temperatureUnit: TemperatureUnit = 'celsius';
  energyAlertThreshold = 4;
  autoRefreshInterval: AutoRefreshInterval = '30000';

  // App UI language
  selectedLanguage: SupportedLanguageCode = 'en';

  readonly supported = supportedLanguages;

  constructor(
    private translate: TranslateService,
    private autoRefresh: AutoRefreshService,
    private energyAlertThresholdService: EnergyAlertThresholdService,
    private notificationPreferences: NotificationPreferencesService,
    private temperatureUnitService: TemperatureUnitService
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
    this.temperatureUnit = this.temperatureUnitService.unit;
    this.energyAlertThreshold = this.energyAlertThresholdService.threshold;
    this.autoRefreshInterval = this.autoRefresh.interval;
    this.notificationsEnabled = this.notificationPreferences.notifications;
    this.notificationSound = this.notificationPreferences.sound;

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

  onTemperatureUnitChange(unit: TemperatureUnit) {
    this.temperatureUnit = unit;
    this.temperatureUnitService.setUnit(unit);
  }

  onEnergyAlertThresholdChange(value: number | string) {
    this.energyAlertThresholdService.setThreshold(value);
    this.energyAlertThreshold = this.energyAlertThresholdService.threshold;
  }

  onAutoRefreshChange(value: AutoRefreshInterval | string) {
    this.autoRefresh.setInterval(value);
    this.autoRefreshInterval = this.autoRefresh.interval;
  }

  onNotificationsChange(value: NotificationMode | string) {
    this.notificationPreferences.setNotifications(value);
    this.notificationsEnabled = this.notificationPreferences.notifications;
  }

  onNotificationSoundChange(value: NotificationSoundMode | string) {
    this.notificationPreferences.setSound(value);
    this.notificationSound = this.notificationPreferences.sound;

    if (this.notificationSound === 'enabled') {
      this.notificationPreferences.playAlertSound();
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
