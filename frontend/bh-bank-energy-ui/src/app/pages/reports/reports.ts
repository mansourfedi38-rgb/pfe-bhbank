import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent {
  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/login']);
  }
}