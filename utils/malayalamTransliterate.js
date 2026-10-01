const MALAYALAM_MAP = {
  '\u0D02': 'm', '\u0D03': 'h',
  '\u0D05': 'a', '\u0D06': 'aa', '\u0D07': 'i', '\u0D08': 'ee',
  '\u0D09': 'u', '\u0D0A': 'uu', '\u0D0B': 'ri', '\u0D0C': 'lu',
  '\u0D0E': 'e', '\u0D0F': 'e', '\u0D10': 'ai',
  '\u0D12': 'o', '\u0D13': 'o', '\u0D14': 'au',
  '\u0D15': 'ka', '\u0D16': 'kha', '\u0D17': 'ga', '\u0D18': 'gha', '\u0D19': 'nga',
  '\u0D1A': 'cha', '\u0D1B': 'chha', '\u0D1C': 'ja', '\u0D1D': 'jha', '\u0D1E': 'nya',
  '\u0D1F': 'ta', '\u0D20': 'tha', '\u0D21': 'da', '\u0D22': 'dha', '\u0D23': 'na',
  '\u0D24': 'ta', '\u0D25': 'tha', '\u0D26': 'da', '\u0D27': 'dha', '\u0D28': 'na',
  '\u0D29': 'nn',
  '\u0D2A': 'pa', '\u0D2B': 'pha', '\u0D2C': 'ba', '\u0D2D': 'bha', '\u0D2E': 'ma',
  '\u0D2F': 'ya', '\u0D30': 'ra', '\u0D31': 'ra', '\u0D32': 'la', '\u0D33': 'la',
  '\u0D34': 'zha', '\u0D35': 'va', '\u0D36': 'sha', '\u0D37': 'sha',
  '\u0D38': 'sa', '\u0D39': 'ha',
  '\u0D3A': '', '\u0D3B': '', '\u0D3C': '',
  '\u0D3D': '', '\u0D3E': 'aa', '\u0D3F': 'i', '\u0D40': 'ee',
  '\u0D41': 'u', '\u0D42': 'uu', '\u0D43': 'ri', '\u0D44': 'ru',
  '\u0D46': 'e', '\u0D47': 'e', '\u0D48': 'ai',
  '\u0D4A': 'o', '\u0D4B': 'o', '\u0D4C': 'au',
  '\u0D4D': '', '\u0D4E': '',
  '\u0D57': '',
  '\u0D5F': 'ee',
  '\u0D60': 'oo', '\u0D61': 'oo',
  '\u0D7A': 'n', '\u0D7B': 'n', '\u0D7C': 'r', '\u0D7D': 'l', '\u0D7E': 'l', '\u0D7F': 'k',
  '\u200C': '', '\u200D': '',
  '\u0D66': '0', '\u0D67': '1', '\u0D68': '2', '\u0D69': '3',
  '\u0D6A': '4', '\u0D6B': '5', '\u0D6C': '6', '\u0D6D': '7',
  '\u0D6E': '8', '\u0D6F': '9',
};

const VIRAMA = '\u0D4D';

function transliterateMalayalam(text) {
  if (!text) return '';
  let result = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const mapped = MALAYALAM_MAP[ch];
    if (mapped !== undefined) {
      if (ch === VIRAMA) {
        if (i + 1 < chars.length) {
          const next = MALAYALAM_MAP[chars[i + 1]];
          if (next && next.length > 1) {
            result += next[0];
          }
        }
      } else {
        result += mapped;
      }
    } else if (ch >= '\u0D00' && ch <= '\u0D7F') {
      continue;
    } else {
      result += ch;
    }
  }
  return result;
}

module.exports = { transliterateMalayalam };
