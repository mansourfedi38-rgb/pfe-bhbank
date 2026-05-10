import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';
import { NavbarComponent } from '../../components/navbar/navbar';
import { ApiService, Agency, Region } from '../../services/api.service';

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
    { key: '', label: 'Tous' },
    { key: 'AGENCE', label: 'Agence' },
    { key: 'CENTRE_AFFAIRES', label: "Centre d'affaires" },
    { key: 'DIRECTION_REGIONALE', label: 'Direction régionale' },
    { key: 'SIEGE', label: 'Siège' },
    { key: 'SUCCURSALE', label: 'Succursale' },
    { key: 'GAB', label: 'GAB' },
  ];

  constructor(
    private api: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
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
        this.regions = regions;
      },
      error: () => {
        this.backendStatus = this.translate.instant('notreReseau.status.failed');
      }
    });

    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = agencies;
        this.applyFilters();
        this.isLoading = false;
        this.backendStatus = this.translate.instant('notreReseau.status.loaded', { count: agencies.length });
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

    // Clear existing markers
    this.markers.forEach((m) => this.map!.removeLayer(m));
    this.markers = [];

    const icon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="marker-pin"><span>BH</span></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const bounds = L.latLngBounds([]);

    this.filteredAgencies.forEach((agency) => {
      if (agency.latitude && agency.longitude) {
        const lat = Number(agency.latitude);
        const lng = Number(agency.longitude);
        const marker = L.marker([lat, lng], { icon })
          .addTo(this.map!)
          .bindPopup(`<strong>${agency.name}</strong><br>${agency.address || ''}`);
        this.markers.push(marker);
        bounds.extend([lat, lng]);
      }
    });

    // Fit map to show all markers with padding
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
          (a.address && a.address.toLowerCase().includes(kw))
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
    return t?.label || type;
  }
}
