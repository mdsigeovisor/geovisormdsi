import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CoordinateInfo } from './coordinate-info';

describe('CoordinateInfo', () => {
  let component: CoordinateInfo;
  let fixture: ComponentFixture<CoordinateInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinateInfo],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoordinateInfo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
