import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { forkJoin } from 'rxjs';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { ApiService, MonthlyEnergyKpi, RecentAlert, SensorData } from '../../services/api.service';
import { AutoRefreshService } from '../../services/auto-refresh.service';
import { EnergyAlertThresholdService } from '../../services/energy-alert-threshold.service';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { TemperatureUnitService } from '../../services/temperature-unit.service';

const DASHBOARD_MONTHS = [
  '2025-01',
  '2025-02',
  '2025-03',
  '2025-04',
  '2025-05',
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04'
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  kpiStatus = '';
  monthlyRows: MonthlyEnergyKpi[] = [];
  private allRecentAlerts: RecentAlert[] = [];
  private latestReadings: SensorData[] = [];
  recentAlerts: RecentAlert[] = [];
  selectedMonth = '';
  selectedAlertMonth = '';
  availableMonths: string[] = [];
  latestReadingTime = '';

  dashboardMetrics = {
    totalEnergyThisMonth: '',
    averageTemperatureThisMonth: '',
    peakAgencyThisMonth: '',
    latestReadingTime: '',
    activeAlerts: ''
  };

  private agencyChart: Chart | null = null;
  private readonly subscriptions = new Subscription();
  private refreshInterval: any;
  private latestAlertSignature = '';

  chartsLoading = true;
  chartsEmpty = false;
  chartError: string | null = null;

  constructor(
    private api: ApiService,
    private autoRefresh: AutoRefreshService,
    private translate: TranslateService,
    private energyAlertThreshold: EnergyAlertThresholdService,
    private notificationPreferences: NotificationPreferencesService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.loadDashboardData();
    this.configureAutoRefresh(this.autoRefresh.intervalMs);

    this.subscriptions.add(this.translate.onLangChange.subscribe(() => {
      this.updateSelectedMonthSummary();
    }));

    this.subscriptions.add(this.temperatureUnit.unit$.subscribe(() => {
      this.updateSelectedMonthSummary();
    }));

    this.subscriptions.add(this.energyAlertThreshold.threshold$.subscribe(() => {
      this.loadRecentAlerts();
    }));

    this.subscriptions.add(this.autoRefresh.interval$.subscribe((interval) => {
      this.configureAutoRefresh(this.autoRefresh.toMilliseconds(interval));
    }));

    this.subscriptions.add(this.notificationPreferences.notifications$.subscribe(() => {
      this.applyNotificationVisibility();
    }));

    this.subscriptions.add(this.notificationPreferences.sound$.subscribe(() => {
      this.latestAlertSignature = '';
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  onMonthChange(): void {
    this.selectedAlertMonth = this.selectedMonth;
    this.updateSelectedMonthSummary();
    this.createMonthlyAgencyChart();
    this.loadRecentAlerts();
  }

  onAlertMonthChange(): void {
    this.loadRecentAlerts();
  }

  refreshNow(): void {
    this.setLoadingState();
    this.loadDashboardData();
  }

  formatAlertTimestamp(value: string): string {
    return new Date(value).toLocaleString(this.currentLocale());
  }

  formatAlertType(alert: RecentAlert): string {
    const key = this.alertTranslationKey(alert);
    return this.translate.instant(`dashboard.alerts.${key}.type`);
  }

  formatAlertMessage(alert: RecentAlert): string {
    const key = this.alertTranslationKey(alert);
    const translated = this.translate.instant(`dashboard.alerts.${key}.message`, {
      agency: alert.agency_name,
      temperature: alert.temperature !== undefined ? this.temperatureUnit.format(alert.temperature) : '',
      energy: this.formatEnergy(alert.energy_usage),
      threshold: this.formatEnergy(alert.energy_threshold)
    });

    if (translated !== `dashboard.alerts.${key}.message`) {
      return translated;
    }

    return alert.message.replace(/(-?\d+(?:\.\d+)?)\s*°C/g, (_match, value) => this.temperatureUnit.format(value));
  }

  areNotificationMessagesEnabled(): boolean {
    return this.notificationPreferences.notifications === 'enabled';
  }

  private loadDashboardData(): void {
    forkJoin({
      monthlyKpi: this.api.getMonthlyEnergyKpi(),
      latestReadings: this.api.getSensorData({ ordering: '-timestamp' })
    }).subscribe({
      next: ({ monthlyKpi, latestReadings }) => {
        this.monthlyRows = monthlyKpi.filter((row) => DASHBOARD_MONTHS.includes(row.month));
        this.latestReadings = latestReadings;
        const monthsWithData = new Set(this.monthlyRows.map((row) => row.month));
        this.availableMonths = DASHBOARD_MONTHS.filter((month) => monthsWithData.has(month));
        this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || '';
        this.selectedAlertMonth = this.selectedMonth;

        this.kpiStatus = this.translate.instant('dashboard.status.loadedMonthly', { count: this.monthlyRows.length });
        this.updateSelectedMonthSummary();
        this.createMonthlyAgencyChart();
        this.loadRecentAlerts();
      },
      error: (err) => {
        this.kpiStatus = this.translate.instant('dashboard.status.failed', { error: String(err?.message ?? err) });
        this.chartsLoading = false;
        this.chartError = err?.message || this.translate.instant('dashboard.status.failed', { error: '' });
        this.loadRecentAlerts();
        this.cdr.detectChanges();
      }
    });

  }

  private loadRecentAlerts(): void {
    this.api.getRecentAlerts(this.selectedAlertMonth, this.energyAlertThreshold.threshold).subscribe({
      next: (alerts) => {
        this.allRecentAlerts = alerts.slice(0, 5);
        this.playSoundForNewAlerts(this.allRecentAlerts);
        this.applyNotificationVisibility();
        this.cdr.detectChanges();
      },
      error: () => {
        this.allRecentAlerts = [];
        this.recentAlerts = [];
        this.dashboardMetrics.activeAlerts = this.notAvailable();
        this.cdr.detectChanges();
      }
    });
  }

  private updateSelectedMonthSummary(): void {
    const rows = this.getSelectedMonthRows();

    if (rows.length === 0) {
      this.latestReadingTime = this.formatLatestReadingForMonth(this.selectedMonth);
      this.dashboardMetrics.totalEnergyThisMonth = this.notAvailable();
      this.dashboardMetrics.averageTemperatureThisMonth = this.notAvailable();
      this.dashboardMetrics.peakAgencyThisMonth = this.notAvailable();
      this.dashboardMetrics.latestReadingTime = this.latestReadingTime;
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    const totalEnergy = rows.reduce((sum, row) => sum + Number(row.total_energy), 0);
    const avgTemperature =
      rows.reduce((sum, row) => sum + Number(row.avg_temperature), 0) / rows.length;
    const peakAgency = [...rows].sort((a, b) => Number(b.total_energy) - Number(a.total_energy))[0];
    this.latestReadingTime = this.formatLatestReadingForMonth(this.selectedMonth);

    this.dashboardMetrics.totalEnergyThisMonth = `${totalEnergy.toFixed(2)} kWh`;
    this.dashboardMetrics.averageTemperatureThisMonth = this.temperatureUnit.format(avgTemperature);
    this.dashboardMetrics.peakAgencyThisMonth = peakAgency?.agency_name ?? this.notAvailable();
    this.dashboardMetrics.latestReadingTime = this.latestReadingTime;
    this.chartsEmpty = false;
    this.cdr.detectChanges();
  }

  private createMonthlyAgencyChart(): void {
    this.chartsLoading = false;
    const rows = this.getSelectedMonthRows();

    if (rows.length === 0) {
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      if (this.agencyChart) {
        this.agencyChart.destroy();
      }

      const ctx = document.getElementById('agencyChart') as HTMLCanvasElement;
      if (!ctx) return;

      this.agencyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map((row) => row.agency_name),
          datasets: [{
            label: `${this.translate.instant('dashboard.monthlyEnergyByAgency')} (${this.selectedMonth})`,
            data: rows.map((row) => Number(row.total_energy)),
            backgroundColor: 'rgba(220, 53, 69, 0.72)',
            borderColor: 'rgba(220, 53, 69, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { color: this.chartTextColor() }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() },
              title: {
                display: true,
                text: this.translate.instant('energyUsage.totalEnergy') + ' (kWh)',
                color: this.chartTextColor()
              }
            },
            x: {
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() },
              title: {
                display: true,
                text: this.translate.instant('sensors.agency'),
                color: this.chartTextColor()
              }
            }
          }
        }
      });

      this.cdr.detectChanges();
    }, 100);
  }

  private getSelectedMonthRows(): MonthlyEnergyKpi[] {
    return this.monthlyRows.filter((row) => row.month === this.selectedMonth);
  }

  private formatLatestReading(row?: SensorData): string {
    if (!row) return this.notAvailable();
    return new Date(row.timestamp).toLocaleString(this.currentLocale());
  }

  private formatLatestReadingForMonth(month: string): string {
    if (!month) return this.notAvailable();
    const row = this.latestReadings.find((reading) => reading.timestamp.startsWith(month));
    return this.formatLatestReading(row);
  }

  private setLoadingState(): void {
    this.kpiStatus = this.translate.instant('dashboard.status.loadingMonthly');
    this.chartsLoading = true;
    this.chartsEmpty = false;
    this.chartError = null;
    this.latestReadingTime = this.notAvailable();
    this.dashboardMetrics.totalEnergyThisMonth = this.notAvailable();
    this.dashboardMetrics.averageTemperatureThisMonth = this.notAvailable();
    this.dashboardMetrics.peakAgencyThisMonth = this.notAvailable();
    this.dashboardMetrics.latestReadingTime = this.notAvailable();
    this.dashboardMetrics.activeAlerts = this.notAvailable();
  }

  private notAvailable(): string {
    return this.translate.instant('common.notAvailable');
  }

  private alertTranslationKey(alert: RecentAlert): string {
    if (alert.alert_key) return alert.alert_key;
    const keys: Record<RecentAlert['type'], string> = {
      'High temperature': 'high_temperature',
      'High energy usage': 'high_energy_usage',
      'After-hours energy waste': 'after_hours_energy_waste'
    };
    return keys[alert.type] || 'high_energy_usage';
  }

  private formatEnergy(value?: number): string {
    return value === undefined ? '' : `${Number(value).toFixed(2)} kWh`;
  }

  private currentLocale(): string {
    const locales: Record<string, string> = {
      en: 'en-US',
      fr: 'fr-FR',
      ar: 'ar-TN'
    };
    return locales[this.translate.currentLang] || 'en-US';
  }

  private isDarkTheme(): boolean {
    return typeof document !== 'undefined' && document.body.classList.contains('theme-dark');
  }

  private chartTextColor(): string {
    return this.isDarkTheme() ? '#f8fafc' : '#555555';
  }

  private chartGridColor(): string {
    return this.isDarkTheme() ? 'rgba(219, 231, 245, 0.24)' : 'rgba(0, 0, 0, 0.1)';
  }

  private applyNotificationVisibility(): void {
    if (this.notificationPreferences.notifications === 'enabled') {
      this.recentAlerts = this.allRecentAlerts;
      this.dashboardMetrics.activeAlerts = String(this.recentAlerts.length);
    } else {
      this.recentAlerts = [];
      this.dashboardMetrics.activeAlerts = '0';
    }

    this.cdr.detectChanges();
  }

  private playSoundForNewAlerts(alerts: RecentAlert[]): void {
    if (alerts.length === 0) {
      this.latestAlertSignature = '';
      return;
    }

    const signature = alerts
      .map((alert) => `${alert.type}-${alert.agency_name}-${alert.timestamp}`)
      .join('|');

    if (signature !== this.latestAlertSignature) {
      this.latestAlertSignature = signature;
      this.notificationPreferences.playAlertSound();
    }
  }

  private configureAutoRefresh(intervalMs: number | null): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (intervalMs !== null) {
      this.refreshInterval = setInterval(() => this.loadDashboardData(), intervalMs);
    }
  }
}
