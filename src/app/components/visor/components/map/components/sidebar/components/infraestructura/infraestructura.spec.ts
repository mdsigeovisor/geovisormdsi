import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Infraestructura } from './infraestructura';

describe('Infraestructura', () => {
  let component: Infraestructura;
  let fixture: ComponentFixture<Infraestructura>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Infraestructura]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Infraestructura);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
