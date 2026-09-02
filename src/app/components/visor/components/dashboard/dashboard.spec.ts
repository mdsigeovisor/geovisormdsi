import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { Dashboard } from './dashboard';
import { MapService } from '@app/services/map.service';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  const mapServiceStub = {
    // Devuelve una muestra para ejercitar el procesamiento y el render.
    getConformidadObraData: () => of([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { txttipobra: 'Ampliación', codanoconformidad: 'Conforme' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { txttipobra: 'Ampliación', codanoconformidad: 'Conforme' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { txttipobra: 'Construcción', codanoconformidad: 'No conforme' } },
    ]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        { provide: MapService, useValue: mapServiceStub },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should count registros totales', () => {
    expect(component.totalRegistros).toBe(3);
  });

  it('should clasificar por txttipobra y codanoconformidad', () => {
    expect(component.tipObras).toEqual(['Ampliación', 'Construcción']);
    expect(component.codConformidad).toEqual(['Conforme', 'No conforme']);
    expect(component.matriz[0][0]).toBe(2);
    expect(component.matriz[1][1]).toBe(1);
  });
});
