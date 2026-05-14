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
  visibleRows: SensorData[] = [];
  agencies: Agency[] = [];
  agenciesMap = new Map<number, string>();
  lastUpdated = '';
  selectedAgencyId: number | null = null;
  selectedAcMode: 'OFF' | 'ECO' | 'ON' | '' = '';
  dateFrom = '';
  dateTo = '';
  filterError = '';
  private hasAppliedFilters = false;
  private pollingInterval: any;
  private temperatureUnitSubscription?: { unsubscribe: () => void };
  private autoRefreshSubscription?: { unsubscribe: () => void };

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
      this.cdr.detectChanges();
    });
    this.autoRefreshSubscription = this.autoRefresh.interval$.subscribe((interval) => {
      this.configureAutoRefresh(this.autoRefresh.toMilliseconds(interval));
    });
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.temperatureUnitSubscription?.unsubscribe();
    this.autoRefreshSubscription?.unsubscribe();
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

    if (this.selectedAgencyId) filters.agency = this.selectedAgencyId;
    if (this.selectedAcMode) filters.ac_mode = this.selectedAcMode;
    if (this.dateFrom) filters.date_from = this.dateFrom;
    if (this.dateTo) filters.date_to = this.dateTo;

    this.api.getSensorData(filters).subscribe({
      next: (rows) => {
        const allowedAgencyIds = new Set(this.agencies.map((agency) => agency.id));
        const scopedRows = rows.filter((row) => allowedAgencyIds.has(row.agency));

        this.isLoading = false;
        this.hasError = false;
        this.filterError = '';
        this.sensorRows = scopedRows;
        this.visibleRows = scopedRows.slice(0, 20);
        this.lastUpdated = new Date().toLocaleString();

        if (scopedRows.length === 0) {
          this.backendStatus = this.translate.instant('sensors.status.noDataBackend');
          this.cards.systemStatus = this.translate.instant('common.noData');
          this.cdr.detectChanges();
          return;
        }

        const avgClients = scopedRows.reduce((sum, item) => sum + Number(item.clients_count), 0) / scopedRows.length;
        const activeAc = scopedRows.filter((item) => item.ac_mode !== 'OFF').length;

        this.updateTemperatureCard();
        this.cards.clientsCount = this.translate.instant('sensors.metrics.clients', {
          count: avgClients.toFixed(0)
        });
        this.cards.activeAC = this.translate.instant('sensors.metrics.activeAc', {
          active: activeAc,
          total: scopedRows.length
        });
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
    return new Date(val).toLocaleString();
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
    if (!this.selectedAgencyId) {
      this.filterError = this.translate.instant('sensors.errors.selectAgency');
      this.backendStatus = this.filterError;
      this.isLoading = false;
      this.hasError = false;
      this.setCardsNotAvailable();
      this.sensorRows = [];
      this.visibleRows = [];
      this.cdr.detectChanges();
      return false;
    }

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
