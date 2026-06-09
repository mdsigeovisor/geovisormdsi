import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    RouterOutlet,
  ],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export default class Auth {

}
