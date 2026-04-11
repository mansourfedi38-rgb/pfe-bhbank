import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SensorsComponent } from './sensors';

describe('Sensors', () => {
  let component: SensorsComponent;
  let fixture: ComponentFixture<SensorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensorsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SensorsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
