import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { TenantConfig } from '../../types/tenant-config';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent implements OnInit {
  form!: FormGroup;
  tenantConfig: TenantConfig | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  success = false;
  tenantId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.tenantId = params['tenantId'] || null;
      if (this.tenantId) {
        this.loadTenantConfig();
      } else {
        this.error = 'Tenant ID is required';
        this.loading = false;
      }
    });
  }

  loadTenantConfig(): void {
    if (!this.tenantId) return;

    this.apiService.getTenantConfig(this.tenantId).subscribe({
      next: (response) => {
        if (response.success && response.valid) {
          this.tenantConfig = response.config;
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
    this.form = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      reason: ['', [Validators.required]],
      notes: ['', []]
    });
  }

  onSubmit(): void {
    if (!this.form.valid || !this.tenantId) return;

    this.submitting = true;
    this.error = null;

    const formData = {
      ...this.form.value,
      notifyTo: this.tenantConfig?.notify_on_submit
    };

    this.apiService.submitForm(this.tenantId, formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = true;
          this.form.reset();
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
