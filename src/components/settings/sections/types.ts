import type { AppSettings } from '@/features/timer/types';

/** What every settings tab receives: the draft settings and a way to change one. */
export interface SettingsSectionProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}
