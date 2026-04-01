# 🔤 தமிழ் வாக்கிய தொகுப்பி — Tamil Sentence Compiler

A compiler for Tamil (தமிழ்) sentences that performs **Lexical**, **Syntax**, and **Semantic Analysis** using an ANTLR4-based grammar. Built out of curiosity and passion for linguistics and compiler design.


---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Compilation Pipeline](#compilation-pipeline)
- [Grammar Design](#grammar-design)
- [Semantic Analysis](#semantic-analysis)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [Sample Inputs & Outputs](#sample-inputs--outputs)
- [Technologies Used](#technologies-used)
- [Team Members](#team-members)

---

## 📖 Overview

This project implements a **compiler front-end** for validating Tamil sentences. Given a Tamil sentence as input, the compiler checks:

1. **Lexical Correctness** — Are all characters valid Tamil Unicode characters (vowels, consonants, vowel signs, pulli, aytham)?
2. **Syntactic Correctness** — Does each word follow valid Tamil word structure rules (start → mid → end)?
3. **Semantic Correctness** — Does the subject agree with the verb in **Person**, **Gender**, and **Number** (PNG)?

The project has **two implementations**:
- **Java + ANTLR4** — The core compiler that runs on the command line.
- **JavaScript (Browser)** — A fully interactive web UI that runs entirely in the browser with no server required.

---

## ✨ Features

### Lexical Analysis
- Validates Tamil Unicode characters: **குறில்** (short vowels), **நெடில்** (long vowels), **வல்லினம்** (hard consonants), other consonants, vowel signs, **புள்ளி** (virama), **ஆய்தம்** (aytham)
- Detects invalid/non-Tamil characters in the input
- Reports exact position of lexical errors

### Syntax Analysis
- Enforces Tamil word formation rules based on ANTLR4 grammar
- Valid word structure: `start → mid* → end?`
- Handles special patterns like aytham-vallinam combinations
- Reports syntax errors with position information

### Semantic Analysis — Subject-Verb Agreement (PNG)
- **Person Agreement** — 1st, 2nd, 3rd person matching
- **Gender Agreement** — Masculine (ஆண்பால்), Feminine (பெண்பால்), Neuter (அஃறிணை), Rational/Honorific (உயர்திணை)
- **Number Agreement** — Singular (ஒருமை) vs Plural (பன்மை)
- **Conjoined subjects** — Handles `ும்` (um) conjunction with sandhi resolution:
  - **Pulli-loss sandhi**: `அவன் + ும் → அவனும்`
  - **வ்-glide sandhi**: `அது + ும் → அதுவும்`
  - **ய்-glide sandhi**: `நீ + ும் → நீயும்`
- **Conjoined agreement rules** — Lowest person dominates (1+3 → 1st plural)
- **Negation** — `வில்லை` form (wildcard agreement)
- **Interrogative** — `ஆ` suffixed verb forms
- **Pro-drop** — Allows sentences without explicit subjects

### Web UI
- Real-time compilation pipeline visualization
- Collapsible phase panels for each analysis stage
- Pre-loaded example sentences for quick testing
- Dark-themed, premium design with Tamil typography
- Fully client-side — no backend or installation needed

---

## 🔄 Compilation Pipeline

```
உள்ளீடு (Input)
    │
    ▼
📝 Lexical Analysis (சொல்லாய்வு)
    │  Tokenizes Tamil characters into: V_KURIL, V_NEDIL,
    │  VA_ONLY, C_ONLY, KU_ONLY, VS_ONLY, P, AK, WS
    ▼
🌳 Syntax Analysis (தொடரியல்)
    │  Validates word structure using ANTLR4 grammar rules:
    │  sentence → word (WS word)* EOF
    │  word → start mid* end?
    ▼
🧠 Semantic Analysis (பொருள்சார்)
    │  Checks Subject-Verb PNG agreement,
    │  handles conjunctions, negation, interrogatives
    ▼
✅ Result (முடிவு)
    VALID / ERROR with detailed message
```

---

## 📜 Grammar Design

The ANTLR4 grammar (`TamilWord.g4`) defines Tamil character classes:

| Lexer Token | Description | Characters |
|------------|-------------|------------|
| `V_KURIL` | Short vowels (குறில்) | அ, இ, உ, எ, ஒ |
| `V_NEDIL` | Long vowels (நெடில்) | ஆ, ஈ, ஊ, ஏ, ஐ, ஓ, ஔ |
| `VA_ONLY` | Vallinam consonants (வல்லினம்) | க, ச, ட, த, ப, ற |
| `C_ONLY` | Other consonants | ங, ஞ, ண, ந, ம, ய, ர, ல, வ, ழ, ள, ன |
| `KU_ONLY` | Kuril vowel signs | ி, ு, ெ, ொ |
| `VS_ONLY` | Other vowel signs | ா, ீ, ூ, ே, ை, ோ, ௌ |
| `P` | Pulli (விராமம்) | ் |
| `AK` | Aytham (ஆய்தம்) | ஃ |

### Word Formation Rules
```
word → start mid* end?
start → vowel | consonant | consonant vowel_sign
mid → consonant vowel_sign? | consonant pulli consonant vowel_sign?
end → consonant pulli
```

---

## 🧠 Semantic Analysis

### Subject Dictionary
The compiler recognizes **18 Tamil pronouns** across all person-gender-number combinations:

| Person | Pronouns | Gender | Number |
|--------|----------|--------|--------|
| 1st | நான் | rational | singular |
| 1st | நாம் | rational | plural |
| 2nd | நீ | rational | singular |
| 2nd | நீங்கள் | rational | plural |
| 3rd | அவன், இவன் | masculine | singular |
| 3rd | அவள், இவள் | feminine | singular |
| 3rd | அது, இது, அஃது, இஃது | neuter | singular |
| 3rd | அவர், இவர் | rational | singular |
| 3rd | அவர்கள், இவர்கள் | rational | plural |
| 3rd | அவை, இவை | neuter | plural |

### Verb Suffix Detection
Detects verb PNG from suffix patterns (longest-match-first):

| Suffix | Person | Gender | Number | Example |
|--------|--------|--------|--------|---------|
| ேன் | 1st | rational | singular | ஓடுகிறேன் (I run) |
| ோம் | 1st | rational | plural | ஓடுகிறோம் (We run) |
| ாய் | 2nd | rational | singular | ஓடுகிறாய் (You run) |
| ீர்கள் | 2nd | rational | plural | ஓடுகிறீர்கள் (You all run) |
| ான் | 3rd | masculine | singular | ஓடுகிறான் (He runs) |
| ாள் | 3rd | feminine | singular | ஓடுகிறாள் (She runs) |
| து | 3rd | neuter | singular | ஓடுகிறது (It runs) |
| ார் | 3rd | rational | singular | ஓடுகிறார் (He/She [honorific] runs) |
| ார்கள் | 3rd | rational | plural | ஓடுகிறார்கள் (They run) |
| ன | 3rd | neuter | plural | ஓடுகின்றன (They [neuter] run) |
| வில்லை | any | any | any | ஓடவில்லை (didn't run) |

---

## 📁 Project Structure

```
Tamil-compiler/
├── TamilWord.g4                    # ANTLR4 grammar for Tamil word structure
├── Main.java                       # Java entry point (Lexer → Parser → Semantic)
├── SentenceSemanticListener.java   # Semantic analysis: PNG agreement, sandhi, conjunctions
├── compiler.js                     # JavaScript port of the full compiler (browser-based)
├── index.html                      # Web UI with compilation pipeline visualization
├── style.css                       # Dark-themed premium styling
└── READMe                          # This file
```

---

## 🚀 How to Run

### Option 1: Web UI (Recommended — No Setup Required)

Simply open `index.html` in any modern browser. That's it!

1. Open `index.html` in Chrome / Firefox / Edge
2. Type or paste a Tamil sentence in the input box
3. Click **தொகு (Compile)** to see results
4. Use the pre-loaded example sentences for quick testing

> 💡 The web version runs entirely in the browser — no Java, no ANTLR, no server needed.

### Option 2: Java + ANTLR4 (Command Line)

#### Prerequisites
- Java JDK 8+
- ANTLR4 JAR file ([Download](https://www.antlr.org/download.html))

#### Steps

```bash
# 1. Generate Lexer & Parser from grammar
java -jar antlr-4.x-complete.jar TamilWord.g4

# 2. Compile all Java files
javac -cp ".;antlr-4.x-complete.jar" *.java

# 3. Run with a Tamil sentence
echo "நான் ஓடுகிறேன்" | java -cp ".;antlr-4.x-complete.jar" Main
```

> ⚠️ On Linux/Mac, replace `;` with `:` in the classpath separator.

---

## 📝 Sample Inputs & Outputs

### ✅ Valid Sentences

| Input | Meaning | Result |
|-------|---------|--------|
| `நான் ஓடுகிறேன்` | I am running | VALID ✅ |
| `அவன் புத்தகம் படிக்கிறான்` | He is reading a book | VALID ✅ |
| `அவர்கள் பாடம் படிக்கிறார்கள்` | They are studying | VALID ✅ |
| `நாம் வேலை செய்கிறோம்` | We are working | VALID ✅ |
| `அவனும் அவளும் வரவில்லையா` | Didn't he and she come? | VALID ✅ |
| `நீ வருகிறாயா` | Are you coming? | VALID ✅ |
| `அஃது வருகிறது` | That (literary) is coming | VALID ✅ |
| `நானும் அவனும் வந்தோம்` | He and I came | VALID ✅ |

### ❌ Invalid Sentences

| Input | Error Type | Reason |
|-------|-----------|--------|
| `நான் புத்தகம் படிக்கிறான்` | Semantic | Person mismatch: subject is 1st but verb is 3rd |
| `அவன் அவள் வந்தோம்` | Semantic | Multiple subjects without ும் conjunction |
| `நான் அவனும் வந்தேன்` | Semantic | Mixed subjects: plain + ும்-conjoined |
| `அவன் fruit சாப்பிடுகிறான்` | Lexical | Invalid non-Tamil character 'f' |
| `அவள் புத்தகம் படிக்கிறான்` | Semantic | Gender mismatch: feminine subject with masculine verb |

---

## 🛠️ Technologies Used

| Technology | Purpose |
|-----------|---------|
| **ANTLR4** | Grammar definition, lexer & parser generation |
| **Java** | Core compiler implementation |
| **JavaScript** | Browser-based compiler port |
| **HTML5 / CSS3** | Interactive web UI with dark theme |
| **Unicode (Tamil Block)** | Tamil character handling (U+0B80 – U+0BFF) |

---

## 📚 References

- [ANTLR4 Documentation](https://github.com/antlr/antlr4/blob/master/doc/index.md)
- [Tamil Unicode Block — Unicode.org](https://unicode.org/charts/PDF/U0B80.pdf)
- [தமிழ் இலக்கணம் — Tamil Grammar](https://ta.wikipedia.org/wiki/%E0%AE%A4%E0%AE%AE%E0%AE%BF%E0%AE%B4%E0%AF%8D_%E0%AE%87%E0%AE%B2%E0%AE%95%E0%AF%8D%E0%AE%95%E0%AE%A3%E0%AE%AE%E0%AF%8D)

---

## 👥 Team Members

> **Built by 2 enthusiasts** — Tamil Language & Compiler Design

| Name | Role |
|------|------|
| Aadhithya Bharathi | Core Engine (G4 Grammar, Main Parser, JS Compiler) |
| Srividya | Frontend & Semantic Engine (UI, Styling, Listener) |

---

## 📄 License

This project is open-source and available for educational and personal use.

---

<p align="center">
  <b>தமிழ் வாக்கிய தொகுப்பி</b> — ANTLR4 Grammar ↔ JavaScript Implementation<br>
  Made with ❤️ by Tamil Language Enthusiasts
</p>
