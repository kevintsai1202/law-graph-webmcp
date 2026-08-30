package tw.lawgraph.agent.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** law-powers 四個技能必須能被 loader 載入，包含 references 檔案引用驗證。 */
class SkillsConfigTest {

    /** 驗證 submodule 中只載入計畫指定的四個技能。 */
    @Test
    void loadsExactlyFourSkillsFromSubmodule() {
        Path dir = Path.of("skills/law-powers/skills");
        assumeTrue(Files.exists(dir.resolve("legal-graph/SKILL.md")), "submodule 未初始化");
        var skills = SkillsConfig.build(dir.toString());
        var names = skills.getSkills().stream().map(skill -> skill.getName()).sorted().toList();
        assertEquals(SkillsConfig.SKILL_NAMES.stream().sorted().toList(), names);
    }
}
