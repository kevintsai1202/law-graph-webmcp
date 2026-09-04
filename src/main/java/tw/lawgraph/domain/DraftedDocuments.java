package tw.lawgraph.domain;

import java.util.List;

/** draftDocuments Action 的產物：依勾選順序排列的書狀清單（未勾選時為空清單）。 */
public record DraftedDocuments(List<DraftedDocument> documents) {
    public DraftedDocuments {
        documents = documents == null ? List.of() : List.copyOf(documents);
    }
}
