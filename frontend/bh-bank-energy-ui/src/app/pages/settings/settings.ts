import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  notifications = 'Enabled';
  theme = 'Default';
  language = 'English';

  constructor(
    private router: Router,
    public languageService: LanguageService
  ) {
    this.language = this.languageService.currentLanguage;
  }

  logout() {
    this.router.navigate(['/login']);
  }

  manageSecurity() {
    alert('Security settings page will be added later.');
  }

  changeLanguage() {
    this.languageService.setLanguage(this.language);
  }
}