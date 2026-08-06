import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapService } from '@app/services/map.service';
import { Imprimir } from './imprimir';

describe('Imprimir', () => {
  let component: Imprimir;
  let fixture: ComponentFixture<Imprimir>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Imprimir],
      providers: [
        {
          provide: MapService,
          useValue: {
            map: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Imprimir);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should build an export canvas when layer elements have no transform', () => {
    const viewport = document.createElement('div');
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = 100;
    layerCanvas.height = 100;
    viewport.appendChild(layerCanvas);

    const map = {
      getViewport: () => viewport,
    } as any;

    const context = {
      clearRect: jasmine.createSpy('clearRect'),
      save: jasmine.createSpy('save'),
      restore: jasmine.createSpy('restore'),
      setTransform: jasmine.createSpy('setTransform'),
      drawImage: jasmine.createSpy('drawImage'),
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(context);

    const canvas = (component as any).buildExportCanvas(map, 200, 150);

    expect(canvas).toBeTruthy();
    expect(canvas?.width).toBe(200);
    expect(canvas?.height).toBe(150);
  });
});
