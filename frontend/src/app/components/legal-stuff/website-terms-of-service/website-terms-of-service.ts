import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface PolicyDialogData {
  title: string;
  type: 'terms' | 'privacy' | 'ada';

  // Dynamic client/tenant data
  clientName?: string;
  clientWebsite?: string;
  clientEmail?: string;
  clientAddressLine1?: string;
  clientAddressLine2?: string;
  clientCity?: string;
  clientState?: string;
  clientZip?: string;
}

@Component({
  selector: 'app-website-terms-of-service',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './website-terms-of-service.html',
  styleUrl: './website-terms-of-service.scss'
})
export class WebsiteTermsOfService {
  shouldBounce = false;

  constructor(
    public dialogRef: MatDialogRef<WebsiteTermsOfService>,
    @Inject(MAT_DIALOG_DATA) public data: PolicyDialogData
  ) {

    // Listen for backdrop clicks
    this.dialogRef.backdropClick().subscribe(() => {
      this.triggerBounce();
    });
  }

  triggerBounce(): void {

    // Angular binding: ensure change detection sees shouldBounce = true
    Promise.resolve().then(() => {
      this.shouldBounce = true;
    });

    // Direct DOM manipulation with Web Animations API
    setTimeout(() => {
      const dialogButtons = document.querySelectorAll('.policy-dialog-panel mat-dialog-actions button');

      const buttonElement = dialogButtons[dialogButtons.length - 1] as HTMLElement;

      if (buttonElement) {

        // Add the bounce class for any CSS-based tweaks
        buttonElement.classList.add('bounce');

        // Web Animations API bounce
        const bounceAnimation = buttonElement.animate([
          { transform: 'translateY(0)', offset: 0, easing: 'ease-out' },
          { transform: 'translateY(-20px)', offset: 0.25, easing: 'ease-in' },
          { transform: 'translateY(0)', offset: 0.5, easing: 'ease-out' },
          { transform: 'translateY(-8px)', offset: 0.75, easing: 'ease-in' },
          { transform: 'translateY(0)', offset: 1 }
        ], {
          duration: 550,
          easing: 'linear' // per-keyframe easings do the real work
        });


        bounceAnimation.onfinish = () => {
          buttonElement.classList.remove('bounce');
          this.shouldBounce = false;
        };
      } else {
        console.log(
          'Website TOS Dialog - Available dialog elements:',
          document.querySelectorAll('.policy-dialog-panel').length
        );
      }
    }, 50);
  }

  onAcknowledge(): void {
    this.dialogRef.close(true);
  }
}
