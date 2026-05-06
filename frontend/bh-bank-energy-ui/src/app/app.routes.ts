import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { SensorsComponent } from './pages/sensors/sensors';
import { EnergyUsageComponent } from './pages/energy-usage/energy-usage';
import { ReportsComponent } from './pages/reports/reports';
import { CompareAgenciesComponent } from './pages/compare-agencies/compare-agencies';
import { SettingsComponent } from './pages/settings/settings';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'sensors', component: SensorsComponent, canActivate: [authGuard] },
  { path: 'energy-usage', component: EnergyUsageComponent, canActivate: [authGuard] },
  { path: 'reports', component: ReportsComponent, canActivate: [authGuard] },
  { path: 'compare-agencies', component: CompareAgenciesComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent }
];