grammar TamilWord;

// ===============================
// PARSER RULES
// ===============================

// Top-level rule
program
: sentence EOF
;

// Sentence = one or more valid words
sentence 
: word (WS word)* EOF
;

// ----------------------------
// WORD RULE (unchanged logic)
// ----------------------------
word 
: start mid* end?
| vowel_kuril ak vallinam vowel_sign? mid* end?
| consonant kuril_opt ak vallinam vowel_sign? mid* end?
;
  
// ----------------------------
// START RULE
// ----------------------------
start
: vowel
| consonant
| consonant vowel_sign
;

// ----------------------------
// MID RULE
// ----------------------------
mid
: consonant vowel_sign?
| consonant pulli consonant vowel_sign?
;

// ----------------------------
// END RULE
// ----------------------------
end
: consonant pulli
;

// ----------------------------
// BASIC UNITS
// ----------------------------
vowel_kuril : V_KURIL ;

vowel : V_KURIL | V_NEDIL ;

vowel_sign
: VS_ONLY
| KU_ONLY
;

kuril_opt
: KU_ONLY?
;

ak : AK ;

consonant : VA_ONLY | C_ONLY ;

vallinam : VA_ONLY ;

pulli : P ;

// ===============================
// LEXER RULES
// ===============================

// Short vowels (Kuril)
V_KURIL : [அஇஉஎஒ] ;

// Long vowels (Nedil)
V_NEDIL : [ஆஈஊஏஐஓஔ] ;

// Vallinam consonants
VA_ONLY : [கசடதபற] ;

// Other consonants
C_ONLY : [ஙஞணநமயரலவழளன] ;

// KU-only vowel signs 
KU_ONLY : [ிுெொ] ;

// VS-only vowel signs
VS_ONLY : [ாீூேைோௌ] ;

// Pulli
P : '்' ;

// Aytham
AK : 'ஃ' ;

// Ignore whitespace
WS : [ \t\r\n]+;