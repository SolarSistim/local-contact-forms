import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeName = 'Fern' | 'Lilac' | 'Lemoncello' | 'Sapphire' | 'Crimson' | 'Light' | 'Dark';

interface ThemeColors {
  // Header Panel (Top)
  headerBackground: string;
  headerText: string;

  // Left Info Panel
  infoPanelBackground: string;
  infoPanelText: string;
  infoPanelHeading: string;
  infoPanelIcon: string;

  // Form Panel (Right)
  formPanelBackground: string;
  formPanelText: string;
  formFieldBorder: string;
  formFieldBackground: string;
  formFieldText: string;

  // Send Button
  buttonEnabledBackground: string;
  buttonEnabledText: string;
  buttonDisabledBackground: string;
  buttonDisabledText: string;
  buttonHoverBackground: string;
  buttonHoverText: string;
  spinnerColor: string;

  // Utility Colors
  pageBackground: string;
  errorColor: string;
  successColor: string;
  borderColor: string;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  'Fern': {
    headerBackground: '#2C4E38',
    headerText: '#E8E2D4',
    infoPanelBackground: '#222017',
    infoPanelText: '#DBC66E',
    infoPanelHeading: '#DBC66E',
    infoPanelIcon: '#DBC66E',
    formPanelBackground: '#DBC66E',
    formPanelText: '#222017',
    formFieldBorder: '#222017',
    formFieldBackground: '#f1f8f5',
    formFieldText: '#222017',
    buttonEnabledBackground: '#2C4E38',
    buttonEnabledText: '#E8E2D4',
    buttonDisabledBackground: '#b19f58ff',
    buttonDisabledText: '#2C4E38',
    buttonHoverBackground: '#245a39',
    buttonHoverText: '#ffffff',
    spinnerColor: '#DBC66E',
    pageBackground: '#15130B',
    errorColor: '#cc3333',
    successColor: '#2d8a4a',
    borderColor: '#245a39'
  },
  'Lilac': {
    headerBackground: '#573E5C',
    headerText: '#FAD8FD',
    infoPanelBackground: '#1D2024',
    infoPanelText: '#AAC7FF',
    infoPanelHeading: '#AAC7FF',
    infoPanelIcon: '#6B5B95',
    formPanelBackground: '#F5F1F8',
    formPanelText: '#4A3F6B',
    formFieldBorder: '#D4C5E8',
    formFieldBackground: '#FAFAF9',
    formFieldText: '#4A3F6B',
    buttonEnabledBackground: '#6B5B95',
    buttonEnabledText: '#F5F1F8',
    buttonDisabledBackground: '#D4C5E8',
    buttonDisabledText: '#8B7BA8',
    buttonHoverBackground: '#5A4A84',
    buttonHoverText: '#F5F1F8',
    spinnerColor: '#6B5B95',
    pageBackground: '#111318',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#D4C5E8'
  },
  'Lemoncello': {
    headerBackground: '#DBC66E',
    headerText: '#3A3000',
    infoPanelBackground: '#222017',
    infoPanelText: '#DBC66E',
    infoPanelHeading: '#DBC66E',
    infoPanelIcon: '#b19131ff',
    formPanelBackground: '#fff8dcff',
    formPanelText: '#4A4226',
    formFieldBorder: '#F4E4AA',
    formFieldBackground: '#ffffffff',
    formFieldText: '#4A4226',
    buttonEnabledBackground: '#F4C430',
    buttonEnabledText: '#2C2416',
    buttonDisabledBackground: '#F4E4AA',
    buttonDisabledText: '#8B8B6A',
    buttonHoverBackground: '#DAA520',
    buttonHoverText: '#2C2416',
    spinnerColor: '#F4C430',
    pageBackground: '#15130B',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#F4E4AA'
  },
  'Sapphire': {
    headerBackground: '#214C57',
    headerText: '#BEEAF7',
    infoPanelBackground: '#1C211C',
    infoPanelText: '#95D5A8',
    infoPanelHeading: '#95D5A8',
    infoPanelIcon: '#669273ff',
    formPanelBackground: '#e6f9ffff',
    formPanelText: '#000D12',
    formFieldBorder: '#1C211C',
    formFieldBackground: '#FFFFF0',
    formFieldText: '#000D12',
    buttonEnabledBackground: '#214C57',
    buttonEnabledText: '#BEEAF7',
    buttonDisabledBackground: 'rgba(52, 114, 129, 1)',
    buttonDisabledText: '#95D5A8',
    buttonHoverBackground: '#214C57',
    buttonHoverText: '#BEEAF7',
    spinnerColor: '#95D5A8',
    pageBackground: '#0F1511',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#95D5A8'
  },
  'Crimson': {
    headerBackground: '#7D1F26',
    headerText: '#FDECEC',
    infoPanelBackground: '#1E1718',
    infoPanelText: '#E6A3A3',
    infoPanelHeading: '#E6A3A3',
    infoPanelIcon: '#A84C55',
    formPanelBackground: '#FFF7F7',
    formPanelText: '#4A1F22',
    formFieldBorder: '#E4B8B8',
    formFieldBackground: '#FFFBFB',
    formFieldText: '#4A1F22',
    buttonEnabledBackground: '#7D1F26',
    buttonEnabledText: '#FDECEC',
    buttonDisabledBackground: '#E4B8B8',
    buttonDisabledText: '#7D1F26',
    buttonHoverBackground: '#6B1A1E',
    buttonHoverText: '#FFFFFF',
    spinnerColor: '#D46A6A',
    pageBackground: '#141012',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#6B1A1E'
  },
  'Light': {
    headerBackground: '#ffffffff',
    headerText: '#1F2937',
    infoPanelBackground: '#FFFFFF',
    infoPanelText: '#374151',
    infoPanelHeading: '#374151',
    infoPanelIcon: '#2563EB',
    formPanelBackground: '#FFFFFF',
    formPanelText: '#111827',
    formFieldBorder: '#9CA3AF',
    formFieldBackground: '#F1F5F9',
    formFieldText: '#111827',
    buttonEnabledBackground: '#2563EB',
    buttonEnabledText: '#FFFFFF',
    buttonDisabledBackground: '#E5E7EB',
    buttonDisabledText: '#9CA3AF',
    buttonHoverBackground: '#1D4ED8',
    buttonHoverText: '#FFFFFF',
    spinnerColor: '#2563EB',
    pageBackground: '#EEF2F7',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#CBD5E1'
  },
    'Dark': {
    headerBackground: '#12161C',
    headerText: '#E5E7EB',
    infoPanelBackground: '#0F141A',
    infoPanelText: '#CBD5E1',
    infoPanelHeading: '#E2E8F0',
    infoPanelIcon: '#94A3B8',
    formPanelBackground: '#181E27',
    formPanelText: '#E5E7EB',
    formFieldBorder: '#9CA3AF',
    formFieldBackground: '#E5E7EB',
    formFieldText: '#111827',
    buttonEnabledBackground: '#3B4250',
    buttonEnabledText: '#F9FAFB',
    buttonDisabledBackground: '#2A313C',
    buttonDisabledText: '#9CA3AF',
    buttonHoverBackground: '#4B5563',
    buttonHoverText: '#FFFFFF',
    spinnerColor: '#9CA3AF',
    pageBackground: '#0E1116',
    errorColor: '#cc3333',
    successColor: '#66cc99',
    borderColor: '#2A313C'
  }
};

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme: ThemeName = 'Fern';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  applyTheme(themeName: ThemeName): void {
    const theme = THEMES[themeName];
    if (!theme) {
      console.warn(`Theme "${themeName}" not found, using default Light theme`);
      return;
    }

    this.currentTheme = themeName;
    this.setThemeVariables(theme);
  }

  private setThemeVariables(theme: ThemeColors): void {
    // Only apply theme in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = document.documentElement;

    Object.entries(theme).forEach(([key, value]) => {
      const cssVariable = `--theme-${this.camelToKebab(key)}`;
      root.style.setProperty(cssVariable, value);
    });
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }
}
