import { NgIf } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-energy-usage',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './energy-usage.html',
  styleUrl: './energy-usage.scss'
})
export class EnergyUsageComponent implements OnInit {
  backendStatus = '';
  isLoading = true;
  hasError = false;
  cards = {
    totalEnergy: 'N/A',
    averageEnergyPerDay: 'N/A',
    totalAgenciesTracked: 'N/A',
    latestReading: 'N/A'
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
          this.backendStatus = this.translate.instant('energyUsage.status.noDataBackend');
          this.cdr.detectChanges();
          return;
        }

        // Calculate real metrics from backend data
        const totalEnergy = rows.reduce((sum, item) => sum + Number(item.total_energy), 0);
        const uniqueDates = new Set(rows.map(item => item.date)).size;
        const uniqueAgencies = new Set(rows.map(item => item.agency)).size;
        const avgEnergyPerDay = uniqueDates > 0 ? totalEnergy / uniqueDates : 0;
        
        // Find latest reading date
        const sortedDates = rows.map(item => item.date).sort().reverse();
        const latestDate = sortedDates.length > 0 ? sortedDates[0] : 'N/A';

        this.cards.totalEnergy = `${totalEnergy.toFixed(2)} kWh`;
        this.cards.averageEnergyPerDay = `${avgEnergyPerDay.toFixed(2)} kWh`;
        this.cards.totalAgenciesTracked = `${uniqueAgencies} agencies`;
        this.cards.latestReading = latestDate !== 'N/A' ? latestDate : this.translate.instant('common.noData');
        
        this.backendStatus = this.translate.instant('energyUsage.status.loaded', {
          count: rows.length
        });
        
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.backendStatus = this.translate.instant('energyUsage.status.failed', {
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
    this.backendStatus = this.translate.instant('energyUsage.status.loading');
  }
}