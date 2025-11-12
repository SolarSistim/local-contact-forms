import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export type MessageType = 'success' | 'error';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss']
})
export class MessageComponent {
  @Input() type: MessageType = 'success';
  @Input() title: string = '';
  @Input() message: string = '';

  getIcon(): string {
    return this.type === 'success' ? 'check_circle' : 'error_outline';
  }

  getIconColor(): string {
    return this.type === 'success' ? 'success' : 'error';
  }
}
