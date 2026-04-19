export interface SalesAccount {
  id: string;
  name: string;
  owner?: string;
  notes?: string;
}

export interface SalesContact {
  id: string;
  account_id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface SalesDeal {
  id: string;
  account_id: string;
  name?: string;
  stage: string;
  value_cents?: number;
  currency?: string;
  last_touch_days_ago?: number;
  objections_raised?: string[];
  next_planned_action?: string;
  decision_deadline?: string | null;
  timing_sensitivity?: 'low' | 'medium' | 'high' | string;
}

export interface SalesActivity {
  id: string;
  account_id?: string;
  deal_id?: string;
  at: string;
  type: string;
  summary: string;
}

export interface SalesWorldFile {
  accounts: SalesAccount[];
  contacts: SalesContact[];
  deals: SalesDeal[];
  activities: SalesActivity[];
  suppression_flags?: string[];
}

export type DossierScope =
  | { kind: 'deal'; id: string }
  | { kind: 'account'; id: string }
  | { kind: 'contact'; id: string };
