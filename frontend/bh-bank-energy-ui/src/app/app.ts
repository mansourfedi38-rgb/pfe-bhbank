import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LanguageSwitcherComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'bh-bank-energy-ui';
}