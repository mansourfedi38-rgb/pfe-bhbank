import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnergyUsageComponent } from './energy-usage';

describe('EnergyUsage', () => {
  let component: EnergyUsageComponent;
  let fixture: ComponentFixture<EnergyUsageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnergyUsageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EnergyUsageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
