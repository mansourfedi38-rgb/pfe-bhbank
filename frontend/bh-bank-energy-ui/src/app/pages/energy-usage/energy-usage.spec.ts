import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnergyUsage } from './energy-usage';

describe('EnergyUsage', () => {
  let component: EnergyUsage;
  let fixture: ComponentFixture<EnergyUsage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnergyUsage],
    }).compileComponents();

    fixture = TestBed.createComponent(EnergyUsage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
