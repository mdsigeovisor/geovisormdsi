import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Consultas } from './consultas';

describe('Consultas', () => {
  let component: Consultas;
  let fixture: ComponentFixture<Consultas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Consultas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Consultas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
