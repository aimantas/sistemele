/** Shapes shared by every JSON endpoint. */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level problems: path like "lines.0.quantity" → message. */
    issues?: Record<string, string>;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface SearchResult {
  module: string;
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  /** SPA path, e.g. /app/crm/contacts/ct_123 */
  href: string;
}

export interface MetricValue {
  key: string;
  label: string;
  format: "number" | "money" | "percent";
  value: number;
  hint?: string;
}

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
}

export interface AppInfo {
  appName: string;
  environment: string;
  locale: string;
  currency: string;
  modules: ModuleInfo[];
  emailConfigured: boolean;
}

export type WidgetSize = { w: 1 | 2 | 3 | 4; h: 1 | 2 };

export interface DashboardWidgetInstance {
  id: string;
  type: string;
  size: WidgetSize;
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  version: 1;
  widgets: DashboardWidgetInstance[];
}
