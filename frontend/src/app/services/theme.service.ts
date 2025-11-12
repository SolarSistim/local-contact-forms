import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeName = 'Light' | 'Dark' | 'Tangerine Orange' | 'Jungle Green' | 'Lemon Yellow' | 'Ocean Blue' | 'Fury Red';

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  link: string;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  'Light': {
    primary: '#0066cc',
    secondary: '#f0f0f0',
    background: '#ffffff',
    surface: '#f9f9f9',
    text: '#333333',
    textSecondary: '#666666',
    border: '#dddddd',
    error: '#cc3333',
    success: '#33cc33',
    link: '#0066cc'
  },
  'Dark': {
    primary: '#4da6ff',
    secondary: '#2a2a2a',
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#b3b3b3',
    border: '#444444',
    error: '#ff6666',
    success: '#66ff66',
    link: '#4da6ff'
  },
  'Tangerine Orange': {
    primary: '#ff8c00',
    secondary: '#ffe4cc',
    background: '#fff8f0',
    surface: '#fff0e0',
    text: '#333333',
    textSecondary: '#666666',
    border: '#ffcc99',
    error: '#cc3333',
    success: '#33cc33',
    link: '#ff8c00'
  },
  'Jungle Green': {
    primary: '#2d8a4a',
    secondary: '#c8e6c9',
    background: '#f1f8f5',
    surface: '#e8f5e9',
    text: '#1b5e20',
    textSecondary: '#558b2f',
    border: '#81c784',
    error: '#cc3333',
    success: '#2d8a4a',
    link: '#2d8a4a'
  },
  'Lemon Yellow': {
    primary: '#fdd835',
    secondary: '#fffde7',
    background: '#fffff9',
    surface: '#fffef5',
    text: '#333333',
    textSecondary: '#666666',
    border: '#ffeb99',
    error: '#cc3333',
    success: '#33cc33',
    link: '#f57f17'
  },
  'Ocean Blue': {
    primary: '#0288d1',
    secondary: '#b3e5fc',
    background: '#e1f5fe',
    surface: '#f1f9fb',
    text: '#01579b',
    textSecondary: '#0277bd',
    border: '#81d4fa',
    error: '#cc3333',
    success: '#33cc33',
    link: '#0288d1'
  },
  'Fury Red': {
    primary: '#d32f2f',
    secondary: '#ffebee',
    background: '#fff5f5',
    surface: '#fff1f1',
    text: '#b71c1c',
    textSecondary: '#c62828',
    border: '#ef9a9a',
    error: '#d32f2f',
    success: '#33cc33',
    link: '#d32f2f'
  }
};

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme: ThemeName = 'Light';

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
