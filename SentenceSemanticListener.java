import java.util.*;
import org.antlr.v4.runtime.*;

public class SentenceSemanticListener extends TamilWordBaseListener {

    private final CommonTokenStream tokens;
    private List<String> words = new ArrayList<>();

    // ================================================================
    // UNICODE CONSTANTS
    // ----------------------------------------------------------------
    // "ும்" = ு (U+0BC1) + ம (U+0BAE) + ் (U+0BCD)  — 3 code units
    // "்"   = pulli / virama (U+0BCD)                 — 1 code unit
    //
    // PULLI-LOSS SANDHI:
    //   Consonant-final stem + ும்: the stem's final pulli merges with ு
    //     அவன்  + ும்  →  அவனும்   (strip ும் → அவன  → +் → அவன் ✅)
    //     அவள்  + ும்  →  அவளும்   (strip ும் → அவள  → +் → அவள் ✅)
    //
    // வ்-GLIDE SANDHI (உ-final stems):
    //   அது  + ும்  →  அதுவும்   (strip ும் → அதுவ  → GLIDE_MAP → அது ✅)
    //   அஃது + ும்  →  அஃதுவும்  (strip ும் → அஃதுவ → GLIDE_MAP → அஃது ✅)
    //
    // ய்-GLIDE SANDHI (vowel-final / ஐ-final stems):
    //   நீ   + ும்  →  நீயும்    (strip ும் → நீய   → GLIDE_MAP → நீ ✅)
    //   அவை  + ும்  →  அவையும்   (strip ும் → அவைய  → GLIDE_MAP → அவை ✅)
    // ================================================================
    private static final String UM_SUFFIX = "ும்";   // 3 chars
    private static final String PULLI     = "்";     // 1 char  (U+0BCD)

    public SentenceSemanticListener(CommonTokenStream tokens) {
        this.tokens = tokens;
    }

    // ================================================================
    // DATA STRUCTURES
    // ================================================================
    static class PNGInfo {
        String person, gender, number;
        PNGInfo(String p, String g, String n) {
            person = p; gender = g; number = n;
        }
        @Override
        public String toString() {
            return "Person=" + person + ", Gender=" + gender + ", Number=" + number;
        }
    }

    // ================================================================
    // GENDER VALUES
    // ----------------------------------------------------------------
    //  "m"         masculine          அவன், இவன்
    //  "f"         feminine           அவள், இவள்
    //  "n"         neuter             அது, இது, அஃது, இஃது, அவை, இவை
    //  "rational"  rational/honorific நான், நீ, நாம், நீங்கள்,
    //                                 அவர், இவர், அவர்கள், இவர்கள்
    //              → matches ONLY "rational" verb suffixes
    //              → never matches "m", "f", or "n"
    //  "wildcard"  bypass             ONLY for வில்லை / வில்லையா
    // ================================================================

    // ================================================================
    // SUBJECT DICTIONARY
    // ================================================================
    private static final Map<String, PNGInfo> SUBJECTS = new HashMap<>();
    static {
        // 1st person — rational
        SUBJECTS.put("நான்",     new PNGInfo("1", "rational", "sing"));
        SUBJECTS.put("நாம்",     new PNGInfo("1", "rational", "plural"));

        // 2nd person — rational
        SUBJECTS.put("நீ",       new PNGInfo("2", "rational", "sing"));
        SUBJECTS.put("நீங்கள்",  new PNGInfo("2", "rational", "plural"));

        // 3rd person masculine singular
        SUBJECTS.put("அவன்",    new PNGInfo("3", "m",        "sing"));
        SUBJECTS.put("இவன்",    new PNGInfo("3", "m",        "sing"));

        // 3rd person feminine singular
        SUBJECTS.put("அவள்",    new PNGInfo("3", "f",        "sing"));
        SUBJECTS.put("இவள்",    new PNGInfo("3", "f",        "sing"));

        // 3rd person neuter singular (regular)
        SUBJECTS.put("அது",     new PNGInfo("3", "n",        "sing"));
        SUBJECTS.put("இது",     new PNGInfo("3", "n",        "sing"));

        // 3rd person neuter singular (aytham — அஃது / இஃது)
        // அஃது and இஃது are literary/classical forms of அது/இது
        // where ஃ (aytham, U+0B83) appears between அ/இ and து.
        // They carry identical PNG to அது/இது: 3rd, neuter, singular.
        SUBJECTS.put("அஃது",    new PNGInfo("3", "n",        "sing"));
        SUBJECTS.put("இஃது",    new PNGInfo("3", "n",        "sing"));

        // 3rd person rational/honorific singular
        SUBJECTS.put("அவர்",    new PNGInfo("3", "rational", "sing"));
        SUBJECTS.put("இவர்",    new PNGInfo("3", "rational", "sing"));

        // 3rd person rational plural
        SUBJECTS.put("அவர்கள்", new PNGInfo("3", "rational", "plural"));
        SUBJECTS.put("இவர்கள்", new PNGInfo("3", "rational", "plural"));

        // 3rd person neuter plural
        SUBJECTS.put("அவை",    new PNGInfo("3", "n",        "plural"));
        SUBJECTS.put("இவை",    new PNGInfo("3", "n",        "plural"));
    }

    // ================================================================
    // GLIDE MAP
    // Maps stem-after-stripping-ும் → canonical SUBJECTS key
    // Only for forms where a glide consonant is inserted (no pulli loss).
    // ----------------------------------------------------------------
    //  ய்-glide  நீ    → நீயும்    → stem நீய    → நீ
    //  வ்-glide  அது   → அதுவும்   → stem அதுவ   → அது
    //  வ்-glide  இது   → இதுவும்   → stem இதுவ   → இது
    //  வ்-glide  அஃது  → அஃதுவும்  → stem அஃதுவ  → அஃது
    //  வ்-glide  இஃது  → இஃதுவும்  → stem இஃதுவ  → இஃது
    //  ய்-glide  அவை   → அவையும்   → stem அவைய   → அவை
    //  ய்-glide  இவை   → இவையும்   → stem இவைய   → இவை
    // ================================================================
    private static final Map<String, String> GLIDE_STEM_MAP = new HashMap<>();
    static {
        GLIDE_STEM_MAP.put("நீய",      "நீ");
        GLIDE_STEM_MAP.put("அதுவ",     "அது");
        GLIDE_STEM_MAP.put("இதுவ",     "இது");
        GLIDE_STEM_MAP.put("அஃதுவ",    "அஃது");   // அஃது → அஃதுவும்
        GLIDE_STEM_MAP.put("இஃதுவ",    "இஃது");   // இஃது → இஃதுவும்
        GLIDE_STEM_MAP.put("அவைய",     "அவை");
        GLIDE_STEM_MAP.put("இவைய",     "இவை");
        GLIDE_STEM_MAP.put("நாங்கள்",  "நாம்");   // dialectal exclusive 1st plural
    }

    // ================================================================
    // VERB SUFFIXES — longest first to prevent short-suffix shadowing
    // ================================================================
    private static final Map<String, PNGInfo> VERB_SUFFIXES = new LinkedHashMap<>();
    static {
        VERB_SUFFIXES.put("ீர்கள்",  new PNGInfo("2", "rational", "plural"));
        VERB_SUFFIXES.put("ார்கள்",  new PNGInfo("3", "rational", "plural"));
        VERB_SUFFIXES.put("வில்லை",  new PNGInfo("wildcard", "wildcard", "wildcard"));
        VERB_SUFFIXES.put("ோம்",     new PNGInfo("1", "rational", "plural"));
        VERB_SUFFIXES.put("ேன்",     new PNGInfo("1", "rational", "sing"));
        VERB_SUFFIXES.put("ாய்",     new PNGInfo("2", "rational", "sing"));
        VERB_SUFFIXES.put("ான்",     new PNGInfo("3", "m",        "sing"));
        VERB_SUFFIXES.put("ாள்",     new PNGInfo("3", "f",        "sing"));
        VERB_SUFFIXES.put("ார்",     new PNGInfo("3", "rational", "sing"));
        VERB_SUFFIXES.put("து",      new PNGInfo("3", "n",        "sing"));
        VERB_SUFFIXES.put("ன",       new PNGInfo("3", "n",        "plural"));
    }

    // ================================================================
    // INTERROGATIVE SUFFIXES
    // ================================================================
    private static final Map<String, PNGInfo> INTERROGATIVE_SUFFIXES = new LinkedHashMap<>();
    static {
        INTERROGATIVE_SUFFIXES.put("வில்லையா", new PNGInfo("wildcard", "wildcard", "wildcard"));
        INTERROGATIVE_SUFFIXES.put("ார்களா",   new PNGInfo("3", "rational", "plural"));
        INTERROGATIVE_SUFFIXES.put("ீர்களா",   new PNGInfo("2", "rational", "plural"));
        INTERROGATIVE_SUFFIXES.put("ோமா",      new PNGInfo("1", "rational", "plural"));
        INTERROGATIVE_SUFFIXES.put("ேனா",      new PNGInfo("1", "rational", "sing"));
        INTERROGATIVE_SUFFIXES.put("ாயா",      new PNGInfo("2", "rational", "sing"));
        INTERROGATIVE_SUFFIXES.put("ாரா",      new PNGInfo("3", "rational", "sing"));
        INTERROGATIVE_SUFFIXES.put("னா",       new PNGInfo("3", "m",        "sing"));
        INTERROGATIVE_SUFFIXES.put("ளா",       new PNGInfo("3", "f",        "sing"));
        INTERROGATIVE_SUFFIXES.put("தா",       new PNGInfo("3", "n",        "sing"));
        INTERROGATIVE_SUFFIXES.put("னவா",      new PNGInfo("3", "n",        "plural"));
    }

    // ================================================================
    // LISTENER HOOKS
    // ================================================================

    @Override
    public void exitWord(TamilWordParser.WordContext ctx) {
        words.add(ctx.getText().trim());
    }

    @Override
    public void exitSentence(TamilWordParser.SentenceContext ctx) {
        if (words.isEmpty()) return;

        // ---- Detect verb (last word) ----
        String lastWord = words.get(words.size() - 1);
        PNGInfo detectedVerbPNG = getVerbPNG(lastWord);

        // ---- Single-word sentence ----
        if (words.size() == 1) {
            if (detectedVerbPNG != null) {
                System.out.println("VALID SINGLE-WORD SENTENCE ✅");
                words.clear();
                return;
            } else {
                semanticError("Single word must be a verb");
            }
        }

        // ---- Verb must be present ----
        if (detectedVerbPNG == null) {
            semanticError("Sentence must end with a verb");
        }

        // ================================================================
        // COLLECT SUBJECTS
        // ----------------------------------------------------------------
        // Scan all words except the last (verb).
        // Track:
        //   subjectsWithUm   — subjects joined by ும் conjunction
        //   subjectsWithoutUm — plain subjects (no ும்)
        //
        // RULE 1 (enforced below):
        //   Without ும்: only ONE subject is allowed.
        //   With ும்: multiple subjects are expected and allowed.
        //   Mixing plain subjects with ும்-subjects in the same sentence
        //   is also disallowed (e.g. "நான் அவனும் வந்தோம்" is invalid).
        // ================================================================
        List<PNGInfo> subjectsWithUm    = new ArrayList<>();
        List<PNGInfo> subjectsWithoutUm = new ArrayList<>();

        for (int i = 0; i < words.size() - 1; i++) {
            String w = words.get(i);

            if (w.endsWith(UM_SUFFIX)) {
                PNGInfo info = resolveUmSubject(w);
                if (info != null) subjectsWithUm.add(info);
                // Unrecognised ும்-word = object/adverb — skip silently
            } else {
                PNGInfo info = SUBJECTS.get(w);
                if (info != null) subjectsWithoutUm.add(info);
            }
        }

        // ================================================================
        // RULE 1 — SUBJECT COUNT VALIDATION
        // ----------------------------------------------------------------
        // Case A: No ும் conjunction present
        //   → Only one plain subject is allowed.
        //   → Zero subjects: allowed (pro-drop / imperative constructions).
        //   → Two or more plain subjects: SEMANTIC ERROR.
        //
        // Case B: ும் conjunction present
        //   → Plain subjects alongside ும்-subjects are disallowed,
        //     e.g. "நான் அவனும் வந்தோம்" — நான் must also carry ும்.
        //   → Single ும்-subject: agreement follows that subject alone.
        //   → Multiple ும்-subjects: conjunction agreement rules apply.
        // ================================================================
        if (subjectsWithUm.isEmpty()) {
            // Case A: No ும் — enforce single subject
            if (subjectsWithoutUm.size() > 1) {
                semanticError(
                    "Only one subject is allowed without the conjunction ும். " +
                    "Found " + subjectsWithoutUm.size() + " subjects. " +
                    "Use subject-ும் forms to conjoin multiple subjects."
                );
            }
        } else {
            // Case B: ும் present — plain subjects alongside ும்-subjects are invalid
            if (!subjectsWithoutUm.isEmpty()) {
                semanticError(
                    "Mixed subjects found: " + subjectsWithoutUm.size() +
                    " subject(s) without ும் alongside ும்-conjoined subjects. " +
                    "All conjoined subjects must carry ும்."
                );
            }
        }

        // ================================================================
        // AGREEMENT CHECK
        // ================================================================
        if (!subjectsWithUm.isEmpty()) {
            if (subjectsWithUm.size() == 1) {
                // Single ும்-subject agrees with that subject alone
                checkAgreement(subjectsWithUm.get(0), detectedVerbPNG);
            } else {
                // Multiple ும்-subjects: apply conjunction agreement rules
                checkConjoinedAgreement(subjectsWithUm, detectedVerbPNG);
            }
        } else if (subjectsWithoutUm.size() == 1) {
            // Exactly one plain subject
            checkAgreement(subjectsWithoutUm.get(0), detectedVerbPNG);
        }
        // Zero subjects: pro-drop allowed, skip agreement check

        System.out.println("SEMANTICALLY VALID SENTENCE ✅");
        words.clear();
    }

    // ================================================================
    // RESOLVE ும் SUBJECT
    // ----------------------------------------------------------------
    // Step 1: Strip ும் (3 Unicode code units: ு + ம + ்)
    // Step 2: Check GLIDE_STEM_MAP — handles நீய, அதுவ, அஃதுவ, அவைய …
    // Step 3: Re-append pulli (்) and check SUBJECTS
    //         Recovers the pulli lost during consonant+ும் sandhi:
    //           அவன் + ும் → அவனும் → strip → அவன → +் → அவன் ✅
    //           அவள் + ும் → அவளும் → strip → அவள → +் → அவள் ✅
    //           நான் + ும் → நானும் → strip → நான → +் → நான் ✅
    // Step 4: Check stem as-is (vowel-final stems that don't lose pulli)
    //           நாம் + ும் → நாமும் → strip → நாம் → found ✅
    //           நீங்கள் + ும் → நீங்களும் → strip → நீங்கள் → found ✅
    // ================================================================
    private PNGInfo resolveUmSubject(String word) {
        if (!word.endsWith(UM_SUFFIX)) return null;

        String stem = word.substring(0, word.length() - UM_SUFFIX.length());

        // Step 1: Glide map
        String glideResolved = GLIDE_STEM_MAP.get(stem);
        if (glideResolved != null) return SUBJECTS.get(glideResolved);

        // Step 2: Re-append pulli (recovers consonant-final stems)
        String stemWithPulli = stem + PULLI;
        if (SUBJECTS.containsKey(stemWithPulli)) return SUBJECTS.get(stemWithPulli);

        // Step 3: Stem as-is (vowel-final, pulli-final stems like நாம்)
        if (SUBJECTS.containsKey(stem)) return SUBJECTS.get(stem);

        return null; // Not a known subject
    }

    // ================================================================
    // CONJOINED SUBJECT AGREEMENT
    // ----------------------------------------------------------------
    // Rules for "X-ும் Y-ும் verb":
    //   1. Verb must be PLURAL
    //   2. Lowest person dominates:
    //        1+2, 1+3  →  1st person plural  (வந்தோம்)
    //        2+3       →  2nd person plural  (வந்தீர்கள்)
    //        3+3       →  3rd person plural  (வந்தார்கள் / வந்தன)
    //   3. Gender of dominant subjects must match verb gender
    // ================================================================
    private void checkConjoinedAgreement(List<PNGInfo> subjects, PNGInfo verb) {

        if ("wildcard".equals(verb.person)) return;

        // Rule 1: Must be plural
        if (!"plural".equals(verb.number)) {
            semanticError("Multiple conjoined subjects require a plural verb form.");
        }

        // Rule 2: Find minimum (dominant) person
        int minPerson = 3;
        for (PNGInfo s : subjects) {
            int p = Integer.parseInt(s.person);
            if (p < minPerson) minPerson = p;
        }

        int verbPerson = Integer.parseInt(verb.person);
        if (verbPerson != minPerson) {
            semanticError(
                "Conjoined subject person mismatch: dominant person is " + minPerson +
                " but verb encodes person " + verbPerson + "."
            );
        }

        // Rule 3: Gender of dominant subjects must match verb gender
        List<String> dominantGenders = new ArrayList<>();
        for (PNGInfo s : subjects) {
            if (Integer.parseInt(s.person) == minPerson) {
                dominantGenders.add(s.gender);
            }
        }

        String expectedGender = resolveConjoinedGender(dominantGenders);
        if (!genderMatches(expectedGender, verb.gender)) {
            semanticError(
                "Gender mismatch in conjoined subjects: expected verb gender '" +
                expectedGender + "' but verb has '" + verb.gender + "'."
            );
        }
    }

    // ================================================================
    // RESOLVE CONJOINED GENDER
    // ----------------------------------------------------------------
    //   Any rational among dominants       → rational
    //   Mixed m + f (e.g. அவன் + அவள்)   → rational  (mixed 3rd → rational plural)
    //   All m                              → m
    //   All f                              → f
    //   All n                              → n
    // ================================================================
    private String resolveConjoinedGender(List<String> genders) {
        boolean hasRational = false, hasMasculine = false,
                hasFeminine  = false, hasNeuter    = false;

        for (String g : genders) {
            switch (g) {
                case "rational": hasRational  = true; break;
                case "m":        hasMasculine = true; break;
                case "f":        hasFeminine  = true; break;
                case "n":        hasNeuter    = true; break;
            }
        }

        if (hasRational)                 return "rational";
        if (hasMasculine && hasFeminine) return "rational";
        if (hasMasculine)                return "m";
        if (hasFeminine)                 return "f";
        if (hasNeuter)                   return "n";
        return "rational";
    }

    // ================================================================
    // SINGLE SUBJECT AGREEMENT
    // ================================================================
    private void checkAgreement(PNGInfo subject, PNGInfo verb) {

        if ("wildcard".equals(verb.person)) return;

        if (!subject.person.equals(verb.person)) {
            semanticError(
                "Person mismatch — subject is " + subject.person +
                "th person but verb is " + verb.person + "th person."
            );
        }

        if (!subject.number.equals(verb.number)) {
            semanticError(
                "Number mismatch — subject is " + subject.number +
                " but verb is " + verb.number + "."
            );
        }

        if (!genderMatches(subject.gender, verb.gender)) {
            semanticError(
                "Gender mismatch — subject gender is '" + subject.gender +
                "' but verb suffix indicates '" + verb.gender + "'."
            );
        }
    }

    // ================================================================
    // GENDER MATCH
    // "wildcard" on either side → pass.
    // All other values must be identical.
    // "rational" does NOT match "m", "f", or "n".
    // ================================================================
    private boolean genderMatches(String subjectGender, String verbGender) {
        if ("wildcard".equals(subjectGender) || "wildcard".equals(verbGender)) return true;
        return subjectGender.equals(verbGender);
    }

    // ================================================================
    // VERB PNG DETECTION
    // Interrogative checked first (longer suffixes, no false matches).
    // ================================================================
    private PNGInfo getVerbPNG(String word) {
        for (Map.Entry<String, PNGInfo> entry : INTERROGATIVE_SUFFIXES.entrySet()) {
            if (word.endsWith(entry.getKey())) return entry.getValue();
        }
        for (Map.Entry<String, PNGInfo> entry : VERB_SUFFIXES.entrySet()) {
            if (word.endsWith(entry.getKey())) return entry.getValue();
        }
        return null;
    }

    // ================================================================
    // SEMANTIC ERROR
    // ================================================================
    private void semanticError(String msg) {
        words.clear();
        throw new RuntimeException("SEMANTIC ERROR -> " + msg);
    }
}