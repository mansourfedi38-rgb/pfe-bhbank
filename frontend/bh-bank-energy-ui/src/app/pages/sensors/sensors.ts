import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService, SensorData } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, RouterLinkActive, TranslateModule],
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
  agenciesMap = new Map<number, string>();
  private pollingInterval: any;

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.translate.onLangChange.subscribe(() => {
      if (this.isLoading) {
        this.setLoadingState();
      }
    });

    // Load agency names for mapping
    this.api.getAgencies().subscribe({
      next: (agencies) => {
        agencies.forEach((a) => this.agenciesMap.set(a.id, a.name));
      },
      error: () => {
        // Continue even if agencies fail to load
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
    this.api.getSensorData().subscribe({
      next: (rows) => {
        this.isLoading = false;
        this.hasError = false;
        this.sensorRows = rows;

        if (rows.length === 0) {
          this.backendStatus = this.translate.instant('sensors.status.noDataBackend');
          this.cards.systemStatus = this.translate.instant('common.noData');
          this.cdr.detectChanges();
          return;
        }

        const avgTemperature =
          rows.reduce((sum, item) => sum + Number(item.temperature), 0) / rows.length;
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
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  getAgencyName(id: number): string {
    return this.agenciesMap.get(id) || `Agency #${id}`;
  }

  formatTemperature(val: string): string {
    return `${Number(val).toFixed(1)}°C`;
  }

  formatEnergy(val: string): string {
    return `${Number(val).toFixed(3)} kWh`;
  }

  formatTimestamp(val: string): string {
    const date = new Date(val);
    return date.toLocaleString();
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
  }
}