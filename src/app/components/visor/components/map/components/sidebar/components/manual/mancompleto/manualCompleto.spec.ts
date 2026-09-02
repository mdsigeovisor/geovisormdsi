import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualCompleto } from './manualCompleto';

describe('ManualCompleto', () => {
  let component: ManualCompleto;
  let fixture: ComponentFixture<ManualCompleto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualCompleto]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManualCompleto);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});