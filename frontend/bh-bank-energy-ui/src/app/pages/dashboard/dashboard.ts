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
import { TemperatureAlertThresholdService } from '../../services/temperature-alert-threshold.service';
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
const DASHBOARD_AGENCY_NAMES = [
  'bh bank mrezga',
  'bh bank nabeul',
  'bh bank dar chaaben'
];

type DashboardAgencyOption = {
  id: number;
  name: string;
};

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
  selectedAgencyId: number | null = null;
  availableMonths: string[] = [];
  availableAgencies: DashboardAgencyOption[] = [];
  latestReadingTime = '';

  dashboardMetrics = {
    totalEnergyThisMonth: '',
    averageTemperatureThisMonth: '',
    peakAgencyThisMonth: '',
    latestReadingTime: '',
    activeAlerts: ''
  };

  private energyChart: Chart | null = null;
  private clientChart: Chart | null = null;
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
    private temperatureAlertThreshold: TemperatureAlertThresholdService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.loadDashboardData();
    this.configureAutoRefresh(this.autoRefresh.intervalMs);

    this.subscriptions.add(this.translate.onLangChange.subscribe(() => {
      this.updateSelectedMonthSummary();
      this.createEnergyClientTrendChart();
    }));

    this.subscriptions.add(this.temperatureUnit.unit$.subscribe(() => {
      this.updateSelectedMonthSummary();
    }));

    this.subscriptions.add(this.energyAlertThreshold.threshold$.subscribe(() => {
      this.loadRecentAlerts();
    }));

    this.subscriptions.add(this.temperatureAlertThreshold.threshold$.subscribe(() => {
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
    this.createEnergyClientTrendChart();
    this.loadRecentAlerts();
  }

  onAgencyChange(): void {
    this.updateSelectedMonthSummary();
    this.createEnergyClientTrendChart();
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
      temperatureThreshold: this.temperatureUnit.format(
        alert.temperature_threshold ?? this.temperatureAlertThreshold.thresholdCelsius
      ),
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
        this.availableAgencies = this.getAvailableAgencies(this.monthlyRows);
        const monthsWithData = new Set(this.monthlyRows.map((row) => row.month));
        this.availableMonths = DASHBOARD_MONTHS.filter((month) => monthsWithData.has(month));
        this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || '';
        this.selectedAlertMonth = this.selectedMonth;

        this.kpiStatus = this.translate.instant('dashboard.status.loadedMonthly', { count: this.monthlyRows.length });
        this.updateSelectedMonthSummary();
        this.createEnergyClientTrendChart();
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
    this.api.getRecentAlerts(
      this.selectedAlertMonth,
      this.energyAlertThreshold.threshold,
      this.temperatureAlertThreshold.thresholdCelsius,
      this.selectedAgencyId
    ).subscribe({
      next: (alerts) => {
        this.allRecentAlerts = alerts;
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

  private createEnergyClientTrendChart(): void {
    this.chartsLoading = false;
    const trendRows = this.buildMonthlyTrendRows();

    if (trendRows.length === 0) {
      this.chartsEmpty = true;
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      if (this.energyChart) {
        this.energyChart.destroy();
      }
      if (this.clientChart) {
        this.clientChart.destroy();
      }

      const energyCtx = document.getElementById('dashboardEnergyChart') as HTMLCanvasElement;
      const clientCtx = document.getElementById('dashboardClientChart') as HTMLCanvasElement;
      if (!energyCtx || !clientCtx) return;

      const selectedMonthColor = 'rgba(227, 6, 19, 0.82)';
      const defaultMonthColor = 'rgba(8, 38, 77, 0.76)';

      this.energyChart = new Chart(energyCtx, {
        type: 'bar',
        data: {
          labels: trendRows.map((row) => row.month),
          datasets: [{
            label: this.translate.instant('energyUsage.totalEnergy'),
            data: trendRows.map((row) => row.totalEnergy),
            backgroundColor: trendRows.map((row) =>
              row.month === this.selectedMonth ? selectedMonthColor : defaultMonthColor
            ),
            borderColor: trendRows.map((row) =>
              row.month === this.selectedMonth ? 'rgba(227, 6, 19, 1)' : 'rgba(8, 38, 77, 1)'
            ),
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 48
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
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const row = trendRows[context.dataIndex];
                  return [
                    `${row.month}`,
                    `${this.translate.instant('energyUsage.totalEnergy')}: ${row.totalEnergy.toFixed(2)} kWh`,
                    `${this.translate.instant('compareAgencies.labels.energyPerClient')}: ${row.energyPerClient.toFixed(3)} kWh`
                  ];
                }
              }
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
                text: this.translate.instant('dashboard.month'),
                color: this.chartTextColor()
              }
            }
          }
        }
      });

      this.clientChart = new Chart(clientCtx, {
        type: 'bar',
        data: {
          labels: trendRows.map((row) => row.month),
          datasets: [{
            label: this.translate.instant('energyUsage.totalClients'),
            data: trendRows.map((row) => row.totalClients),
            backgroundColor: trendRows.map((row) =>
              row.month === this.selectedMonth ? selectedMonthColor : 'rgba(14, 116, 144, 0.76)'
            ),
            borderColor: trendRows.map((row) =>
              row.month === this.selectedMonth ? 'rgba(227, 6, 19, 1)' : 'rgba(14, 116, 144, 1)'
            ),
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 48
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
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const row = trendRows[context.dataIndex];
                  return [
                    `${row.month}`,
                    `${this.translate.instant('energyUsage.totalClients')}: ${row.totalClients.toFixed(0)}`,
                    `${this.translate.instant('energyUsage.totalEnergy')}: ${row.totalEnergy.toFixed(2)} kWh`
                  ];
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() },
              title: {
                display: true,
                text: this.translate.instant('energyUsage.totalClients'),
                color: this.chartTextColor()
              }
            },
            x: {
              ticks: { color: this.chartTextColor() },
              grid: { color: this.chartGridColor() },
              title: {
                display: true,
                text: this.translate.instant('dashboard.month'),
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
    return this.monthlyRows.filter((row) =>
      row.month === this.selectedMonth
      && (this.selectedAgencyId === null || row.agency === this.selectedAgencyId)
    );
  }

  private buildMonthlyTrendRows(): { month: string; totalEnergy: number; totalClients: number; energyPerClient: number }[] {
    const monthMap = new Map<string, { totalEnergy: number; totalClients: number }>();

    this.monthlyRows
      .filter((row) => this.selectedAgencyId === null || row.agency === this.selectedAgencyId)
      .forEach((row) => {
        const current = monthMap.get(row.month) || { totalEnergy: 0, totalClients: 0 };
        current.totalEnergy += Number(row.total_energy);
        current.totalClients += this.monthlyTotalClients(row);
        monthMap.set(row.month, current);
      });

    return DASHBOARD_MONTHS
      .filter((month) => monthMap.has(month))
      .map((month) => ({
        month,
        totalEnergy: Number((monthMap.get(month)?.totalEnergy || 0).toFixed(2)),
        totalClients: Math.round(monthMap.get(month)?.totalClients || 0),
        energyPerClient: this.energyPerClient(
          monthMap.get(month)?.totalEnergy || 0,
          monthMap.get(month)?.totalClients || 0
        )
      }));
  }

  private energyPerClient(totalEnergy: number, totalClients: number): number {
    return totalClients > 0 ? Number((totalEnergy / totalClients).toFixed(3)) : 0;
  }

  private monthlyTotalClients(row: MonthlyEnergyKpi): number {
    return Number(row.avg_clients || 0) * Number(row.readings_count || 0);
  }

  private formatLatestReading(row?: SensorData): string {
    if (!row) return this.notAvailable();
    return new Date(row.timestamp).toLocaleString(this.currentLocale());
  }

  private formatLatestReadingForMonth(month: string): string {
    if (!month) return this.notAvailable();
    const row = this.latestReadings.find((reading) =>
      reading.timestamp.startsWith(month)
      && (this.selectedAgencyId === null || reading.agency === this.selectedAgencyId)
    );
    return this.formatLatestReading(row);
  }

  private getAvailableAgencies(rows: MonthlyEnergyKpi[]): DashboardAgencyOption[] {
    const agencies = new Map<number, string>();
    rows.forEach((row) => {
      if (DASHBOARD_AGENCY_NAMES.includes(this.normalizeName(row.agency_name))) {
        agencies.set(row.agency, row.agency_name);
      }
    });

    return Array.from(agencies.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        DASHBOARD_AGENCY_NAMES.indexOf(this.normalizeName(a.name))
        - DASHBOARD_AGENCY_NAMES.indexOf(this.normalizeName(b.name))
      );
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
      this.dashboardMetrics.activeAlerts = String(this.allRecentAlerts.length);
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

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }
}
