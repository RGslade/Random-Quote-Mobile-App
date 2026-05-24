export function pickDifferentQuote(quotes, currentQuote) {
  // Return a safe fallback when the quote list is unavailable.
  if (!Array.isArray(quotes) || quotes.length === 0) return '';
  if (quotes.length === 1) return quotes[0];

  let nextQuote = currentQuote;

  // Loop until the next quote differs from the current quote.
  while (nextQuote === currentQuote) {
    nextQuote = quotes[Math.floor(Math.random() * quotes.length)];
  }

  return nextQuote;
}
