import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Normativa } from './normativa';

describe('Normativa', () => {
  let component: Normativa;
  let fixture: ComponentFixture<Normativa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Normativa]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Normativa);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
