import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Descargaspdf } from './descargaspdf';

describe('Descargaspdf', () => {
  let component: Descargaspdf;
  let fixture: ComponentFixture<Descargaspdf>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Descargaspdf]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Descargaspdf);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
