const MAX_SAFE_PAISE = BigInt(Number.MAX_SAFE_INTEGER);

function parseRupeesToPaise(value) {
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new TypeError('Amount must have at most two decimal places');

  const rupees = BigInt(match[1]);
  const paise = BigInt((match[2] || '').padEnd(2, '0') || '0');
  const total = rupees * 100n + paise;
  if (total < 100n) throw new RangeError('Amount must be at least ₹1.00');
  if (total > MAX_SAFE_PAISE) throw new RangeError('Amount is too large');
  return Number(total);
}

function paiseToRupees(paise) {
  const totalPaise = typeof paise === 'bigint' ? paise : BigInt(paise);
  if (totalPaise < 0n) {
    throw new RangeError('Paise must be a non-negative safe integer');
  }
  const rupees = totalPaise / 100n;
  const remainder = String(totalPaise % 100n).padStart(2, '0');
  return `${rupees}.${remainder}`;
}

function decimalToPaise(value) {
  const asString = value && typeof value.toString === 'function'
    ? value.toString()
    : String(value);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(asString);
  if (!match) throw new TypeError('Stored amount is not a valid rupee amount');
  return Number(BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0'));
}

function pickUniquePayablePaise(basePaise, usedPaise, startingOffset = 0) {
  for (let offset = 0; offset < 99; offset += 1) {
    const suffix = ((startingOffset + offset) % 99) + 1;
    const payablePaise = basePaise + suffix;
    if (!usedPaise.has(payablePaise)) return payablePaise;
  }
  return null;
}

module.exports = {
  parseRupeesToPaise,
  paiseToRupees,
  decimalToPaise,
  pickUniquePayablePaise,
};
