package tw.lawgraph.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/**
 * /vendor/** 的第三方套件（three、3d-force-graph）版本固定、合計 1.2 MB，
 * 改為一年 immutable 快取：成功下載一次後，之後進站不再重抓，也就不再受邊緣連線停滯影響。
 * 其餘靜態檔（index.html、app-bundle.js）維持 application.yml 的 no-cache，重佈偵測與重新載入行為不變。
 * 升級套件時請改檔名（帶版號），immutable 不會擋到新檔。
 */
@Configuration
public class StaticCacheConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 路徑比對取最specific：/vendor/** 優先於自動設定的 /**
        registry.addResourceHandler("/vendor/**")
                .addResourceLocations("classpath:/static/vendor/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
    }
}
