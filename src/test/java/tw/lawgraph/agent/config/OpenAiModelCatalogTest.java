package tw.lawgraph.agent.config;

import com.embabel.agent.config.models.openai.OpenAiApiFormat;
import com.embabel.agent.config.models.openai.OpenAiModelDefinition;
import com.embabel.agent.config.models.openai.OpenAiModelLoader;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 專案自帶的 models/openai-models.yml 必須遮蔽 Embabel 內建版本，
 * 讓 OpenAI 相容端點（Meta Muse）上的模型能被 MODEL 環境變數選到。
 */
class OpenAiModelCatalogTest {

    /** Embabel 載入模型定義時使用的 classpath 位置。 */
    private static final String CATALOG_PATH = "classpath:models/openai-models.yml";

    /** 以 Embabel 的 loader 讀取專案 classpath 上的模型目錄。 */
    private static java.util.List<OpenAiModelDefinition> loadModels() {
        var loader = new OpenAiModelLoader(new DefaultResourceLoader(), CATALOG_PATH);
        return loader.loadAutoConfigMetadata().effectiveModels();
    }

    /** 線上預設模型 muse-spark-1.3-contributor 必須存在且走 Chat Completions，並預留 reasoning token 空間。 */
    @Test
    void musesparkContributorIsRegisteredForChatCompletions() {
        var muse = loadModels().stream()
                .filter(model -> "muse-spark-1.3-contributor".equals(model.getModelId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("muse-spark-1.3-contributor 不在模型目錄中"));
        assertEquals(OpenAiApiFormat.CHAT_COMPLETIONS, muse.getApiFormat());
        assertTrue(muse.getMaxTokens() >= 8192, "reasoning 模型需要足夠的 max_tokens，實際=" + muse.getMaxTokens());
        assertTrue(muse.getSpecialHandling().getUsesMaxCompletionTokens(), "應以 max_completion_tokens 送出上限");
    }

    /** 切回 OpenAI 時只改環境變數即可，因此 gpt-5.4-mini／nano 必須保留。 */
    @Test
    void keepsOpenAiFallbackModels() {
        var ids = loadModels().stream().map(OpenAiModelDefinition::getModelId).toList();
        assertTrue(ids.contains("gpt-5.4-mini"), "缺 gpt-5.4-mini");
        assertTrue(ids.contains("gpt-5.4-nano"), "缺 gpt-5.4-nano");
    }
}
