import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { PolicyDialogData } from '../privacy-policy/privacy-policy';

@Component({
  selector: 'app-ada-statement',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ],
  templateUrl: './ada-statement.html',
  styleUrl: './ada-statement.scss',
  encapsulation: ViewEncapsulation.None
})
export class AdaStatement {
  shouldBounce = false;

  constructor(
      public dialogRef: MatDialogRef<AdaStatement>,
      @Inject(MAT_DIALOG_DATA) public data: PolicyDialogData
    ) {
      
      // Listen for backdrop clicks
      this.dialogRef.backdropClick().subscribe(() => {
        this.triggerBounce();
      });
      
    }

    triggerBounce(): void {
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
          
          // Add inline styles
          
          // CRITICAL: Use Web Animations API to animate the button
          // This works regardless of CSS loading issues
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
        
          
          // Update button text
          const updateText = (add: boolean) => {
            const walker = document.createTreeWalker(
              buttonElement,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let textNode = walker.nextNode();
          };
          
          updateText(true);
          
          // Remove styles after animation completes
          bounceAnimation.onfinish = () => {
            buttonElement.classList.remove('bounce');
            buttonElement.style.border = '';
            buttonElement.style.backgroundColor = '';
            buttonElement.style.color = '';
            updateText(false);
            this.shouldBounce = false;
          };
        } else {
          console.error('ADA Statement Dialog - Button element still not found!');
          console.log('ADA Statement Dialog - Available dialog elements:', 
            document.querySelectorAll('.policy-dialog-panel').length);
        }
      }, 50);
    }

    onAcknowledge(): void {
      this.dialogRef.close(true);
    }
}