import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  kpiStatus = 'Loading daily KPI...';

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    // Placeholder: fetch a small sample from Django to validate /api proxy wiring.
    this.api.getDailyEnergyKpi().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.kpiStatus = `Daily KPI loaded (${data.length} rows).`;
        } else {
          this.kpiStatus = 'Daily KPI loaded.';
        }
      },
      error: (err) => {
        // Keep it simple: status is enough to validate dev connectivity.
        this.kpiStatus = `Daily KPI failed to load: ${String(err?.message ?? err)}`;
        console.error('Daily KPI load error', err);
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }
}