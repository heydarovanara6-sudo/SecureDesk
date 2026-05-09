import { Filter } from 'bad-words';
import azerbaijaniBadWords from './azerbaijaniBadWords';

const filter = new Filter();

// Russian single words only (no spaces - bad-words can't handle phrases)
const russianWords = [
  'блядь', 'блять', 'сука', 'суки', 'пиздец', 'пизда', 'пизды',
  'хуй', 'хуя', 'хуйня', 'хуйло', 'ёбаный', 'ёбать', 'ебать',
  'залупа', 'мудак', 'мудаки', 'пидор', 'пидорас', 'пидоры',
  'шлюха', 'шлюхи', 'нахуй', 'похуй', 'уёбок', 'уебок',
  'пиздёж', 'пиздеж', 'ублюдок', 'долбоёб', 'долбоеб',
  'блядина', 'курва', 'манда', 'мразь', 'мрази', 'падла',
  'сволочь', 'тварь', 'твари', 'херня', 'шалава', 'шалавы',
  'заебал', 'заебала', 'охуеть', 'охуел', 'мудила', 'мудило',
];

// Only single-word entries for addWords (filter out anything with a space)
const azSingleWords = azerbaijaniBadWords.filter(w => !w.includes(' '));
const azPhrases = azerbaijaniBadWords.filter(w => w.includes(' '));
const ruSingleWords = russianWords.filter(w => !w.includes(' '));
const ruPhrases = russianWords.filter(w => w.includes(' '));

// Add single words to the bad-words Filter
try {
  filter.addWords(...ruSingleWords, ...azSingleWords);
} catch (e) {
  console.warn('wordFilter addWords error:', e);
}

export const isProfane = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();

  // Check phrases manually
  const allPhrases = [...azPhrases, ...ruPhrases];
  if (allPhrases.some(phrase => lowerText.includes(phrase.toLowerCase()))) return true;

  // Check single words manually (covers both filter + direct match)
  const allSingleWords = [...azSingleWords, ...ruSingleWords];
  if (allSingleWords.some(word => lowerText.includes(word.toLowerCase()))) return true;

  try {
    return filter.isProfane(text);
  } catch {
    return false;
  }
};

export const cleanText = (text) => {
  if (!text) return text;
  try {
    return filter.clean(text);
  } catch {
    return text;
  }
};

export default filter;