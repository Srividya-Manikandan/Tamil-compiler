import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.tree.*;
import org.antlr.v4.runtime.misc.ParseCancellationException;

import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Main {

    public static void main(String[] args) {

        try {

            // =========================
            // READ INPUT
            // =========================
            BufferedReader reader =
                    new BufferedReader(new InputStreamReader(System.in));

          
            String input = reader.readLine();

            // =========================
            // LEXER
            // =========================
            CharStream charStream = CharStreams.fromString(input);
            TamilWordLexer lexer = new TamilWordLexer(charStream);

            lexer.removeErrorListeners();
            lexer.addErrorListener(new BaseErrorListener() {
                @Override
                public void syntaxError(Recognizer<?, ?> recognizer,
                                        Object offendingSymbol,
                                        int line,
                                        int charPositionInLine,
                                        String msg,
                                        RecognitionException e) {
                    throw new RuntimeException(
                            "LEXICAL ERROR at " + line + ":" +
                                    charPositionInLine + " -> " + msg
                    );
                }
            });

            CommonTokenStream tokens = new CommonTokenStream(lexer);

            // =========================
            // PARSER
            // =========================
            TamilWordParser parser = new TamilWordParser(tokens);

            parser.removeErrorListeners();
            parser.addErrorListener(new BaseErrorListener() {
                @Override
                public void syntaxError(Recognizer<?, ?> recognizer,
                                        Object offendingSymbol,
                                        int line,
                                        int charPositionInLine,
                                        String msg,
                                        RecognitionException e) {
                    throw new RuntimeException(
                            "SYNTAX ERROR at " + line + ":" +
                                    charPositionInLine + " -> " + msg
                    );
                }
            });

            // Disable default recovery
            parser.setErrorHandler(new BailErrorStrategy());

            // Parse
            ParseTree tree = parser.program();

            // =========================
            // SEMANTIC CHECK
            // =========================
            ParseTreeWalker walker = new ParseTreeWalker();
            SentenceSemanticListener listener =
                    new SentenceSemanticListener(tokens);

            walker.walk(listener, tree);

            // If everything passed
            System.out.println("VALID SENTENCE ✅");

        }
        catch (ParseCancellationException e) {
            System.err.println("SYNTAX ERROR ");
        }
        catch (RuntimeException e) {
            if (e.getMessage() != null)
                System.err.println(e.getMessage());
            else
                System.err.println("ERROR ");
        }
        catch (Exception e) {
            System.err.println("UNEXPECTED ERROR ");
        }
    }
}