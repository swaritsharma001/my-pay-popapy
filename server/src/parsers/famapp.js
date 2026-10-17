const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

function stripHtmlAndNormalize(input) {
  return String(input || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(?:x20b9|8377);/gi, '₹')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFamAppEmail(input) {
  const text = stripHtmlAndNormalize(input);
  if (!text) return null;

  const debit = /\byou have successfully paid\b|\bsuccessfully paid\b/i.test(text);
  const credit =
    /\byou\s+(?:have\s+)?received\b|\breceived\s+₹|\bcredited\b|\bmoney received\b|\bhas sent you\b|\bsent you\s+₹/i.test(
      text,
    );
  if (!debit && !credit) return null;

  const amountMatch = text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  const transactionMatch = text.match(
    /Transaction\s*ID\s*:\s*(.+?)(?=\s*Date\s*:|\s*UTR\s*:|$)/i,
  );
  const dateMatch = text.match(/Date\s*:\s*(.+?)(?=\s*UTR\s*:|$)/i);
  const utrMatch = text.match(/UTR\s*:\s*(\d{12})\b/i);
  if (!amountMatch || !transactionMatch || !dateMatch || !utrMatch) return null;

  const amount = amountMatch[1].replace(/,/g, '');
  const txnId = transactionMatch[1].replace(/\s+/g, '');
  const dateText = dateMatch[1].trim();
  const paidAt = dayjs.tz(
    dateText,
    'hh:mm A [IST], D MMMM YYYY',
    'Asia/Kolkata',
  );
  if (!paidAt.isValid() || !txnId) return null;

  const partyMatch = text.match(
    /\b(?:to|from|by)\s+(.+?)(?=\s*Transaction\s*ID\s*:|\s*Date\s*:|\s*UTR\s*:|$)/i,
  );
  const counterparty = partyMatch
    ? partyMatch[1].replace(/[.,;!]+$/, '').trim() || null
    : null;

  return {
    type: debit ? 'debit' : 'credit',
    amount,
    utr: utrMatch[1],
    txnId,
    counterparty,
    paidAt: paidAt.toDate(),
  };
}

module.exports = { parseFamAppEmail, stripHtmlAndNormalize };
