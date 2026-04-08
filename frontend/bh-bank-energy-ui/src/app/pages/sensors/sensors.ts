import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent implements OnInit {
  backendStatus = 'Loading sensors from backend...';
  cards = {
    temperature: 'N/A',
    humidity: 'N/A',
    airQuality: 'N/A',
    systemStatus: 'N/A'
  };

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.api.getSensorData().subscribe({
      next: (rows) => {
        if (rows.length === 0) {
          this.backendStatus = 'No sensor data in backend.';
          this.cards.systemStatus = 'No data';
          return;
        }

        const avgTemperature =
          rows.reduce((sum, item) => sum + Number(item.temperature), 0) / rows.length;
        const avgClients = rows.reduce((sum, item) => sum + Number(item.clients_count), 0) / rows.length;
        const activeAc = rows.filter((item) => item.ac_mode !== 'OFF').length;

        this.cards.temperature = `${avgTemperature.toFixed(1)}°C`;
        this.cards.humidity = `${avgClients.toFixed(0)} clients`;
        this.cards.airQuality = `${activeAc}/${rows.length} active AC`;
        this.cards.systemStatus = 'Online';
        this.backendStatus = `Loaded ${rows.length} backend sensor rows.`;
      },
      error: (err) => {
        this.backendStatus = `Sensor backend load failed: ${String(err?.message ?? err)}`;
        this.cards.systemStatus = 'Offline';
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }
}