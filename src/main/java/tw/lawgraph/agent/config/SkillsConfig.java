package tw.lawgraph.agent.config;

import com.embabel.agent.skills.Skills;
import com.embabel.agent.skills.support.DefaultDirectorySkillDefinitionLoader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;
import java.util.List;

/** 載入 law-powers 的四個技能，作為 LlmReference 掛進每個 Action 的 PromptRunner。 */
@Configuration
public class SkillsConfig {
    /** 唯一允許載入的四個 law-powers 技能名稱。 */
    public static final List<String> SKILL_NAMES = List.of(
            "legal-brainstorming", "legal-research", "legal-element-analysis", "legal-graph");

    /** 依技能根目錄建立 Skills，供測試與 Spring Bean 共用。 */
    public static Skills build(String skillsDir) {
        Skills skills = new Skills(
                "law-powers",
                "Taiwan legal analysis skills (law-powers)",
                List.of(),
                new DefaultDirectorySkillDefinitionLoader(false));
        for (String name : SKILL_NAMES) {
            skills = skills.withLocalSkill(Path.of(skillsDir, name).toString());
        }
        return skills;
    }

    /** 建立法律分析技能集合 Bean。 */
    @Bean
    public Skills lawPowersSkills(@Value("${lawgraph.skills-dir}") String skillsDir) {
        return build(skillsDir);
    }
}
