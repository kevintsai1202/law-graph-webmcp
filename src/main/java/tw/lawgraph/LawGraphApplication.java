package tw.lawgraph;

import com.embabel.agent.config.annotation.EnableAgents;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 應用程式入口：啟用 Embabel Agent 平台與 Spring MVC。 */
@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
@EnableAgents
public class LawGraphApplication {

    /**
     * 啟動法律關係圖 WebMCP 應用程式。
     *
     * @param args 啟動參數
     */
    public static void main(String[] args) {
        SpringApplication.run(LawGraphApplication.class, args);
    }
}
