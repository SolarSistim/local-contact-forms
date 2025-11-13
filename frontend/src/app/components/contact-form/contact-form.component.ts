import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
    MatMenuModule
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent implements OnInit {
  contactForm!: FormGroup;
  tenantConfig: TenantConfig | null = null;
  reasonOptions: string[] = [];
  loading = true;
  submitting = false;
  error: string | null = null;
  success = false;
  tenantId: string | null = null;

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
    private themeService: ThemeService
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
      message: ['', []]
    });
  }

  onSubmit(): void {
    if (!this.contactForm.valid || !this.tenantId) return;

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
      submissionsSheetId: this.tenantConfig?.submissionsSheetId
    };

    this.apiService.submitForm(this.tenantId, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = true;
          this.contactForm.reset();
          this.submitting = false;
        } else {
          this.error = 'Form submission failed. Please try again.';
          this.submitting = false;
        }
      },
      error: (err) => {
        console.error('Error submitting form:', err);
        this.error = 'An error occurred while submitting the form. Please try again.';
        this.submitting = false;
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
}
