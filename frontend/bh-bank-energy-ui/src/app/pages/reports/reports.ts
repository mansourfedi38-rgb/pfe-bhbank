import { NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  cards = {
    dailyReport: 'N/A',
    totalEnergyTracked: 'N/A',
    agenciesCount: 'N/A',
    dataPointsCount: 'N/A'
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

    this.api.getDailyEnergyKpi().subscribe({
      next: (rows) => {
        this.isLoading = false;
        this.hasError = false;
        
        if (rows.length === 0) {
          this.backendStatus = this.translate.instant('reports.status.noDataBackend');
          this.cdr.detectChanges();
          return;
        }

        // Calculate real metrics from backend data
        const totalEnergy = rows.reduce((sum, item) => sum + Number(item.total_energy), 0);
        const uniqueAgencies = new Set(rows.map((item) => item.agency)).size;
        const totalDataPoints = rows.length;

        this.cards.dailyReport = this.translate.instant('reports.entries', { count: rows.length });
        this.cards.totalEnergyTracked = `${totalEnergy.toFixed(2)} kWh`;
        this.cards.agenciesCount = `${uniqueAgencies} agencies`;
        this.cards.dataPointsCount = `${totalDataPoints} records`;

        this.backendStatus = this.translate.instant('reports.status.loaded', { count: rows.length });
        
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('reports.status.failed', {
          error: String(err?.message ?? err)
        });
        
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
    this.backendStatus = this.translate.instant('reports.status.loading');
    this.cards.totalEnergyTracked = this.translate.instant('common.notAvailable');
    this.cards.agenciesCount = this.translate.instant('common.notAvailable');
    this.cards.dataPointsCount = this.translate.instant('common.notAvailable');
  }
}