import { NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  cards = {
    temperature: '',
    clientsCount: '',
    activeAC: '',
    systemStatus: ''
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.translate.onLangChange.subscribe(() => {
      if (this.isLoading) {
        this.setLoadingState();
      }
    });

    this.api.getSensorData().subscribe({
      next: (rows) => {
        this.isLoading = false;
        this.hasError = false;
        
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
        
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('sensors.status.failed', {
          error: String(err?.message ?? err)
        });
        this.cards.systemStatus = this.translate.instant('sensors.systemOffline');
        
        // Force change detection
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
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