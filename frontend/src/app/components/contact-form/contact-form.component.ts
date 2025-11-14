import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { TenantConfig } from '../../types/tenant-config';
import { LoaderComponent } from '../loader/loader.component';
import { MessageComponent } from '../message/message.component';
import { MatMenuModule } from '@angular/material/menu';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AdaStatement } from '../legal-stuff/ada-statement/ada-statement';
import { PrivacyPolicy, PolicyDialogData } from '../legal-stuff/privacy-policy/privacy-policy';
import { WebsiteTermsOfService } from '../legal-stuff/website-terms-of-service/website-terms-of-service';

// Declare grecaptcha for TypeScript
declare const grecaptcha: any;

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    LoaderComponent,
    MessageComponent,
    MatMenuModule,
    MatDialogModule
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent implements OnInit, AfterViewInit, OnDestroy {

  contactForm!: FormGroup;
  tenantConfig: TenantConfig | null = null;
  reasonOptions: string[] = [];
  loading = true;
  submitting = false;
  error: string | null = null;
  success = false;
  tenantId: string | null = null;

  // reCAPTCHA configuration
  private recaptchaSiteKey = '6LcKsAwsAAAAABbClubGJhDxBTmT7eHYUUpXDfnV'; // Replace with your actual site key
  private recaptchaLoaded = false;
  private recaptchaWidgetId: number | null = null;
  private recaptchaScriptLoaded = false;
  private recaptchaRenderAttempts = 0;
  private maxRenderAttempts = 10;

  // Custom Validators
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return { required: true };
    }
    
    // Must have at least 1 character (trim whitespace first)
    const trimmedValue = control.value.trim();
    if (trimmedValue.length < 1) {
      return { minlength: { requiredLength: 1, actualLength: trimmedValue.length } };
    }
    
    return null;
  }

  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return { required: true };
    }

    // Remove all whitespace and special characters for validation
    const cleanedPhone = control.value.replace(/[\s\-()]/g, '');
    
    // Check if it contains only digits
    if (!/^\d+$/.test(cleanedPhone)) {
      return { invalidPhone: true };
    }

    // Must be exactly 10 digits
    if (cleanedPhone.length !== 10) {
      return { phoneLength: true };
    }

    // Validate against allowed formats:
    // 8504802892
    // (850) 480-2892
    // 850-480-2892
    // 850 480-2892
    // 850 4802892
    const phonePattern = /^(\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4})$/;
    
    if (!phonePattern.test(control.value)) {
      return { invalidFormat: true };
    }

    return null;
  }

  private emailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return { required: true };
    }

    // Email pattern: emailprefix@domain.extension (extension must be at least 2 characters)
    // This allows:
    // - One or more characters before @
    // - @ symbol
    // - One or more characters for domain
    // - . (dot)
    // - At least 2 characters for extension
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    
    if (!emailPattern.test(control.value)) {
      return { invalidEmail: true };
    }

    return null;
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private themeService: ThemeService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.tenantId = params['tenantId'] || null;

      // Fallback to window location search if not found in route params
      if (!this.tenantId && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        this.tenantId = urlParams.get('tenantId');
      }

      if (this.tenantId) {
        this.loadTenantConfig();
      }
    });

    this.initializeForm();
    this.loadRecaptcha();
  }

  ngAfterViewInit(): void {
    // Try to render reCAPTCHA after view is initialized
    if (this.recaptchaScriptLoaded) {
      this.attemptRecaptchaRender();
    }
  }

  ngOnDestroy(): void {
    // Clean up reCAPTCHA
    if (this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
      try {
        grecaptcha.reset(this.recaptchaWidgetId);
      } catch (e) {
        console.error('Error resetting reCAPTCHA:', e);
      }
    }
  }

  loadTenantConfig(): void {
    if (!this.tenantId) return;

    this.apiService.getTenantConfig(this.tenantId).subscribe({
      next: (response) => {
        if (response.success && response.valid) {
          this.tenantConfig = response.config;
          // Parse reason_for_contact options
          if (response.config.reason_for_contact) {
            this.reasonOptions = response.config.reason_for_contact
              .split(',')
              .map(reason => reason.trim())
              .filter(reason => reason.length > 0);
          }
          // Apply the theme based on the tenant config
          this.themeService.applyTheme(response.config.theme);
          this.initializeForm();
          this.loading = false;
        } else {
          this.error = 'Failed to load tenant configuration';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading tenant config:', err);
        this.error = 'Failed to load tenant configuration';
        this.loading = false;
      }
    });
  }

  initializeForm(): void {
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required, this.nameValidator]],
      lastName: ['', [Validators.required, this.nameValidator]],
      email: ['', [Validators.required, this.emailValidator]],
      phone: ['', [Validators.required, this.phoneValidator]],
      reason: ['', [Validators.required]],
      message: ['', []],
      recaptchaToken: ['', [Validators.required]]
    });
  }

  /**
   * Load reCAPTCHA script and render widget
   */
  loadRecaptcha(): void {
    if (typeof window === 'undefined') return;

    // Check if script already exists
    if (document.getElementById('recaptcha-script')) {
      this.recaptchaScriptLoaded = true;
      this.attemptRecaptchaRender();
      return;
    }

    // Create and load the reCAPTCHA script
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    script.async = true;
    script.defer = true;

    // Set up the callback that will be called when reCAPTCHA loads
    (window as any).onRecaptchaLoad = () => {
      this.recaptchaLoaded = true;
      this.recaptchaScriptLoaded = true;
      this.attemptRecaptchaRender();
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
    };

    document.head.appendChild(script);
  }

  /**
   * Attempt to render reCAPTCHA with retry logic
   */
  attemptRecaptchaRender(): void {
    this.recaptchaRenderAttempts++;

    if (this.recaptchaRenderAttempts > this.maxRenderAttempts) {
      console.error('Max reCAPTCHA render attempts reached');
      return;
    }

    // Check if element exists
    const element = document.getElementById('recaptcha-element');
    
    if (!element) {
      // Element not ready yet, try again after a short delay
      setTimeout(() => this.attemptRecaptchaRender(), 200);
      return;
    }

    // Check if grecaptcha is loaded
    if (typeof grecaptcha === 'undefined' || !grecaptcha.render) {
      // grecaptcha not ready yet, try again after a short delay
      setTimeout(() => this.attemptRecaptchaRender(), 200);
      return;
    }

    // Check if already rendered
    if (this.recaptchaWidgetId !== null) {
      return;
    }

    // Everything is ready, render it
    this.renderRecaptcha();
  }

  /**
   * Render the reCAPTCHA widget
   */
  renderRecaptcha(): void {
    const element = document.getElementById('recaptcha-element');
    if (!element) {
      console.error('reCAPTCHA element not found');
      return;
    }

    if (typeof grecaptcha === 'undefined' || !grecaptcha.render) {
      console.error('grecaptcha not loaded');
      return;
    }

    try {
      this.recaptchaWidgetId = grecaptcha.render('recaptcha-element', {
        sitekey: this.recaptchaSiteKey,
        callback: (token: string) => this.onRecaptchaSuccess(token),
        'expired-callback': () => this.onRecaptchaExpired(),
        'error-callback': () => this.onRecaptchaError()
      });
      
      console.log('reCAPTCHA rendered successfully');
    } catch (error) {
      console.error('Error rendering reCAPTCHA:', error);
    }
  }

  /**
   * Handle successful reCAPTCHA completion
   */
  onRecaptchaSuccess(token: string): void {
    this.contactForm.patchValue({ recaptchaToken: token });
    this.contactForm.get('recaptchaToken')?.markAsTouched();
    this.cdr.detectChanges();
  }

  /**
   * Handle expired reCAPTCHA
   */
  onRecaptchaExpired(): void {
    this.contactForm.patchValue({ recaptchaToken: '' });
    this.contactForm.get('recaptchaToken')?.markAsTouched();
    console.warn('reCAPTCHA expired');
    this.cdr.detectChanges();
  }

  /**
   * Handle reCAPTCHA error
   */
  onRecaptchaError(): void {
    this.contactForm.patchValue({ recaptchaToken: '' });
    this.contactForm.get('recaptchaToken')?.markAsTouched();
    console.error('reCAPTCHA error occurred');
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    // Mark all fields as touched to show validation errors
    Object.keys(this.contactForm.controls).forEach(key => {
      this.contactForm.get(key)?.markAsTouched();
    });

    if (!this.contactForm.valid || !this.tenantId) {
      console.error('Form is invalid:', this.contactForm.errors);
      return;
    }

    this.submitting = true;
    this.error = null;

    const formData = {
      firstName: this.contactForm.get('firstName')?.value.trim(),
      lastName: this.contactForm.get('lastName')?.value.trim(),
      email: this.contactForm.get('email')?.value.trim(),
      phone: this.contactForm.get('phone')?.value.trim(),
      reason: this.contactForm.get('reason')?.value,
      notes: this.contactForm.get('message')?.value,
      notifyTo: this.tenantConfig?.notify_on_submit,
      submissionsSheetId: this.tenantConfig?.submissionsSheetId,
      recaptchaToken: this.contactForm.get('recaptchaToken')?.value
    };

    this.apiService.submitForm(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = true;
          this.contactForm.reset();
          
          // Reset reCAPTCHA
          if (this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
            try {
              grecaptcha.reset(this.recaptchaWidgetId);
            } catch (e) {
              console.error('Error resetting reCAPTCHA:', e);
            }
          }
          
          this.submitting = false;
        } else {
          this.error = 'Form submission failed. Please try again.';
          this.submitting = false;
          
          // Reset reCAPTCHA on error
          if (this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
            try {
              grecaptcha.reset(this.recaptchaWidgetId);
            } catch (e) {
              console.error('Error resetting reCAPTCHA:', e);
            }
          }
        }
      },
      error: (err) => {
        console.error('Error submitting form:', err);
        
        // Check for specific reCAPTCHA errors
        if (err.error?.code === 'RECAPTCHA_FAILED') {
          this.error = 'reCAPTCHA verification failed. Please try again.';
        } else if (err.error?.code === 'RECAPTCHA_MISSING') {
          this.error = 'Please complete the reCAPTCHA verification.';
        } else {
          this.error = 'An error occurred while submitting the form. Please try again.';
        }
        
        this.submitting = false;
        
        // Reset reCAPTCHA on error
        if (this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
          try {
            grecaptcha.reset(this.recaptchaWidgetId);
          } catch (e) {
            console.error('Error resetting reCAPTCHA:', e);
          }
        }
      }
    });
  }

  hasSocialMedia(): boolean {
    if (!this.tenantConfig) return false;
    return !!(
      this.tenantConfig.facebook_url ||
      this.tenantConfig.instagram_url ||
      this.tenantConfig.linkedin_url ||
      this.tenantConfig.pinterest_url ||
      this.tenantConfig.reddit_url ||
      this.tenantConfig.tiktok_url ||
      this.tenantConfig.wechat_url ||
      this.tenantConfig.x_url ||
      this.tenantConfig.youtube_url
    );
  }

  copyAddressToClipboard(): void {
    if (!this.tenantConfig) return;

    const address = [
      this.tenantConfig.business_address_1,
      this.tenantConfig.business_address_2,
      `${this.tenantConfig.business_city}, ${this.tenantConfig.business_state} ${this.tenantConfig.business_zip}`
    ]
      .filter(line => line && line.trim())
      .join('\n');

    navigator.clipboard.writeText(address).then(() => {
      console.log('Address copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy address:', err);
    });
  }

  copyToClipboard(text: string | undefined): void {
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  openPolicyDialog(type: 'terms' | 'privacy' | 'ada'): void {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960;

    let title = '';
    let component: any;

    switch (type) {
      case 'terms':
        title = 'Terms of Service';
        component = WebsiteTermsOfService;
        break;
      case 'privacy':
        title = 'Privacy Policy';
        component = PrivacyPolicy;
        break;
      case 'ada':
        title = 'ADA Statement';
        component = AdaStatement;
        break;
    }

    const data: PolicyDialogData = {
      title,
      type,
      clientName: this.tenantConfig?.business_name,
      clientWebsite: this.tenantConfig?.business_web_url,
      clientEmail: this.tenantConfig?.notify_on_submit,
      clientAddressLine1: this.tenantConfig?.business_address_1,
      clientAddressLine2: this.tenantConfig?.business_address_2,
      clientCity: this.tenantConfig?.business_city,
      clientState: this.tenantConfig?.business_state,
      clientZip: this.tenantConfig?.business_zip
    };

    const baseConfig = {
      disableClose: true,
      data,
      panelClass: 'policy-dialog-panel' as string
    };

    if (isMobile) {
      this.dialog.open(component, {
        ...baseConfig,
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        position: { top: '0', left: '0' }
      });
    } else {
      this.dialog.open(component, {
        ...baseConfig,
        width: '60vw',
        maxWidth: '800px',
        maxHeight: '80vh',
        position: { top: '10vh' }
      });
    }
  }
}