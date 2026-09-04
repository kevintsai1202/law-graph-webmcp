package tw.lawgraph.domain;

/** 單一爭點上對造可能提出的抗辯、我方回應與風險評級。 */
public record DefenseAssessment(String issue, String defense, String response, Risk risk) {}
