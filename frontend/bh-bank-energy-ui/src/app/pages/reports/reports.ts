import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  backendStatus = '';
  cards = {
    dailyReport: 'N/A',
    weeklyReport: 'N/A',
    monthlyAnalysis: 'N/A',
    performanceScore: 'N/A'
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
        this.cards.dailyReport = `${rows.length} entries`;
        this.cards.weeklyReport = rows.length > 0
          ? this.translate.instant('reports.generated')
          : this.translate.instant('common.noData');
        this.cards.monthlyAnalysis = rows.length > 0
          ? this.translate.instant('reports.updated')
          : this.translate.instant('common.noData');

        if (rows.length > 0) {
          const uniqueAgencies = new Set(rows.map((item) => item.agency)).size;
          const score = Math.min(100, Math.round((uniqueAgencies / Math.max(1, rows.length)) * 100));
          this.cards.performanceScore = `${score}%`;
        } else {
          this.cards.performanceScore = '0%';
        }

        this.backendStatus = this.translate.instant('reports.status.loaded', { count: rows.length });
      },
      error: (err) => {
        this.backendStatus = this.translate.instant('reports.status.failed', {
          error: String(err?.message ?? err)
        });
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }

  private setLoadingState(): void {
    this.backendStatus = this.translate.instant('reports.status.loading');
    this.cards.weeklyReport = this.translate.instant('common.notAvailable');
    this.cards.monthlyAnalysis = this.translate.instant('common.notAvailable');
  }
}