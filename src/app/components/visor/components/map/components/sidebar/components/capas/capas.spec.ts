import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Capas } from './capas';

describe('Capas', () => {
  let component: Capas;
  let fixture: ComponentFixture<Capas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Capas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Capas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
