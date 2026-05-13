import { Component } from '@angular/core';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-governance',
  standalone: true,
  imports: [NavbarComponent],
  templateUrl: './governance.html',
  styleUrl: './governance.scss'
})
export class GovernanceComponent {}
