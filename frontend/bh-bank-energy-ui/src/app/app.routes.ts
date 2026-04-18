import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { SensorsComponent } from './pages/sensors/sensors';
import { EnergyUsageComponent } from './pages/energy-usage/energy-usage';
import { ReportsComponent } from './pages/reports/reports';
import { CompareAgenciesComponent } from './pages/compare-agencies/compare-agencies';
import { SettingsComponent } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'sensors', component: SensorsComponent },
  { path: 'energy-usage', component: EnergyUsageComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'compare-agencies', component: CompareAgenciesComponent },
  { path: 'settings', component: SettingsComponent }
];