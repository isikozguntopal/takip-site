// The name shown at the top of every screen: the title (Prof. Dr., Erg., …) before the name.
// Without a name nothing is shown, even if a title was typed.

const tidy = (text) => String(text ?? '').trim().replace(/\s+/g, ' ');

export function displayName({ title, name } = {}) {
  const n = tidy(name);
  if (!n) return '';
  const t = tidy(title);
  return t ? `${t} ${n}` : n;
}

// Suggestions offered in the title field; anything else can be typed too.
export const TITLES = ['Prof. Dr.', 'Doç. Dr.', 'Dr.', 'Uzm. Erg.', 'Erg.'];
