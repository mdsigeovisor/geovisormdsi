import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ortofotos } from './ortofotos';

describe('Ortofotos', () => {
  let component: Ortofotos;
  let fixture: ComponentFixture<Ortofotos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ortofotos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ortofotos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
