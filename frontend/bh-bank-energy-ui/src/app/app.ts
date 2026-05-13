import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Footer } from './shared/footer/footer';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'bh-bank-energy-ui';

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {
    this.themeService.init();
  }

  get shouldShowFooter(): boolean {
    return !this.router.url.startsWith('/login');
  }
}
