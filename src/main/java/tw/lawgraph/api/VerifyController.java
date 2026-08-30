package tw.lawgraph.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** WebMCP verifyCitation 工具的後端端點。 */
@RestController
public class VerifyController {
    private final CitationVerifier verifier;

    /** 注入引用驗證服務。 */
    public VerifyController(CitationVerifier verifier) { this.verifier = verifier; }

    /** 驗證條號或裁判字號，空白輸入回 400。 */
    @GetMapping("/api/laws/verify")
    public ResponseEntity<?> verify(@RequestParam String ref) {
        if (ref.isBlank()) return ResponseEntity.badRequest()
                .body(ApiExceptionHandler.error("INVALID_INPUT", "ref must not be blank"));
        return ResponseEntity.ok(verifier.verify(ref.trim()));
    }
}
