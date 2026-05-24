import { aggressiveQuotes } from './quotes/aggressive.js';
import { cheesyPickupQuotes } from './quotes/cheesyPickup.js';
import { inspirationalQuotes } from './quotes/inspirational.js';
import { jokeQuotes } from './quotes/jokes.js';
import { risquePickupQuotes } from './quotes/risquePickup.js';
import { romanticPickupQuotes } from './quotes/romanticPickup.js';

// Group quotes by selectable mode for the category menu.
export const QUOTE_CATEGORIES = {
  aggressive: aggressiveQuotes,
  cheesyPickup: cheesyPickupQuotes,
  inspirational: inspirationalQuotes,
  jokes: jokeQuotes,
  risquePickup: risquePickupQuotes,
  romanticPickup: romanticPickupQuotes,
};

// Flatten all category quotes for utilities that need the complete pool.
export const QUOTES = Object.values(QUOTE_CATEGORIES).reduce(
  (allQuotes, categoryQuotes) => allQuotes.concat(categoryQuotes),
  []
);
