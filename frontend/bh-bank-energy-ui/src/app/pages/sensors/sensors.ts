import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent implements OnInit {
  backendStatus = '';
  cards = {
    temperature: '',
    humidity: '',
    airQuality: '',
    systemStatus: ''
  };

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.setLoadingState();
    this.translate.onLangChange.subscribe(() => this.setLoadingState());

    this.api.getSensorData().subscribe({
      next: (rows) => {
        if (rows.length === 0) {
          this.backendStatus = this.translate.instant('sensors.status.noDataBackend');
          this.cards.systemStatus = this.translate.instant('common.noData');
          return;
        }

        const avgTemperature =
          rows.reduce((sum, item) => sum + Number(item.temperature), 0) / rows.length;
        const avgClients = rows.reduce((sum, item) => sum + Number(item.clients_count), 0) / rows.length;
        const activeAc = rows.filter((item) => item.ac_mode !== 'OFF').length;

        this.cards.temperature = `${avgTemperature.toFixed(1)}°C`;
        this.cards.humidity = this.translate.instant('sensors.metrics.clients', {
          count: avgClients.toFixed(0)
        });
        this.cards.airQuality = this.translate.instant('sensors.metrics.activeAc', {
          active: activeAc,
          total: rows.length
        });
        this.cards.systemStatus = this.translate.instant('sensors.systemOnline');
        this.backendStatus = this.translate.instant('sensors.status.loaded', { count: rows.length });
      },
      error: (err) => {
        this.backendStatus = this.translate.instant('sensors.status.failed', {
          error: String(err?.message ?? err)
        });
        this.cards.systemStatus = this.translate.instant('sensors.systemOffline');
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }

  private setLoadingState(): void {
    this.backendStatus = this.translate.instant('sensors.status.loading');
    this.cards.temperature = this.translate.instant('common.notAvailable');
    this.cards.humidity = this.translate.instant('common.notAvailable');
    this.cards.airQuality = this.translate.instant('common.notAvailable');
    this.cards.systemStatus = this.translate.instant('common.notAvailable');
  }
}