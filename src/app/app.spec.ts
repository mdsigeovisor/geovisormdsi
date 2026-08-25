import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renderiza el outlet de enrutamiento principal', async () => {
    // Nota: la plantilla real de App es <router-outlet/>; la aserción del
    // scaffolding ("Hello, visor-mdsi") quedó obsoleta tras el refactor.
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('expone el título de la aplicación', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as { title(): string };
    expect(app.title()).toBe('visor-mdsi');
  });
});
