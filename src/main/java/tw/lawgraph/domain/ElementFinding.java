package tw.lawgraph.domain;

/** 單一法律要件的涵攝判斷與事實依據。 */
public record ElementFinding(String law, String element, Met met, String basis, String fact) {}
