import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TenantConfigResponse,
  FormSubmissionResponse,
  EmailResponse,
  FormSubmission,
  EmailRequest
} from '../types/tenant-config';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {
    console.log('API Base URL:', this.apiBaseUrl);
  }

  getTenantConfig(tenantId: string): Observable<TenantConfigResponse> {
    const url = `${this.apiBaseUrl}/getTenantConfig?tenantId=${encodeURIComponent(tenantId)}`;
    console.log('Fetching tenant config from:', url);
    return this.http.get<TenantConfigResponse>(url);
  }

  submitForm(tenantId: string, formData: FormSubmission): Observable<FormSubmissionResponse> {
    const payload = {
      ...formData,
      tenantId
    };
    return this.http.post<FormSubmissionResponse>(
      `${this.apiBaseUrl}/submitForm?tenantId=${encodeURIComponent(tenantId)}`,
      payload
    );
  }

  sendEmail(tenantId: string, emailData: EmailRequest): Observable<EmailResponse> {
    const payload = {
      ...emailData,
      tenantId
    };
    return this.http.post<EmailResponse>(
      `${this.apiBaseUrl}/sendEmail?tenantId=${encodeURIComponent(tenantId)}`,
      payload
    );
  }
}
