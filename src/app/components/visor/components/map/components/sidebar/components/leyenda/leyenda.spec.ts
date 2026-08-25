import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Leyenda } from './leyenda';

describe('Leyenda', () => {
  let component: Leyenda;
  let fixture: ComponentFixture<Leyenda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Leyenda],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Leyenda);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
