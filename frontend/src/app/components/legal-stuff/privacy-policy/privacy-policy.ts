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
  selector: 'app-privacy-policy-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {
  shouldBounce = false;

  constructor(
    public dialogRef: MatDialogRef<PrivacyPolicy>,
    @Inject(MAT_DIALOG_DATA) public data: PolicyDialogData
  ) {

    // Listen for backdrop clicks
    this.dialogRef.backdropClick().subscribe(() => {
      this.triggerBounce();
    });
  }

  triggerBounce(): void {

    // APPROACH 1: Angular binding with microtask to ensure change detection
    Promise.resolve().then(() => {
      this.shouldBounce = true;
    });

    // APPROACH 2: Direct DOM manipulation with Web Animations API
    setTimeout(() => {
      const dialogButtons = document.querySelectorAll('.policy-dialog-panel mat-dialog-actions button');

      const buttonElement = dialogButtons[dialogButtons.length - 1] as HTMLElement;

      if (buttonElement) {

        // Add the bounce class
        buttonElement.classList.add('bounce');

        // Use Web Animations API for the physical-feeling bounce
        const bounceAnimation = buttonElement.animate([
          { transform: 'translateY(0)', offset: 0, easing: 'ease-out' },
          { transform: 'translateY(-20px)', offset: 0.25, easing: 'ease-in' },
          { transform: 'translateY(0)', offset: 0.5, easing: 'ease-out' },
          { transform: 'translateY(-8px)', offset: 0.75, easing: 'ease-in' },
          { transform: 'translateY(0)', offset: 1 }
        ], {
          duration: 550,
          easing: 'linear' // base; per-keyframe easings do the real work
        });


        const updateText = (add: boolean) => {
          const walker = document.createTreeWalker(
            buttonElement,
            NodeFilter.SHOW_TEXT,
            null
          );

          // You can implement DOM text tweaks here if you want,
          // but Angular is already handling the "[BOUNCING!!!]" text.
          let textNode = walker.nextNode();
        };

        updateText(true);

        bounceAnimation.onfinish = () => {
          buttonElement.classList.remove('bounce');
          buttonElement.style.border = '';
          buttonElement.style.backgroundColor = '';
          buttonElement.style.color = '';
          updateText(false);
          this.shouldBounce = false;
        };
      } else {
        console.log(
          'Privacy Policy Dialog - Available dialog elements:',
          document.querySelectorAll('.policy-dialog-panel').length
        );
      }
    }, 50);
  }

  onAcknowledge(): void {
    this.dialogRef.close(true);
  }
}
