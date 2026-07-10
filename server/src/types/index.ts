export type LivingSituation = 'PG_RENTAL' | 'RENTED_APARTMENT' | 'OWN_HOME' | 'FAMILY_HOME';
export type ReportFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type Category = 'LEAK' | 'WORTHY_ESSENTIAL' | 'INVESTMENT';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  living_situation: LivingSituation;
  report_frequency: ReportFrequency;
  income_sources: string[];
  income_lower_inr: number;
  income_upper_inr: number;
  agent_assistance_preferences: string[];
  last_report_at: string | null;
  auto_reports_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParseResult {
  success: boolean;
  amount?: number;
  description?: string;
  requiresConfirmation: boolean;
  isSplit?: boolean;
  totalBill?: number;
  yourShare?: number;
  splitCount?: number;
  highAmount?: boolean;
  error?: string;
}

export interface SavingOpportunity {
  title: string;
  description: string;
  estimated_savings_inr: number;
}

export interface AgentAOutput {
  categorized_transactions: Array<{
    transaction_id: string;
    category: Category;
    reasoning: string;
  }>;
  category_breakdown: {
    LEAK: number;
    WORTHY_ESSENTIAL: number;
    INVESTMENT: number;
  };
  behavioral_summary: string;
  saving_opportunities: SavingOpportunity[];
  total_spend: number;
}
