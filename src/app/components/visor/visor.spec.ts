import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Visor } from './visor';

describe('Visor', () => {
  let component: Visor;
  let fixture: ComponentFixture<Visor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Visor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Visor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
