import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';
import { NavbarComponent } from '../../components/navbar/navbar';
import { ApiService, Agency, Region } from '../../services/api.service';
import { OFFICIAL_BH_NETWORK_LOCATIONS } from './official-network-locations';

@Component({
  selector: 'app-notre-reseau',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, NavbarComponent],
  templateUrl: './notre-reseau.html',
  styleUrl: './notre-reseau.scss'
})
export class NotreReseauComponent implements OnInit, AfterViewInit {
  agencies: Agency[] = [];
  filteredAgencies: Agency[] = [];
  regions: Region[] = [];
  selectedRegionId: number | null = null;
  searchKeyword = '';
  selectedType = '';
  isLoading = true;
  backendStatus = '';

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];

  agencyTypes = [
    { key: '', labelKey: 'notreReseau.types.all' },
    { key: 'SIEGE', labelKey: 'notreReseau.types.headOffice' },
    { key: 'DIRECTION_REGIONALE', labelKey: 'notreReseau.types.regionalOffice' },
    { key: 'CENTRE_AFFAIRES', labelKey: 'notreReseau.types.businessCenter' },
    { key: 'SUCCURSALE', labelKey: 'notreReseau.types.branch' },
    { key: 'AGENCE', labelKey: 'notreReseau.types.agency' },
    { key: 'GAB', labelKey: 'notreReseau.types.atm' },
  ];

  private readonly extraNetworkLocations = OFFICIAL_BH_NETWORK_LOCATIONS;
  private readonly extraRegions: Region[] = [
    { id: 24, name: 'Kasserine' },
    { id: 25, name: 'Sidi Bouzid' }
  ];

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.translate.onLangChange.subscribe(() => {
      this.applyFilters();
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.updateMarkers();
  }

  private loadData(): void {
    this.isLoading = true;
    this.backendStatus = this.translate.instant('notreReseau.status.loading');

    this.api.getRegions().subscribe({
      next: (regions) => {
        this.regions = this.mergeRegions(regions);
      },
      error: () => {
        this.backendStatus = this.translate.instant('notreReseau.status.failed');
      }
    });

    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = this.mergeNetworkLocations(agencies);
        this.applyFilters();
        this.isLoading = false;
        this.backendStatus = this.translate.instant('notreReseau.status.loaded', { count: this.agencies.length });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.updateMarkers();
        }, 0);
      },
      error: () => {
        this.isLoading = false;
        this.backendStatus = this.translate.instant('notreReseau.status.failed');
        this.cdr.detectChanges();
      }
    });
  }

  private initMap(): void {
    const mapEl = document.getElementById('agencyMap');
    if (!mapEl) return;

    this.map = L.map('agencyMap').setView([34.0, 9.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  private updateMarkers(): void {
    if (!this.map) return;

    this.markers.forEach((m) => this.map!.removeLayer(m));
    this.markers = [];

    const bounds = L.latLngBounds([]);

    this.filteredAgencies.forEach((agency) => {
      if (agency.latitude && agency.longitude) {
        const lat = Number(agency.latitude);
        const lng = Number(agency.longitude);
        const marker = L.marker([lat, lng], { icon: this.markerIcon(agency.agency_type || '') })
          .addTo(this.map!)
          .bindPopup(`<strong>${agency.name}</strong><br>${this.getTypeLabel(agency.agency_type || '')}<br>${agency.address || ''}`);
        this.markers.push(marker);
        bounds.extend([lat, lng]);
      }
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }

  applyFilters(): void {
    let result = [...this.agencies];

    if (this.selectedRegionId) {
      result = result.filter((a) => a.region === this.selectedRegionId);
    }

    if (this.selectedType) {
      result = result.filter((a) => a.agency_type === this.selectedType);
    }

    if (this.searchKeyword.trim()) {
      const kw = this.searchKeyword.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(kw) ||
          (a.address && a.address.toLowerCase().includes(kw)) ||
          this.getTypeLabel(a.agency_type || '').toLowerCase().includes(kw)
      );
    }

    this.filteredAgencies = result;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.updateMarkers();
    }, 0);
  }

  onSearch(): void {
    this.applyFilters();
  }

  selectType(type: string): void {
    this.selectedType = type;
    this.applyFilters();
  }

  focusOnMap(agency: Agency): void {
    if (this.map && agency.latitude && agency.longitude) {
      this.map.setView([Number(agency.latitude), Number(agency.longitude)], 14);
      const marker = this.markers.find(
        (m) =>
          Math.abs(m.getLatLng().lat - Number(agency.latitude!)) < 0.0001 &&
          Math.abs(m.getLatLng().lng - Number(agency.longitude!)) < 0.0001
      );
      if (marker) {
        marker.openPopup();
      }
    }
  }

  getRegionName(regionId: number): string {
    const region = this.regions.find((r) => r.id === regionId);
    return region?.name || '';
  }

  getTypeLabel(type: string): string {
    const t = this.agencyTypes.find((x) => x.key === type);
    return t ? this.translate.instant(t.labelKey) : type;
  }

  private mergeNetworkLocations(agencies: Agency[]): Agency[] {
    const existingNames = new Set(agencies.map((agency) => agency.name.trim().toLowerCase()));
    const extras = this.extraNetworkLocations.filter((location) => !existingNames.has(location.name.trim().toLowerCase()));
    return [...agencies, ...extras].sort((a, b) => {
      const typeOrder = this.typeOrder(a.agency_type || '') - this.typeOrder(b.agency_type || '');
      return typeOrder || a.name.localeCompare(b.name);
    });
  }

  private mergeRegions(regions: Region[]): Region[] {
    const regionNames = new Set(regions.map((region) => region.name.trim().toLowerCase()));
    const extras = this.extraRegions.filter((region) => !regionNames.has(region.name.trim().toLowerCase()));
    return [...regions, ...extras].sort((a, b) => a.name.localeCompare(b.name));
  }

  private markerIcon(type: string): L.DivIcon {
    const label = type === 'GAB' ? 'GAB' : 'BH';
    return L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin ${this.markerClass(type)}"><span>${label}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
  }

  private markerClass(type: string): string {
    const classes: Record<string, string> = {
      SIEGE: 'marker-head-office',
      DIRECTION_REGIONALE: 'marker-regional-office',
      CENTRE_AFFAIRES: 'marker-business-center',
      SUCCURSALE: 'marker-branch',
      GAB: 'marker-atm'
    };
    return classes[type] || 'marker-agency';
  }

  private typeOrder(type: string): number {
    const order = ['SIEGE', 'DIRECTION_REGIONALE', 'CENTRE_AFFAIRES', 'SUCCURSALE', 'AGENCE', 'GAB'];
    const index = order.indexOf(type);
    return index === -1 ? order.length : index;
  }
}
