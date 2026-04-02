import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService } from '../../services/language';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  constructor(
    private router: Router,
    public languageService: LanguageService
  ) {}

  logout() {
    this.router.navigate(['/login']);
  }
}