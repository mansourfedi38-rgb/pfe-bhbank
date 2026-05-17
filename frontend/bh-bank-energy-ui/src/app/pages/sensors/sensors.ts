import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../components/navbar/navbar';
import { Agency, ApiService, SensorData } from '../../services/api.service';
import { AutoRefreshService } from '../../services/auto-refresh.service';
import { TemperatureUnitService } from '../../services/temperature-unit.service';

const SENSOR_AGENCY_NAMES = [
  'bh bank nabeul',
  'bh bank dar chaaben',
  'bh bank mrezga'
];
const SENSOR_MIN_DATE = '2025-01-01';
const SENSOR_MAX_DATE = '2026-04-30';

type SensorTableFrequency = 'hour' | 'day' | 'week' | 'month';
type SensorDisplayRow = SensorData & { periodLabel?: string };

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent implements OnInit, OnDestroy {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  cards = {
    temperature: '',
    clientsCount: '',
    activeAC: '',
    systemStatus: ''
  };

  sensorRows: SensorData[] = [];
  visibleRows: SensorDisplayRow[] = [];
  agencies: Agency[] = [];
  agenciesMap = new Map<number, string>();
  lastUpdated = '';
  selectedAgencyId: number | null = null;
  selectedAcMode: 'OFF' | 'ECO' | 'ON' | '' = '';
  selectedTableFrequency: SensorTableFrequency = 'hour';
  dateFrom = '';
  dateTo = '';
  filterError = '';
  private hasAppliedFilters = false;
  private pollingInterval: any;
  private temperatureUnitSubscription?: { unsubscribe: () => void };
  private autoRefreshSubscription?: { unsubscribe: () => void };
  private languageSubscription?: { unsubscribe: () => void };

  constructor(
    private api: ApiService,
    private autoRefresh: AutoRefreshService,
    private translate: TranslateService,
    private temperatureUnit: TemperatureUnitService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setEmptyState();
    this.api.getAgencies().subscribe({
      next: (agencies) => {
        const uniqueAgencies = new Map<string, Agency>();
        agencies
          .filter((agency) => SENSOR_AGENCY_NAMES.includes(this.normalizeName(agency.name)))
          .forEach((agency) => {
            const normalizedName = this.normalizeName(agency.name);
            const existingAgency = uniqueAgencies.get(normalizedName);
            if (!existingAgency || agency.id < existingAgency.id) {
              uniqueAgencies.set(normalizedName, agency);
            }
          });

        this.agencies = Array.from(uniqueAgencies.values())
          .sort((a, b) => SENSOR_AGENCY_NAMES.indexOf(this.normalizeName(a.name)) - SENSOR_AGENCY_NAMES.indexOf(this.normalizeName(b.name)));
        this.agencies.forEach((agency) => this.agenciesMap.set(agency.id, agency.name));
      }
    });

    this.configureAutoRefresh(this.autoRefresh.intervalMs);
    this.temperatureUnitSubscription = this.temperatureUnit.unit$.subscribe(() => {
      this.updateTemperatureCard();
      this.updateSummaryCards();
      this.cdr.detectChanges();
    });
    this.autoRefreshSubscription = this.autoRefresh.interval$.subscribe((interval) => {
      this.configureAutoRefresh(this.autoRefresh.toMilliseconds(interval));
    });
    this.languageSubscription = this.translate.onLangChange.subscribe(() => {
      this.updateTemperatureCard();
      this.updateSummaryCards();
      this.visibleRows = this.buildVisibleRows(this.sensorRows);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.temperatureUnitSubscription?.unsubscribe();
    this.autoRefreshSubscription?.unsubscribe();
    this.languageSubscription?.unsubscribe();
  }

  loadSensorData(): void {
    if (!this.hasAppliedFilters) {
      return;
    }

    const filters: {
      agency?: number;
      ac_mode?: 'OFF' | 'ECO' | 'ON';
      date_from?: string;
      date_to?: string;
      ordering?: string;
    } = { ordering: '-timestamp' };

    if (this.selectedAgencyId !== null) filters.agency = this.selectedAgencyId;
    if (this.dateFrom) filters.date_from = this.dateFrom;
    if (this.dateTo) filters.date_to = this.dateTo;

    this.api.getSensorData(filters).subscribe({
      next: (rows) => {
        const allowedAgencyIds = new Set(this.agencies.map((agency) => agency.id));
        const scopedRows = rows
          .filter((row) => allowedAgencyIds.has(row.agency))
          .map((row) => this.normalizeSummerScheduleRow(row))
          .filter((row) => !this.selectedAcMode || row.ac_mode === this.selectedAcMode);

        this.isLoading = false;
        this.hasError = false;
        this.filterError = '';
        this.sensorRows = scopedRows;
        this.visibleRows = this.buildVisibleRows(scopedRows);
        this.lastUpdated = new Date().toLocaleString();

        if (scopedRows.length === 0) {
          this.backendStatus = this.translate.instant('sensors.status.noDataBackend');
          this.cards.systemStatus = this.translate.instant('common.noData');
          this.cdr.detectChanges();
          return;
        }

        this.updateTemperatureCard();
        this.updateSummaryCards();
        this.cards.systemStatus = this.translate.instant('sensors.systemOnline');
        this.backendStatus = this.translate.instant('sensors.status.loaded', { count: scopedRows.length });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('sensors.status.failed', {
          error: String(err?.message ?? err)
        });
        this.cards.systemStatus = this.translate.instant('sensors.systemOffline');
        this.sensorRows = [];
        this.visibleRows = [];
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    if (!this.validateDates()) {
      return;
    }

    this.hasAppliedFilters = true;
    this.isLoading = true;
    this.loadSensorData();
  }

  onTableFrequencyChange(): void {
    this.visibleRows = this.buildVisibleRows(this.sensorRows);
  }

  refreshNow(): void {
    if (!this.validateDates()) {
      return;
    }

    this.hasAppliedFilters = true;
    this.isLoading = true;
    this.loadSensorData();
  }

  clearFilters(): void {
    this.selectedAgencyId = null;
    this.selectedAcMode = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.hasAppliedFilters = false;
    this.setEmptyState();
    this.cdr.detectChanges();
  }

  getAgencyName(id: number): string {
    return this.agenciesMap.get(id) || this.translate.instant('common.agencyNumber', { id });
  }

  formatTemperature(val: string): string {
    return this.temperatureUnit.format(val);
  }

  formatEnergy(val: string): string {
    return `${Number(val).toFixed(3)} kWh`;
  }

  formatTimestamp(val: string): string {
    return new Date(val).toLocaleString(this.currentLocale(), { timeZone: 'UTC' });
  }

  formatTableTimestamp(row: SensorDisplayRow): string {
    return row.periodLabel || this.formatTimestamp(row.timestamp);
  }

  acModeClass(mode: string): string {
    switch (mode) {
      case 'ON': return 'ac-on';
      case 'ECO': return 'ac-eco';
      case 'OFF': return 'ac-off';
      default: return 'ac-off';
    }
  }

  private setLoadingState(): void {
    this.isLoading = true;
    this.hasError = false;
    this.filterError = '';
    this.backendStatus = this.translate.instant('sensors.status.loading');
    this.cards.temperature = this.translate.instant('common.notAvailable');
    this.cards.clientsCount = this.translate.instant('common.notAvailable');
    this.cards.activeAC = this.translate.instant('common.notAvailable');
    this.cards.systemStatus = this.translate.instant('common.notAvailable');
    this.lastUpdated = this.translate.instant('common.notAvailable');
  }

  private setEmptyState(): void {
    this.isLoading = false;
    this.hasError = false;
    this.filterError = '';
    this.backendStatus = this.translate.instant('sensors.status.waitingForApply');
    this.cards.temperature = this.translate.instant('common.notAvailable');
    this.cards.clientsCount = this.translate.instant('common.notAvailable');
    this.cards.activeAC = this.translate.instant('common.notAvailable');
    this.cards.systemStatus = this.translate.instant('common.notAvailable');
    this.sensorRows = [];
    this.visibleRows = [];
    this.lastUpdated = this.translate.instant('common.notAvailable');
  }

  private updateTemperatureCard(): void {
    if (this.sensorRows.length === 0) {
      this.cards.temperature = this.translate.instant('common.notAvailable');
      return;
    }

    const avgTemperature =
      this.sensorRows.reduce((sum, item) => sum + Number(item.temperature), 0) / this.sensorRows.length;

    this.cards.temperature = this.temperatureUnit.format(avgTemperature);
  }

  private updateSummaryCards(): void {
    if (this.sensorRows.length === 0) {
      this.cards.clientsCount = this.translate.instant('common.notAvailable');
      this.cards.activeAC = this.translate.instant('common.notAvailable');
      return;
    }

    const totalClients = this.sensorRows.reduce((sum, item) => sum + Number(item.clients_count), 0);
    const activeAcHours = this.sensorRows.filter((item) => item.ac_mode !== 'OFF').length;

    this.cards.clientsCount = this.translate.instant('sensors.metrics.clients', {
      count: totalClients
    });
    this.cards.activeAC = this.translate.instant('sensors.metrics.activeAc', {
      active: activeAcHours,
      total: this.sensorRows.length
    });
  }

  private buildVisibleRows(rows: SensorData[]): SensorDisplayRow[] {
    if (this.selectedTableFrequency === 'hour') {
      return rows.slice(0, 20);
    }

    const groups = new Map<string, SensorData[]>();

    rows.forEach((row) => {
      const key = `${row.agency}|${this.periodKey(row.timestamp)}`;
      const groupRows = groups.get(key) || [];
      groupRows.push(row);
      groups.set(key, groupRows);
    });

    return Array.from(groups.values())
      .map((groupRows) => this.aggregateRows(groupRows))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }

  private aggregateRows(rows: SensorData[]): SensorDisplayRow {
    const first = rows[0];
    const totalClients = rows.reduce((sum, row) => sum + Number(row.clients_count), 0);
    const totalEnergy = rows.reduce((sum, row) => sum + Number(row.energy_usage), 0);
    const avgTemperature = rows.reduce((sum, row) => sum + Number(row.temperature), 0) / rows.length;
    const acMode = rows.some((row) => row.ac_mode === 'ON')
      ? 'ON'
      : rows.some((row) => row.ac_mode === 'ECO')
        ? 'ECO'
        : 'OFF';
    const periodStart = this.periodStart(first.timestamp);

    return {
      ...first,
      temperature: avgTemperature.toFixed(2),
      clients_count: totalClients,
      energy_usage: totalEnergy.toFixed(3),
      ac_mode: acMode,
      timestamp: periodStart.toISOString(),
      periodLabel: this.periodLabel(periodStart)
    };
  }

  private periodKey(timestamp: string): string {
    const start = this.periodStart(timestamp);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');

    if (this.selectedTableFrequency === 'month') {
      return `${year}-${month}`;
    }
    return `${year}-${month}-${day}`;
  }

  private periodStart(timestamp: string): Date {
    const value = new Date(timestamp);
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
    const day = value.getUTCDate();

    if (this.selectedTableFrequency === 'month') {
      return new Date(Date.UTC(year, month, 1));
    }

    if (this.selectedTableFrequency === 'week') {
      const start = new Date(Date.UTC(year, month, day));
      const weekday = start.getUTCDay() || 7;
      start.setUTCDate(start.getUTCDate() - weekday + 1);
      return start;
    }

    return new Date(Date.UTC(year, month, day));
  }

  private periodLabel(start: Date): string {
    if (this.selectedTableFrequency === 'month') {
      return start.toLocaleDateString(this.currentLocale(), {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      });
    }

    if (this.selectedTableFrequency === 'week') {
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      return `${this.formatPeriodDate(start)} - ${this.formatPeriodDate(end)}`;
    }

    return this.formatPeriodDate(start);
  }

  private formatPeriodDate(value: Date): string {
    return value.toLocaleDateString(this.currentLocale(), { timeZone: 'UTC' });
  }

  private currentLocale(): string {
    const locales: Record<string, string> = {
      en: 'en-US',
      fr: 'fr-FR',
      ar: 'ar-TN'
    };
    return locales[this.translate.currentLang] || 'en-US';
  }

  private normalizeSummerScheduleRow(row: SensorData): SensorData {
    if (!this.isJulyAugust2025AfterSummerClosing(row.timestamp)) {
      return this.normalizeWorkingHoursCooling(row);
    }

    return {
      ...row,
      clients_count: 0,
      ac_mode: 'OFF',
      energy_usage: this.closedHoursEnergy(row.energy_usage)
    };
  }

  private normalizeWorkingHoursCooling(row: SensorData): SensorData {
    if (row.ac_mode !== 'OFF' || !this.isWorkingHour(row.timestamp)) {
      return row;
    }

    const temperature = Number(row.temperature);
    if (!Number.isFinite(temperature) || temperature < 30) {
      return row;
    }

    return {
      ...row,
      ac_mode: 'ON',
      energy_usage: this.ensureCoolingEnergy(row.energy_usage)
    };
  }

  private isJulyAugust2025AfterSummerClosing(timestamp: string): boolean {
    const value = new Date(timestamp);
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const hour = value.getUTCHours();

    return year === 2025 && (month === 7 || month === 8) && (hour < 8 || hour >= 14);
  }

  private isWorkingHour(timestamp: string): boolean {
    const value = new Date(timestamp);
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const hour = value.getUTCHours();

    if (value.getUTCDay() === 0 || value.getUTCDay() === 6) {
      return false;
    }

    if (year === 2025 && (month === 7 || month === 8)) {
      return hour >= 8 && hour < 14;
    }

    return hour >= 8 && hour < 17;
  }

  private closedHoursEnergy(value: string): string {
    const original = Number(value);
    if (!Number.isFinite(original)) {
      return value;
    }

    return Math.min(original, 0.25).toFixed(3);
  }

  private ensureCoolingEnergy(value: string): string {
    const original = Number(value);
    if (!Number.isFinite(original)) {
      return value;
    }

    return Math.max(original, 1.1).toFixed(3);
  }

  private configureAutoRefresh(intervalMs: number | null): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (intervalMs !== null) {
      this.pollingInterval = setInterval(() => this.loadSensorData(), intervalMs);
    }
  }

  private validateDates(): boolean {
    if (!this.dateFrom || !this.dateTo) {
      this.filterError = this.translate.instant('sensors.errors.selectDateRange');
      this.backendStatus = this.filterError;
      this.isLoading = false;
      this.hasError = false;
      this.setCardsNotAvailable();
      this.sensorRows = [];
      this.visibleRows = [];
      this.cdr.detectChanges();
      return false;
    }

    if (this.dateFrom > this.dateTo) {
      this.filterError = this.translate.instant('sensors.errors.invalidDateRange');
      this.backendStatus = this.filterError;
      this.isLoading = false;
      this.hasError = false;
      this.setCardsNotAvailable();
      this.sensorRows = [];
      this.visibleRows = [];
      this.cdr.detectChanges();
      return false;
    }

    if (this.dateFrom < SENSOR_MIN_DATE || this.dateTo > SENSOR_MAX_DATE) {
      this.filterError = this.translate.instant('sensors.errors.dateOutOfRange');
      this.backendStatus = this.filterError;
      this.isLoading = false;
      this.hasError = false;
      this.setCardsNotAvailable();
      this.sensorRows = [];
      this.visibleRows = [];
      this.cdr.detectChanges();
      return false;
    }

    this.filterError = '';
    return true;
  }

  private setCardsNotAvailable(): void {
    this.cards.temperature = this.translate.instant('common.notAvailable');
    this.cards.clientsCount = this.translate.instant('common.notAvailable');
    this.cards.activeAC = this.translate.instant('common.notAvailable');
    this.cards.systemStatus = this.translate.instant('common.notAvailable');
    this.lastUpdated = this.translate.instant('common.notAvailable');
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }
}
