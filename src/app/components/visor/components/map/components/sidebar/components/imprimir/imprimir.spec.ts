import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Imprimir } from './imprimir';

describe('Imprimir', () => {
  let component: Imprimir;
  let fixture: ComponentFixture<Imprimir>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Imprimir]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Imprimir);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
