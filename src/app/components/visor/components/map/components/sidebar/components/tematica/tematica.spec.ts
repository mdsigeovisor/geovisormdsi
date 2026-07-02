import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tematica } from './tematica';

describe('Tematica', () => {
  let component: Tematica;
  let fixture: ComponentFixture<Tematica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tematica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tematica);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
