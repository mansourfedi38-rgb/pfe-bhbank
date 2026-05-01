import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Agency, ApiService, SensorData } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, RouterLink, RouterLinkActive, TranslateModule],
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
  private pollingInterval: any;

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        agencies.forEach((agency) => this.agenciesMap.set(agency.id, agency.name));
      }
    });

    this.loadSensorData();
    this.pollingInterval = setInterval(() => this.loadSensorData(), 5000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  loadSensorData(): void {
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
        this.isLoading = false;
        this.hasError = false;
        this.sensorRows = rows;
        this.visibleRows = rows.slice(0, 20);
        this.lastUpdated = new Date().toLocaleString();

        if (rows.length === 0) {
          this.backendStatus = this.translate.instant('sensors.status.noDataBackend');
          this.cards.systemStatus = this.translate.instant('common.noData');
          this.cdr.detectChanges();
          return;
        }

        const avgTemperature = rows.reduce((sum, item) => sum + Number(item.temperature), 0) / rows.length;
        const avgClients = rows.reduce((sum, item) => sum + Number(item.clients_count), 0) / rows.length;
        const activeAc = rows.filter((item) => item.ac_mode !== 'OFF').length;

        this.cards.temperature = `${avgTemperature.toFixed(1)}°C`;
        this.cards.clientsCount = this.translate.instant('sensors.metrics.clients', {
          count: avgClients.toFixed(0)
        });
        this.cards.activeAC = this.translate.instant('sensors.metrics.activeAc', {
          active: activeAc,
          total: rows.length
        });
        this.cards.systemStatus = this.translate.instant('sensors.systemOnline');
        this.backendStatus = this.translate.instant('sensors.status.loaded', { count: rows.length });
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

  logout() {
    this.auth.logout();
  }

  applyFilters(): void {
    this.isLoading = true;
    this.loadSensorData();
  }

  clearFilters(): void {
    this.selectedAgencyId = null;
    this.selectedAcMode = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  getAgencyName(id: number): string {
    return this.agenciesMap.get(id) || this.translate.instant('common.agencyNumber', { id });
  }

  formatTemperature(val: string): string {
    return `${Number(val).toFixed(1)}°C`;
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
    this.backendStatus = this.translate.instant('sensors.status.loading');
    this.cards.temperature = this.translate.instant('common.notAvailable');
    this.cards.clientsCount = this.translate.instant('common.notAvailable');
    this.cards.activeAC = this.translate.instant('common.notAvailable');
    this.cards.systemStatus = this.translate.instant('common.notAvailable');
    this.lastUpdated = this.translate.instant('common.notAvailable');
  }
}
