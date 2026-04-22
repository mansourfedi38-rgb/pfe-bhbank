import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-energy-usage',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './energy-usage.html',
  styleUrl: './energy-usage.scss'
})
export class EnergyUsageComponent implements OnInit {
  backendStatus = '';
  cards = {
    todayConsumption: 'N/A',
    weeklyConsumption: 'N/A',
    monthlyAverage: 'N/A',
    optimizationRate: 'N/A'
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.translate.onLangChange.subscribe(() => this.setLoadingState());

    this.api.getDailyEnergyKpi().subscribe({
      next: (rows) => {
        if (rows.length === 0) {
          this.backendStatus = this.translate.instant('energyUsage.status.noDataBackend');
          return;
        }

        const values = rows.map((item) => Number(item.total_energy));
        const total = values.reduce((sum, value) => sum + value, 0);
        const avg = total / values.length;

        this.cards.todayConsumption = `${avg.toFixed(2)} kWh`;
        this.cards.weeklyConsumption = `${(avg * 7).toFixed(2)} kWh`;
        this.cards.monthlyAverage = `${(avg * 30).toFixed(2)} kWh`;
        this.cards.optimizationRate = `${Math.max(0, Math.min(100, 100 - avg)).toFixed(1)}%`;
        this.backendStatus = this.translate.instant('energyUsage.status.loaded', {
          count: rows.length
        });
      },
      error: (err) => {
        this.backendStatus = this.translate.instant('energyUsage.status.failed', {
          error: String(err?.message ?? err)
        });
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }

  private setLoadingState(): void {
    this.backendStatus = this.translate.instant('energyUsage.status.loading');
  }
}