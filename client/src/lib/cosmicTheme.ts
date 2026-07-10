export const ANIMALS = {
  fox: { emoji: '🦊', name: 'Captain Fox', role: 'Expense Navigator' },
  cat: { emoji: '🐱', name: 'Luna Cat', role: 'Budget Guardian' },
  bunny: { emoji: '🐰', name: 'Hopper', role: 'Savings Scout' },
  owl: { emoji: '🦉', name: 'Wise Owl', role: 'Report Oracle' },
  panda: { emoji: '🐼', name: 'Cosmo Panda', role: 'Mission Control' },
} as const;

export const PLANETS = {
  dashboard: { emoji: '🪐', name: 'Home Planet', color: 'from-purple-600 to-indigo-800' },
  history: { emoji: '🌙', name: 'Moon Archive', color: 'from-blue-600 to-cyan-800' },
  reports: { emoji: '⭐', name: 'Star Reports', color: 'from-amber-500 to-orange-700' },
  settings: { emoji: '🔧', name: 'Ship Deck', color: 'from-pink-500 to-purple-700' },
} as const;

export const MOOD_THRESHOLDS = [
  { max: 500, label: 'Stellar!', emoji: '🌟', color: 'text-cosmos-mint' },
  { max: 1500, label: 'Cruising', emoji: '🚀', color: 'text-cosmos-amber' },
  { max: 3000, label: 'Warning!', emoji: '☄️', color: 'text-orange-400' },
  { max: Infinity, label: 'Black Hole!', emoji: '🕳️', color: 'text-cosmos-pink' },
];

export function getMood(total: number) {
  return MOOD_THRESHOLDS.find((m) => total <= m.max) ?? MOOD_THRESHOLDS[3];
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function categoryBadge(category: string | null) {
  switch (category) {
    case 'LEAK': return { label: 'Leak Planet', class: 'badge-leak', emoji: '🪐' };
    case 'WORTHY_ESSENTIAL': return { label: 'Essential Star', class: 'badge-essential', emoji: '⭐' };
    case 'INVESTMENT': return { label: 'Investment Rocket', class: 'badge-investment', emoji: '🚀' };
    default: return { label: 'Uncharted', class: 'bg-white/10 text-white/60', emoji: '🌌' };
  }
}

export const LIVING_OPTIONS = [
  { value: 'PG_RENTAL', label: 'PG Pod', emoji: '🛸' },
  { value: 'RENTED_APARTMENT', label: 'Rented Station', emoji: '🏠' },
  { value: 'OWN_HOME', label: 'Home Base', emoji: '🏡' },
  { value: 'FAMILY_HOME', label: 'Family Nebula', emoji: '👨‍👩‍👧' },
];

export const FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly Mission', emoji: '📅' },
  { value: 'BIWEEKLY', label: 'Bi-weekly Orbit', emoji: '🔄' },
  { value: 'MONTHLY', label: 'Monthly Galaxy', emoji: '🌌' },
];

export const INCOME_OPTIONS = [
  { value: 'SALARY', label: 'Salary', emoji: '💼' },
  { value: 'FREELANCE', label: 'Freelance', emoji: '🎨' },
  { value: 'INTERNSHIP_STIPEND', label: 'Internship', emoji: '🎓' },
  { value: 'FAMILY_SUPPORT', label: 'Family Support', emoji: '👨‍👩‍👧' },
  { value: 'SIDE_HUSTLE', label: 'Side Hustle', emoji: '⚡' },
  { value: 'SCHOLARSHIP', label: 'Scholarship', emoji: '🏆' },
  { value: 'RENTAL_INCOME', label: 'Rental Income', emoji: '🏠' },
  { value: 'OTHER', label: 'Other', emoji: '✨' },
];

export const INCOME_RANGE_PRESETS = [
  { lower: 500, upper: 5000, label: '₹500 – ₹5k', emoji: '🌱' },
  { lower: 5000, upper: 10000, label: '₹5k – ₹10k', emoji: '🚀' },
  { lower: 10000, upper: 15000, label: '₹10k – ₹15k', emoji: '⭐' },
  { lower: 15000, upper: 25000, label: '₹15k – ₹25k', emoji: '🪐' },
  { lower: 25000, upper: 50000, label: '₹25k – ₹50k', emoji: '💫' },
  { lower: 50000, upper: 100000, label: '₹50k – ₹1L', emoji: '🌌' },
];

export const ASSISTANCE_OPTIONS = [
  { value: 'EXPENSE_COACHING', label: 'Expense coaching', emoji: '🪐', hint: 'Always included' },
  { value: 'EMAIL_MISSION_REPORTS', label: 'Email debriefs', emoji: '📧', hint: 'On by default' },
  { value: 'CIBIL_CREDIT', label: 'CIBIL & credit tips', emoji: '💳' },
  { value: 'SAVINGS_GOALS', label: 'Savings goals', emoji: '🎯' },
  { value: 'INVESTMENT_GUIDANCE', label: 'SIP & investments', emoji: '🚀' },
  { value: 'DEBT_PAYOFF', label: 'Debt payoff help', emoji: '⛓️' },
  { value: 'EMERGENCY_FUND', label: 'Emergency fund', emoji: '🛡️' },
  { value: 'BUDGET_PLANNING', label: 'Monthly budget plan', emoji: '📊' },
  { value: 'TAX_BASICS', label: 'Tax-saving basics', emoji: '📋' },
  { value: 'INCOME_VS_SPEND', label: 'Income vs spend analysis', emoji: '⚖️' },
  { value: 'WEEKLY_CHALLENGES', label: 'Weekly money challenges', emoji: '🏅' },
  { value: 'SUBSCRIPTION_AUDIT', label: 'Subscription leak audit', emoji: '🔍' },
];

export const QUICK_CHIPS = [
  { label: 'Food', prefix: 'spent on food ' },
  { label: 'Travel', prefix: 'spent on travel ' },
  { label: 'Bills', prefix: 'paid bill ' },
  { label: 'Fun', prefix: 'spent on entertainment ' },
  { label: 'Split Bill', prefix: 'spent on dinner with 3 friends ' },
];

export const MONEY_TIPS = [
  { emoji: '💳', tag: 'CIBIL', text: 'Keep credit card usage under 30% of your limit — it boosts your CIBIL score over time.' },
  { emoji: '🏦', tag: 'Savings', text: 'Pay yourself first: move 10% of salary to savings the day you get paid, before spending.' },
  { emoji: '📊', tag: 'CIBIL', text: 'Never miss an EMI — even one late payment can drop your CIBIL score by 50–100 points.' },
  { emoji: '🍔', tag: 'Leak Alert', text: 'Cooking 2 extra meals at home each week can save ₹2,000–₹4,000/month vs food delivery.' },
  { emoji: '🚀', tag: 'Invest', text: 'Start a ₹500 SIP early — compound interest is your best co-pilot on long missions.' },
  { emoji: '📱', tag: 'CIBIL', text: 'Check your CIBIL report free once a year. Fix errors before applying for loans.' },
  { emoji: '🛸', tag: 'Budget', text: 'The 50-30-20 rule: 50% needs, 30% wants, 20% savings & debt payoff.' },
  { emoji: '⚡', tag: 'Quick Win', text: 'Cancel one unused subscription today — that\'s free fuel for your savings rocket.' },
  { emoji: '🪐', tag: 'Credit', text: 'A longer credit history helps CIBIL. Keep your oldest card active, even if rarely used.' },
  { emoji: '💫', tag: 'Mindset', text: 'Wait 24 hours before any impulse buy over ₹1,000. Most "must-haves" become "never-minds".' },
];
