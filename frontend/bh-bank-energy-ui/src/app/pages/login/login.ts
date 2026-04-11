import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  constructor(private router: Router) {}

  // NOTE: Authentication is not implemented yet. This is a demo/stub flow.
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}