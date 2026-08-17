function isClean(word) {
  if (!word || typeof word !== 'string') return false;

  let normalized = word.toLowerCase();

  // Leetspeak normalization
  normalized = normalized
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');

  // Remove repeated characters (e.g. fuuuck -> fuck, shiiit -> shit)
  // This regex matches any character that is repeated and reduces it to a single character.
  // Note: some valid words might have double letters (like "boot"), but for our bad word list,
  // we check if the stripped version matches or contains a bad word root.
  // Actually, standardizing repeated characters to a single one might break valid words (e.g. "loop" -> "lop").
  // Since we only check against our list, this is mostly fine, but let's do this carefully.
  // A safer way is to just collapse 3+ consecutive to 1, or just check the collapsed version against bad words.
  const collapsed = normalized.replace(/(.)\1+/g, '$1');

  const englishProfanity = [
    'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'bastard', 'damn', 'hell', 
    'crap', 'piss', 'slut', 'whore', 'nigger', 'nigga', 'fag', 'faggot', 'retard', 'idiot', 'moron', 
    'kill', 'rape', 'sex', 'porn', 'nude', 'naked', 'boob', 'tit', 'penis', 'vagina', 'asshole', 
    'motherfucker', 'bullshit'
  ];

  const hindiProfanity = [
    'madarchod', 'maderchod', 'mc', 'bhenchod', 'behenchod', 'bc', 'chutiya', 'chutiye', 'chut', 
    'lund', 'lauda', 'gaand', 'randi', 'harami', 'bhadwa', 'bhosdi', 'bhosadike', 'bhosdike', 'sala', 
    'saala', 'kamina', 'kamine', 'kutta', 'kutte', 'haramzada', 'haramzade', 'gandu', 'gaandu', 
    'jhaant', 'jhant', 'terimaa', 'terima', 'teribehen', 'teribehan', 'madar', 'bhenk', 'hijra', 
    'chakka', 'rakhel', 'lavde', 'lavda', 'lode', 'loda', 'bur', 'boor', 'chod', 'chodna', 'chodne', 
    'chodiye', 'chodo', 'bhen'
  ];

  const combinedList = [...englishProfanity, ...hindiProfanity];

  // We should also check for substrings for extreme cases like "sex", "porn", "nude"
  const extremeSubstrings = ['sex', 'porn', 'nude', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'fag'];

  // Check exact matches or matches against collapsed versions
  for (const bad of combinedList) {
    if (normalized === bad || collapsed === bad) return false;
    // Check for common suffixes manually if needed, but extreme substrings handles a lot
  }

  // Check substrings for extreme words
  for (const ex of extremeSubstrings) {
    if (normalized.includes(ex)) return false;
    if (collapsed.includes(ex)) return false;
  }

  // Check for some multi-word variants that might be submitted as one word (e.g. behenchod)
  if (normalized.includes('chod') || collapsed.includes('chod')) {
      // "chod" could be a root in valid hindi, but given context (tech words), anything with chod is suspect
      return false;
  }
  if (normalized.includes('lauda') || normalized.includes('lund')) return false;

  return true;
}

module.exports = { isClean };
