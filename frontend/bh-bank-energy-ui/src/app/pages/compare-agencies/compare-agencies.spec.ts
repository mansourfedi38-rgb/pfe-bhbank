import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareAgenciesComponent } from './compare-agencies';

describe('CompareAgencies', () => {
  let component: CompareAgenciesComponent;
  let fixture: ComponentFixture<CompareAgenciesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareAgenciesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareAgenciesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
