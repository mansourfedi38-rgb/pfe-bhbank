import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sensors.html',
  styleUrl: './sensors.scss'
})
export class SensorsComponent {}
