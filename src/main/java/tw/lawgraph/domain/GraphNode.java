package tw.lawgraph.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 3D 法律關係圖節點；空欄位不序列化以維持渲染器相容性。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphNode(String id, String group, String label, String description, String ref, String jid,
                        String met, String status, String url, String family, String favorable, String risk,
                        String duty, String role) {}
