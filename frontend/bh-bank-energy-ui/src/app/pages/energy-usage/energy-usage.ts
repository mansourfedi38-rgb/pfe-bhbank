import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-energy-usage',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './energy-usage.html',
  styleUrl: './energy-usage.scss'
})
export class EnergyUsageComponent {
  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/login']);
  }
}