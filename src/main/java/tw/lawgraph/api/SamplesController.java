package tw.lawgraph.api;

import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;
import tw.lawgraph.domain.Locale;

import java.io.IOException;
import java.util.List;

/** 依語系回傳 classpath 中的四個虛構示範案例。 */
@RestController
public class SamplesController {
    private final List<SampleCase> en;
    private final List<SampleCase> zhTw;

    /** 啟動時一次載入兩種語系的示範案例。 */
    public SamplesController() throws IOException {
        JsonMapper mapper = JsonMapper.builder().build();
        en = List.of(mapper.readValue(new ClassPathResource("samples/en.json").getInputStream(), SampleCase[].class));
        zhTw = List.of(mapper.readValue(new ClassPathResource("samples/zh-TW.json").getInputStream(), SampleCase[].class));
    }

    /** 未知語系用英文；依 mode 過濾（預設案件示範）。 */
    @GetMapping("/api/samples")
    public List<SampleCase> samples(@RequestParam(required = false) String locale, @RequestParam(required = false) String mode) {
        String wanted = CaseMode.normalize(mode);
        return (Locale.fromCode(locale) == Locale.ZH_TW ? zhTw : en).stream().filter(s -> wanted.equals(s.mode())).toList();
    }
}
