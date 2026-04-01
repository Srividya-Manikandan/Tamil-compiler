/* ============================================================
   Tamil Sentence Compiler — JavaScript Implementation
   ============================================================
   Faithful port of: TamilWord.g4 + Main.java + SentenceSemanticListener.java
   ============================================================ */

// ================================================================
// TOKEN TYPES  (from TamilWord.g4 lexer rules)
// ================================================================
const TokenType = {
  V_KURIL: 'V_KURIL',   // Short vowels: அ இ உ எ ஒ
  V_NEDIL: 'V_NEDIL',   // Long vowels: ஆ ஈ ஊ ஏ ஐ ஓ ஔ
  VA_ONLY: 'VA_ONLY',   // Vallinam consonants: க ச ட த ப ற
  C_ONLY: 'C_ONLY',    // Other consonants: ங ஞ ண ந ம ய ர ல வ ழ ள ன
  KU_ONLY: 'KU_ONLY',   // Kuril vowel signs: ி ு ெ ொ
  VS_ONLY: 'VS_ONLY',   // Nedil vowel signs: ா ீ ூ ே ை ோ ௌ
  P: 'P',          // Pulli (virama): ்
  AK: 'AK',         // Aytham: ஃ
  WS: 'WS',         // Whitespace
  EOF: 'EOF',
  UNKNOWN: 'UNKNOWN'
};

// Character sets matching the g4 grammar
const V_KURIL_CHARS = new Set('அஇஉஎஒ');
const V_NEDIL_CHARS = new Set('ஆஈஊஏஐஓஔ');
const VA_ONLY_CHARS = new Set('கசடதபற');
const C_ONLY_CHARS = new Set('ஙஞணநமயரலவழளன');
const KU_ONLY_CHARS = new Set('ிுெொ');
const VS_ONLY_CHARS = new Set('ாீூேைோௌ');
const PULLI_CHAR = '்';           // U+0BCD
const AYTHAM_CHAR = 'ஃ';           // U+0B83
const WS_CHARS = new Set(' \t\r\n');

// Human-readable names for token types
const TOKEN_DISPLAY = {
  V_KURIL: 'குறில் உயிர்',
  V_NEDIL: 'நெடில் உயிர்',
  VA_ONLY: 'வல்லினம்',
  C_ONLY: 'மெல்/இடையினம்',
  KU_ONLY: 'குறில் உயிர்மெய்',
  VS_ONLY: 'நெடில் உயிர்மெய்',
  P: 'புள்ளி',
  AK: 'ஆய்தம்',
  WS: 'இடைவெளி',
  EOF: 'முடிவு',
  UNKNOWN: 'அறியாத'
};

const TOKEN_CSS_CLASS = {
  V_KURIL: 'vowel',
  V_NEDIL: 'vowel',
  VA_ONLY: 'consonant',
  C_ONLY: 'consonant',
  KU_ONLY: 'vowel-sign',
  VS_ONLY: 'vowel-sign',
  P: 'pulli',
  AK: 'aytham',
  WS: 'whitespace',
  EOF: 'whitespace',
  UNKNOWN: ''
};

// ================================================================
// LEXER
// ================================================================
class TamilLexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
    this.errors = [];
  }

  tokenize() {
    this.tokens = [];
    this.errors = [];
    this.pos = 0;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (WS_CHARS.has(ch)) {
        // Consume all contiguous whitespace as one token
        let start = this.pos;
        while (this.pos < this.input.length && WS_CHARS.has(this.input[this.pos])) {
          this.pos++;
        }
        this.tokens.push({ type: TokenType.WS, value: this.input.substring(start, this.pos), pos: start });
      } else if (V_KURIL_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.V_KURIL, value: ch, pos: this.pos });
        this.pos++;
      } else if (V_NEDIL_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.V_NEDIL, value: ch, pos: this.pos });
        this.pos++;
      } else if (VA_ONLY_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.VA_ONLY, value: ch, pos: this.pos });
        this.pos++;
      } else if (C_ONLY_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.C_ONLY, value: ch, pos: this.pos });
        this.pos++;
      } else if (KU_ONLY_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.KU_ONLY, value: ch, pos: this.pos });
        this.pos++;
      } else if (VS_ONLY_CHARS.has(ch)) {
        this.tokens.push({ type: TokenType.VS_ONLY, value: ch, pos: this.pos });
        this.pos++;
      } else if (ch === PULLI_CHAR) {
        this.tokens.push({ type: TokenType.P, value: ch, pos: this.pos });
        this.pos++;
      } else if (ch === AYTHAM_CHAR) {
        this.tokens.push({ type: TokenType.AK, value: ch, pos: this.pos });
        this.pos++;
      } else {
        this.errors.push({
          pos: this.pos,
          char: ch,
          message: `நிலை ${this.pos}: அறியாத எழுத்து '${ch}' (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`
        });
        this.tokens.push({ type: TokenType.UNKNOWN, value: ch, pos: this.pos });
        this.pos++;
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: '', pos: this.pos });
    return { tokens: this.tokens, errors: this.errors };
  }
}

// ================================================================
// PARSER  (Recursive descent, matching TamilWord.g4 grammar)
// ================================================================
class TamilParser {
  constructor(tokens) {
    // Filter out whitespace for word-level parsing, but keep track of word boundaries
    this.allTokens = tokens.filter(t => t.type !== TokenType.EOF);
    this.words = [];           // Array of token arrays, one per word
    this.errors = [];
    this.parseTree = null;

    // Split tokens into words by WS
    let current = [];
    for (const t of this.allTokens) {
      if (t.type === TokenType.WS) {
        if (current.length > 0) {
          this.words.push(current);
          current = [];
        }
      } else {
        current.push(t);
      }
    }
    if (current.length > 0) {
      this.words.push(current);
    }
  }

  parse() {
    this.errors = [];
    const wordTrees = [];

    for (let wi = 0; wi < this.words.length; wi++) {
      const wordTokens = this.words[wi];
      const result = this.parseWord(wordTokens, wi);
      if (result.error) {
        this.errors.push(result.error);
        wordTrees.push({ type: 'word', text: wordTokens.map(t => t.value).join(''), error: result.error, children: [] });
      } else {
        wordTrees.push(result.tree);
      }
    }

    this.parseTree = { type: 'sentence', children: wordTrees };
    return { parseTree: this.parseTree, errors: this.errors, words: this.words.map(w => w.map(t => t.value).join('')) };
  }

  parseWord(tokens, wordIndex) {
    const text = tokens.map(t => t.value).join('');
    let pos = 0;
    const children = [];

    // Helper to peek current token type
    const peek = () => pos < tokens.length ? tokens[pos].type : null;
    const advance = () => tokens[pos++];
    const isConsonant = (t) => t === TokenType.VA_ONLY || t === TokenType.C_ONLY;
    const isVowel = (t) => t === TokenType.V_KURIL || t === TokenType.V_NEDIL;
    const isVowelSign = (t) => t === TokenType.KU_ONLY || t === TokenType.VS_ONLY;

    // Try alternative 2: vowel_kuril ak vallinam vowel_sign? mid* end?
    // Try alternative 3: consonant kuril_opt ak vallinam vowel_sign? mid* end?
    // Try alternative 1: start mid* end?

    // We'll try all alternatives and pick the one that consumes all tokens

    // Alt 2: V_KURIL AK VA_ONLY vowel_sign? mid* end?
    const tryAlt2 = () => {
      let p = 0;
      const ch = [];
      if (p < tokens.length && tokens[p].type === TokenType.V_KURIL) {
        ch.push({ type: 'vowel_kuril', value: tokens[p].value }); p++;
      } else return null;
      if (p < tokens.length && tokens[p].type === TokenType.AK) {
        ch.push({ type: 'ak', value: tokens[p].value }); p++;
      } else return null;
      if (p < tokens.length && tokens[p].type === TokenType.VA_ONLY) {
        ch.push({ type: 'vallinam', value: tokens[p].value }); p++;
      } else return null;
      if (p < tokens.length && isVowelSign(tokens[p].type)) {
        ch.push({ type: 'vowel_sign', value: tokens[p].value }); p++;
      }
      // mid*
      while (p < tokens.length) {
        if (p + 2 === tokens.length && isConsonant(tokens[p].type) && tokens[p + 1].type === TokenType.P) {
          break;
        }
        const midResult = tryMid(tokens, p);
        if (!midResult) break;
        ch.push(midResult.node);
        p = midResult.pos;
      }
      // end?
      if (p < tokens.length) {
        const endResult = tryEnd(tokens, p);
        if (endResult) {
          ch.push(endResult.node);
          p = endResult.pos;
        }
      }
      if (p === tokens.length) return ch;
      return null;
    };

    // Alt 3: consonant kuril_opt ak vallinam vowel_sign? mid* end?
    const tryAlt3 = () => {
      let p = 0;
      const ch = [];
      if (p < tokens.length && isConsonant(tokens[p].type)) {
        ch.push({ type: 'consonant', value: tokens[p].value }); p++;
      } else return null;
      // kuril_opt: KU_ONLY?
      if (p < tokens.length && tokens[p].type === TokenType.KU_ONLY) {
        ch.push({ type: 'kuril_opt', value: tokens[p].value }); p++;
      }
      if (p < tokens.length && tokens[p].type === TokenType.AK) {
        ch.push({ type: 'ak', value: tokens[p].value }); p++;
      } else return null;
      if (p < tokens.length && tokens[p].type === TokenType.VA_ONLY) {
        ch.push({ type: 'vallinam', value: tokens[p].value }); p++;
      } else return null;
      if (p < tokens.length && isVowelSign(tokens[p].type)) {
        ch.push({ type: 'vowel_sign', value: tokens[p].value }); p++;
      }
      while (p < tokens.length) {
        if (p + 2 === tokens.length && isConsonant(tokens[p].type) && tokens[p + 1].type === TokenType.P) {
          break;
        }
        const midResult = tryMid(tokens, p);
        if (!midResult) break;
        ch.push(midResult.node);
        p = midResult.pos;
      }
      if (p < tokens.length) {
        const endResult = tryEnd(tokens, p);
        if (endResult) {
          ch.push(endResult.node);
          p = endResult.pos;
        }
      }
      if (p === tokens.length) return ch;
      return null;
    };

    // Alt 1: start mid* end?
    const tryAlt1 = () => {
      let p = 0;
      const ch = [];
      // start: vowel | consonant | consonant vowel_sign
      if (p >= tokens.length) return null;
      if (isVowel(tokens[p].type)) {
        ch.push({ type: 'start', subtype: 'vowel', value: tokens[p].value }); p++;
      } else if (isConsonant(tokens[p].type)) {
        let startVal = tokens[p].value;
        p++;
        if (p < tokens.length && isVowelSign(tokens[p].type)) {
          startVal += tokens[p].value;
          ch.push({ type: 'start', subtype: 'consonant+vowel_sign', value: startVal }); p++;
        } else {
          ch.push({ type: 'start', subtype: 'consonant', value: startVal });
        }
      } else {
        return null;
      }
      // mid*
      while (p < tokens.length) {
        if (p + 2 === tokens.length && isConsonant(tokens[p].type) && tokens[p + 1].type === TokenType.P) {
          break;
        }
        const midResult = tryMid(tokens, p);
        if (!midResult) break;
        ch.push(midResult.node);
        p = midResult.pos;
      }
      // end?
      if (p < tokens.length) {
        const endResult = tryEnd(tokens, p);
        if (endResult) {
          ch.push(endResult.node);
          p = endResult.pos;
        }
      }
      if (p === tokens.length) return ch;
      return null;
    };

    // mid: consonant vowel_sign? | consonant pulli consonant vowel_sign?
    function tryMid(toks, p) {
      if (p >= toks.length || !isConsonant(toks[p].type)) return null;

      // Try: consonant pulli consonant vowel_sign?
      if (p + 2 < toks.length && toks[p + 1].type === TokenType.P && isConsonant(toks[p + 2].type)) {
        let val = toks[p].value + toks[p + 1].value + toks[p + 2].value;
        let np = p + 3;
        if (np < toks.length && isVowelSign(toks[np].type)) {
          val += toks[np].value;
          np++;
        }
        return { node: { type: 'mid', subtype: 'conjunct', value: val }, pos: np };
      }

      // Try: consonant vowel_sign?
      let val = toks[p].value;
      let np = p + 1;
      if (np < toks.length && isVowelSign(toks[np].type)) {
        val += toks[np].value;
        np++;
      }
      return { node: { type: 'mid', subtype: 'simple', value: val }, pos: np };
    }

    // end: consonant pulli
    function tryEnd(toks, p) {
      if (p + 1 < toks.length && isConsonant(toks[p].type) && toks[p + 1].type === TokenType.P) {
        return {
          node: { type: 'end', value: toks[p].value + toks[p + 1].value },
          pos: p + 2
        };
      }
      // Also handle case where pulli follows directly (single token left)
      if (p < toks.length && isConsonant(toks[p].type) && p + 1 < toks.length && toks[p + 1].type === TokenType.P) {
        return {
          node: { type: 'end', value: toks[p].value + toks[p + 1].value },
          pos: p + 2
        };
      }
      return null;
    }

    // Try alternatives in order: alt2, alt3, alt1
    let result = tryAlt2();
    if (!result) result = tryAlt3();
    if (!result) result = tryAlt1();

    if (result) {
      return { tree: { type: 'word', text, children: result, error: null } };
    } else {
      return {
        tree: null,
        error: {
          word: text,
          wordIndex,
          message: `சொல் #${wordIndex + 1} '${text}' — தமிழ் இலக்கண விதிகளுக்கு பொருந்தவில்லை`
        }
      };
    }
  }
}

// ================================================================
// SEMANTIC ANALYZER  (Port of SentenceSemanticListener.java)
// ================================================================

// PNG Info
class PNGInfo {
  constructor(person, gender, number) {
    this.person = person;
    this.gender = gender;
    this.number = number;
  }
  toString() {
    return `Person=${this.person}, Gender=${this.gender}, Number=${this.number}`;
  }
}

// Subject dictionary
const SUBJECTS = new Map();
SUBJECTS.set('நான்', new PNGInfo('1', 'rational', 'sing'));
SUBJECTS.set('நாம்', new PNGInfo('1', 'rational', 'plural'));
SUBJECTS.set('நீ', new PNGInfo('2', 'rational', 'sing'));
SUBJECTS.set('நீங்கள்', new PNGInfo('2', 'rational', 'plural'));
SUBJECTS.set('அவன்', new PNGInfo('3', 'm', 'sing'));
SUBJECTS.set('இவன்', new PNGInfo('3', 'm', 'sing'));
SUBJECTS.set('அவள்', new PNGInfo('3', 'f', 'sing'));
SUBJECTS.set('இவள்', new PNGInfo('3', 'f', 'sing'));
SUBJECTS.set('அது', new PNGInfo('3', 'n', 'sing'));
SUBJECTS.set('இது', new PNGInfo('3', 'n', 'sing'));
SUBJECTS.set('அஃது', new PNGInfo('3', 'n', 'sing'));
SUBJECTS.set('இஃது', new PNGInfo('3', 'n', 'sing'));
SUBJECTS.set('அவர்', new PNGInfo('3', 'rational', 'sing'));
SUBJECTS.set('இவர்', new PNGInfo('3', 'rational', 'sing'));
SUBJECTS.set('அவர்கள்', new PNGInfo('3', 'rational', 'plural'));
SUBJECTS.set('இவர்கள்', new PNGInfo('3', 'rational', 'plural'));
SUBJECTS.set('அவை', new PNGInfo('3', 'n', 'plural'));
SUBJECTS.set('இவை', new PNGInfo('3', 'n', 'plural'));

// Glide stem map
const GLIDE_STEM_MAP = new Map();
GLIDE_STEM_MAP.set('நீய', 'நீ');
GLIDE_STEM_MAP.set('அதுவ', 'அது');
GLIDE_STEM_MAP.set('இதுவ', 'இது');
GLIDE_STEM_MAP.set('அஃதுவ', 'அஃது');
GLIDE_STEM_MAP.set('இஃதுவ', 'இஃது');
GLIDE_STEM_MAP.set('அவைய', 'அவை');
GLIDE_STEM_MAP.set('இவைய', 'இவை');
GLIDE_STEM_MAP.set('நாங்கள்', 'நாம்');

// Verb suffixes — ordered longest first
const VERB_SUFFIXES = [
  ['ீர்கள்', new PNGInfo('2', 'rational', 'plural')],
  ['ார்கள்', new PNGInfo('3', 'rational', 'plural')],
  ['வில்லை', new PNGInfo('wildcard', 'wildcard', 'wildcard')],
  ['ோம்', new PNGInfo('1', 'rational', 'plural')],
  ['ேன்', new PNGInfo('1', 'rational', 'sing')],
  ['ாய்', new PNGInfo('2', 'rational', 'sing')],
  ['ான்', new PNGInfo('3', 'm', 'sing')],
  ['ாள்', new PNGInfo('3', 'f', 'sing')],
  ['ார்', new PNGInfo('3', 'rational', 'sing')],
  ['து', new PNGInfo('3', 'n', 'sing')],
  ['ன', new PNGInfo('3', 'n', 'plural')]
];

// Interrogative suffixes — ordered longest first
const INTERROGATIVE_SUFFIXES = [
  ['வில்லையா', new PNGInfo('wildcard', 'wildcard', 'wildcard')],
  ['ார்களா', new PNGInfo('3', 'rational', 'plural')],
  ['ீர்களா', new PNGInfo('2', 'rational', 'plural')],
  ['ோமா', new PNGInfo('1', 'rational', 'plural')],
  ['ேனா', new PNGInfo('1', 'rational', 'sing')],
  ['ாயா', new PNGInfo('2', 'rational', 'sing')],
  ['ாரா', new PNGInfo('3', 'rational', 'sing')],
  ['னா', new PNGInfo('3', 'm', 'sing')],
  ['ளா', new PNGInfo('3', 'f', 'sing')],
  ['தா', new PNGInfo('3', 'n', 'sing')],
  ['னவா', new PNGInfo('3', 'n', 'plural')]
];

const UM_SUFFIX = 'ும்';   // 3 chars
const PULLI = '்';     // 1 char

// Human-readable PNG labels (Tamil)
const PERSON_LABELS = { '1': '1ம் நபர்', '2': '2ம் நபர்', '3': '3ம் நபர்', 'wildcard': 'அனைத்தும்' };
const GENDER_LABELS = { 'm': 'ஆண்பால்', 'f': 'பெண்பால்', 'n': 'அஃறிணை', 'rational': 'உயர்திணை', 'wildcard': 'அனைத்தும்' };
const NUMBER_LABELS = { 'sing': 'ஒருமை', 'plural': 'பன்மை', 'wildcard': 'அனைத்தும்' };

class TamilSemanticAnalyzer {
  constructor(words) {
    this.words = words;
    this.details = {
      subjects: [],
      verb: null,
      verbPNG: null,
      subjectsWithUm: [],
      subjectsWithoutUm: [],
      agreementResult: null,
      isInterrogative: false,
      isNegation: false
    };
  }

  analyze() {
    if (this.words.length === 0) {
      throw new SemanticError('வாக்கியம் காலியாக உள்ளது');
    }

    const lastWord = this.words[this.words.length - 1];
    const verbPNG = this.getVerbPNG(lastWord);

    // Detect interrogative and negation
    this.details.isInterrogative = INTERROGATIVE_SUFFIXES.some(([suffix]) => lastWord.endsWith(suffix));
    this.details.isNegation = lastWord.endsWith('வில்லை') && !lastWord.endsWith('வில்லையா');

    // Single-word sentence
    if (this.words.length === 1) {
      if (verbPNG) {
        this.details.verb = lastWord;
        this.details.verbPNG = verbPNG;
        this.details.agreementResult = { success: true, message: 'ஒற்றைச் சொல் வாக்கியம் — வினைச்சொல் சரியானது ✅' };
        return this.details;
      } else {
        throw new SemanticError('ஒற்றைச் சொல் வாக்கியம் வினைச்சொல்லாக இருக்க வேண்டும்');
      }
    }

    // Verb must be present
    if (!verbPNG) {
      throw new SemanticError('வாக்கியம் வினைச்சொல்லில் முடிய வேண்டும்');
    }

    this.details.verb = lastWord;
    this.details.verbPNG = verbPNG;

    // Collect subjects
    const subjectsWithUm = [];
    const subjectsWithoutUm = [];

    for (let i = 0; i < this.words.length - 1; i++) {
      const w = this.words[i];

      if (w.endsWith(UM_SUFFIX)) {
        const info = this.resolveUmSubject(w);
        if (info) {
          subjectsWithUm.push({ word: w, png: info });
        }
        // Unrecognized ும்-word = object/adverb — skip
      } else {
        const info = SUBJECTS.get(w);
        if (info) {
          subjectsWithoutUm.push({ word: w, png: info });
        }
      }
    }

    this.details.subjectsWithUm = subjectsWithUm;
    this.details.subjectsWithoutUm = subjectsWithoutUm;
    this.details.subjects = [...subjectsWithoutUm, ...subjectsWithUm];

    // Rule 1: Subject count validation
    if (subjectsWithUm.length === 0) {
      if (subjectsWithoutUm.length > 1) {
        throw new SemanticError(
          `ும் இணைப்பு இல்லாமல் ஒரே ஒரு எழுவாய் மட்டுமே அனுமதிக்கப்படும். ${subjectsWithoutUm.length} எழுவாய்கள் கண்டறியப்பட்டன.`
        );
      }
    } else {
      if (subjectsWithoutUm.length > 0) {
        throw new SemanticError(
          `கலப்பு எழுவாய்கள்: ${subjectsWithoutUm.length} எழுவாய்(கள்) ும் இல்லாமலும், ும்-இணைப்பு எழுவாய்களுடன் சேர்ந்தும் உள்ளன.`
        );
      }
    }

    // Agreement check
    if (subjectsWithUm.length > 0) {
      if (subjectsWithUm.length === 1) {
        this.checkAgreement(subjectsWithUm[0].png, verbPNG);
      } else {
        this.checkConjoinedAgreement(subjectsWithUm.map(s => s.png), verbPNG);
      }
    } else if (subjectsWithoutUm.length === 1) {
      this.checkAgreement(subjectsWithoutUm[0].png, verbPNG);
    }
    // Zero subjects: pro-drop allowed

    this.details.agreementResult = { success: true, message: 'எழுவாய்-வினை ஒப்புமை சரியானது ✅' };
    return this.details;
  }

  resolveUmSubject(word) {
    if (!word.endsWith(UM_SUFFIX)) return null;
    const stem = word.substring(0, word.length - UM_SUFFIX.length);

    // Step 1: Glide map
    const glideResolved = GLIDE_STEM_MAP.get(stem);
    if (glideResolved) return SUBJECTS.get(glideResolved);

    // Step 2: Re-append pulli
    const stemWithPulli = stem + PULLI;
    if (SUBJECTS.has(stemWithPulli)) return SUBJECTS.get(stemWithPulli);

    // Step 3: Stem as-is
    if (SUBJECTS.has(stem)) return SUBJECTS.get(stem);

    return null;
  }

  getVerbPNG(word) {
    for (const [suffix, png] of INTERROGATIVE_SUFFIXES) {
      if (word.endsWith(suffix)) return png;
    }
    for (const [suffix, png] of VERB_SUFFIXES) {
      if (word.endsWith(suffix)) return png;
    }
    return null;
  }

  checkAgreement(subject, verb) {
    if (verb.person === 'wildcard') return;

    if (subject.person !== verb.person) {
      throw new SemanticError(
        `நபர் பொருத்தமின்மை — எழுவாய் ${PERSON_LABELS[subject.person]} ஆனால் வினைச்சொல் ${PERSON_LABELS[verb.person]}.`
      );
    }
    if (subject.number !== verb.number) {
      throw new SemanticError(
        `எண் பொருத்தமின்மை — எழுவாய் ${NUMBER_LABELS[subject.number]} ஆனால் வினைச்சொல் ${NUMBER_LABELS[verb.number]}.`
      );
    }
    if (!this.genderMatches(subject.gender, verb.gender)) {
      throw new SemanticError(
        `பால் பொருத்தமின்மை — எழுவாய் ${GENDER_LABELS[subject.gender]} ஆனால் வினைச்சொல் ${GENDER_LABELS[verb.gender]}.`
      );
    }
  }

  checkConjoinedAgreement(subjects, verb) {
    if (verb.person === 'wildcard') return;

    if (verb.number !== 'plural') {
      throw new SemanticError('பல இணைப்பு எழுவாய்களுக்கு பன்மை வினைவடிவம் தேவை.');
    }

    let minPerson = 3;
    for (const s of subjects) {
      const p = parseInt(s.person);
      if (p < minPerson) minPerson = p;
    }

    const verbPerson = parseInt(verb.person);
    if (verbPerson !== minPerson) {
      throw new SemanticError(
        `இணைப்பு எழுவாய் நபர் பொருத்தமின்மை: ஆதிக்க நபர் ${minPerson} ஆனால் வினைச்சொல் நபர் ${verbPerson}.`
      );
    }

    const dominantGenders = [];
    for (const s of subjects) {
      if (parseInt(s.person) === minPerson) {
        dominantGenders.push(s.gender);
      }
    }

    const expectedGender = this.resolveConjoinedGender(dominantGenders);
    if (!this.genderMatches(expectedGender, verb.gender)) {
      throw new SemanticError(
        `இணைப்பு எழுவாய் பால் பொருத்தமின்மை: எதிர்பார்த்த '${GENDER_LABELS[expectedGender]}' ஆனால் வினைச்சொல் '${GENDER_LABELS[verb.gender]}'.`
      );
    }
  }

  resolveConjoinedGender(genders) {
    let hasRational = false, hasMasculine = false, hasFeminine = false, hasNeuter = false;
    for (const g of genders) {
      if (g === 'rational') hasRational = true;
      else if (g === 'm') hasMasculine = true;
      else if (g === 'f') hasFeminine = true;
      else if (g === 'n') hasNeuter = true;
    }
    if (hasRational) return 'rational';
    if (hasMasculine && hasFeminine) return 'rational';
    if (hasMasculine) return 'm';
    if (hasFeminine) return 'f';
    if (hasNeuter) return 'n';
    return 'rational';
  }

  genderMatches(subjectGender, verbGender) {
    if (subjectGender === 'wildcard' || verbGender === 'wildcard') return true;
    return subjectGender === verbGender;
  }
}

class SemanticError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SemanticError';
  }
}

// ================================================================
// COMPILER — Orchestrates all phases
// ================================================================
class TamilCompiler {
  compile(input) {
    const result = {
      input: input.trim(),
      phases: {
        lexer: { success: false, data: null, error: null },
        parser: { success: false, data: null, error: null },
        semantic: { success: false, data: null, error: null }
      },
      overall: { success: false, message: '' }
    };

    if (!result.input) {
      result.overall.message = 'உள்ளீடு காலியாக உள்ளது';
      return result;
    }

    // Phase 1: Lexical Analysis
    try {
      const lexer = new TamilLexer(result.input);
      const lexResult = lexer.tokenize();

      if (lexResult.errors.length > 0) {
        result.phases.lexer.error = {
          type: 'LEXICAL ERROR',
          message: lexResult.errors.map(e => e.message).join('\n'),
          details: lexResult.errors
        };
        result.phases.lexer.data = { tokens: lexResult.tokens };
        result.overall.message = `சொல்லாய்வுப் பிழை → ${lexResult.errors[0].message}`;
        return result;
      }

      result.phases.lexer.success = true;
      result.phases.lexer.data = { tokens: lexResult.tokens };
    } catch (e) {
      result.phases.lexer.error = { type: 'LEXICAL ERROR', message: e.message };
      result.overall.message = `சொல்லாய்வுப் பிழை → ${e.message}`;
      return result;
    }

    // Phase 2: Syntax Analysis
    try {
      const parser = new TamilParser(result.phases.lexer.data.tokens);
      const parseResult = parser.parse();

      if (parseResult.errors.length > 0) {
        result.phases.parser.error = {
          type: 'SYNTAX ERROR',
          message: parseResult.errors.map(e => e.message).join('\n'),
          details: parseResult.errors
        };
        result.phases.parser.data = { parseTree: parseResult.parseTree, words: parseResult.words };
        result.overall.message = `தொடரியல் பிழை → ${parseResult.errors[0].message}`;
        return result;
      }

      result.phases.parser.success = true;
      result.phases.parser.data = { parseTree: parseResult.parseTree, words: parseResult.words };
    } catch (e) {
      result.phases.parser.error = { type: 'SYNTAX ERROR', message: e.message };
      result.overall.message = `தொடரியல் பிழை → ${e.message}`;
      return result;
    }

    // Phase 3: Semantic Analysis
    try {
      const analyzer = new TamilSemanticAnalyzer(result.phases.parser.data.words);
      const semanticResult = analyzer.analyze();

      result.phases.semantic.success = true;
      result.phases.semantic.data = semanticResult;
    } catch (e) {
      if (e instanceof SemanticError) {
        result.phases.semantic.error = { type: 'SEMANTIC ERROR', message: e.message };
        result.overall.message = `பொருள்சார் பிழை → ${e.message}`;
      } else {
        result.phases.semantic.error = { type: 'ERROR', message: e.message };
        result.overall.message = `பிழை → ${e.message}`;
      }
      return result;
    }

    // All phases passed
    result.overall.success = true;
    result.overall.message = 'சரியான வாக்கியம் ✅';
    return result;
  }
}

// ================================================================
// UI CONTROLLER
// ================================================================
const compiler = new TamilCompiler();

// Example sentences with expected validity
const EXAMPLES = [
  { text: 'நான் ஓடுகிறேன்', valid: true, desc: '1ம் நபர் ஒருமை' },
  { text: 'அது வேலை செய்கிறது', valid: true, desc: '3ம் நபர் அஃறிணை' },
  { text: 'அவர்கள் பாடம் படிக்கிறார்கள்', valid: true, desc: '3ம் நபர் உயர்திணை பன்மை' },
  { text: 'நாம் வேலை செய்கிறோம்', valid: true, desc: '1ம் நபர் பன்மை' },
  { text: 'அவன் புத்தகம் படிக்கிறான்', valid: true, desc: '3ம் நபர் ஆண்பால்' },
  { text: 'அஃது வருகிறது', valid: true, desc: 'ஆய்த எழுத்து எழுவாய்' },
  { text: 'அவன் வரவில்லை', valid: true, desc: 'எதிர்மறை வாக்கியம்' },
  { text: 'நீ வருகிறாயா', valid: true, desc: 'வினாவாக்கியம்' },
  { text: 'அவனும் அவளும் வரவில்லையா', valid: true, desc: 'இணைப்பு + வினா + எதிர்மறை' },
  { text: 'அதுவும் இதுவும் வந்தன', valid: true, desc: 'இணைப்பு அஃறிணை பன்மை' },
  { text: 'நானும் நீயும் வந்தீர்கள்', valid: false, desc: 'நபர் பொருத்தமின்மை' },
  { text: 'நான் புத்தகம் படிக்கிறான்', valid: false, desc: 'நபர் பொருத்தமின்மை' },
  { text: 'நீ பாடம் படிக்கிறேன்', valid: false, desc: 'நபர் பொருத்தமின்மை' },
  { text: 'அவன் புத்தகம் படிக்கிறாள்', valid: false, desc: 'பால் பொருத்தமின்மை' },
  { text: 'அவன் fruit சாப்பிடுகிறான்', valid: false, desc: 'சொல்லாய்வுப் பிழை' },
  { text: 'அவன் அவள் வந்தோம்', valid: false, desc: 'பல எழுவாய் பிழை' },
];

document.addEventListener('DOMContentLoaded', () => {
  initExamples();
  initEventListeners();
});

function initExamples() {
  const grid = document.getElementById('examples-grid');
  if (!grid) return;

  grid.innerHTML = '';
  for (const ex of EXAMPLES) {
    const item = document.createElement('div');
    item.className = 'example-item';
    item.innerHTML = `
      <span class="ex-icon">▸</span>
      <span>${ex.text}</span>
      <span class="ex-badge ${ex.valid ? 'valid' : 'invalid'}">${ex.valid ? 'சரி' : 'பிழை'}</span>
    `;
    item.addEventListener('click', () => {
      document.getElementById('tamil-input').value = ex.text;
      runCompiler();
    });
    grid.appendChild(item);
  }
}

function initEventListeners() {
  document.getElementById('compile-btn').addEventListener('click', runCompiler);
  document.getElementById('clear-btn').addEventListener('click', clearAll);

  const input = document.getElementById('tamil-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runCompiler();
    }
  });
}

function runCompiler() {
  const input = document.getElementById('tamil-input').value;
  if (!input.trim()) return;

  const result = compiler.compile(input);
  displayResults(result);
}

function clearAll() {
  document.getElementById('tamil-input').value = '';
  document.getElementById('results-section').classList.remove('visible');
  resetPipeline();
}

function displayResults(result) {
  const section = document.getElementById('results-section');
  section.classList.add('visible');

  // Update pipeline
  updatePipeline(result);

  // Result banner
  const banner = document.getElementById('result-banner');
  if (result.overall.success) {
    banner.className = 'result-banner success';
    banner.innerHTML = `
      <span class="result-icon">✅</span>
      <span class="result-text">சரியான தமிழ் வாக்கியம்</span>
    `;
  } else {
    banner.className = 'result-banner error';
    const errorType = result.phases.lexer.error ? 'சொல்லாய்வுப் பிழை'
      : result.phases.parser.error ? 'தொடரியல் பிழை'
        : 'பொருள்சார் பிழை';
    banner.innerHTML = `
      <span class="result-icon">❌</span>
      <span class="result-text">
        ${errorType}
        <span class="error-detail">${result.overall.message}</span>
      </span>
    `;
  }

  // Phase 1: Lexer
  renderLexerPhase(result);

  // Phase 2: Parser
  renderParserPhase(result);

  // Phase 3: Semantic
  renderSemanticPhase(result);

  // Smooth scroll to results
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updatePipeline(result) {
  const steps = document.querySelectorAll('.pipeline-step');
  steps.forEach(s => s.classList.remove('active', 'success', 'error'));

  // Lexer
  if (result.phases.lexer.success) {
    steps[1].classList.add('success');
  } else if (result.phases.lexer.error) {
    steps[1].classList.add('error');
    return;
  }

  // Parser
  if (result.phases.parser.success) {
    steps[2].classList.add('success');
  } else if (result.phases.parser.error) {
    steps[2].classList.add('error');
    return;
  }

  // Semantic
  if (result.phases.semantic.success) {
    steps[3].classList.add('success');
  } else if (result.phases.semantic.error) {
    steps[3].classList.add('error');
    return;
  }

  // Result
  if (result.overall.success) {
    steps[4].classList.add('success');
  }
}

function resetPipeline() {
  document.querySelectorAll('.pipeline-step').forEach(s => s.classList.remove('active', 'success', 'error'));
}

function renderLexerPhase(result) {
  const card = document.getElementById('phase-lexer');
  const content = document.getElementById('phase-lexer-content');
  const tokens = result.phases.lexer.data ? result.phases.lexer.data.tokens : [];

  if (result.phases.lexer.success) {
    card.className = 'phase-card phase-success expanded';
    card.querySelector('.phase-status').textContent = 'வெற்றி';
  } else if (result.phases.lexer.error) {
    card.className = 'phase-card phase-error expanded';
    card.querySelector('.phase-status').textContent = 'பிழை';
  }

  // Build token table
  const visibleTokens = tokens.filter(t => t.type !== TokenType.EOF);
  let html = `<table class="token-table"><thead><tr>
    <th>#</th><th>எழுத்து</th><th>வகை</th><th>விளக்கம்</th>
  </tr></thead><tbody>`;

  visibleTokens.forEach((t, i) => {
    const cssClass = TOKEN_CSS_CLASS[t.type] || '';
    const displayVal = t.type === TokenType.WS ? '⎵' : t.value;
    html += `<tr>
      <td>${i + 1}</td>
      <td style="font-size:1.1rem">${displayVal}</td>
      <td><span class="token-type ${cssClass}">${t.type}</span></td>
      <td style="color:var(--text-secondary);font-size:0.8rem">${TOKEN_DISPLAY[t.type] || ''}</td>
    </tr>`;
  });

  html += '</tbody></table>';

  if (result.phases.lexer.error) {
    html += `<div class="phase-error-msg" style="margin-top:12px">⚠️ ${result.phases.lexer.error.message}</div>`;
  }

  content.innerHTML = html;
}

function renderParserPhase(result) {
  const card = document.getElementById('phase-parser');
  const content = document.getElementById('phase-parser-content');

  if (!result.phases.lexer.success) {
    card.className = 'phase-card phase-skipped';
    card.querySelector('.phase-status').textContent = 'தவிர்';
    content.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">சொல்லாய்வு நிலையில் பிழை ஏற்பட்டதால் தவிர்க்கப்பட்டது</p>';
    return;
  }

  if (result.phases.parser.success) {
    card.className = 'phase-card phase-success expanded';
    card.querySelector('.phase-status').textContent = 'வெற்றி';
  } else if (result.phases.parser.error) {
    card.className = 'phase-card phase-error expanded';
    card.querySelector('.phase-status').textContent = 'பிழை';
  }

  const parseTree = result.phases.parser.data.parseTree;
  let html = '<div class="parse-tree-container"><div class="tree"><ul>';
  html += renderTreeNode(parseTree);
  html += '</ul></div></div>';

  if (result.phases.parser.error) {
    html += `<div class="phase-error-msg" style="margin-top:12px">⚠️ ${result.phases.parser.error.message}</div>`;
  }

  content.innerHTML = html;
}

function renderTreeNode(node) {
  let html = '<li>';

  if (node.type === 'sentence') {
    html += '<div class="node-box"><span class="node-label">sentence</span></div>';
    if (node.children && node.children.length > 0) {
      html += '<ul>';
      for (const child of node.children) {
        html += renderTreeNode(child);
      }
      html += '</ul>';
    }
  } else if (node.type === 'word') {
    const errorClass = node.error ? ' error-box' : '';
    html += `<div class="node-box${errorClass}">`;
    html += `<span class="node-label">word</span>`;
    html += `<span class="leaf-label">${node.text}</span>`;
    if (node.error) {
      html += `<div style="font-size:0.7rem;margin-top:4px">பிழை</div>`;
    }
    html += `</div>`;

    if (node.children && node.children.length > 0) {
      html += '<ul>';
      for (const child of node.children) {
        html += `<li><div class="node-box">`;
        html += `<span class="node-label">${child.type}</span>`;
        if (child.subtype) {
          html += `<span style="font-size:0.65rem;color:var(--text-muted);display:block;margin-top:-2px;margin-bottom:4px">${child.subtype}</span>`;
        }
        html += `<span class="leaf-label">${child.value}</span>`;
        html += `</div></li>`;
      }
      html += '</ul>';
    }
  }

  html += '</li>';
  return html;
}

function renderSemanticPhase(result) {
  const card = document.getElementById('phase-semantic');
  const content = document.getElementById('phase-semantic-content');

  if (!result.phases.parser.success) {
    card.className = 'phase-card phase-skipped';
    card.querySelector('.phase-status').textContent = 'தவிர்';
    content.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">முந்தைய நிலையில் பிழை ஏற்பட்டதால் தவிர்க்கப்பட்டது</p>';
    return;
  }

  if (result.phases.semantic.success) {
    card.className = 'phase-card phase-success expanded';
    card.querySelector('.phase-status').textContent = 'வெற்றி';
  } else if (result.phases.semantic.error) {
    card.className = 'phase-card phase-error expanded';
    card.querySelector('.phase-status').textContent = 'பிழை';
  }

  const data = result.phases.semantic.data;
  let html = '';

  if (data) {
    html += '<div class="semantic-grid">';

    // Subjects box
    html += '<div class="semantic-box">';
    html += '<h4>எழுவாய் (Subject)</h4>';
    if (data.subjects.length === 0 && data.subjectsWithUm.length === 0 && data.subjectsWithoutUm.length === 0) {
      html += '<div class="value" style="color:var(--text-muted)">எழுவாய் இல்லை (pro-drop)</div>';
    } else {
      const allSubjects = [...data.subjectsWithoutUm, ...data.subjectsWithUm];
      for (const s of allSubjects) {
        html += `<div class="value" style="margin-bottom:8px">${s.word}`;
        html += `<div style="margin-top:4px">`;
        html += `<span class="png-tag person">${PERSON_LABELS[s.png.person]}</span>`;
        html += `<span class="png-tag gender">${GENDER_LABELS[s.png.gender]}</span>`;
        html += `<span class="png-tag number">${NUMBER_LABELS[s.png.number]}</span>`;
        html += `</div></div>`;
      }
    }
    html += '</div>';

    // Verb box
    html += '<div class="semantic-box">';
    html += '<h4>பயனிலை (Verb)</h4>';
    if (data.verb) {
      html += `<div class="value">${data.verb}`;
      if (data.isInterrogative) html += ' <span style="font-size:0.75rem;color:var(--accent-cyan)">❓ வினா</span>';
      if (data.isNegation) html += ' <span style="font-size:0.75rem;color:var(--accent-amber)">⊘ எதிர்மறை</span>';
      html += '</div>';
      if (data.verbPNG) {
        html += `<div style="margin-top:6px">`;
        html += `<span class="png-tag person">${PERSON_LABELS[data.verbPNG.person]}</span>`;
        html += `<span class="png-tag gender">${GENDER_LABELS[data.verbPNG.gender]}</span>`;
        html += `<span class="png-tag number">${NUMBER_LABELS[data.verbPNG.number]}</span>`;
        html += `</div>`;
      }
    } else {
      html += '<div class="value" style="color:var(--accent-rose)">வினைச்சொல் கண்டறியப்படவில்லை</div>';
    }
    html += '</div>';

    html += '</div>'; // end semantic-grid

    // Agreement result
    if (data.agreementResult) {
      html += `<div class="agreement-result match">✅ ${data.agreementResult.message}</div>`;
    }
  }

  if (result.phases.semantic.error) {
    html += `<div class="phase-error-msg" style="margin-top:12px">⚠️ ${result.phases.semantic.error.message}</div>`;
  }

  content.innerHTML = html;
}

// Toggle phase panels
function togglePhase(phaseId) {
  const card = document.getElementById(phaseId);
  card.classList.toggle('expanded');
}
