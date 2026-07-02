import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  version : string = '';
  logoutClick(){}
    
  ngOnInit(): void {
    this.version = `${environment.version} ${environment.ambiente}`;    
  }  
}
