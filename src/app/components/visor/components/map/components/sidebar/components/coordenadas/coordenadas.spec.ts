import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { UbicacionCoordenadas } from './coordenadas';

describe('UbicacionCoordenadas', () => {
  let component: UbicacionCoordenadas;
  let fixture: ComponentFixture<UbicacionCoordenadas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UbicacionCoordenadas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UbicacionCoordenadas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
