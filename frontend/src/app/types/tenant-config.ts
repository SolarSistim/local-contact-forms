export interface TenantConfig {
  tenantId: string;
  status: 'active' | 'inactive';
  submissionsSheetId?: string;
  business_name: string;
  notify_on_submit: string;
  intro_text: string;
  meta_description: string;
  meta_keywords: string;
  post_submit_message: string;
  business_phone: string;
  business_address_1: string;
  business_address_2: string;
  business_city: string;
  business_state: string;
  business_zip: string;
  business_web_url: string;
  theme: 'Fern' | 'Lilac' | 'Lemoncello' | 'Sapphire' | 'Crimson' | 'Light' | 'Dark';
  logo: string;
  reason_for_contact?: string;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  pinterest_url?: string;
  reddit_url?: string;
  tiktok_url?: string;
  wechat_url?: string;
  x_url?: string;
  youtube_url?: string;
  rate_limit_per_hour?: number;
}

export interface TenantConfigResponse {
  success: boolean;
  config: TenantConfig;
  valid: boolean;
  missingRequiredFields: string[];
  validationErrors: string[];
}

export interface FormSubmission {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reason: string;
  notes?: string;
  notifyTo?: string;
  submissionsSheetId?: string;
  recaptchaToken: string;
  website?: string;
}

export interface FormSubmissionResponse {
  success: boolean;
  sheet: boolean;
  email: boolean;
}

export interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  cc?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId: string;
}
