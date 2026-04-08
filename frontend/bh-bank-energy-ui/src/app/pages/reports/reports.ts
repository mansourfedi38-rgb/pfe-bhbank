import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  backendStatus = 'Loading reports from backend...';
  cards = {
    dailyReport: 'N/A',
    weeklyReport: 'N/A',
    monthlyAnalysis: 'N/A',
    performanceScore: 'N/A'
  };

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.api.getDailyEnergyKpi().subscribe({
      next: (rows) => {
        this.cards.dailyReport = `${rows.length} entries`;
        this.cards.weeklyReport = rows.length > 0 ? 'Generated' : 'No data';
        this.cards.monthlyAnalysis = rows.length > 0 ? 'Updated' : 'No data';

        if (rows.length > 0) {
          const uniqueAgencies = new Set(rows.map((item) => item.agency)).size;
          const score = Math.min(100, Math.round((uniqueAgencies / Math.max(1, rows.length)) * 100));
          this.cards.performanceScore = `${score}%`;
        } else {
          this.cards.performanceScore = '0%';
        }

        this.backendStatus = `Reports loaded from ${rows.length} backend KPI rows.`;
      },
      error: (err) => {
        this.backendStatus = `Reports backend load failed: ${String(err?.message ?? err)}`;
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }
}