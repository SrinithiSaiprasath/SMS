import type { ParseResult } from '../types/index.js';

const AMOUNT_PATTERN = /(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹|inr)?/i;

const SPLIT_PATTERNS: Array<{
  regex: RegExp;
  getDenominator: (match: RegExpMatchArray, total: number) => number;
}> = [
  {
    regex: /(\d+)\s*friends?/i,
    getDenominator: (m) => parseInt(m[1], 10) + 1,
  },
  {
    regex: /split\s+among\s+(\d+)/i,
    getDenominator: (m) => parseInt(m[1], 10),
  },
  {
    regex: /among\s+(\d+)\s+people/i,
    getDenominator: (m) => parseInt(m[1], 10),
  },
  {
    regex: /divided\s+by\s+(\d+)/i,
    getDenominator: (m) => parseInt(m[1], 10),
  },
];

function extractAmount(message: string): number | null {
  const match = message.match(AMOUNT_PATTERN);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : Math.round(amount * 100) / 100;
}

function extractDescription(message: string, amountStr: string): string {
  let desc = message
    .replace(amountStr, '')
    .replace(/\b(rupees?|rs\.?|₹|inr)\b/gi, '')
    .replace(/\b(spent|paid|bought|on|for)\b/gi, '')
    .replace(/\d+\s*friends?/gi, '')
    .replace(/split\s+among\s+\d+/gi, '')
    .replace(/among\s+\d+\s+people/gi, '')
    .replace(/divided\s+by\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!desc) desc = 'expense';
  return desc.slice(0, 500);
}

export function parseExpenseMessage(rawMessage: string): ParseResult {
  const message = rawMessage.trim();
  if (!message || message.length > 1000) {
    return { success: false, requiresConfirmation: false, error: 'Please describe your expense in a short sentence.' };
  }

  const amountMatch = message.match(AMOUNT_PATTERN);
  const amount = extractAmount(message);
  if (amount === null || amount <= 0) {
    return {
      success: false,
      requiresConfirmation: false,
      error: "Hmm, I couldn't spot the amount! Try: spent 800 on dinner",
    };
  }

  const description = extractDescription(message, amountMatch?.[0] ?? String(amount));
  const highAmount = amount > 100000;

  for (const { regex, getDenominator } of SPLIT_PATTERNS) {
    const splitMatch = message.match(regex);
    if (splitMatch) {
      const denominator = getDenominator(splitMatch, amount);
      if (denominator > 1) {
        const yourShare = Math.round((amount / denominator) * 100) / 100;
        return {
          success: true,
          amount: yourShare,
          description,
          requiresConfirmation: true,
          isSplit: true,
          totalBill: amount,
          yourShare,
          splitCount: denominator,
          highAmount,
        };
      }
    }
  }

  return {
    success: true,
    amount,
    description,
    requiresConfirmation: highAmount,
    isSplit: false,
    highAmount,
  };
}
