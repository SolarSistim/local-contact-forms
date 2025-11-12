import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { TenantConfig } from '../../types/tenant-config';
import { MatIconModule } from '@angular/material/icon';

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
    MatIconModule
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent implements OnInit {
  contactForm!: FormGroup;
  tenantConfig: TenantConfig | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  success = false;
  tenantId: string | null = null;

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
      } else {
        this.error = 'Tenant ID is required';
        this.loading = false;
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
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      reason: ['', [Validators.required]],
      message: ['', []]
    });
  }

  onSubmit(): void {
    if (!this.contactForm.valid || !this.tenantId) return;

    this.submitting = true;
    this.error = null;

    const formData = {
      firstName: this.contactForm.get('firstName')?.value,
      lastName: this.contactForm.get('lastName')?.value,
      email: this.contactForm.get('email')?.value,
      phone: this.contactForm.get('phone')?.value,
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
}
