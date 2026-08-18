import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit, OnDestroy {
  showLogoutModal = signal(false);
  visitCount = 1234;
  private intervalId: any;
  constructor(private readonly router: Router) {}
  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      if (this.visitCount < 2000) {
        this.visitCount++;
      } else {
        clearInterval(this.intervalId);
      }
    }, 10);
  }
  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }
  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.router.navigate(['/auth']);
  }
  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}