import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent {
  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/login']);
  }
}