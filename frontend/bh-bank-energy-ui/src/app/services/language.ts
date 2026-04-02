import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLanguage = 'English';

  translations: any = {
    English: {
      dashboard: 'Dashboard',
      sensors: 'Sensors',
      energyUsage: 'Energy Usage',
      reports: 'Reports',
      settings: 'Settings',
      logout: 'Logout',
      dashboardTitle: 'Energy Management Dashboard',
      dashboardSubtitle: 'Welcome to the BH Bank smart monitoring platform.',
      sensorsTitle: 'Sensors Monitoring',
      sensorsSubtitle: 'Track temperature, humidity, and sensor status across BH Bank agencies.',
      energyTitle: 'Energy Usage Overview',
      energySubtitle: 'Monitor energy consumption and optimization across BH Bank agencies.',
      reportsTitle: 'Reports & Analytics',
      reportsSubtitle: 'Review operational summaries and energy performance reports for BH Bank agencies.',
      settingsTitle: 'Settings',
      settingsSubtitle: 'Manage platform preferences and user configuration.'
    },

    French: {
      dashboard: 'Tableau de bord',
      sensors: 'Capteurs',
      energyUsage: 'Consommation énergétique',
      reports: 'Rapports',
      settings: 'Paramètres',
      logout: 'Déconnexion',
      dashboardTitle: 'Tableau de bord de gestion énergétique',
      dashboardSubtitle: 'Bienvenue sur la plateforme intelligente de surveillance BH Bank.',
      sensorsTitle: 'Surveillance des capteurs',
      sensorsSubtitle: 'Suivez la température, l’humidité et l’état des capteurs dans les agences BH Bank.',
      energyTitle: 'Vue d’ensemble de la consommation énergétique',
      energySubtitle: 'Surveillez la consommation d’énergie et l’optimisation dans les agences BH Bank.',
      reportsTitle: 'Rapports et analyses',
      reportsSubtitle: 'Consultez les résumés opérationnels et les rapports de performance énergétique des agences BH Bank.',
      settingsTitle: 'Paramètres',
      settingsSubtitle: 'Gérez les préférences de la plateforme et la configuration utilisateur.'
    },

    Arabic: {
      dashboard: 'لوحة التحكم',
      sensors: 'المستشعرات',
      energyUsage: 'استهلاك الطاقة',
      reports: 'التقارير',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      dashboardTitle: 'لوحة إدارة الطاقة',
      dashboardSubtitle: 'مرحبًا بك في منصة المراقبة الذكية الخاصة ببنك BH.',
      sensorsTitle: 'مراقبة المستشعرات',
      sensorsSubtitle: 'تابع درجة الحرارة والرطوبة وحالة المستشعرات عبر وكالات بنك BH.',
      energyTitle: 'نظرة عامة على استهلاك الطاقة',
      energySubtitle: 'راقب استهلاك الطاقة وعمليات التحسين عبر وكالات بنك BH.',
      reportsTitle: 'التقارير والتحليلات',
      reportsSubtitle: 'راجع الملخصات التشغيلية وتقارير أداء الطاقة الخاصة بوكالات بنك BH.',
      settingsTitle: 'الإعدادات',
      settingsSubtitle: 'قم بإدارة تفضيلات المنصة وإعدادات المستخدم.'
    },

    German: {
      dashboard: 'Dashboard',
      sensors: 'Sensoren',
      energyUsage: 'Energieverbrauch',
      reports: 'Berichte',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      dashboardTitle: 'Energieverwaltungs-Dashboard',
      dashboardSubtitle: 'Willkommen auf der intelligenten Überwachungsplattform der BH Bank.',
      sensorsTitle: 'Sensorüberwachung',
      sensorsSubtitle: 'Verfolgen Sie Temperatur, Luftfeuchtigkeit und Sensorstatus in den Filialen der BH Bank.',
      energyTitle: 'Überblick über den Energieverbrauch',
      energySubtitle: 'Überwachen Sie den Energieverbrauch und die Optimierung in den Filialen der BH Bank.',
      reportsTitle: 'Berichte und Analysen',
      reportsSubtitle: 'Überprüfen Sie betriebliche Zusammenfassungen und Energieberichte der BH-Bank-Filialen.',
      settingsTitle: 'Einstellungen',
      settingsSubtitle: 'Verwalten Sie Plattformpräferenzen und Benutzerkonfiguration.'
    }
  };

  setLanguage(language: string) {
    this.currentLanguage = language;
  }

  getTranslation(key: string): string {
    return this.translations[this.currentLanguage][key] || key;
  }
}