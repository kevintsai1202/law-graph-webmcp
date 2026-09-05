(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/main/resources/static/js/i18n.js
  var DICT = {
    en: {
      "app.title": "Law Graph",
      "app.subtitle": "Taiwan legal relationship graph, built with your agent",
      "nav.lawPowers": "Law Powers skills \xB7 self-host, no limit",
      "agent.available": "Agent tools: ready",
      "agent.unavailable": "Agent tools: unavailable",
      "input.placeholder": "Describe the dispute: who, what happened, when, what you want.",
      "input.samples": "Or start from a sample case",
      "input.submit": "Analyse",
      "input.files": "Reference documents",
      "input.filesHint": "PDF, Markdown, or DOCX; up to 5 files, 10 MB each. Scanned PDF pages are transcribed by the vision model and must be reviewed.",
      "input.filesDropTitle": "Drop reference files here",
      "input.filesDropAction": "or choose files from your device",
      "input.filesFormats": "PDF, MD, DOCX \xB7 up to 10 MB each",
      "input.filesList": "Selected reference files",
      "input.filesRemove": "Remove {name}",
      "input.filesEmpty": "No files selected.",
      "input.filesSelected": "{count} file(s) selected.",
      "input.filesTooMany": "Too many files: {count}. Select no more than 5.",
      "progress.case.BRAINSTORM": "Facts & issues",
      "progress.case.QUESTIONS": "Clarifying questions",
      "progress.case.RESEARCH": "Legal basis & case-law research",
      "progress.case.ANALYSIS": "Element subsumption",
      "progress.case.ASSESSMENT": "Defenses & burden of proof",
      "progress.case.DOCUMENTS": "Drafting documents",
      "progress.case.GRAPH": "Relationship graph",
      "progress.cancel": "Cancel and start over",
      "progress.partial": "Results so far",
      "nav.home": "Home",
      "home.title": "What do you want to do?",
      "home.lead": "Pick a capability. Each runs its own agent workflow with the same steps: facts, questions, research, analysis, output.",
      "home.case.title": "Case analysis",
      "home.case.desc": "Describe a dispute \u2192 statutes & judgments \u2192 element subsumption \u2192 defenses \u2192 pleadings \u2192 relationship graph.",
      "home.contract.title": "Contract compliance review",
      "home.contract.desc": "Paste a contract or describe a business activity \u2192 statutory comparison \u2192 red/yellow/green clause risks \u2192 fixes \u2192 obligation graph.",
      "home.start": "Start",
      "home.steps.case": "Facts \xB7 Questions \xB7 Research \xB7 Subsumption \xB7 Defenses \xB7 Documents \xB7 Graph",
      "home.steps.contract": "Load \xB7 Questions \xB7 Research \xB7 Clause review \xB7 Summary \xB7 Revision \xB7 Graph",
      "home.leaveConfirm": "Leave this case and return home? The analysis will be discarded.",
      "progress.contract.LOAD": "Reading the contract",
      "progress.contract.QUESTIONS": "Clarifying questions",
      "progress.contract.RESEARCH": "Statute & case-law research",
      "progress.contract.REVIEW": "Clause-by-clause review",
      "progress.contract.SUMMARY": "Compliance summary",
      "progress.contract.REVISE": "Revised clauses",
      "progress.contract.GRAPH": "Obligation graph",
      "contract.label": "Paste the contract or describe the business activity",
      "contract.placeholder": "Paste the clauses, or describe what you plan to do (e.g. an online raffle collecting names and phone numbers).",
      "contract.hint": "At least 20 characters, or attach the contract as PDF/DOCX/MD.",
      "contract.party": "Our side",
      "contract.party.partyA": "Party A\uFF08\u7532\u65B9\uFF09",
      "contract.party.partyB": "Party B\uFF08\u4E59\u65B9\uFF09",
      "contract.party.unknown": "Not sure",
      "contract.scopes": "Review scopes (optional)",
      "contract.scopesHint": "Leave empty to let the agent decide.",
      "contract.scope.commercial": "Commercial contract (Civil Code)",
      "contract.scope.labor": "Employment (Labor Standards Act)",
      "contract.scope.privacy": "Marketing & personal data (PDPA)",
      "contract.scope.corporate": "Corporate governance (Company Act)",
      "contract.outputs": "Optional outputs",
      "contract.outputsHint": "Risk list, summary and graph are always produced.",
      "doc.revised": "Revised clauses\uFF08\u4FEE\u8A02\u7248\u689D\u6B3E\uFF09",
      "input.submitContract": "Review contract",
      "input.samplesContract": "Or start from a sample contract",
      "result.tab.findings": "Clause risks",
      "result.tab.summary": "Compliance summary",
      "result.tab.laws": "Statutes & judgments",
      "finding.clauseNo": "Clause",
      "finding.clauseText": "Clause text",
      "finding.risk": "Risk",
      "finding.lawRefs": "Legal basis",
      "finding.riskPoint": "Risk point",
      "finding.suggestion": "Suggested change",
      "finding.judgments": "Supporting judgments",
      "finding.filter.all": "All",
      "finding.export": "Export CSV",
      "finding.file": "clause-risks.csv",
      "finding.none": "No clause findings.",
      "summary.contractType": "Contract type",
      "summary.scopes": "Scopes reviewed",
      "summary.overall": "Overall risk",
      "summary.priorities": "Fix these first",
      "summary.parties": "Parties",
      "revised.original": "Original clause",
      "revised.revised": "Revised clause",
      "revised.rationale": "Why",
      "input.outputs": "Outputs to generate",
      "input.outputsHint": "Pick at least one output.",
      "output.graph": "Relationship graph\uFF08\u95DC\u806F\u5716\uFF09",
      "doc.complaint": "Complaint\uFF08\u8D77\u8A34\u72C0\uFF09",
      "doc.reasons": "Statement of reasons\uFF08\u7406\u7531\u72C0\uFF09",
      "doc.report": "Report to the court\uFF08\u9673\u5831\u72C0\uFF09",
      "doc.preparatory": "Preparatory pleading\uFF08\u6E96\u5099\u72C0\uFF09",
      "doc.defense": "Answer\uFF08\u7B54\u8FAF\u72C0\uFF09",
      "doc.issues": "Issues summary\uFF08\u722D\u9EDE\u6574\u7406\uFF09",
      "doc.appeal": "Appeal\uFF08\u4E0A\u8A34\u72C0\uFF09",
      "doc.motion": "Motion\uFF08\u8072\u8ACB\u72C0\uFF09",
      "doc.parties": "Parties",
      "doc.attachments": "Evidence attachments",
      "doc.to": "To:",
      "doc.missing": "This document was not generated for this case. Start a new case with it selected to draft it.",
      "doc.disclaimer": "Draft for analysis support only \u2014 review with a licensed attorney before filing.",
      "doc.issue.no": "No.",
      "doc.issue.issue": "Issue",
      "doc.issue.plaintiff": "Plaintiff's claim",
      "doc.issue.plaintiffEvidence": "Plaintiff's evidence",
      "doc.issue.defendant": "Defendant's defence",
      "doc.issue.defendantEvidence": "Defendant's evidence",
      "doc.issue.basis": "Legal basis",
      "doc.issue.title": "Issues table",
      "doc.issue.export": "Export CSV",
      "doc.issue.file": "issues.csv",
      "doc.claims.title": "Claims and legal bases",
      "doc.claims.no": "No.",
      "doc.claims.basis": "Legal basis",
      "doc.claims.claim": "Plaintiff's claim",
      "doc.claims.file": "claims.csv",
      "doc.undisputed.title": "Undisputed facts",
      "doc.undisputed.no": "No.",
      "doc.undisputed.fact": "Undisputed fact",
      "doc.undisputed.evidence": "Evidence",
      "doc.undisputed.file": "undisputed.csv",
      "input.motionRequest": "Motion request (what you ask the court to do)",
      "input.motionRequestPlaceholder": "e.g. request the court to order production of the dashcam footage",
      "questions.title": "A few facts only you know",
      "questions.why": "Why we ask",
      "questions.submit": "Continue",
      "result.tab.graph": "Graph",
      "result.tab.analysis": "Analysis",
      "result.tab.research": "Research",
      "result.tab.brainstorm": "Facts & issues",
      "result.researchWarning.title": "Statutory research unavailable",
      "result.researchWarning.tip": "No statutes were retrieved for this review, so the risk ratings below are heuristic and unverified. Re-run when the research service is available.",
      "result.generatedIn": "Generated in",
      "result.notes": "Verification notes",
      "result.coverage": "Research coverage",
      "result.newCase": "New case",
      "result.elements": "Elements",
      "result.strategy": "Strategy",
      "result.evidenceGaps": "Evidence gaps",
      "result.statutes": "Statutes",
      "result.judgments": "Judgments",
      "result.facts": "Facts",
      "result.relations": "Relations",
      "result.issues": "Issues",
      "result.evidenceNeeds": "Evidence needs",
      "graph.filter": "Filter",
      "graph.family": "Family",
      "graph.search": "Search a node and press Enter",
      "graph.group.fact": "Facts",
      "graph.group.law": "Statutes",
      "graph.group.judgment": "Judgments",
      "graph.group.issue": "Issues",
      "graph.group.party": "Parties",
      "graph.group.plaintiff": "Plaintiff",
      "graph.group.evidence": "Evidence",
      "graph.group.contract": "Contracts",
      "graph.group.clause": "Clauses",
      "graph.group.obligation": "Obligations",
      "graph.group.element": "Elements",
      "graph.status.good": "Favourable / won",
      "graph.status.bad": "Unfavourable / lost",
      "graph.status.mixed": "Mixed (partly favourable)",
      "graph.risk.high": "\u{1F534} High-risk clause",
      "graph.risk.medium": "\u{1F7E1} Medium-risk clause",
      "graph.risk.low": "\u{1F7E2} Low-risk clause",
      "graph.met.yes": "\u25CB Satisfied",
      "graph.met.no": "\u2717 Not satisfied",
      "graph.met.unknown": "\u25B3 Facts unclear (evidence needed)",
      "graph.duty.main": "Primary obligation",
      "graph.duty.collateral": "Collateral obligation",
      "graph.duty.incidental": "Incidental obligation",
      "graph.detail.dutyType": "Obligation type: ",
      "graph.detail.role": "Contract role: ",
      "graph.detail.evidence": "Key evidence",
      "graph.detail.noEvidence": "No decisive evidence flagged for this case",
      "graph.detail.forDefendant": "Favours defendant: ",
      "graph.detail.againstDefendant": "Against defendant: ",
      "graph.detail.fullText": "Read full judgment \u2197",
      "graph.overturned": " \u26A0\uFE0F overturned",
      "failed.title": "Analysis failed",
      "failed.retry": "Try again",
      "disclaimer": "Analysis support only \u2014 not legal advice. Sample cases are fictional. Do not paste real personal data.",
      "a11y.skip": "Skip to main content",
      "input.label": "Describe your dispute",
      "input.hint": "At least 20 characters. The more specific the facts, the better the analysis.",
      "input.hintWithFiles": "Reference files attached: the description is optional, a short summary is enough.",
      "progress.aria": "Analysis progress",
      "questions.lead": "Your answers are sent to the agent only; nothing is stored after the case ends.",
      "graph.close": "Close detail panel",
      "graph.detail.aria": "Node details",
      "result.tabs.aria": "Result sections",
      "inspector.title": "Tool Inspector",
      "inspector.readonly": "Read-only view. These tools are called by your Agent via WebMCP; humans interact through the page itself.",
      "auth.semantic.ready": "Semantic search: ready",
      "auth.semantic.required": "Semantic search: not authorized",
      "auth.semantic.tip": "Authorize to include semantic judgment search in this analysis.",
      "auth.semantic.action": "Authorize now",
      "usage.exhausted.title": "Daily AI budget used up",
      "usage.exhausted.tip": "This site pauses new analyses once the shared daily token budget is spent. Install the Law Powers skills and run the same analysis with your own AI agent, with no limit.",
      "usage.exhausted.action": "Get Law Powers",
      "quota.count": "Analyses used today:",
      "input.previewAria": "Case description (click to edit)",
      "quota.loginTip": "Sign in with Google to get {limit} analyses per day.",
      "nav.login": "Sign in with Google",
      "nav.logout": "Sign out",
      "nav.loginBenefit": "Signed-in users get {limit} analyses per day",
      "license.banner.title": "License",
      "license.banner.prefix": ": this site is free for everyone to use, except ",
      "license.banner.suffix": " (Meridian International Law Firm). We owe this service to them.",
      "license.excluded": "Under this project's license, this service is not available to \u7D93\u5146\u570B\u969B\u6CD5\u5F8B\u4E8B\u52D9\u6240.",
      "quota.reason": "This site is free to use. To keep it available for more people, each person can run at most {limit} analyses per day (resets at midnight, Taipei time).",
      "quota.exhausted.title": "Today's {limit} analyses are used up",
      "input.lawPowers": "This hosted site shares a daily AI budget. Prefer no limit? Install the open-source Law Powers skills and run the same analysis with your own AI agent.",
      "input.lawPowersAction": "Law Powers skills",
      "result.defenses": "Likely defenses & responses",
      "result.evidencePlan": "Evidence & burden of proof",
      "result.risk": "Risk summary",
      "result.claimSummary": "Claim summary",
      "result.none": "None",
      "claim.established": "All elements met",
      "claim.failed": "An element fails",
      "claim.pending": "Evidence needed",
      "defense.issue": "Issue",
      "defense.defense": "Defense",
      "defense.response": "Response",
      "defense.risk": "Risk",
      "evidence.fact": "Fact to prove",
      "evidence.burden": "Burden",
      "evidence.available": "Available",
      "evidence.missing": "Missing",
      "evidence.howToObtain": "How to obtain",
      "risk.high": "High",
      "risk.medium": "Medium",
      "risk.low": "Low",
      "result.tab.checklist": "Client checklist",
      "checklist.lead": "Suggested items to prepare before the next meeting or filing.",
      "checklist.category": "Category",
      "checklist.item": "Item",
      "checklist.why": "Why it matters",
      "checklist.due": "When",
      "checklist.export": "Export CSV",
      "checklist.print": "Print",
      "checklist.file": "client-checklist.csv",
      "checklist.cat.evidence": "Documents & evidence",
      "checklist.cat.witness": "Witnesses",
      "checklist.cat.procedure": "Procedure",
      "checklist.cat.cost": "Fees & deadlines",
      "checklist.cat.other": "Other"
    },
    "zh-TW": {
      "app.title": "\u6CD5\u5F8B\u95DC\u4FC2\u5716",
      "app.subtitle": "\u8207\u4F60\u7684 Agent \u4E00\u8D77\u5EFA\u69CB\u7684\u53F0\u7063\u6CD5\u5F8B\u95DC\u4FC2\u5716",
      "nav.lawPowers": "Law Powers \u6280\u80FD \xB7 \u81EA\u7528 Agent \u4E0D\u9650\u984D\u5EA6",
      "agent.available": "Agent \u5DE5\u5177\uFF1A\u53EF\u7528",
      "agent.unavailable": "Agent \u5DE5\u5177\uFF1A\u4E0D\u53EF\u7528",
      "input.placeholder": "\u63CF\u8FF0\u722D\u8B70\uFF1A\u7576\u4E8B\u4EBA\u3001\u767C\u751F\u4E86\u4EC0\u9EBC\u3001\u6642\u9593\u3001\u4F60\u60F3\u9054\u6210\u4EC0\u9EBC\u3002",
      "input.samples": "\u6216\u5F9E\u793A\u7BC4\u6848\u4F8B\u958B\u59CB",
      "input.submit": "\u958B\u59CB\u5206\u6790",
      "input.files": "\u53C3\u8003\u6587\u4EF6",
      "input.filesHint": "\u652F\u63F4 PDF\u3001Markdown\u3001DOCX\uFF1B\u6700\u591A 5 \u4EFD\u3001\u6BCF\u4EFD 10 MB\u3002\u6383\u63CF\u578B PDF \u6703\u7531\u8996\u89BA\u6A21\u578B\u8F49\u9304\uFF0C\u7D50\u679C\u9700\u4EBA\u5DE5\u6838\u5C0D\u3002",
      "input.filesDropTitle": "\u5C07\u53C3\u8003\u6587\u4EF6\u62D6\u66F3\u5230\u9019\u88E1",
      "input.filesDropAction": "\u6216\u5F9E\u88DD\u7F6E\u9078\u64C7\u6A94\u6848",
      "input.filesFormats": "PDF\u3001MD\u3001DOCX \xB7 \u6BCF\u4EFD\u6700\u591A 10 MB",
      "input.filesList": "\u5DF2\u9078\u64C7\u7684\u53C3\u8003\u6587\u4EF6",
      "input.filesRemove": "\u79FB\u9664 {name}",
      "input.filesEmpty": "\u5C1A\u672A\u9078\u64C7\u6A94\u6848\u3002",
      "input.filesSelected": "\u5DF2\u9078\u64C7 {count} \u4EFD\u6A94\u6848\u3002",
      "input.filesTooMany": "\u6A94\u6848\u904E\u591A\uFF1A{count} \u4EFD\uFF0C\u6700\u591A\u53EA\u80FD\u9078 5 \u4EFD\u3002",
      "progress.case.BRAINSTORM": "\u6574\u7406\u6848\u60C5\u8207\u722D\u57F7\u9EDE\uFF08\u4E8B\u5BE6\u8207\u722D\u9EDE\u6574\u7406\uFF09",
      "progress.case.QUESTIONS": "\u88DC\u5145\u6848\u60C5\uFF08\u7B49\u5F85\u4F60\u7684\u56DE\u7B54\uFF09",
      "progress.case.RESEARCH": "\u627E\u6CD5\u689D\u8207\u5224\u6C7A\uFF08\u8ACB\u6C42\u6B0A\u57FA\u790E\u8207\u5BE6\u52D9\u898B\u89E3\u6AA2\u7D22\uFF09",
      "progress.case.ANALYSIS": "\u9010\u689D\u6AA2\u67E5\u662F\u5426\u7B26\u5408\u6CD5\u5F8B\u8981\u4EF6\uFF08\u69CB\u6210\u8981\u4EF6\u6DB5\u651D\uFF09",
      "progress.case.ASSESSMENT": "\u5C0D\u65B9\u6703\u600E\u9EBC\u53CD\u99C1\u3001\u8AB0\u8981\u8CA0\u8CAC\u8B49\u660E\uFF08\u6297\u8FAF\u8A55\u4F30\u8207\u8209\u8B49\u8CAC\u4EFB\uFF09",
      "progress.case.DOCUMENTS": "\u64B0\u5BEB\u6CD5\u9662\u6587\u4EF6\uFF08\u66F8\u72C0\u8D77\u8349\uFF09",
      "progress.case.GRAPH": "\u756B\u51FA\u6CD5\u5F8B\u95DC\u4FC2\u5716",
      "progress.cancel": "\u653E\u68C4\u6B64\u6848\uFF0C\u91CD\u65B0\u958B\u59CB",
      "progress.partial": "\u76EE\u524D\u5DF2\u5B8C\u6210\u7684\u6210\u679C",
      "nav.home": "\u9996\u9801",
      "home.title": "\u4F60\u60F3\u505A\u4EC0\u9EBC\uFF1F",
      "home.lead": "\u9078\u4E00\u9805\u80FD\u529B\u3002\u5169\u689D\u6D41\u7A0B\u6B65\u9A64\u4E00\u81F4\uFF1A\u6574\u7406\u4E8B\u5BE6\u3001\u88DC\u554F\u3001\u6AA2\u7D22\u6CD5\u6E90\u3001\u5206\u6790\u3001\u7522\u51FA\u3002",
      "home.case.title": "\u6848\u4EF6\u5206\u6790",
      "home.case.desc": "\u63CF\u8FF0\u7CFE\u7D1B \u2192 \u627E\u6CD5\u689D\u8207\u5224\u6C7A \u2192 \u9010\u8981\u4EF6\u6DB5\u651D \u2192 \u6297\u8FAF\u8A55\u4F30 \u2192 \u66F8\u72C0 \u2192 \u6CD5\u5F8B\u95DC\u4FC2\u5716\u3002",
      "home.contract.title": "\u5408\u7D04\u6CD5\u898F\u5BE9\u67E5",
      "home.contract.desc": "\u8CBC\u4E0A\u5408\u7D04\u6216\u63CF\u8FF0\u5546\u696D\u884C\u70BA \u2192 \u6CD5\u898F\u5C0D\u7167 \u2192 \u7D05\u9EC3\u7DA0\u98A8\u96AA\u689D\u6B3E \u2192 \u4FEE\u6539\u5EFA\u8B70 \u2192 \u5951\u7D04\u7FA9\u52D9\u5716\u3002",
      "home.start": "\u958B\u59CB",
      "home.steps.case": "\u6848\u60C5 \xB7 \u88DC\u554F \xB7 \u6AA2\u7D22 \xB7 \u6DB5\u651D \xB7 \u6297\u8FAF \xB7 \u66F8\u72C0 \xB7 \u95DC\u4FC2\u5716",
      "home.steps.contract": "\u8F09\u5165 \xB7 \u88DC\u554F \xB7 \u6AA2\u7D22 \xB7 \u9010\u689D\u5BE9\u67E5 \xB7 \u6458\u8981 \xB7 \u4FEE\u8A02 \xB7 \u7FA9\u52D9\u5716",
      "home.leaveConfirm": "\u8981\u96E2\u958B\u9019\u500B\u6848\u4EF6\u56DE\u9996\u9801\u55CE\uFF1F\u5206\u6790\u7D50\u679C\u5C07\u88AB\u653E\u68C4\u3002",
      "progress.contract.LOAD": "\u8B80\u53D6\u5951\u7D04\u8207\u5207\u5206\u689D\u6B3E",
      "progress.contract.QUESTIONS": "\u88DC\u5145\u8CC7\u8A0A\uFF08\u7B49\u5F85\u4F60\u7684\u56DE\u7B54\uFF09",
      "progress.contract.RESEARCH": "\u627E\u6CD5\u689D\u8207\u5224\u6C7A\uFF08\u5F37\u884C\u898F\u5B9A\u8207\u5BE6\u52D9\u898B\u89E3\u6AA2\u7D22\uFF09",
      "progress.contract.REVIEW": "\u9010\u689D\u6AA2\u67E5\u662F\u5426\u9055\u6CD5\u6216\u4E0D\u516C\u5E73\uFF08\u6CD5\u898F\u5C0D\u7167\uFF09",
      "progress.contract.SUMMARY": "\u6574\u9AD4\u98A8\u96AA\u8207\u512A\u5148\u4FEE\u6539\u9806\u5E8F\uFF08\u5408\u898F\u6458\u8981\uFF09",
      "progress.contract.REVISE": "\u7522\u51FA\u4FEE\u8A02\u7248\u689D\u6B3E",
      "progress.contract.GRAPH": "\u756B\u51FA\u5951\u7D04\u7FA9\u52D9\u95DC\u4FC2\u5716",
      "contract.label": "\u8CBC\u4E0A\u5408\u7D04\u539F\u6587\uFF0C\u6216\u63CF\u8FF0\u4F60\u8981\u9032\u884C\u7684\u5546\u696D\u884C\u70BA",
      "contract.placeholder": "\u8CBC\u4E0A\u689D\u6B3E\u5168\u6587\uFF1B\u6216\u63CF\u8FF0\u4F60\u6253\u7B97\u505A\u7684\u4E8B\uFF08\u4F8B\u5982\uFF1A\u7DDA\u4E0A\u62BD\u734E\u6D3B\u52D5\u8981\u6536\u96C6\u53C3\u52A0\u8005\u59D3\u540D\u8207\u96FB\u8A71\uFF09\u3002",
      "contract.hint": "\u81F3\u5C11 20 \u5B57\uFF0C\u6216\u76F4\u63A5\u9644\u4E0A\u5408\u7D04 PDF\uFF0FDOCX\uFF0FMD\u3002",
      "contract.party": "\u6211\u65B9\u7ACB\u5834",
      "contract.party.partyA": "\u7532\u65B9",
      "contract.party.partyB": "\u4E59\u65B9",
      "contract.party.unknown": "\u4E0D\u78BA\u5B9A",
      "contract.scopes": "\u5BE9\u67E5\u7BC4\u7587\uFF08\u53EF\u4E0D\u9078\uFF09",
      "contract.scopesHint": "\u4E0D\u9078\u7531 Agent \u4F9D\u5951\u7D04\u5167\u5BB9\u5224\u5B9A\u3002",
      "contract.scope.commercial": "\u4E00\u822C\u5546\u52D9\u5951\u7D04\uFF08\u6C11\u6CD5\u50B5\u7DE8\uFF09",
      "contract.scope.labor": "\u52DE\u52D5\u5951\u7D04\uFF08\u52DE\u57FA\u6CD5\uFF09",
      "contract.scope.privacy": "\u884C\u92B7\u8207\u500B\u8CC7\uFF08\u500B\u8CC7\u6CD5\uFF09",
      "contract.scope.corporate": "\u516C\u53F8\u6CBB\u7406\uFF08\u516C\u53F8\u6CD5\uFF09",
      "contract.outputs": "\u984D\u5916\u7522\u51FA",
      "contract.outputsHint": "\u98A8\u96AA\u6E05\u55AE\u3001\u5408\u898F\u6458\u8981\u8207\u95DC\u4FC2\u5716\u4E00\u5B9A\u6703\u7522\u51FA\u3002",
      "doc.revised": "\u4FEE\u8A02\u7248\u689D\u6B3E",
      "input.submitContract": "\u958B\u59CB\u5BE9\u67E5",
      "input.samplesContract": "\u6216\u5F9E\u793A\u7BC4\u5408\u7D04\u958B\u59CB",
      "result.tab.findings": "\u98A8\u96AA\u689D\u6B3E\u6E05\u55AE",
      "result.tab.summary": "\u5408\u898F\u6458\u8981",
      "result.tab.laws": "\u6CD5\u689D\u8207\u5224\u6C7A",
      "finding.clauseNo": "\u689D\u6B3E",
      "finding.clauseText": "\u689D\u6B3E\u539F\u6587",
      "finding.risk": "\u98A8\u96AA",
      "finding.lawRefs": "\u6CD5\u898F\u4F9D\u64DA",
      "finding.riskPoint": "\u98A8\u96AA\u9EDE",
      "finding.suggestion": "\u4FEE\u6539\u5EFA\u8B70",
      "finding.judgments": "\u4F50\u8B49\u5224\u6C7A",
      "finding.filter.all": "\u5168\u90E8",
      "finding.export": "\u532F\u51FA CSV",
      "finding.file": "\u98A8\u96AA\u689D\u6B3E\u6E05\u55AE.csv",
      "finding.none": "\u6C92\u6709\u689D\u6B3E\u5BE9\u67E5\u7D50\u679C\u3002",
      "summary.contractType": "\u5951\u7D04\u985E\u578B",
      "summary.scopes": "\u5BE9\u67E5\u7BC4\u7587",
      "summary.overall": "\u6574\u9AD4\u98A8\u96AA",
      "summary.priorities": "\u5EFA\u8B70\u512A\u5148\u4FEE\u6539",
      "summary.parties": "\u7576\u4E8B\u4EBA",
      "revised.original": "\u539F\u689D\u6B3E",
      "revised.revised": "\u4FEE\u8A02\u5F8C",
      "revised.rationale": "\u4FEE\u6539\u7406\u7531",
      "input.outputs": "\u8981\u7522\u51FA\u7684\u9805\u76EE",
      "input.outputsHint": "\u81F3\u5C11\u52FE\u9078\u4E00\u9805\u3002",
      "output.graph": "\u95DC\u806F\u5716",
      "doc.complaint": "\u8D77\u8A34\u72C0",
      "doc.reasons": "\u7406\u7531\u72C0",
      "doc.report": "\u9673\u5831\u72C0",
      "doc.preparatory": "\u6E96\u5099\u72C0",
      "doc.defense": "\u7B54\u8FAF\u72C0",
      "doc.issues": "\u722D\u9EDE\u6574\u7406",
      "doc.appeal": "\u4E0A\u8A34\u72C0",
      "doc.motion": "\u8072\u8ACB\u72C0",
      "doc.parties": "\u7576\u4E8B\u4EBA",
      "doc.attachments": "\u8B49\u7269",
      "doc.to": "\u6B64\u81F4",
      "doc.missing": "\u672C\u6848\u672A\u7522\u751F\u6B64\u66F8\u72C0\uFF1B\u91CD\u65B0\u5206\u6790\u4E26\u52FE\u9078\u5F8C\u5373\u53EF\u8D77\u8349\u3002",
      "doc.disclaimer": "\u672C\u66F8\u72C0\u70BA\u5206\u6790\u8F14\u52A9\u8349\u7A3F\uFF0C\u63D0\u51FA\u524D\u8ACB\u5148\u7D93\u57F7\u696D\u5F8B\u5E2B\u5BE9\u95B1\u3002",
      "doc.issue.no": "\u5E8F\u6B21",
      "doc.issue.issue": "\u722D\u9EDE",
      "doc.issue.plaintiff": "\u539F\u544A\u4E3B\u5F35",
      "doc.issue.plaintiffEvidence": "\u539F\u544A\u8B49\u64DA",
      "doc.issue.defendant": "\u88AB\u544A\u6297\u8FAF",
      "doc.issue.defendantEvidence": "\u88AB\u544A\u8B49\u64DA",
      "doc.issue.basis": "\u6CD5\u5F8B\u4F9D\u64DA",
      "doc.issue.title": "\u722D\u9EDE\u6574\u7406\u8868",
      "doc.issue.export": "\u532F\u51FA CSV",
      "doc.issue.file": "\u722D\u9EDE\u6574\u7406\u8868.csv",
      "doc.claims.title": "\u8072\u660E\u8207\u8ACB\u6C42\u6B0A\u57FA\u790E\u6E05\u55AE",
      "doc.claims.no": "\u5E8F\u6B21",
      "doc.claims.basis": "\u8ACB\u6C42\u6B0A\u57FA\u790E",
      "doc.claims.claim": "\u539F\u544A\u4E4B\u8072\u660E",
      "doc.claims.file": "\u8072\u660E\u8207\u8ACB\u6C42\u6B0A\u57FA\u790E\u6E05\u55AE.csv",
      "doc.undisputed.title": "\u4E0D\u722D\u57F7\u4E8B\u9805\u6E05\u55AE",
      "doc.undisputed.no": "\u5E8F\u6B21",
      "doc.undisputed.fact": "\u5169\u9020\u4E0D\u722D\u57F7\u4E8B\u5BE6",
      "doc.undisputed.evidence": "\u8B49\u64DA",
      "doc.undisputed.file": "\u4E0D\u722D\u57F7\u4E8B\u9805\u6E05\u55AE.csv",
      "input.motionRequest": "\u8072\u8ACB\u4E8B\u9805\uFF08\u8981\u8ACB\u6CD5\u9662\u51C6\u8A31\u4EC0\u9EBC\uFF09",
      "input.motionRequestPlaceholder": "\u4F8B\u5982\uFF1A\u8072\u8ACB\u8ABF\u67E5\u8B49\u64DA\uFF0C\u547D\u88AB\u544A\u63D0\u51FA\u884C\u8ECA\u7D00\u9304\u5668\u5F71\u50CF",
      "questions.title": "\u5E7E\u500B\u53EA\u6709\u4F60\u77E5\u9053\u7684\u4E8B\u5BE6",
      "questions.why": "\u70BA\u4F55\u8981\u554F",
      "questions.submit": "\u7E7C\u7E8C",
      "result.tab.graph": "\u95DC\u4FC2\u5716",
      "result.tab.analysis": "\u6CD5\u5F8B\u5206\u6790\uFF08\u6DB5\u651D\u8207\u8A55\u4F30\uFF09",
      "result.tab.research": "\u6CD5\u689D\u8207\u5224\u6C7A",
      "result.tab.brainstorm": "\u6848\u60C5\u8207\u722D\u57F7\u9EDE",
      "result.researchWarning.title": "\u6CD5\u898F\u6AA2\u7D22\u672A\u5B8C\u6210",
      "result.researchWarning.tip": "\u672C\u6B21\u5BE9\u67E5\u6C92\u6709\u53D6\u5F97\u4EFB\u4F55\u6CD5\u689D\uFF0C\u4EE5\u4E0B\u98A8\u96AA\u8A55\u7D1A\u50C5\u70BA\u555F\u767C\u5F0F\u5224\u65B7\u3001\u672A\u7D93\u6CD5\u6E90\u9A57\u8B49\uFF1B\u8ACB\u5F85\u6AA2\u7D22\u670D\u52D9\u6062\u5FA9\u5F8C\u91CD\u65B0\u5BE9\u67E5\u3002",
      "result.generatedIn": "\u7522\u751F\u8A9E\u7CFB",
      "result.notes": "\u9A57\u8B49\u7D00\u9304",
      "result.coverage": "\u6AA2\u7D22\u6DB5\u84CB\u72C0\u614B",
      "result.newCase": "\u65B0\u6848\u4EF6",
      "result.elements": "\u9010\u689D\u6AA2\u67E5\u6CD5\u5F8B\u8981\u4EF6\uFF08\u69CB\u6210\u8981\u4EF6\u6DB5\u651D\u8868\uFF09",
      "result.strategy": "\u7B56\u7565",
      "result.evidenceGaps": "\u8B49\u64DA\u7F3A\u53E3",
      "result.statutes": "\u6CD5\u689D",
      "result.judgments": "\u5224\u6C7A",
      "result.facts": "\u4E8B\u5BE6",
      "result.relations": "\u6CD5\u5F8B\u95DC\u4FC2",
      "result.issues": "\u722D\u9EDE",
      "result.evidenceNeeds": "\u5F85\u88DC\u8B49\u64DA",
      "graph.filter": "\u7BC0\u9EDE\u7BE9\u9078",
      "graph.family": "\u6848\u4EF6\u5BB6\u65CF",
      "graph.search": "\u641C\u5C0B\u7BC0\u9EDE\u5F8C\u6309 Enter",
      "graph.group.fact": "\u4E8B\u5BE6",
      "graph.group.law": "\u6CD5\u689D",
      "graph.group.judgment": "\u5224\u6C7A",
      "graph.group.issue": "\u722D\u9EDE",
      "graph.group.party": "\u7576\u4E8B\u4EBA",
      "graph.group.plaintiff": "\u539F\u544A",
      "graph.group.evidence": "\u8B49\u64DA",
      "graph.group.contract": "\u5951\u7D04",
      "graph.group.clause": "\u689D\u6B3E",
      "graph.group.obligation": "\u7FA9\u52D9",
      "graph.group.element": "\u8981\u4EF6",
      "graph.status.good": "\u5C0D\u672C\u65B9\u6709\u5229\uFF0F\u52DD\u8A34",
      "graph.status.bad": "\u5C0D\u672C\u65B9\u4E0D\u5229\uFF0F\u6557\u8A34",
      "graph.status.mixed": "\u4E92\u898B\uFF08\u90E8\u5206\u6709\u5229\uFF09",
      "graph.risk.high": "\u{1F534} \u9AD8\u98A8\u96AA\u689D\u6B3E",
      "graph.risk.medium": "\u{1F7E1} \u4E2D\u98A8\u96AA\u689D\u6B3E",
      "graph.risk.low": "\u{1F7E2} \u4F4E\u98A8\u96AA\u689D\u6B3E",
      "graph.met.yes": "\u25CB \u8A72\u7576",
      "graph.met.no": "\u2717 \u4E0D\u8A72\u7576",
      "graph.met.unknown": "\u25B3 \u4E8B\u5BE6\u4E0D\u660E\uFF08\u5F85\u88DC\u8B49\u64DA\uFF09",
      "graph.duty.main": "\u4E3B\u7D66\u4ED8\u7FA9\u52D9",
      "graph.duty.collateral": "\u5F9E\u7D66\u4ED8\u7FA9\u52D9",
      "graph.duty.incidental": "\u9644\u96A8\u7FA9\u52D9",
      "graph.detail.dutyType": "\u7FA9\u52D9\u985E\u578B\uFF1A",
      "graph.detail.role": "\u5951\u7D04\u5730\u4F4D\uFF1A",
      "graph.detail.evidence": "\u95DC\u9375\u8B49\u64DA\u512A\u52A3\u9EDE",
      "graph.detail.noEvidence": "\u672C\u6848\u672A\u7279\u5225\u6A19\u8A3B\u9006\u8F49\u95DC\u9375\u8B49\u64DA",
      "graph.detail.forDefendant": "\u6709\u5229\u88AB\u544A\uFF1A",
      "graph.detail.againstDefendant": "\u4E0D\u5229\u88AB\u544A\uFF1A",
      "graph.detail.fullText": "\u67E5\u770B\u5224\u6C7A\u5168\u6587 \u2197",
      "graph.overturned": " \u26A0\uFE0F\u5DF2\u5EE2\u68C4",
      "failed.title": "\u5206\u6790\u5931\u6557",
      "failed.retry": "\u91CD\u8A66",
      "disclaimer": "\u50C5\u4F9B\u5206\u6790\u8F14\u52A9\uFF0C\u975E\u6CD5\u5F8B\u610F\u898B\u3002\u793A\u7BC4\u6848\u4F8B\u7686\u70BA\u865B\u69CB\u3002\u8ACB\u52FF\u8CBC\u5165\u771F\u5BE6\u500B\u8CC7\u3002",
      "a11y.skip": "\u8DF3\u5230\u4E3B\u8981\u5167\u5BB9",
      "input.label": "\u63CF\u8FF0\u4F60\u7684\u722D\u8B70",
      "input.hint": "\u81F3\u5C11 20 \u5B57\u3002\u4E8B\u5BE6\u8D8A\u5177\u9AD4\uFF0C\u5206\u6790\u8D8A\u7CBE\u6E96\u3002",
      "input.hintWithFiles": "\u5DF2\u9644\u53C3\u8003\u6587\u4EF6\uFF0C\u63CF\u8FF0\u53EF\u7559\u7A7A\u6216\u7C21\u8FF0\u5373\u53EF\u3002",
      "progress.aria": "\u5206\u6790\u9032\u5EA6",
      "questions.lead": "\u56DE\u7B54\u53EA\u6703\u63D0\u4F9B\u7D66 Agent \u5206\u6790\uFF1B\u6848\u4EF6\u7D50\u675F\u5F8C\u4E0D\u6703\u4FDD\u5B58\u3002",
      "graph.close": "\u95DC\u9589\u8A73\u60C5\u9762\u677F",
      "graph.detail.aria": "\u7BC0\u9EDE\u8A73\u60C5",
      "result.tabs.aria": "\u7D50\u679C\u5206\u9801",
      "inspector.title": "\u5DE5\u5177\u6AA2\u8996\u5668",
      "inspector.readonly": "\u552F\u8B80\u6AA2\u8996\u3002\u9019\u4E9B\u5DE5\u5177\u7531\u4F60\u7684 Agent \u900F\u904E WebMCP \u547C\u53EB\uFF1B\u4EBA\u76F4\u63A5\u64CD\u4F5C\u9801\u9762\u5373\u53EF\u3002",
      "auth.semantic.ready": "\u8A9E\u610F\u6AA2\u7D22\uFF1A\u5C31\u7DD2",
      "auth.semantic.required": "\u8A9E\u610F\u6AA2\u7D22\uFF1A\u672A\u6388\u6B0A",
      "auth.semantic.tip": "\u5B8C\u6210\u6388\u6B0A\u5F8C\uFF0C\u672C\u6B21\u5206\u6790\u624D\u6703\u7D0D\u5165\u5224\u6C7A\u8A9E\u610F\u6AA2\u7D22\u3002",
      "auth.semantic.action": "\u4E00\u9375\u6388\u6B0A",
      "usage.exhausted.title": "\u4ECA\u65E5 AI \u984D\u5EA6\u5DF2\u7528\u5B8C",
      "usage.exhausted.tip": "\u672C\u7AD9\u6BCF\u65E5\u5171\u4EAB token \u984D\u5EA6\u7528\u5B8C\u5F8C\u6703\u66AB\u505C\u65B0\u7684\u5206\u6790\u3002\u4F60\u4E5F\u53EF\u4EE5\u5B89\u88DD Law Powers \u6280\u80FD\uFF0C\u7528\u81EA\u5DF1\u7684 AI Agent \u505A\u540C\u6A23\u7684\u5206\u6790\uFF0C\u4E0D\u53D7\u984D\u5EA6\u9650\u5236\u3002",
      "usage.exhausted.action": "\u53D6\u5F97 Law Powers",
      "quota.count": "\u4ECA\u65E5\u5DF2\u5206\u6790",
      "input.previewAria": "\u6848\u60C5\u63CF\u8FF0\uFF08\u9EDE\u4E00\u4E0B\u7DE8\u8F2F\uFF09",
      "quota.loginTip": "\u7528 Google \u767B\u5165\u5F8C\u6BCF\u5929\u53EF\u5206\u6790 {limit} \u6B21\u3002",
      "nav.login": "Google \u767B\u5165",
      "nav.logout": "\u767B\u51FA",
      "nav.loginBenefit": "\u767B\u5165\u5F8C\u6BCF\u5929\u53EF\u5206\u6790 {limit} \u6B21",
      "license.banner.title": "\u4F7F\u7528\u6388\u6B0A",
      "license.banner.prefix": "\uFF1A\u672C\u7AD9\u7121\u511F\u6388\u6B0A\u6240\u6709\u4EBA\u81EA\u7531\u4F7F\u7528 \u2014\u2014 \u552F ",
      "license.banner.suffix": " \u9664\u5916\u3002\u62DC\u4ED6\u5011\u6240\u8CDC\uFF0C\u624D\u6709\u9019\u500B\u670D\u52D9\u7684\u8A95\u751F\u3002",
      "license.excluded": "\u4F9D\u672C\u5C08\u6848\u4F7F\u7528\u6388\u6B0A\uFF0C\u672C\u670D\u52D9\u4E0D\u63D0\u4F9B\u7D93\u5146\u570B\u969B\u6CD5\u5F8B\u4E8B\u52D9\u6240\u4F7F\u7528\u3002",
      "quota.reason": "\u672C\u7AD9\u514D\u8CBB\u958B\u653E\uFF0C\u70BA\u4E86\u8B93\u66F4\u591A\u4EBA\u90FD\u80FD\u4F7F\u7528\uFF0C\u6BCF\u4EBA\u6BCF\u5929\u6700\u591A\u5206\u6790 {limit} \u6B21\uFF08\u53F0\u5317\u6642\u9593\u5348\u591C\u91CD\u65B0\u8A08\u7B97\uFF09\u3002",
      "quota.exhausted.title": "\u4ECA\u65E5 {limit} \u6B21\u5206\u6790\u5DF2\u7528\u5B8C",
      "input.lawPowers": "\u672C\u7AD9\u6709\u6BCF\u65E5\u5171\u4EAB AI \u984D\u5EA6\u3002\u60F3\u4E0D\u53D7\u9650\u5236\uFF0C\u53EF\u5B89\u88DD\u958B\u6E90\u7684 Law Powers \u6280\u80FD\uFF0C\u7528\u81EA\u5DF1\u7684 AI Agent \u505A\u540C\u6A23\u7684\u5206\u6790\u3002",
      "input.lawPowersAction": "Law Powers \u6280\u80FD",
      "result.defenses": "\u5C0D\u65B9\u53EF\u80FD\u600E\u9EBC\u53CD\u99C1\u3001\u6211\u5011\u600E\u9EBC\u56DE\u61C9\uFF08\u6297\u8FAF\u8A55\u4F30\uFF09",
      "result.evidencePlan": "\u8AB0\u8981\u8B49\u660E\u4EC0\u9EBC\u3001\u9084\u7F3A\u54EA\u4E9B\u8B49\u64DA\uFF08\u8209\u8B49\u8CAC\u4EFB\u8207\u8B49\u64DA\u8A08\u756B\uFF09",
      "result.risk": "\u6574\u9AD4\u98A8\u96AA",
      "result.claimSummary": "\u5404\u9805\u8ACB\u6C42\u80FD\u4E0D\u80FD\u6210\u7ACB\uFF08\u8ACB\u6C42\u6B0A\u57FA\u790E\u5C0F\u7D50\uFF09",
      "result.none": "\u7121",
      "claim.established": "\u8981\u4EF6\u9F4A\u5099",
      "claim.failed": "\u6709\u8981\u4EF6\u4E0D\u8A72\u7576",
      "claim.pending": "\u5F85\u88DC\u8B49\u64DA",
      "defense.issue": "\u722D\u9EDE",
      "defense.defense": "\u5C0D\u9020\u6297\u8FAF",
      "defense.response": "\u6211\u65B9\u56DE\u61C9",
      "defense.risk": "\u98A8\u96AA",
      "evidence.fact": "\u5F85\u8B49\u4E8B\u5BE6",
      "evidence.burden": "\u8209\u8B49\u8CAC\u4EFB",
      "evidence.available": "\u73FE\u6709\u8B49\u64DA",
      "evidence.missing": "\u7F3A\u53E3",
      "evidence.howToObtain": "\u53D6\u5F97\u65B9\u5F0F",
      "risk.high": "\u9AD8",
      "risk.medium": "\u4E2D",
      "risk.low": "\u4F4E",
      "result.tab.checklist": "\u4F60\u9700\u8981\u6E96\u5099\u7684\u6771\u897F",
      "checklist.lead": "\u4E0B\u9762\u662F\u9019\u500B\u6848\u5B50\u5EFA\u8B70\u4F60\u5148\u6E96\u5099\u597D\u7684\u6771\u897F\uFF0C\u6700\u597D\u5728\u4E0B\u6B21\u8DDF\u5F8B\u5E2B\u898B\u9762\u6216\u9001\u6587\u4EF6\u7D66\u6CD5\u9662\u4E4B\u524D\u5099\u59A5\u3002",
      "checklist.category": "\u5206\u985E",
      "checklist.item": "\u9805\u76EE",
      "checklist.why": "\u70BA\u4F55\u9700\u8981",
      "checklist.due": "\u6642\u9650",
      "checklist.export": "\u532F\u51FA CSV",
      "checklist.print": "\u5217\u5370",
      "checklist.file": "\u7576\u4E8B\u4EBA\u6E96\u5099\u6E05\u55AE.csv",
      "checklist.cat.evidence": "\u8B49\u64DA\u6587\u4EF6",
      "checklist.cat.witness": "\u4EBA\u8B49",
      "checklist.cat.procedure": "\u7A0B\u5E8F\u4E8B\u9805",
      "checklist.cat.cost": "\u8CBB\u7528\u8207\u671F\u9650",
      "checklist.cat.other": "\u5176\u4ED6"
    }
  };
  function t(key, locale2) {
    return DICT[locale2] && DICT[locale2][key] || DICT.en[key] || key;
  }
  function detectLocale(navigatorLanguage, stored) {
    if (stored === "en" || stored === "zh-TW") return stored;
    return String(navigatorLanguage || "").toLowerCase().startsWith("zh") ? "zh-TW" : "en";
  }

  // src/main/resources/static/js/state.js
  var States = Object.freeze({ HOME: "HOME", INPUT: "INPUT", RUNNING: "RUNNING", QUESTIONS: "QUESTIONS", RESULT: "RESULT", FAILED: "FAILED" });
  var VIEW_BY_STATUS = { RUNNING: States.RUNNING, WAITING: States.QUESTIONS, COMPLETED: States.RESULT, FAILED: States.FAILED };
  var normalizeMode = (mode) => mode === "contract" ? "contract" : "case";
  var initialState = Object.freeze({ view: States.HOME, caseId: null, last: null, mode: null });
  function reduce(state, event) {
    switch (event.type) {
      case "SELECT_MODE":
        return { view: States.INPUT, caseId: null, last: null, mode: normalizeMode(event.mode) };
      case "GO_HOME":
        return { ...initialState };
      case "START":
        return { view: States.RUNNING, caseId: event.caseId, last: null, mode: normalizeMode(event.mode ?? state.mode) };
      case "STATUS":
        return {
          ...state,
          view: VIEW_BY_STATUS[event.status.status] || state.view,
          last: event.status,
          mode: event.status.mode ? normalizeMode(event.status.mode) : state.mode
        };
      case "RESET":
        return { ...initialState };
      default:
        return state;
    }
  }

  // src/main/resources/static/js/views/util.js
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function mount(el, html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    el.replaceChildren(...doc.body.childNodes);
  }

  // src/main/resources/static/js/views/icons.js
  var wrap = (paths, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  var ICONS = {
    /** 向右箭頭：示範案例卡的進入提示。 */
    arrowRight: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    /** 資訊圓圈：免責聲明。 */
    info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'),
    /** 警示三角：失敗頁。 */
    alert: wrap('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    /** 關閉叉叉：詳情面板。 */
    close: wrap('<path d="M18 6 6 18M6 6l12 12"/>'),
    /** 向下 V 形：Inspector 折疊切換。 */
    chevronDown: wrap('<path d="m6 9 6 6 6-6"/>'),
    /** 加號：新案件。 */
    plus: wrap('<path d="M12 5v14M5 12h14"/>'),
    /** 上傳：檔案拖放區的主要視覺提示。 */
    upload: wrap('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/>'),
    /** 送出（紙飛機）：開始分析／繼續。 */
    send: wrap('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
    /** 重試（循環箭頭）。 */
    refresh: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>')
  };

  // src/main/resources/static/js/contract.js
  var CONTRACT_PARTIES = Object.freeze(["partyA", "partyB", "unknown"]);
  var CONTRACT_SCOPES = Object.freeze(["commercial", "labor", "privacy", "corporate"]);
  var CONTRACT_OUTPUTS = Object.freeze(["revised"]);

  // src/main/resources/static/js/documents.js
  var DOC_TYPES = Object.freeze([
    "complaint",
    "reasons",
    "report",
    "preparatory",
    "defense",
    "issues",
    "appeal",
    "motion"
  ]);
  var OUTPUT_OPTIONS = Object.freeze(["graph", ...DOC_TYPES]);
  function outputOptionsFor(mode = "case") {
    return mode === "contract" ? [...CONTRACT_OUTPUTS] : [...OUTPUT_OPTIONS];
  }
  function normalizeOutputs(outputs, mode = "case") {
    const requested = new Set(Array.isArray(outputs) ? outputs : []);
    if (mode === "contract") return CONTRACT_OUTPUTS.filter((o) => requested.has(o));
    const ordered = OUTPUT_OPTIONS.filter((o) => requested.has(o));
    return ordered.length ? ordered : ["graph"];
  }

  // src/main/resources/static/js/views/input.js
  var MIN_CHARS = 20;
  var MAX_FILES = 5;
  function renderOutputs(locale2, mode = "case") {
    const contract = mode === "contract";
    const options = outputOptionsFor(mode);
    const items = options.map((option) => {
      const label = contract ? t("doc.revised", locale2) : option === "graph" ? t("output.graph", locale2) : t("doc." + option, locale2);
      return `<label class="output-item"><input type="checkbox" name="outputs" value="${option}"${!contract && option === "graph" ? " checked" : ""}><span>${esc(label)}</span></label>`;
    }).join("");
    return `<fieldset class="outputs" id="output-box">
      <legend>${esc(t(contract ? "contract.outputs" : "input.outputs", locale2))}</legend>
      <div class="output-grid">${items}</div>
      <p class="field-hint">${esc(t(contract ? "contract.outputsHint" : "input.outputsHint", locale2))}</p>
    </fieldset>`;
  }
  function renderContractFields(locale2) {
    const parties = CONTRACT_PARTIES.map(
      (p) => `<label class="output-item"><input type="radio" name="party" value="${p}"${p === "unknown" ? " checked" : ""}><span>${esc(t("contract.party." + p, locale2))}</span></label>`
    ).join("");
    const scopes = CONTRACT_SCOPES.map(
      (s) => `<label class="output-item"><input type="checkbox" name="scopes" value="${s}"><span>${esc(t("contract.scope." + s, locale2))}</span></label>`
    ).join("");
    return `<fieldset class="outputs" id="contract-party"><legend>${esc(t("contract.party", locale2))}</legend><div class="output-grid">${parties}</div></fieldset>
    <fieldset class="outputs" id="contract-scopes"><legend>${esc(t("contract.scopes", locale2))}</legend><div class="output-grid">${scopes}</div><p class="field-hint">${esc(t("contract.scopesHint", locale2))}</p></fieldset>`;
  }
  function renderSemanticAuthNotice(auth, locale2) {
    if (!auth || !auth.enabled || auth.authorized) return "";
    return `<div class="semantic-auth-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t("auth.semantic.required", locale2))}</strong>
      <span>${esc(t("auth.semantic.tip", locale2))}</span>
    </div>
    <a href="${esc(auth.startPath || "/api/auth/tw-legal-rag/start")}" class="auth-link">${esc(t("auth.semantic.action", locale2))} \u2197</a>
  </div>`;
  }
  var LAW_POWERS_URL = "https://kevintsai1202.github.io/law-powers/";
  function renderUsageNotice(usage, locale2) {
    if (!usage || !usage.exhausted) return "";
    return `<div class="semantic-auth-banner usage-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t("usage.exhausted.title", locale2))}</strong>
      <span>${esc(t("usage.exhausted.tip", locale2))}</span>
    </div>
    <a href="${LAW_POWERS_URL}" class="auth-link" target="_blank" rel="noopener">${esc(t("usage.exhausted.action", locale2))} \u2197</a>
  </div>`;
  }
  function renderQuota(quota, locale2) {
    if (!quota || !(quota.limit > 0)) return "";
    const count = `${quota.used} / ${quota.limit}`;
    const loginTip = !quota.loggedIn && quota.memberLimit > quota.limit ? ` <a class="quota-login" href="${esc(quota.loginPath || "/oauth2/authorization/google")}">${esc(t("quota.loginTip", locale2).replace("{limit}", quota.memberLimit))}</a>` : "";
    if (quota.exhausted) {
      return `<div class="semantic-auth-banner quota-banner" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t("quota.exhausted.title", locale2).replace("{limit}", quota.limit))}</strong>
      <span>${esc(t("quota.reason", locale2).replace("{limit}", quota.limit))}${loginTip}</span>
    </div>
    <a href="${LAW_POWERS_URL}" class="auth-link" target="_blank" rel="noopener">${esc(t("usage.exhausted.action", locale2))} \u2197</a>
  </div>`;
    }
    return `<p class="field-hint quota-note" aria-live="polite"><strong>${esc(t("quota.count", locale2))} ${esc(count)}</strong> <span>${esc(t("quota.reason", locale2).replace("{limit}", quota.limit))}${loginTip}</span></p>`;
  }
  function renderInput({ samples = [], semanticAuth = null, usage = null, quota = null, mode = "case" }, locale2) {
    const contract = mode === "contract";
    const cards = samples.map((s) => `<button type="button" class="sample" data-sample-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.summary)}</span>${ICONS.arrowRight}</button>`).join("");
    const authNotice = renderSemanticAuthNotice(semanticAuth, locale2);
    const usageNotice = renderUsageNotice(usage, locale2);
    const quotaNotice = renderQuota(quota, locale2);
    return `<section class="input">
    <div class="input-main card">
      ${usageNotice}
      ${quotaNotice}
      ${authNotice}
      <label class="field-label" for="case-text">${esc(t(contract ? "contract.label" : "input.label", locale2))}</label>
      <textarea id="case-text" rows="3" aria-describedby="case-hint" placeholder="${esc(t(contract ? "contract.placeholder" : "input.placeholder", locale2))}"></textarea>
      <!-- \u5931\u7126\u4E14\u5DF2\u6709\u5167\u5BB9\u6642\uFF0C\u4EE5\u4E09\u884C\u9810\u89BD\u53D6\u4EE3\u8F38\u5165\u6846\uFF08\u8D85\u9577\u4EE5 \u2026 \u6536\u5C3E\uFF09\uFF1B\u9EDE\u9810\u89BD\u5373\u56DE\u5230\u8F38\u5165\u6846\u4E26\u653E\u5927 -->
      <button type="button" class="case-preview" id="case-preview" hidden aria-label="${esc(t("input.previewAria", locale2))}"></button>
      <div class="field-hint" id="case-hint"><span id="case-hint-text">${esc(t(contract ? "contract.hint" : "input.hint", locale2))}</span><span class="count" id="case-count" aria-live="polite">0 / ${MIN_CHARS}</span></div>
      <div class="upload-field">
        <label class="field-label" for="case-files">${esc(t("input.files", locale2))}</label>
        <input class="upload-input" id="case-files" type="file" accept=".pdf,.md,.markdown,.docx" multiple aria-describedby="file-hint file-status">
        <button class="upload-dropzone" id="file-dropzone" type="button" aria-describedby="file-hint file-status">
          <span class="upload-icon" aria-hidden="true">${ICONS.upload}</span>
          <span class="upload-copy"><strong>${esc(t("input.filesDropTitle", locale2))}</strong><span>${esc(t("input.filesDropAction", locale2))}</span></span>
          <span class="upload-formats">${esc(t("input.filesFormats", locale2))}</span>
        </button>
        <div class="file-list" id="file-list" role="list" aria-label="${esc(t("input.filesList", locale2))}"></div>
        <div class="field-hint" id="file-hint">${esc(t("input.filesHint", locale2))}</div>
        <p class="file-status" id="file-status" aria-live="polite">${esc(t("input.filesEmpty", locale2))}</p>
      </div>
      ${contract ? renderContractFields(locale2) : ""}
      ${renderOutputs(locale2, mode)}
      ${contract ? "" : `<div class="motion-field" id="motion-field" hidden>
        <label class="field-label" for="motion-request">${esc(t("input.motionRequest", locale2))}</label>
        <input id="motion-request" type="text" maxlength="200" placeholder="${esc(t("input.motionRequestPlaceholder", locale2))}">
      </div>`}
      <div class="input-actions"><button id="case-submit" class="primary" type="button" disabled>${esc(t(contract ? "input.submitContract" : "input.submit", locale2))}</button></div>
    </div>
    <aside class="input-side">
      <h3>${esc(t(contract ? "input.samplesContract" : "input.samples", locale2))}</h3><div class="samples">${cards}</div>
      <p class="disclaimer">${ICONS.info}<span>${esc(t("disclaimer", locale2))}</span></p>
      <p class="disclaimer lawpowers-note">${ICONS.info}<span>${esc(t("input.lawPowers", locale2))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t("input.lawPowersAction", locale2))} \u2197</a></span></p>
    </aside></section>`;
  }
  function formatFileSize(bytes, locale2) {
    if (bytes < 1024) return `${bytes} B`;
    const value = bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024);
    const unit = bytes < 1024 * 1024 ? "KB" : "MB";
    return `${new Intl.NumberFormat(locale2, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
  }
  function mergeFiles(current2, incoming) {
    const fileMap = new Map(current2.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
    incoming.forEach((file) => fileMap.set(`${file.name}:${file.size}:${file.lastModified}`, file));
    return [...fileMap.values()];
  }
  function renderFileList(container, files, locale2) {
    container.replaceChildren();
    if (!files.length) return;
    const doc = container.ownerDocument || globalThis.document;
    files.forEach((file, index) => {
      const item = doc.createElement("div");
      item.className = "file-item";
      item.setAttribute("role", "listitem");
      const extension = doc.createElement("span");
      extension.className = "file-extension";
      extension.textContent = (file.name.split(".").pop() || "FILE").slice(0, 5).toUpperCase();
      const detail = doc.createElement("span");
      detail.className = "file-detail";
      const name = doc.createElement("strong");
      name.className = "file-name";
      name.textContent = file.name;
      const size = doc.createElement("span");
      size.className = "file-size";
      size.textContent = formatFileSize(file.size, locale2);
      detail.append(name, size);
      const remove = doc.createElement("button");
      remove.className = "file-remove";
      remove.type = "button";
      remove.dataset.fileIndex = String(index);
      remove.setAttribute("aria-label", t("input.filesRemove", locale2).replace("{name}", file.name));
      remove.innerHTML = ICONS.close;
      item.append(extension, detail, remove);
      container.append(item);
    });
  }
  function bindInput(root, { onSubmit, onSample }, locale2 = "en", mode = "case") {
    const ta = root.querySelector("#case-text"), files = root.querySelector("#case-files");
    const btn = root.querySelector("#case-submit"), count = root.querySelector("#case-count");
    const dropzone = root.querySelector("#file-dropzone"), fileList = root.querySelector("#file-list");
    const fileStatus = root.querySelector("#file-status");
    const hintText = root.querySelector("#case-hint-text");
    let selectedFiles = [...files.files];
    let dragDepth = 0;
    const checked = () => [...root.querySelectorAll('input[name="outputs"]:checked')].map((c) => c.value);
    const motionField = root.querySelector("#motion-field"), motionInput = root.querySelector("#motion-request");
    const syncMotion = () => {
      if (motionField) motionField.hidden = !checked().includes("motion");
    };
    const syncFiles = () => {
      renderFileList(fileList, selectedFiles, locale2);
      fileStatus.textContent = selectedFiles.length ? t(selectedFiles.length > MAX_FILES ? "input.filesTooMany" : "input.filesSelected", locale2).replace("{count}", selectedFiles.length) : t("input.filesEmpty", locale2);
      fileStatus.classList.toggle("error", selectedFiles.length > MAX_FILES);
    };
    const sync = () => {
      const n = ta.value.trim().length;
      const hasFiles = selectedFiles.length > 0;
      count.textContent = hasFiles ? `${n}` : `${n} / ${MIN_CHARS}`;
      count.classList.toggle("ok", hasFiles || n >= MIN_CHARS);
      if (hintText) hintText.textContent = t(hasFiles ? "input.hintWithFiles" : "input.hint", locale2);
      const hasInput = n >= MIN_CHARS || hasFiles;
      btn.disabled = !hasInput || mode !== "contract" && checked().length === 0 || selectedFiles.length > MAX_FILES;
    };
    ta.addEventListener("input", sync);
    const preview = root.querySelector("#case-preview");
    const collapse = () => {
      ta.classList.remove("expanded");
      if (!preview) return;
      const text = ta.value.trim();
      if (text) {
        preview.textContent = ta.value;
        preview.hidden = false;
        ta.hidden = true;
      }
    };
    const expand = () => {
      if (preview) {
        preview.hidden = true;
        ta.hidden = false;
      }
      ta.classList.add("expanded");
    };
    ta.addEventListener("focus", expand);
    ta.addEventListener("blur", collapse);
    if (preview) preview.addEventListener("click", () => {
      expand();
      ta.focus?.();
    });
    files.addEventListener("change", () => {
      selectedFiles = [...files.files];
      syncFiles();
      sync();
    });
    dropzone.addEventListener("click", () => files.click());
    dropzone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      dragDepth++;
      dropzone.classList.add("is-dragging");
    });
    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    dropzone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropzone.classList.remove("is-dragging");
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove("is-dragging");
      selectedFiles = mergeFiles(selectedFiles, [...event.dataTransfer?.files || []]);
      syncFiles();
      sync();
    });
    fileList.addEventListener("click", (event) => {
      const remove = event.target.closest?.("[data-file-index]");
      if (!remove) return;
      selectedFiles.splice(Number(remove.dataset.fileIndex), 1);
      files.value = "";
      syncFiles();
      sync();
    });
    root.querySelectorAll('input[name="outputs"]').forEach((c) => c.addEventListener("change", () => {
      syncMotion();
      sync();
    }));
    syncFiles();
    syncMotion();
    sync();
    const extra = () => mode === "contract" ? {
      party: root.querySelector('input[name="party"]:checked')?.value || "unknown",
      scopes: [...root.querySelectorAll('input[name="scopes"]:checked')].map((c) => c.value)
    } : {};
    btn.addEventListener("click", () => onSubmit(
      ta.value,
      checked(),
      [...selectedFiles],
      mode !== "contract" && checked().includes("motion") && motionInput ? (motionInput.value || "").trim() : "",
      extra()
    ));
    root.querySelectorAll(".sample").forEach((b) => b.addEventListener("click", () => onSample(b.dataset.sampleId, checked(), extra())));
  }

  // src/main/resources/static/js/views/progress.js
  var STEPS_BY_MODE = Object.freeze({
    case: Object.freeze(["BRAINSTORM", "QUESTIONS", "RESEARCH", "ANALYSIS", "ASSESSMENT", "DOCUMENTS", "GRAPH"]),
    contract: Object.freeze(["LOAD", "QUESTIONS", "RESEARCH", "REVIEW", "SUMMARY", "REVISE", "GRAPH"])
  });
  var STEPS = STEPS_BY_MODE.case;
  function renderCancel(locale2) {
    return `<div class="cancel-row"><button id="cancel-case" type="button" class="ghost">${esc(t("progress.cancel", locale2))}</button></div>`;
  }
  function renderProgress({ step, busy = true, mode = "case" }, locale2) {
    const steps = STEPS_BY_MODE[mode] || STEPS_BY_MODE.case;
    const modeKey = mode === "contract" ? "contract" : "case";
    const idx = steps.indexOf(step);
    return `<ol class="progress" aria-label="${esc(t("progress.aria", locale2))}">${steps.map((s, i) => {
      const cls = i < idx ? "step done" : i === idx ? "step active" : "step";
      const current2 = i === idx ? ` aria-current="step"${busy ? " data-busy" : ""}` : "";
      return `<li class="${cls}" data-step="${s}"${current2}><span class="step-no" aria-hidden="true">${i + 1}</span><span class="step-label">${esc(t(`progress.${modeKey}.${s}`, locale2))}</span></li>`;
    }).join("")}</ol>`;
  }

  // src/main/resources/static/js/views/questions.js
  function renderQuestions({ questions = [], answers = {}, notice = "" }, locale2) {
    const items = questions.map((q, i) => `<label class="q"><span class="q-no" aria-hidden="true">${i + 1}</span><span class="q-text">${esc(q.text)}</span>
    <small>${esc(t("questions.why", locale2))}: ${esc(q.why)}</small><textarea name="${esc(q.id)}" rows="2">${esc(answers[q.id] || "")}</textarea></label>`).join("");
    const noticeHtml = notice ? `<p id="question-fill-notice" class="question-fill-notice" role="status">${esc(notice)}</p>` : "";
    return `<form id="questions-form" class="questions card"><h2>${esc(t("questions.title", locale2))}</h2><p class="lead">${esc(t("questions.lead", locale2))}</p>${noticeHtml}${items}
    <div class="questions-actions"><button type="submit" class="primary">${ICONS.send}${esc(t("questions.submit", locale2))}</button></div></form>`;
  }
  function bindQuestions(root, { onSubmit }) {
    root.querySelector("#questions-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const answers = [...e.currentTarget.querySelectorAll("textarea")].map((ta) => ({ questionId: ta.name, answer: ta.value }));
      onSubmit(answers);
    });
  }

  // src/main/resources/static/js/views/result.js
  var AUX_TABS = ["analysis", "research", "brainstorm"];
  function tabsFor(outputs, hasChecklist = false, mode = "case", result = null) {
    if (mode === "contract") {
      const selected2 = normalizeOutputs(outputs, "contract");
      return ["findings", "summary", ...selected2.includes("revised") ? ["doc-revised"] : [], ...result?.graph ? ["graph"] : [], "laws"];
    }
    const selected = normalizeOutputs(outputs);
    const front = ["graph", ...DOC_TYPES].filter((o) => selected.includes(o)).map((o) => o === "graph" ? "graph" : "doc-" + o);
    return [...front, ...hasChecklist ? ["checklist"] : [], ...AUX_TABS];
  }
  function tabLabel(tab, locale2) {
    return tab.startsWith("doc-") ? t("doc." + tab.slice(4), locale2) : t("result.tab." + tab, locale2);
  }
  var metMark = (m) => m === "yes" ? "\u25CB" : m === "no" ? "\u2717" : "\u25B3";
  var metKey = (m) => m === "yes" || m === "no" ? m : "unknown";
  var list = (arr, f = (x) => x) => `<ul>${(arr || []).map((x) => `<li>${esc(f(x))}</li>`).join("")}</ul>`;
  function elementsList(elements, locale2) {
    const rows = (elements || []).map((e) => {
      const k = metKey(e.met);
      return `<li class="el el-${k}"><span class="el-badge">${metMark(e.met)} ${esc(t("graph.met." + k, locale2).replace(/^[○✗△]\s*/, ""))}</span>
      <div class="el-head">${esc(e.element)} <span class="el-law">\xB7 ${esc(e.law)}</span></div><div class="el-basis">${esc(e.basis)}</div></li>`;
    }).join("");
    return `<ul class="elements">${rows}</ul>`;
  }
  function claimStatus(elements) {
    const byLaw = /* @__PURE__ */ new Map();
    (elements || []).forEach((e) => {
      if (!byLaw.has(e.law)) byLaw.set(e.law, []);
      byLaw.get(e.law).push(e.met);
    });
    return [...byLaw.entries()].map(([law, mets]) => ({
      law,
      status: mets.some((m) => m === "no") ? "failed" : mets.every((m) => m === "yes") ? "established" : "pending"
    }));
  }
  function claimSummaryList(elements, locale2) {
    const rows = claimStatus(elements).map((r) => `<li class="claim claim-${r.status}">${esc(r.law)}<span class="claim-status">${esc(t("claim." + r.status, locale2))}</span></li>`).join("");
    return rows ? `<ul class="claim-summary">${rows}</ul>` : "";
  }
  function defensesTable(defenses, locale2) {
    if (!defenses?.length) return `<p class="empty">${esc(t("result.none", locale2))}</p>`;
    const head = ["defense.issue", "defense.defense", "defense.response", "defense.risk"].map((k) => `<th>${esc(t(k, locale2))}</th>`).join("");
    const rows = defenses.map((d) => `<tr><td>${esc(d.issue)}</td><td>${esc(d.defense)}</td><td>${esc(d.response)}</td><td><span class="risk risk-${esc(d.risk || "medium")}">${esc(t("risk." + (d.risk || "medium"), locale2))}</span></td></tr>`).join("");
    return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function evidenceTable(items, locale2) {
    if (!items?.length) return `<p class="empty">${esc(t("result.none", locale2))}</p>`;
    const head = ["evidence.fact", "evidence.burden", "evidence.available", "evidence.missing", "evidence.howToObtain"].map((k) => `<th>${esc(t(k, locale2))}</th>`).join("");
    const rows = items.map((e) => `<tr><td>${esc(e.fact)}</td><td>${esc(e.burden)}</td><td>${esc(e.available)}</td><td>${esc(e.missing)}</td><td>${esc(e.howToObtain)}</td></tr>`).join("");
    return `<div class="table-wrap"><table class="assess-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  var CHECKLIST_CATEGORIES = ["\u8B49\u64DA\u6587\u4EF6", "\u4EBA\u8B49", "\u7A0B\u5E8F\u4E8B\u9805", "\u8CBB\u7528\u8207\u671F\u9650", "\u5176\u4ED6"];
  var CHECKLIST_CATEGORY_I18N = {
    "\u8B49\u64DA\u6587\u4EF6": "evidence",
    "\u4EBA\u8B49": "witness",
    "\u7A0B\u5E8F\u4E8B\u9805": "procedure",
    "\u8CBB\u7528\u8207\u671F\u9650": "cost",
    "\u5176\u4ED6": "other"
  };
  var checklistCatLabel = (cat, locale2) => t("checklist.cat." + (CHECKLIST_CATEGORY_I18N[cat] || "other"), locale2);
  function checklistTable(items, locale2) {
    const groups = new Map(CHECKLIST_CATEGORIES.map((c) => [c, []]));
    (items || []).forEach((i) => groups.get(CHECKLIST_CATEGORIES.includes(i.category) ? i.category : "\u5176\u4ED6").push(i));
    const sections = [...groups.entries()].filter(([, rows]) => rows.length).map(([cat, rows]) => `<h3>${esc(checklistCatLabel(cat, locale2))}</h3>
    <div class="table-wrap"><table class="assess-table checklist-table"><thead><tr><th>${esc(t("checklist.item", locale2))}</th><th>${esc(t("checklist.why", locale2))}</th><th>${esc(t("checklist.due", locale2))}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.why)}</td><td>${esc(r.dueHint || "")}</td></tr>`).join("")}</tbody></table></div>`).join("");
    return `<section class="checklist" id="checklist-sheet"><p class="lead">${esc(t("checklist.lead", locale2))}</p>${sections}
    <div class="actions"><button type="button" id="checklist-export" class="secondary">${esc(t("checklist.export", locale2))}</button>
    <button type="button" id="checklist-print" class="secondary">${esc(t("checklist.print", locale2))}</button></div></section>`;
  }
  function checklistCsv(items, locale2) {
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = [t("checklist.category", locale2), t("checklist.item", locale2), t("checklist.why", locale2), t("checklist.due", locale2)].join(",");
    return "\uFEFF" + [head, ...(items || []).map((i) => [checklistCatLabel(CHECKLIST_CATEGORIES.includes(i.category) ? i.category : "\u5176\u4ED6", locale2), i.item, i.why, i.dueHint].map(cell).join(","))].join("\r\n");
  }
  var SECTION_HTML = {
    brainstorm: (b, locale2) => {
      const h3 = (key) => `<h3>${esc(t(key, locale2))}</h3>`;
      return `${h3("result.facts")}${list(b.facts)}${h3("result.relations")}${list(b.relations)}
      ${h3("result.issues")}${list(b.issues)}${h3("result.evidenceNeeds")}${list(b.evidenceNeeds)}`;
    },
    research: (r, locale2) => {
      const h3 = (key) => `<h3>${esc(t(key, locale2))}</h3>`;
      const coverage = r.coverage || {};
      const evidenceByJid = new Map((r.evidence || []).map((e) => [e.judgment?.jid, e]));
      const coverageLine = r.coverage ? `<p class="research-coverage">${esc(t("result.coverage", locale2))}\uFF1Akeyword=${esc(coverage.keywordStatus || "")}\uFF1Bsemantic=${esc(coverage.semanticStatus || "")}\uFF1Bmerged=${esc(String(coverage.mergedCount ?? 0))}</p>` : "";
      const judgmentText = (j) => {
        const sources = evidenceByJid.get(j.jid)?.sources || [];
        return sources.length ? `${j.citation} [${sources.join("+")}]` : j.citation;
      };
      return `${coverageLine}${h3("result.statutes")}${list(r.laws, (l) => `${l.title}\uFF08${l.ref}\uFF09`)}${h3("result.judgments")}${list(r.judgments, judgmentText)}
      ${h3("result.notes")}${list(r.notes)}`;
    },
    analysis: (a, locale2, assessment = null) => {
      const h3 = (key) => `<h3>${esc(t(key, locale2))}</h3>`;
      return `${h3("result.elements")}${elementsList(a.elements, locale2)}
      ${h3("result.claimSummary")}${claimSummaryList(a.elements, locale2)}
      ${h3("result.defenses")}${defensesTable(assessment?.defenses, locale2)}
      ${h3("result.evidencePlan")}${evidenceTable(assessment?.evidencePlan, locale2)}
      ${h3("result.strategy")}<p>${esc(a.strategy || "")}</p>
      ${assessment?.riskSummary ? `${h3("result.risk")}<p>${esc(assessment.riskSummary)}</p>` : ""}
      ${h3("result.evidenceGaps")}${list(a.evidenceGaps)}
      <p class="disclaimer">${ICONS.info}<span>${esc(a.disclaimer)}</span></p>`;
    }
  };
  var riskBadge = (risk, locale2) => `<span class="risk risk-${esc(risk || "medium")}">${risk === "high" ? "\u{1F534}" : risk === "low" ? "\u{1F7E2}" : "\u{1F7E1}"} ${esc(t("risk." + (risk || "medium"), locale2))}</span>`;
  function findingsTable(findings, locale2, riskFilter = "all") {
    const rows = (findings || []).filter((f) => riskFilter === "all" || f.risk === riskFilter);
    const filters = ["all", "high", "medium", "low"].map((r) => `<button type="button" class="chip ${r === riskFilter ? "active" : ""}" data-risk="${r}" aria-pressed="${r === riskFilter}">${esc(r === "all" ? t("finding.filter.all", locale2) : t("risk." + r, locale2))}</button>`).join("");
    const head = ["clauseNo", "clauseText", "risk", "lawRefs", "riskPoint", "suggestion", "judgments"].map((k) => `<th scope="col">${esc(t("finding." + k, locale2))}</th>`).join("");
    const body = rows.map((f) => `<tr data-risk="${esc(f.risk || "medium")}"><td>${esc(f.clauseNo)}</td><td class="clause-text">${esc(f.clauseText)}</td><td>${riskBadge(f.risk, locale2)}</td>
    <td>${list(f.lawRefs)}</td><td>${esc(f.riskPoint)}</td><td>${esc(f.suggestion)}</td><td>${list(f.judgmentCitations)}</td></tr>`).join("");
    const table = rows.length ? `<div class="table-wrap"><table class="assess-table findings-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">${esc(t("finding.none", locale2))}</p>`;
    return `<div class="findings-toolbar"><div id="findings-filter" role="group" aria-label="${esc(t("finding.risk", locale2))}">${filters}</div>
    <button type="button" id="findings-export" class="secondary">${esc(t("finding.export", locale2))}</button></div>${table}`;
  }
  function findingsCsv(findings, locale2) {
    const head = ["clauseNo", "clauseText", "risk", "lawRefs", "riskPoint", "suggestion", "judgments"].map((k) => t("finding." + k, locale2)).join(",");
    const lines = (findings || []).map((f) => [f.clauseNo, f.clauseText, t("risk." + (f.risk || "medium"), locale2), (f.lawRefs || []).join("\uFF1B"), f.riskPoint, f.suggestion, (f.judgmentCitations || []).join("\uFF1B")].map(csvCell).join(","));
    return "\uFEFF" + [head, ...lines].join("\r\n");
  }
  function researchWarning(research, locale2) {
    const noLaws = !research || !research.laws?.length;
    const keywordFailed = !!research?.coverage?.keywordStatus && research.coverage.keywordStatus !== "SUCCESS";
    if (!noLaws && !keywordFailed) return "";
    return `<div class="semantic-auth-banner research-warning" role="alert">
    <span class="auth-icon" aria-hidden="true">${ICONS.alert}</span>
    <div class="auth-message">
      <strong>${esc(t("result.researchWarning.title", locale2))}</strong>
      <span>${esc(t("result.researchWarning.tip", locale2))}</span>
    </div>
  </div>`;
  }
  function findingsNotes(notes, locale2) {
    const rows = notes || [];
    if (!rows.length) return "";
    return `<details class="findings-notes"><summary>${esc(t("result.notes", locale2))}</summary><ul>${rows.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>`;
  }
  function summaryPanel(result, locale2) {
    const c = result.compliance || {}, b = result.contract || {};
    const h3 = (key) => `<h3>${esc(t(key, locale2))}</h3>`;
    const parties = (b.parties || []).map((p) => `${p.role}\uFF1A${p.name}`);
    return `${researchWarning(result.research, locale2)}
    ${h3("summary.contractType")}<p>${esc(c.contractType || b.contractType || "")}</p>
    ${parties.length ? h3("summary.parties") + list(parties) : ""}
    ${h3("summary.scopes")}${list(c.scopes || [], (s) => t("contract.scope." + s, locale2))}
    ${h3("summary.overall")}<p>${riskBadge(c.overallRisk, locale2)}</p>
    ${h3("summary.priorities")}${list(c.priorities)}
    <p class="disclaimer">${ICONS.info}<span>${esc(c.disclaimer || "")}</span></p>`;
  }
  SECTION_HTML.contract = (b, locale2) => `<p><b>${esc(t("summary.contractType", locale2))}</b>\uFF1A${esc(b.contractType || "")}\uFF08${(b.clauses || []).length}\uFF09</p><p>${esc(b.summary || "")}</p>`;
  SECTION_HTML.findings = (f, locale2) => findingsTable(f?.findings, locale2);
  var ISSUE_COLUMNS = ["no", "issue", "plaintiff", "plaintiffEvidence", "defendant", "defendantEvidence", "basis"];
  var CLAIM_COLUMNS = ["no", "basis", "claim"];
  var UNDISPUTED_COLUMNS = ["no", "fact", "evidence"];
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function renderOfficialTable(rows, columns, prefix, locale2) {
    const head = columns.map((c) => `<th scope="col">${esc(t(prefix + "." + c, locale2))}</th>`).join("");
    const body = rows.map((row) => `<tr>${columns.map((c) => `<td>${esc(row[c] || "")}</td>`).join("")}</tr>`).join("");
    const csv = [columns.map((c) => t(prefix + "." + c, locale2)), ...rows.map((row) => columns.map((c) => row[c] || ""))].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const href = "data:text/csv;charset=utf-8," + encodeURIComponent("\uFEFF" + csv);
    return `<div class="issue-toolbar"><h4 class="doc-section">${esc(t(prefix + ".title", locale2))}</h4><a class="doc-export" href="${href}" download="${esc(t(prefix + ".file", locale2))}">${ICONS.download || ""}${esc(t("doc.issue.export", locale2))}</a></div>
    <div class="issue-table-wrap"><table class="issue-table ${prefix.replace("doc.", "")}-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderDocumentTables(doc, locale2) {
    const parts = [];
    if (Array.isArray(doc.undisputed) && doc.undisputed.length) parts.push(renderOfficialTable(doc.undisputed, UNDISPUTED_COLUMNS, "doc.undisputed", locale2));
    if (Array.isArray(doc.claimsBasis) && doc.claimsBasis.length) parts.push(renderOfficialTable(doc.claimsBasis, CLAIM_COLUMNS, "doc.claims", locale2));
    if (Array.isArray(doc.issues) && doc.issues.length) parts.push(renderOfficialTable(doc.issues, ISSUE_COLUMNS, "doc.issue", locale2));
    return parts.join("");
  }
  function renderDocument(doc, locale2) {
    if (!doc) return `<p class="doc-missing">${ICONS.info}<span>${esc(t("doc.missing", locale2))}</span></p>`;
    const issueTable = renderDocumentTables(doc, locale2);
    const parties = (doc.parties || []).map((p) => `<tr><th scope="row">${esc(p.role)}</th><td>${esc(p.name)}</td></tr>`).join("");
    const paragraphs = (doc.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("");
    const attachments = (doc.attachments || []).length ? `<h4 class="doc-section">${esc(t("doc.attachments", locale2))}</h4><ol class="doc-attachments">${doc.attachments.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>` : "";
    return `<article class="legal-doc">
      <h3 class="doc-title">${esc(doc.title || "")}</h3>
      ${parties ? `<table class="doc-parties" aria-label="${esc(t("doc.parties", locale2))}"><tbody>${parties}</tbody></table>` : ""}
      <div class="doc-body">${paragraphs}</div>
      ${issueTable}
      ${attachments}
      <p class="doc-footer"><span class="doc-to">${esc(t("doc.to", locale2))} ${esc(doc.court || "")}</span><span class="doc-date">${esc(doc.date || "")}</span></p>
      <p class="disclaimer">${ICONS.info}<span>${esc(t("doc.disclaimer", locale2))}</span></p>
    </article>`;
  }
  function renderRevised(revised, locale2) {
    const items = revised?.items || [];
    if (!items.length) return `<p class="doc-missing">${ICONS.info}<span>${esc(t("doc.missing", locale2))}</span></p>`;
    const head = ["clauseNo", "original", "revised", "rationale"].map((k) => `<th scope="col">${esc(t(k === "clauseNo" ? "finding.clauseNo" : "revised." + k, locale2))}</th>`).join("");
    const rows = items.map(
      (i) => `<tr><td>${esc(i.clauseNo)}</td><td class="clause-text">${esc(i.original)}</td><td class="clause-text">${esc(i.revised)}</td><td>${esc(i.rationale)}</td></tr>`
    ).join("");
    return `<div class="table-wrap"><table class="assess-table revised-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div><p class="disclaimer">${ICONS.info}<span>${esc(t("doc.disclaimer", locale2))}</span></p>`;
  }
  function renderSections(result, locale2, mode = "case") {
    if (!result) return "";
    const keys = mode === "contract" ? ["contract", "research", "findings"] : ["brainstorm", "research", "analysis"];
    const present = keys.filter((k) => result[k]);
    if (!present.length) return "";
    const label = (k) => k === "contract" ? t("summary.contractType", locale2) : t("result.tab." + k, locale2);
    const blocks = present.map((k) => `<details class="partial" data-section="${k}" open>
      <summary>${esc(label(k))}</summary>${SECTION_HTML[k](result[k], locale2, result.assessment)}</details>`).join("");
    return `<section class="partials"><h2>${esc(t("progress.partial", locale2))}</h2>${blocks}</section>`;
  }
  function renderResult({ status, activeTab = "graph", outputs, mode = status?.mode || "case", riskFilter = "all" }, locale2) {
    const r = status.result || {};
    const TABS = tabsFor(outputs, !!r.assessment?.checklist?.length, mode, r);
    if (!TABS.includes(activeTab)) activeTab = TABS[0];
    const tabs = TABS.map((k) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${k === activeTab}" class="tab ${k === activeTab ? "active" : ""}" data-tab="${k}">${esc(tabLabel(k, locale2))}</button>`).join("");
    const panels = {
      graph: `<div class="graph-wrap">
        <div class="graph-side control-panel">
          <div class="section-title">${esc(t("graph.filter", locale2))}</div><div id="filter-box"></div>
          <div class="section-title">${esc(t("graph.family", locale2))}</div><div id="family-box"></div>
          <label class="field-label" for="search-input" hidden>${esc(t("graph.search", locale2))}</label>
          <input id="search-input" type="text" placeholder="${esc(t("graph.search", locale2))}" aria-label="${esc(t("graph.search", locale2))}">
        </div>
        <div id="network-canvas"></div>
        <aside class="detail-panel" id="detail-panel" aria-label="${esc(t("graph.detail.aria", locale2))}"><button class="close-btn" id="close-panel-btn" type="button" aria-label="${esc(t("graph.close", locale2))}">${ICONS.close}</button>
          <div class="detail-header"><span class="detail-tag" id="detail-tag"></span><h2 class="detail-title" id="detail-title"></h2></div>
          <div class="detail-body" id="detail-body"></div></aside></div>`,
      analysis: SECTION_HTML.analysis(r.analysis || {}, locale2, r.assessment),
      research: SECTION_HTML.research(r.research || {}, locale2),
      brainstorm: SECTION_HTML.brainstorm(r.brainstorm || {}, locale2),
      checklist: checklistTable(r.assessment?.checklist, locale2),
      findings: researchWarning(r.research, locale2) + findingsTable(r.compliance?.findings || r.findings?.findings, locale2, riskFilter) + findingsNotes(r.findings?.notes, locale2),
      summary: summaryPanel(r, locale2),
      laws: SECTION_HTML.research(r.research || {}, locale2)
    };
    for (const k of TABS) {
      if (k === "doc-revised") {
        panels[k] = renderRevised(r.revised, locale2);
        continue;
      }
      if (!k.startsWith("doc-")) continue;
      const type = k.slice(4);
      panels[k] = renderDocument((r.documents || []).find((d) => d.type === type), locale2);
    }
    return `<section class="result"><nav class="tabs"><div class="tablist" role="tablist" aria-label="${esc(t("result.tabs.aria", locale2))}">${tabs}</div><span class="gen">${esc(t("result.generatedIn", locale2))}: ${esc(status.locale)}</span>
    <button id="new-case" type="button">${ICONS.plus}${esc(t("result.newCase", locale2))}</button></nav>
    ${TABS.map((k) => `<div class="panel card" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}" data-panel="${k}" ${k === activeTab ? "" : "hidden"}>${panels[k]}</div>`).join("")}</section>`;
  }
  function bindResult(root, { onTab, onNewCase }) {
    const tabs = [...root.querySelectorAll(".tab")];
    tabs.forEach((b, i) => {
      b.addEventListener("click", () => onTab(b.dataset.tab));
      b.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        onTab(next.dataset.tab);
        root.querySelector(`#tab-${next.dataset.tab}`)?.focus();
      });
    });
    root.querySelector("#new-case").addEventListener("click", onNewCase);
  }

  // src/main/resources/static/js/views/home.js
  var CAP_ICONS = {
    case: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 21h14M12 6l-6 3 6-3 6 3-6-3"/><path d="M3 14a3 3 0 0 0 6 0L6 9l-3 5zM15 14a3 3 0 0 0 6 0l-3-5-3 5z"/></svg>',
    contract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 15.5l2 2 3.5-4"/></svg>'
  };
  function renderHome(locale2, { quota = null } = {}) {
    const card = (mode) => `<article class="capability card" data-mode="${mode}" tabindex="0" role="button" aria-label="${esc(t(`home.${mode}.title`, locale2))}">
      <span class="cap-icon" aria-hidden="true">${CAP_ICONS[mode]}</span>
      <h2>${esc(t(`home.${mode}.title`, locale2))}</h2>
      <p>${esc(t(`home.${mode}.desc`, locale2))}</p>
      <p class="cap-steps">${esc(t(`home.steps.${mode}`, locale2))}</p>
      <button type="button" class="primary" data-mode="${mode}" tabindex="-1">${esc(t("home.start", locale2))}${ICONS.arrowRight}</button>
    </article>`;
    return `<section class="home"><h2 class="home-title">${esc(t("home.title", locale2))}</h2><p class="home-lead">${esc(t("home.lead", locale2))}</p>
    <div class="capabilities">${card("case")}${card("contract")}</div>
    ${renderQuota(quota, locale2)}
    <p class="disclaimer">${ICONS.info}<span>${esc(t("disclaimer", locale2))}</span></p></section>`;
  }
  function bindHome(root, { onSelect }) {
    root.querySelectorAll(".capability").forEach((card) => {
      const go = () => onSelect(card.dataset.mode);
      card.addEventListener("click", go);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.target?.closest?.("button")) go();
      });
    });
  }

  // src/main/resources/static/js/router.js
  var MODES = Object.freeze(["case", "contract"]);
  function parseHash(hash) {
    const path = String(hash || "").replace(/^#\/?/, "");
    return MODES.includes(path) ? { view: "INPUT", mode: path } : { view: "HOME", mode: null };
  }
  function hashFor(state) {
    return state?.view !== "HOME" && MODES.includes(state?.mode) ? `#/${state.mode}` : "#/";
  }

  // src/main/resources/static/js/app.js
  function semanticAuthPath(status, locationLike = globalThis.location) {
    if (!status?.result?.research?.coverage?.authorizationRequired) return null;
    const search = locationLike?.search || "";
    if (new URLSearchParams(search).has("mcpAuth")) return null;
    const returnTo = `${locationLike?.pathname || "/"}${search}`;
    return `/api/auth/tw-legal-rag/start?returnTo=${encodeURIComponent(returnTo)}`;
  }
  function downloadText(text, filename, mime) {
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
  function createApp({ root, client, storage, navigatorLanguage, partialCollapseMs = 5e3, locationLike = globalThis.location }) {
    let state = { ...initialState };
    let locale2 = detectLocale(navigatorLanguage, storage.getItem("locale"));
    let samples = [];
    let stopPolling = null;
    let startRequestId = 0;
    let activeTab = "graph";
    let riskFilter = "all";
    const mode = () => state.mode || "case";
    let hashListenerBound = false;
    let selectedOutputs = ["graph"];
    let questionDraft = {};
    let questionFillNotice = null;
    let semanticAuth = null;
    let usage = null;
    let quota = null;
    const hadAuthCallback = consumeAuthCallbackQuery();
    let authRedirected = hadAuthCallback;
    async function refreshAuthStatus() {
      const usageReady = refreshUsage();
      if (typeof client?.authStatus === "function") {
        try {
          semanticAuth = await client.authStatus();
        } catch {
          semanticAuth = null;
        }
      }
      await usageReady;
      return semanticAuth;
    }
    async function refreshUsage() {
      [usage, quota] = await Promise.all([
        Promise.resolve().then(() => client?.usage?.()).catch(() => null),
        Promise.resolve().then(() => client?.quota?.()).catch(() => null)
      ]);
      return usage;
    }
    const listeners = /* @__PURE__ */ new Set();
    const stage = () => root.querySelector("#stage");
    function dispatch(event) {
      const nextState = reduce(state, event);
      if (nextState.view !== States.QUESTIONS) {
        questionDraft = {};
        questionFillNotice = null;
      } else if (event.type === "STATUS") {
        const ids = new Set((nextState.last?.questions || []).map((question) => question.id));
        questionDraft = Object.fromEntries(Object.entries(questionDraft).filter(([id]) => ids.has(id)));
      }
      state = nextState;
      const authPath = semanticAuthPath(nextState.last);
      if (!authRedirected && authPath && typeof globalThis.location?.assign === "function") {
        authRedirected = true;
        globalThis.location.assign(authPath);
      }
      const nextHash = hashFor(state);
      if (locationLike && (locationLike.hash || "#/") !== nextHash) locationLike.hash = nextHash;
      render2();
      listeners.forEach((l) => l(state, "STATE"));
    }
    function render2() {
      const el = stage();
      if (!el) return;
      clearTimeout(collapseTimer);
      root.querySelectorAll("[data-i18n]").forEach((n) => {
        n.textContent = t(n.dataset.i18n, locale2);
      });
      root.querySelectorAll("[data-i18n-aria]").forEach((n) => {
        n.setAttribute?.("aria-label", t(n.dataset.i18nAria, locale2));
      });
      switch (state.view) {
        case States.HOME:
          mount(el, renderHome(locale2, { quota }));
          bindHome(el, { onSelect: selectMode });
          break;
        case States.INPUT: {
          const typed = el.querySelector?.("#case-text")?.value ?? "";
          mount(el, renderInput({ samples, semanticAuth, usage, quota, mode: mode() }, locale2));
          bindInput(el, { onSubmit: start, onSample: startSample }, locale2, mode());
          if (typed) {
            const ta = el.querySelector("#case-text");
            if (ta) {
              ta.value = typed;
              ta.dispatchEvent?.(new globalThis.Event("input", { bubbles: true }));
            }
          }
          break;
        }
        case States.RUNNING:
          mount(el, renderProgress({ step: state.last?.step || firstStep(), mode: mode() }, locale2) + renderCancel(locale2) + renderSections(state.last?.result, locale2, mode()));
          bindCancel(el);
          break;
        case States.QUESTIONS:
          mount(el, renderProgress({ step: "QUESTIONS", busy: false, mode: mode() }, locale2) + renderCancel(locale2) + renderSections(state.last.result, locale2, mode()) + renderQuestions({ questions: state.last.questions, answers: questionDraft, notice: questionFillNotice }, locale2));
          bindQuestions(el, { onSubmit: answer });
          bindCancel(el);
          scheduleCollapse(el);
          break;
        case States.RESULT:
          mount(el, renderResult({ status: state.last, activeTab, outputs: selectedOutputs, mode: mode(), riskFilter }, locale2));
          bindResult(el, { onTab: (k) => {
            activeTab = k;
            render2();
          }, onNewCase: reset });
          el.querySelector("#findings-filter")?.querySelectorAll?.("button[data-risk]")?.forEach?.((b) => {
            b.addEventListener("click", () => {
              riskFilter = b.dataset.risk || "all";
              render2();
            });
          });
          el.querySelector("#findings-export")?.addEventListener("click", () => {
            const all = state.last?.result?.compliance?.findings || state.last?.result?.findings?.findings || [];
            const findings = riskFilter === "all" ? all : all.filter((f) => f.risk === riskFilter);
            downloadText(findingsCsv(findings, locale2), t("finding.file", locale2), "text/csv;charset=utf-8");
          });
          el.querySelector("#checklist-export")?.addEventListener("click", () => {
            const items = state.last?.result?.assessment?.checklist || [];
            downloadText(checklistCsv(items, locale2), t("checklist.file", locale2), "text/csv;charset=utf-8");
          });
          el.querySelector("#checklist-print")?.addEventListener("click", () => {
            const body = globalThis.document?.body;
            body?.classList.add("printing-checklist");
            const cleanup = () => body?.classList.remove("printing-checklist");
            try {
              globalThis.addEventListener?.("afterprint", cleanup, { once: true });
              globalThis.print?.();
            } finally {
              globalThis.setTimeout?.(cleanup, 2e3);
            }
          });
          listeners.forEach((l) => l(state, "RESULT_RENDERED"));
          break;
        case States.FAILED:
          mount(el, renderFailed(state.last?.error, locale2));
          el.querySelector("#retry").addEventListener("click", reset);
          break;
      }
    }
    let collapseTimer = null;
    function scheduleCollapse(el) {
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => {
        el.querySelectorAll(".partials details[open]").forEach((d) => {
          d.open = false;
        });
      }, partialCollapseMs);
    }
    function firstStep() {
      return mode() === "contract" ? "LOAD" : "BRAINSTORM";
    }
    async function selectMode(next) {
      dispatch({ type: "SELECT_MODE", mode: next });
      samples = await Promise.resolve().then(() => client.samples(locale2, mode())).catch(() => []);
      render2();
    }
    function goHome() {
      dispatch({ type: "GO_HOME" });
    }
    function bindCancel(el) {
      el.querySelector("#cancel-case")?.addEventListener("click", reset);
    }
    function renderFailed(error, loc) {
      return `<section class="failed card" role="alert"><h2>${ICONS.alert}${esc(t("failed.title", loc))}</h2>
      <p class="code">${esc(error?.code || "")} @ ${esc(error?.step || "")}</p><p>${esc(error?.message || "")}</p>
      ${error?.code === "DAILY_TOKEN_LIMIT" ? `<p class="alt">${esc(t("usage.exhausted.tip", loc))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t("usage.exhausted.action", loc))} \u2197</a></p>` : ""}
      ${error?.code === "DAILY_CASE_LIMIT" ? `<p class="alt">${esc(t("quota.reason", loc))} <a href="${LAW_POWERS_URL}" target="_blank" rel="noopener">${esc(t("usage.exhausted.action", loc))} \u2197</a></p>` : ""}
      <div class="actions"><button id="retry" type="button" class="primary">${ICONS.refresh}${esc(t("failed.retry", loc))}</button></div></section>`;
    }
    function beginPolling(caseId, { resumed = false } = {}) {
      if (stopPolling) stopPolling();
      stopPolling = client.poll(caseId, (s) => {
        if (resumed && s?.status === "FAILED" && s?.error?.code === "CASE_NOT_FOUND") {
          storage.removeItem("caseId");
          storage.removeItem("outputs");
          dispatch({ type: "RESET" });
          return;
        }
        dispatch({ type: "STATUS", status: s });
      });
    }
    async function start(text, outputs, files = [], motionRequest = "", extra = {}) {
      if ((!text || !text.trim()) && (!Array.isArray(files) || !files.length)) return null;
      const m = mode();
      selectedOutputs = normalizeOutputs(outputs, m);
      activeTab = m === "contract" ? "findings" : selectedOutputs.includes("graph") ? "graph" : "doc-" + selectedOutputs[0];
      const requestId = ++startRequestId;
      dispatch({ type: "START", caseId: null, mode: m });
      const payloadExtra = m === "contract" ? [{ mode: "contract", party: extra?.party || "unknown", scopes: extra?.scopes || [] }] : [];
      const documents = m === "contract" ? selectedOutputs : selectedOutputs.filter((o) => o !== "graph");
      let s;
      try {
        s = await client.start((text || "").trim(), locale2, documents, files, motionRequest, ...payloadExtra);
        refreshUsage().catch(() => {
        });
      } catch (error) {
        if (requestId === startRequestId) {
          dispatch({
            type: "STATUS",
            status: {
              status: "FAILED",
              step: m === "contract" ? "LOAD" : "BRAINSTORM",
              locale: locale2,
              error: { code: error.code || "START_FAILED", message: error.message || "Unable to start case." }
            }
          });
        }
        throw error;
      }
      if (requestId !== startRequestId) return null;
      storage.setItem("caseId", s.caseId);
      storage.setItem("outputs", JSON.stringify(selectedOutputs));
      storage.setItem("mode", m);
      dispatch({ type: "START", caseId: s.caseId, mode: m });
      beginPolling(s.caseId);
      return s;
    }
    async function startSample(id, outputs, extra = {}) {
      const value = String(id || "").trim();
      let smp = samples.find((x) => x.id === value || x.title === value);
      if (!smp && value) {
        const loaded = await client.samples(locale2, mode()).catch(() => []);
        if (loaded.length) samples = loaded;
        smp = samples.find((x) => x.id === value || x.title === value);
      }
      return smp ? start(smp.text, outputs, [], "", extra) : null;
    }
    async function answer(answers) {
      let s;
      try {
        s = await client.answer(state.caseId, answers);
      } catch (error) {
        dispatch({ type: "STATUS", status: {
          status: "FAILED",
          step: "QUESTIONS",
          locale: locale2,
          error: { code: error.code || "ANSWER_FAILED", message: error.message || "Unable to submit answers." }
        } });
        throw error;
      }
      dispatch({ type: "STATUS", status: s });
      beginPolling(state.caseId);
      return s;
    }
    function captureQuestionDraft() {
      root.querySelectorAll("#questions-form textarea").forEach((textarea) => {
        questionDraft[textarea.name] = textarea.value;
      });
    }
    function normalizeAnswerItems(answers) {
      let value = answers;
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          return null;
        }
      }
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object" && Array.isArray(value.answers)) return value.answers;
      if (value && typeof value === "object") {
        return Object.entries(value).map(([questionId, answer2]) => ({ questionId, answer: answer2 }));
      }
      return null;
    }
    function fillQuestions(answers) {
      if (state.view !== States.QUESTIONS) {
        return { ok: false, error: "QUESTIONS_NOT_VISIBLE", message: "Question fields are not visible on the page." };
      }
      const items = normalizeAnswerItems(answers);
      if (!items) {
        return { ok: false, error: "INVALID_ANSWERS", message: "answers must be an array of { questionId, answer }." };
      }
      captureQuestionDraft();
      const questions = state.last?.questions || [];
      const validIds = new Set(questions.map((question) => question.id));
      const seen = /* @__PURE__ */ new Set();
      const invalidQuestionIds = [];
      const emptyAnswerQuestionIds = [];
      const proposed = [];
      for (const item of items) {
        const id = String(item?.questionId || "").trim();
        if (!id || !validIds.has(id) || seen.has(id)) {
          if (id) invalidQuestionIds.push(id);
          continue;
        }
        seen.add(id);
        const answer2 = String(item?.answer ?? "");
        if (!answer2.trim()) {
          emptyAnswerQuestionIds.push(id);
          continue;
        }
        proposed.push({ id, answer: answer2 });
      }
      if (!proposed.length) {
        return {
          ok: false,
          submitted: false,
          error: "NO_ANSWERS_APPLIED",
          ...getQuestionProgress(),
          invalidQuestionIds,
          emptyAnswerQuestionIds,
          message: "No answer was applied. Use questionId from getQuestions and provide non-empty answer text."
        };
      }
      proposed.forEach(({ id, answer: answer2 }) => {
        questionDraft[id] = answer2;
      });
      render2();
      const appliedQuestionIds = proposed.filter(({ id, answer: answer2 }) => root.querySelector(`#questions-form textarea[name="${CSS.escape(id)}"]`)?.value === answer2).map(({ id }) => id);
      const failedQuestionIds = proposed.map(({ id }) => id).filter((id) => !appliedQuestionIds.includes(id));
      if (!appliedQuestionIds.length) {
        return {
          ok: false,
          submitted: false,
          error: "NO_ANSWERS_APPLIED",
          ...getQuestionProgress(),
          invalidQuestionIds,
          emptyAnswerQuestionIds,
          failedQuestionIds,
          message: "The answer was not found in the visible question fields; the page was not updated."
        };
      }
      questionFillNotice = locale2 === "zh-TW" ? `Agent \u5DF2\u5BE6\u969B\u586B\u5165 ${appliedQuestionIds.length} \u984C\uFF0C\u8ACB\u9010\u984C\u6AA2\u67E5\u5F8C\u518D\u6309\u300C\u7E7C\u7E8C\u300D\u3002` : `Agent filled ${appliedQuestionIds.length} visible question field(s). Review them before clicking Continue.`;
      render2();
      return {
        ok: failedQuestionIds.length === 0,
        submitted: false,
        humanReviewRequired: true,
        ...getQuestionProgress(),
        appliedQuestionIds,
        invalidQuestionIds,
        emptyAnswerQuestionIds,
        failedQuestionIds,
        message: failedQuestionIds.length ? "Some answers were filled into the visible form. The human must review them and submit the form." : "Answers were filled into the visible form. The human must review them and submit the form."
      };
    }
    function getQuestionProgress() {
      const questions = state.last?.questions || [];
      const missingQuestionIds = questions.filter((question) => !String(questionDraft[question.id] || "").trim()).map((question) => question.id);
      return {
        filledQuestionCount: questions.length - missingQuestionIds.length,
        questionCount: questions.length,
        missingQuestionIds
      };
    }
    function setOutputs(outputs) {
      if (state.view !== States.INPUT) {
        return { ok: false, error: "INPUT_NOT_VISIBLE", message: "Output checkboxes are only visible on the input page." };
      }
      const requested = Array.isArray(outputs) ? outputs : [];
      const valid = outputOptionsFor(mode());
      if (!requested.some((output) => valid.includes(output))) {
        return { ok: false, error: "INVALID_OUTPUTS", validOutputs: [...valid], message: "outputs must contain at least one valid option." };
      }
      const applied = normalizeOutputs(requested, mode());
      const boxes = [...root.querySelectorAll('input[name="outputs"]')];
      if (!boxes.length) {
        return { ok: false, error: "INPUT_NOT_VISIBLE", message: "Output checkboxes are not rendered yet." };
      }
      boxes.forEach((box) => {
        box.checked = applied.includes(box.value);
      });
      boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
      return {
        ok: true,
        submitted: false,
        humanReviewRequired: true,
        applied,
        message: "Outputs ticked on the visible form. The human must review and click Analyse, or call startCase with documents to start directly."
      };
    }
    function outputLabel(code) {
      return code === "graph" ? t("output.graph", locale2) : t("doc." + code, locale2);
    }
    function getOutputOptions() {
      const boxes = state.view === States.INPUT ? [...root.querySelectorAll('input[name="outputs"]')] : [];
      const checkedSet = new Set(boxes.length ? boxes.filter((box) => box.checked).map((box) => box.value) : selectedOutputs);
      const contract = mode() === "contract";
      const options = outputOptionsFor(mode()).map((code) => ({
        code,
        label: outputLabel(code),
        kind: code === "graph" ? "graph" : "document",
        checked: checkedSet.has(code),
        isDefault: !contract && code === "graph"
      }));
      return {
        ok: true,
        view: state.view,
        rendered: boxes.length > 0,
        count: options.length,
        checkedCount: options.filter((option) => option.checked).length,
        minRequired: contract ? 0 : 1,
        mode: mode(),
        options,
        nextAction: state.view === States.INPUT ? "Use setOutputSelection to tick outputs, or pass documents to startCase." : "Output checkboxes are only editable on the input page."
      };
    }
    function getInputForm() {
      if (state.view !== States.INPUT) {
        return { ok: false, error: "INPUT_NOT_VISIBLE", view: state.view, message: "The input form is only visible on the input page." };
      }
      const fullText = root.querySelector("#case-text")?.value ?? "";
      const CASE_TEXT_PREVIEW = 800;
      const submit = root.querySelector("#case-submit");
      return {
        ok: true,
        view: state.view,
        locale: locale2,
        caseText: fullText.slice(0, CASE_TEXT_PREVIEW),
        caseTextTruncated: fullText.length > CASE_TEXT_PREVIEW,
        charCount: fullText.trim().length,
        minChars: MIN_CHARS,
        canSubmit: Boolean(submit) && !submit.disabled,
        mode: mode(),
        // 合約模式專屬欄位：我方立場與審查範疇的目前勾選狀態
        contract: mode() === "contract" ? {
          party: root.querySelector('input[name="party"]:checked')?.value || "unknown",
          scopes: [...root.querySelectorAll('input[name="scopes"]:checked')].map((c) => c.value)
        } : void 0,
        outputs: getOutputOptions(),
        sampleCount: samples.length,
        samples: samples.map(({ id, title }) => ({ id, title }))
      };
    }
    function getResultTabs() {
      if (state.view !== States.RESULT) {
        return { ok: false, error: "RESULT_NOT_VISIBLE", view: state.view, message: "Result tabs are only visible after the case is completed." };
      }
      const result = state.last?.result || {};
      const tabs = tabsFor(selectedOutputs, !!result.assessment?.checklist?.length, mode(), result).map((id) => {
        const available = id === "graph" ? Boolean(result.graph) : id === "findings" ? Boolean(result.compliance?.findings?.length) : id === "summary" ? Boolean(result.compliance) : id === "laws" ? Boolean(result.research) : id.startsWith("doc-") ? (result.documents || []).some((document2) => document2.type === id.slice(4)) : Boolean(result[id]);
        return { id, label: tabLabel(id, locale2), active: id === activeTab, available };
      });
      return {
        ok: true,
        view: state.view,
        generatedLocale: state.last?.locale || locale2,
        mode: mode(),
        outputs: [...selectedOutputs],
        count: tabs.length,
        activeTab,
        tabs,
        nextAction: "Use getAnalysis with section brainstorm/research/analysis/documents, or getGraphSummary for the graph."
      };
    }
    async function reset() {
      startRequestId++;
      if (stopPolling) stopPolling();
      stopPolling = null;
      storage.removeItem("caseId");
      storage.removeItem("outputs");
      storage.removeItem("mode");
      activeTab = "graph";
      selectedOutputs = ["graph"];
      riskFilter = "all";
      authRedirected = false;
      await refreshAuthStatus();
      dispatch({ type: "RESET" });
    }
    async function setLocale2(code) {
      locale2 = code in DICT ? code : "en";
      storage.setItem("locale", locale2);
      samples = await client.samples(locale2, mode());
      const sel = root.querySelector("#lang-select");
      if (sel) sel.value = locale2;
      listeners.forEach((l) => l(state, "LOCALE"));
      render2();
    }
    async function mount2() {
      const sel = root.querySelector("#lang-select");
      if (sel) {
        sel.value = locale2;
        sel.addEventListener("change", () => setLocale2(sel.value));
      }
      const initial = parseHash(locationLike?.hash);
      bindHashChange();
      const saved = storage.getItem("caseId");
      const savedMode = saved ? storage.getItem("mode") || "case" : null;
      const [, loadedSamples] = await Promise.all([
        refreshAuthStatus(),
        Promise.resolve().then(() => client.samples(locale2, savedMode || initial.mode || "case")).catch(() => [])
      ]);
      samples = loadedSamples;
      if (saved) {
        try {
          selectedOutputs = normalizeOutputs(JSON.parse(storage.getItem("outputs")), savedMode);
        } catch {
          selectedOutputs = normalizeOutputs([], savedMode);
        }
        activeTab = savedMode === "contract" ? "findings" : selectedOutputs.includes("graph") ? "graph" : "doc-" + selectedOutputs[0];
        dispatch({ type: "START", caseId: saved, mode: savedMode });
        beginPolling(saved, { resumed: true });
      } else if (initial.view === "INPUT") {
        await selectMode(initial.mode);
      } else render2();
    }
    function bindHashChange() {
      if (hashListenerBound) return;
      hashListenerBound = true;
      globalThis.addEventListener?.("hashchange", () => {
        const parsed = parseHash(locationLike?.hash);
        if (state.view === States.HOME && parsed.view === "INPUT") return selectMode(parsed.mode);
        if (parsed.view === "HOME" && state.view !== States.HOME) return leaveToHome();
        if (state.view === States.INPUT && parsed.view === "INPUT" && parsed.mode !== mode()) return selectMode(parsed.mode);
        return void 0;
      });
    }
    function leaveToHome() {
      if (state.view === States.INPUT) {
        goHome();
        return Promise.resolve();
      }
      if (state.view === States.RUNNING || state.view === States.QUESTIONS) {
        if (stopPolling) {
          stopPolling();
          stopPolling = null;
        }
        if (globalThis.confirm?.(t("home.leaveConfirm", locale2)) === false) {
          if (locationLike) locationLike.hash = hashFor(state);
          if (state.caseId) beginPolling(state.caseId, { resumed: true });
          return Promise.resolve();
        }
      }
      return reset();
    }
    return {
      mount: mount2,
      dispatch,
      getState: () => state,
      getLocale: () => locale2,
      getSamples: () => samples,
      getAuthStatus: () => semanticAuth,
      refreshAuthStatus,
      getUsage: () => usage,
      refreshUsage,
      /** 呼叫端今日配額（含 loggedIn／memberLimit）與 REST client，供右上角登入區使用。 */
      getQuota: () => quota,
      client,
      setLocale: setLocale2,
      selectMode,
      goHome,
      getMode: mode,
      setRiskFilter: (r) => {
        riskFilter = r;
        render2();
      },
      start,
      startSample,
      answer,
      fillQuestions,
      getQuestionProgress,
      setOutputs,
      getOutputOptions,
      getInputForm,
      getResultTabs,
      reset,
      verify: (ref) => client.verify(ref),
      onChange: (l) => listeners.add(l)
    };
  }
  function consumeAuthCallbackQuery() {
    const location = globalThis.location;
    const params = new URLSearchParams(location?.search || "");
    if (!params.has("mcpAuth")) return false;
    params.delete("mcpAuth");
    if (typeof globalThis.history?.replaceState === "function") {
      const query = params.toString();
      const path = (location?.pathname || "/") + (query ? "?" + query : "") + (location?.hash || "");
      globalThis.history.replaceState(null, "", path);
    }
    return true;
  }

  // src/main/resources/static/js/caseClient.js
  function createCaseClient(fetchImpl = globalThis.fetch, base = "", { entryTimeoutMs = 8e3 } = {}) {
    async function call(path, init) {
      const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
      const res = await fetchImpl(base + path, { ...!isForm && { headers: { "Content-Type": "application/json" } }, ...init });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(body.message || String(res.status));
        e.status = res.status;
        e.code = body.error;
        throw e;
      }
      return body;
    }
    function entry(path) {
      return call(path, { signal: AbortSignal.timeout(entryTimeoutMs) });
    }
    return {
      /** 有附件時改用 multipart；無附件維持既有 JSON 契約與 WebMCP 相容性。extra.mode 有值時才附上 mode／party／scopes（合約模式）。 */
      start: (caseText, locale2, documents, files = [], motionRequest = "", extra = {}) => {
        const modeFields = extra.mode ? { mode: extra.mode, party: extra.party || "unknown", scopes: Array.isArray(extra.scopes) ? extra.scopes : [] } : {};
        if (Array.isArray(files) && files.length) {
          const form = new FormData();
          form.append("caseText", caseText || "");
          form.append("locale", locale2);
          if (motionRequest) form.append("motionRequest", motionRequest);
          if (modeFields.mode) {
            form.append("mode", modeFields.mode);
            form.append("party", modeFields.party);
            modeFields.scopes.forEach((s) => form.append("scopes", s));
          }
          (Array.isArray(documents) ? documents : []).forEach((document2) => form.append("documents", document2));
          files.forEach((file) => form.append("files", file, file.name));
          return call("/api/cases", { method: "POST", body: form });
        }
        return call("/api/cases", {
          method: "POST",
          body: JSON.stringify({
            caseText,
            locale: locale2,
            ...Array.isArray(documents) && documents.length ? { documents } : {},
            ...motionRequest ? { motionRequest } : {},
            ...modeFields
          })
        });
      },
      status: (id) => call(`/api/cases/${encodeURIComponent(id)}`),
      answer: (id, answers) => call(`/api/cases/${encodeURIComponent(id)}/answers`, { method: "POST", body: JSON.stringify({ answers }) }),
      /** 案例清單：mode 有值時附加查詢參數以取合約模式範例。 */
      samples: (locale2, mode) => entry(`/api/samples?locale=${encodeURIComponent(locale2)}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}`),
      verify: (ref) => call(`/api/laws/verify?ref=${encodeURIComponent(ref)}`),
      authStatus: () => entry("/api/auth/tw-legal-rag/status"),
      /** 今日 token 用量與是否停用。 */
      usage: () => entry("/api/usage"),
      /** 呼叫端今日案件配額（已用／上限／剩餘）。 */
      quota: () => entry("/api/quota"),
      /** 目前登入者（Google）；未登入 loggedIn=false。 */
      me: () => entry("/api/me"),
      /** 登出：Spring Security 的 POST /logout 會 302 回首頁，這裡只需送出請求。 */
      logout: () => fetchImpl(base + "/logout", { method: "POST", redirect: "manual" }),
      /**
       * 每 intervalMs 輪詢一次；COMPLETED／FAILED／WAITING 自動停（WAITING 由人工回答後以 answer 續接）；回傳 stop()。
       * 短暫的 5xx／網路錯誤（例如部署換容器的一分鐘）不立刻判失敗：改以 failureIntervalMs 重試，
       * 連續失敗達 maxFailures 才回 FAILED／NETWORK；404（案件不存在）則立即失敗。
       */
      poll(id, onStatus, intervalMs = 2e3, { maxFailures = 3, failureIntervalMs = 1e4 } = {}) {
        let stopped = false;
        let timer = null;
        let failures = 0;
        const tick = async () => {
          if (stopped) return;
          try {
            const s = await call(`/api/cases/${encodeURIComponent(id)}`);
            failures = 0;
            onStatus(s);
            if (s.status === "COMPLETED" || s.status === "FAILED" || s.status === "WAITING") {
              stopped = true;
              return;
            }
          } catch (e) {
            failures += 1;
            if (e.status !== 404 && failures < maxFailures) {
              timer = setTimeout(tick, failureIntervalMs);
              return;
            }
            onStatus({ status: "FAILED", error: { code: e.code || "NETWORK", message: e.message } });
            stopped = true;
            return;
          }
          timer = setTimeout(tick, intervalMs);
        };
        tick();
        return () => {
          stopped = true;
          clearTimeout(timer);
        };
      }
    };
  }

  // src/main/resources/static/js/graphView.js
  var graphView_exports = {};
  __export(graphView_exports, {
    LAYOUT: () => LAYOUT,
    explainEdge: () => explainEdge,
    filter: () => filter,
    findNode: () => findNode,
    focus: () => focus,
    groupName: () => groupName,
    isWebglAvailable: () => isWebglAvailable,
    isolatedGravity: () => isolatedGravity,
    neighborsOf: () => neighborsOf,
    render: () => render,
    setLocale: () => setLocale,
    summarize: () => summarize,
    summary: () => summary,
    toGraphData: () => toGraphData
  });
  var locale = "en";
  function setLocale(code) {
    locale = code === "zh-TW" ? "zh-TW" : "en";
  }
  function groupName(group, code = locale) {
    const v = t("graph.group." + group, code);
    return v === "graph.group." + group ? group : v;
  }
  function toGraphData(data) {
    const nodes = (data.nodes || []).map((n) => ({ ...n }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = (data.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ source: e.from, target: e.to, label: e.label, title: e.title, rel: e.rel }));
    return { nodes, links };
  }
  function findNode(nodes, idOrLabel) {
    if (!idOrLabel) return null;
    return nodes.find((n) => n.id === idOrLabel) || nodes.find((n) => (n.label || "").includes(idOrLabel)) || null;
  }
  var endId = (x) => x && typeof x === "object" ? x.id : x;
  function neighborsOf(links, nodeId) {
    const out = /* @__PURE__ */ new Set();
    links.forEach((l) => {
      if (endId(l.source) === nodeId) out.add(endId(l.target));
      if (endId(l.target) === nodeId) out.add(endId(l.source));
    });
    return [...out];
  }
  function summarize(data) {
    const nodeCounts = {};
    (data.nodes || []).forEach((n) => {
      nodeCounts[n.group] = (nodeCounts[n.group] || 0) + 1;
    });
    return {
      nodeCounts,
      edgeCounts: (data.edges || []).length,
      topIssues: (data.nodes || []).filter((n) => n.group === "issue").map((n) => n.label).slice(0, 10),
      unmetElements: (data.nodes || []).filter((n) => n.group === "element" && n.met !== "yes").map((n) => n.label)
    };
  }
  function isWebglAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }
  var COLORS = {
    fact: "#f97316",
    law: "#0ea5e9",
    issue: "#a855f7",
    party: "#a16207",
    plaintiff: "#0d9488",
    judgment: "#22c55e",
    good: "#22c55e",
    bad: "#ef4444",
    mixed: "#eab308",
    strong: "#22c55e",
    weak: "#ef4444",
    edgeDefault: "#94a3b8",
    appeal: "#3b82f6",
    minfu: "#d946ef",
    joint: "#10b981",
    defense: "#ef4444",
    preserve: "#eab308",
    lawrel_trigger: "#3b82f6",
    lawrel_alt: "#eab308",
    lawrel_absorb: "#a855f7",
    lawrel_lex: "#0d9488",
    lawrel_bridge: "#ef4444",
    contract: "#6366f1",
    clause: "#64748b",
    obligation: "#f43f5e",
    risk_high: "#ef4444",
    risk_medium: "#eab308",
    risk_low: "#22c55e",
    include: "#94a3b8",
    impose: "#a855f7",
    bear: "#f97316",
    claim: "#0d9488",
    consideration: "#eab308",
    breach: "#ef4444",
    element: "#64748b",
    met_yes: "#22c55e",
    met_no: "#ef4444",
    met_unknown: "#eab308",
    elemref: "#38bdf8"
  };
  function metColor(n) {
    return n.met === "yes" ? COLORS.met_yes : n.met === "no" ? COLORS.met_no : n.met === "unknown" ? COLORS.met_unknown : COLORS.element;
  }
  function riskColor(n) {
    return n.risk === "high" ? COLORS.risk_high : n.risk === "medium" ? COLORS.risk_medium : n.risk === "low" ? COLORS.risk_low : COLORS.clause;
  }
  function judgmentColor(n) {
    return n.status === "bad" ? COLORS.bad : n.status === "mixed" ? COLORS.mixed : COLORS.good;
  }
  function nodeObject(n) {
    let geo, color;
    switch (n.group) {
      case "fact":
        geo = new THREE.SphereGeometry(5);
        color = COLORS.fact;
        break;
      case "law":
        geo = new THREE.BoxGeometry(7, 7, 7);
        color = COLORS.law;
        break;
      case "judgment":
        geo = new THREE.SphereGeometry(5.5);
        color = judgmentColor(n);
        break;
      case "issue":
        geo = new THREE.OctahedronGeometry(5.5);
        color = COLORS.issue;
        break;
      case "party":
        geo = new THREE.OctahedronGeometry(5);
        color = COLORS.party;
        break;
      case "plaintiff":
        geo = new THREE.TetrahedronGeometry(5.5);
        color = COLORS.plaintiff;
        break;
      case "evidence":
        geo = new THREE.SphereGeometry(2.5);
        color = n.favorable === "strong" ? COLORS.strong : n.favorable === "weak" ? COLORS.weak : COLORS.edgeDefault;
        break;
      case "contract":
        geo = new THREE.DodecahedronGeometry(7);
        color = COLORS.contract;
        break;
      case "clause":
        geo = new THREE.BoxGeometry(5.5, 5.5, 5.5);
        color = riskColor(n);
        break;
      case "obligation": {
        const s = n.duty === "main" ? 1 : n.duty === "collateral" ? 0.8 : n.duty === "incidental" ? 0.65 : 0.8;
        geo = new THREE.CylinderGeometry(4 * s, 4 * s, 8 * s);
        color = COLORS.obligation;
        break;
      }
      case "element":
        geo = new THREE.IcosahedronGeometry(4);
        color = metColor(n);
        break;
      default:
        geo = new THREE.SphereGeometry(4);
        color = COLORS.edgeDefault;
    }
    const mat = new THREE.MeshLambertMaterial({ color });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, mat));
    if (n.overturned === true) {
      mat.color.set("#6b7280");
      group.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: "#ef4444", wireframe: true })));
    }
    const bigLabel = (text, y) => {
      const l = new SpriteText(text);
      l.color = "#ffffff";
      l.backgroundColor = "rgba(15,23,42,0.82)";
      l.textHeight = 7;
      l.padding = 2;
      l.position.set(0, y, 0);
      return l;
    };
    const smallLabel = (text, color2, height, y) => {
      const l = new SpriteText(text);
      l.color = color2;
      l.textHeight = height;
      l.position.set(0, y, 0);
      return l;
    };
    if (n.group === "judgment") group.add(bigLabel((n.label || "") + (n.overturned === true ? t("graph.overturned", locale) : ""), 12));
    else if (n.group === "contract") group.add(bigLabel(n.label || "", 13));
    else if (n.group === "law") group.add(smallLabel(n.label || "", LABEL_SUB, 3.4, 9));
    else if (n.group === "clause") group.add(smallLabel(n.label || "", n.risk ? riskColor(n) : LABEL_SUB, 3.4, 9));
    else if (n.group === "element") {
      const mark = n.met === "yes" ? "\u25CB " : n.met === "no" ? "\u2717 " : n.met === "unknown" ? "\u25B3 " : "";
      group.add(smallLabel(mark + (n.label || ""), n.met ? metColor(n) : LABEL_SUB, 3.2, 8));
    }
    return group;
  }
  function linkStyle(l) {
    switch (l.label) {
      case "\u4E0A\u8A34":
      case "\u4E0A\u8A34/\u767C\u56DE\u66F4\u5BE9":
        return { color: COLORS.appeal, width: 2.2, curve: 0, arrow: 3.5 };
      case "\u5211\u4E8B\u9644\u5E36\u6C11\u4E8B (\u6C11\u9644)":
      case "\u5211\u4E8B\u9644\u5E36\u6C11\u4E8B":
      case "\u6C11\u9644":
        return { color: COLORS.minfu, width: 1.6, curve: 0, arrow: 3.5 };
      case "\u9023\u5E36\u8CAC\u4EFB/\u4FDD\u8B49":
      case "\u9023\u5E36\u8CAC\u4EFB":
      case "\u9023\u5E36":
        return { color: COLORS.joint, width: 1.8, curve: 0, arrow: 0 };
      case "\u6297\u8FAF/\u963B\u65B7":
      case "\u6297\u8FAF":
        return { color: COLORS.defense, width: 1.6, curve: 0, arrow: 3.5 };
      case "\u4FDD\u5168/\u5047\u6263\u62BC":
      case "\u4FDD\u5168":
      case "\u5047\u6263\u62BC":
        return { color: COLORS.preserve, width: 1.4, curve: 0, arrow: 3.5 };
      case "\u6CD5\u689D\u95DC\u806F":
        return { color: COLORS["lawrel_" + (l.rel || "trigger")] || COLORS.appeal, width: 1.4, curve: 0.25, arrow: 3 };
      case "\u7576\u4E8B\u4EBA":
        return { color: COLORS.party, width: 1, curve: 0, arrow: 0 };
      case "\u8B49\u64DA":
        return { color: COLORS.edgeDefault, width: 0.8, curve: 0, arrow: 0 };
      case "\u5305\u542B":
        return { color: COLORS.include, width: 1.2, curve: 0, arrow: 3 };
      case "\u8AB2\u4E88":
        return { color: COLORS.impose, width: 1.4, curve: 0, arrow: 3 };
      case "\u8CA0\u64D4":
        return { color: COLORS.bear, width: 1.8, curve: 0, arrow: 3.5 };
      case "\u5F97\u8ACB\u6C42":
        return { color: COLORS.claim, width: 1.8, curve: 0, arrow: 3.5 };
      case "\u5C0D\u50F9":
        return { color: COLORS.consideration, width: 2, curve: 0.3, arrow: 0 };
      case "\u9055\u7D04\u6548\u679C":
        return { color: COLORS.breach, width: 1.6, curve: 0.15, arrow: 3.5 };
      case "\u8981\u4EF6":
        return { color: COLORS.law, width: 1.2, curve: 0, arrow: 3 };
      case "\u8A72\u7576":
        return { color: COLORS.edgeDefault, width: 1.6, curve: 0, arrow: 3.5 };
      case "\u8981\u4EF6\u8A8D\u5B9A":
        return { color: COLORS.elemref, width: 1.3, curve: 0.2, arrow: 3 };
      default:
        return { color: COLORS.edgeDefault, width: 1.2, curve: 0, arrow: 3 };
    }
  }
  function linkColorFn(l) {
    const target = typeof l.target === "object" ? l.target : null;
    if (l.label === "\u8B49\u64DA") return target ? target.favorable === "weak" ? COLORS.weak : target.favorable === "strong" ? COLORS.strong : COLORS.edgeDefault : COLORS.edgeDefault;
    if (l.label === "\u8A72\u7576") return target ? metColor(target) : COLORS.edgeDefault;
    if (l.label === "\u8981\u4EF6\u8A8D\u5B9A") return l.stance === "pro" ? COLORS.met_yes : l.stance === "con" ? COLORS.met_no : COLORS.elemref;
    return linkStyle(l).color;
  }
  var CANVAS_BG = "#f6f3ec";
  var LABEL_SUB = "#475569";
  var LINK_DISTANCE = { "\u8B49\u64DA": 26, "\u7576\u4E8B\u4EBA": 60, "\u5305\u542B": 45, "\u8AB2\u4E88": 40, "\u8CA0\u64D4": 55, "\u5F97\u8ACB\u6C42": 55, "\u8981\u4EF6": 40, "\u8A72\u7576": 55 };
  var LAYOUT = { chargeStrength: -55, chargeDistanceMax: 150, isolatedGravity: 0.06, warmupTicks: 60 };
  function isolatedGravity(strength = LAYOUT.isolatedGravity) {
    let nodes = [];
    let linked = /* @__PURE__ */ new Set();
    const force = (alpha) => {
      const k = strength * alpha;
      nodes.forEach((n) => {
        if (linked.has(n.id)) return;
        n.vx -= (n.x || 0) * k;
        n.vy -= (n.y || 0) * k;
        n.vz -= (n.z || 0) * k;
      });
    };
    force.initialize = (simNodes) => {
      nodes = simNodes;
    };
    force.links = (links = []) => {
      linked = /* @__PURE__ */ new Set();
      links.forEach((l) => {
        linked.add(endId(l.source));
        linked.add(endId(l.target));
      });
      return force;
    };
    return force;
  }
  var Graph = null;
  var current = null;
  var filterState = {};
  var activeFamily = null;
  var initialFitDone = false;
  var resizeObserver = null;
  var $ = (id) => document.getElementById(id);
  function badgeText(n) {
    if (n.statusText) return n.statusText;
    return ["good", "bad", "mixed"].includes(n.status) ? t("graph.status." + n.status, locale) : "";
  }
  function pill(text, color) {
    const b = document.createElement("div");
    b.textContent = text;
    b.style.cssText = "display:inline-block;padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:600;color:#fff;margin-bottom:6px;background:" + color + ";";
    return b;
  }
  function buildStatusBadge(n) {
    const text = badgeText(n);
    if (!text) return null;
    return pill(text, n.status === "good" ? COLORS.good : n.status === "bad" ? COLORS.bad : COLORS.mixed);
  }
  function buildRiskBadge(risk) {
    const map = { high: t("graph.risk.high", locale), medium: t("graph.risk.medium", locale), low: t("graph.risk.low", locale) };
    return map[risk] ? pill(map[risk], risk === "high" ? COLORS.risk_high : risk === "medium" ? COLORS.risk_medium : COLORS.risk_low) : null;
  }
  function buildMetBadge(met) {
    const map = { yes: t("graph.met.yes", locale), no: t("graph.met.no", locale), unknown: t("graph.met.unknown", locale) };
    return map[met] ? pill(map[met], met === "yes" ? COLORS.met_yes : met === "no" ? COLORS.met_no : COLORS.met_unknown) : null;
  }
  function dutyText(duty) {
    return ["main", "collateral", "incidental"].includes(duty) ? t("graph.duty." + duty, locale) : "";
  }
  function infoLine(text) {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = "font-size:0.85rem;color:var(--color-primary);margin-bottom:6px;";
    return d;
  }
  function evidenceText(e) {
    const generic = !e.label || e.label === "\u6709\u5229\u8B49\u64DA" || e.label === "\u4E0D\u5229\u8B49\u64DA";
    return generic ? e.description || e.title || "" : e.label;
  }
  function buildEvidenceList(n) {
    if (!Graph) return null;
    const evs = Graph.graphData().links.filter((l) => l.label === "\u8B49\u64DA" && endId(l.source) === n.id).map((l) => typeof l.target === "object" ? l.target : null).filter(Boolean);
    const sec = document.createElement("div");
    sec.style.cssText = "margin-top:16px;";
    const h = document.createElement("h3");
    h.textContent = t("graph.detail.evidence", locale);
    h.style.cssText = "font-size:0.95rem;color:var(--color-heading);margin-bottom:8px;";
    sec.appendChild(h);
    if (!evs.length) {
      const p = document.createElement("div");
      p.textContent = t("graph.detail.noEvidence", locale);
      p.style.cssText = "color:var(--text-sub);font-size:0.85rem;";
      sec.appendChild(p);
      return sec;
    }
    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;";
    evs.forEach((e) => {
      const strong = e.favorable === "strong";
      const li = document.createElement("li");
      li.style.cssText = "display:flex;gap:8px;font-size:0.85rem;line-height:1.5;color:var(--color-text);";
      const dot = document.createElement("span");
      dot.style.cssText = "flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:5px;background:" + (strong ? COLORS.strong : COLORS.weak) + ";";
      const txt = document.createElement("span");
      const lead = document.createElement("b");
      lead.textContent = t(strong ? "graph.detail.forDefendant" : "graph.detail.againstDefendant", locale);
      txt.appendChild(lead);
      txt.appendChild(document.createTextNode(evidenceText(e)));
      li.appendChild(dot);
      li.appendChild(txt);
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }
  function renderRichText(container, text) {
    container.style.cssText = "font-size:0.9rem;line-height:1.6;color:var(--color-text);white-space:pre-wrap;";
    const lines = String(text).split("\n");
    lines.forEach((line, i) => {
      line.split(/(\*\*[^*]+\*\*)/g).forEach((p) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) {
          const b = document.createElement("b");
          b.textContent = p.slice(2, -2);
          container.appendChild(b);
        } else if (p) container.appendChild(document.createTextNode(p));
      });
      if (i < lines.length - 1) container.appendChild(document.createElement("br"));
    });
  }
  function showDetail(n) {
    const panel = $("detail-panel"), tag = $("detail-tag"), title = $("detail-title"), body = $("detail-body");
    if (!panel || !tag || !title || !body) return;
    tag.textContent = (n.group || "").toUpperCase();
    tag.style.background = COLORS[n.group] || COLORS.edgeDefault;
    title.textContent = n.label || "";
    body.replaceChildren();
    const add = (el) => el && body.appendChild(el);
    if (n.group === "judgment") add(buildStatusBadge(n));
    if (n.group === "clause") add(buildRiskBadge(n.risk));
    if (n.group === "element") add(buildMetBadge(n.met));
    if (n.group === "obligation" && dutyText(n.duty)) add(infoLine(t("graph.detail.dutyType", locale) + dutyText(n.duty)));
    if (n.group === "party" && n.role) add(infoLine(t("graph.detail.role", locale) + n.role));
    const bodyText = n.description || n.title || "";
    if (bodyText) {
      const el = document.createElement("div");
      renderRichText(el, bodyText);
      add(el);
    }
    if (n.group === "judgment") add(buildEvidenceList(n));
    if (n.url) {
      const link = document.createElement("a");
      link.href = n.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = t("graph.detail.fullText", locale);
      link.style.cssText = "display:inline-block;margin-top:12px;min-height:44px;line-height:44px;color:var(--color-primary);font-weight:600;text-decoration:none;";
      add(link);
    }
    panel.classList.add("active");
  }
  function hideDetail() {
    $("detail-panel")?.classList.remove("active");
  }
  function nodeVis(n) {
    return filterState[n.group] !== false;
  }
  function linkVis(l) {
    const s = typeof l.source === "object" ? l.source : null, t2 = typeof l.target === "object" ? l.target : null;
    return (!s || filterState[s.group] !== false) && (!t2 || filterState[t2.group] !== false);
  }
  function buildFilters(nodes) {
    const box = $("filter-box");
    if (!box) return;
    box.replaceChildren();
    filterState = {};
    [...new Set(nodes.map((n) => n.group))].forEach((g) => {
      filterState[g] = true;
      const lb = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.group = g;
      cb.addEventListener("change", () => {
        filterState[g] = cb.checked;
        Graph.nodeVisibility(nodeVis).linkVisibility(linkVis);
      });
      lb.appendChild(cb);
      lb.appendChild(document.createTextNode(" " + groupName(g)));
      box.appendChild(lb);
    });
    if (nodes.some((n) => n.group === "clause")) {
      const legend = document.createElement("div");
      legend.className = "legend-risks";
      ["high", "medium", "low"].forEach((r) => {
        const span = document.createElement("span");
        span.className = "legend-risk risk-" + r;
        span.textContent = t("graph.risk." + r, locale);
        legend.appendChild(span);
      });
      box.appendChild(legend);
    }
    Graph.nodeVisibility(nodeVis).linkVisibility(linkVis);
  }
  function syncFilterCheckboxes() {
    document.querySelectorAll("#filter-box input[type=checkbox]").forEach((cb) => {
      cb.checked = filterState[cb.dataset.group] !== false;
    });
  }
  function buildFamilyFocus(nodes) {
    const box = $("family-box");
    if (!box) return;
    box.replaceChildren();
    const fams = [...new Set(nodes.map((n) => n.family).filter(Boolean))];
    if (!fams.length) {
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    fams.forEach((f) => {
      const chip = document.createElement("span");
      chip.textContent = f;
      chip.style.cssText = "display:inline-block;font-size:0.8rem;padding:6px 12px;margin:2px;border:1px solid var(--color-border);border-radius:999px;cursor:pointer;color:var(--color-text-sub);background:var(--color-surface);";
      chip.setAttribute("role", "button");
      chip.tabIndex = 0;
      chip.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          chip.click();
        }
      });
      chip.addEventListener("click", () => {
        activeFamily = activeFamily === f ? null : f;
        applyFamilyFocus();
      });
      box.appendChild(chip);
    });
  }
  function applyFamilyFocus() {
    if (!Graph) return;
    Graph.nodeThreeObject((n) => {
      const obj = nodeObject(n);
      const inFam = !activeFamily || n.family === activeFamily;
      obj.traverse((o) => {
        if (o.material) {
          o.material.transparent = true;
          o.material.opacity = inFam ? 1 : 0.12;
        }
      });
      return obj;
    });
  }
  function bindSearch() {
    const input = $("search-input");
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const kw = e.target.value.trim();
      if (kw) focus(kw);
    });
  }
  function showCanvasError(title, tips) {
    const el = $("network-canvas");
    if (!el) return;
    el.replaceChildren();
    const box = document.createElement("div");
    box.style.cssText = "max-width:560px;margin:80px auto;padding:24px 28px;background:var(--color-bad-soft);border:1px solid var(--color-bad);border-radius:12px;color:var(--color-text);font-size:0.95rem;line-height:1.8;";
    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-size:1.1rem;font-weight:700;margin-bottom:10px;color:var(--color-bad);";
    box.appendChild(h);
    const ul = document.createElement("ul");
    ul.style.cssText = "padding-left:1.2em;margin:0;";
    tips.forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      ul.appendChild(li);
    });
    box.appendChild(ul);
    el.appendChild(box);
  }
  function render(data) {
    current = data;
    const el = $("network-canvas");
    if (!el) return null;
    el.replaceChildren();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (!isWebglAvailable()) {
      showCanvasError("WebGL is not available in this browser", [
        "Open the page in Chrome/Edge/Firefox with hardware acceleration enabled.",
        "Remote desktops and IDE preview browsers often disable WebGL."
      ]);
      Graph = null;
      return null;
    }
    initialFitDone = false;
    activeFamily = null;
    Graph = ForceGraph3D()(el).backgroundColor(CANVAS_BG).graphData(toGraphData(data)).nodeThreeObject(nodeObject).nodeThreeObjectExtend(false).linkColor(linkColorFn).linkWidth((l) => linkStyle(l).width).linkCurvature((l) => linkStyle(l).curve).linkDirectionalArrowLength((l) => linkStyle(l).arrow).linkDirectionalArrowRelPos(1).linkOpacity(0.6).warmupTicks(LAYOUT.warmupTicks).onEngineStop(() => {
      if (!initialFitDone) {
        initialFitDone = true;
        Graph.zoomToFit(600, 60);
      }
    });
    Graph.d3Force("charge").strength(LAYOUT.chargeStrength).distanceMax(LAYOUT.chargeDistanceMax);
    Graph.d3Force("link").distance((l) => LINK_DISTANCE[l.label] ?? 80);
    const gathered = Graph.graphData();
    Graph.d3Force("isolatedGravity", isolatedGravity());
    Graph.d3Force("isolatedGravity").links(gathered.links);
    let reheated = false;
    const renderedGraph = Graph;
    renderedGraph.onEngineTick(() => {
      if (reheated) return;
      reheated = true;
      renderedGraph.d3ReheatSimulation();
    });
    const syncSize = () => Graph.width(el.clientWidth).height(el.clientHeight);
    syncSize();
    resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(el);
    Graph.onNodeClick((n) => showDetail(n));
    Graph.onNodeHover((n) => {
      const c = el.querySelector("canvas");
      if (c) c.style.cursor = n ? "pointer" : "grab";
    });
    $("close-panel-btn")?.addEventListener("click", hideDetail);
    buildFilters(Graph.graphData().nodes);
    buildFamilyFocus(Graph.graphData().nodes);
    bindSearch();
    return Graph;
  }
  var strip = ({ x, y, z, vx, vy, vz, fx, fy, fz, __threeObj, ...rest }) => rest;
  function focus(idOrLabel) {
    if (!Graph) return null;
    const { nodes, links } = Graph.graphData();
    const hit = findNode(nodes, idOrLabel);
    if (!hit) return null;
    const dist = 60, x = hit.x || 0, y = hit.y || 0, z = hit.z || 0, r = Math.hypot(x, y, z) || 1;
    Graph.cameraPosition({ x: x * (1 + dist / r), y: y * (1 + dist / r), z: z * (1 + dist / r) }, hit, 1200);
    showDetail(hit);
    return { node: strip(hit), neighbors: neighborsOf(links, hit.id).map((id) => strip(nodes.find((n) => n.id === id))) };
  }
  function filter({ groups, family, reset } = {}) {
    if (!Graph) return null;
    const { nodes, links } = Graph.graphData();
    if (reset) {
      Object.keys(filterState).forEach((g) => {
        filterState[g] = true;
      });
      activeFamily = null;
    }
    if (Array.isArray(groups)) Object.keys(filterState).forEach((g) => {
      filterState[g] = groups.includes(g);
    });
    if (family !== void 0) activeFamily = family;
    Graph.nodeVisibility(nodeVis).linkVisibility(linkVis);
    applyFamilyFocus();
    syncFilterCheckboxes();
    return { visibleNodes: nodes.filter(nodeVis).length, visibleEdges: links.filter(linkVis).length };
  }
  function explainEdge(sourceId, targetId) {
    if (!Graph) return null;
    const l = Graph.graphData().links.find((k) => endId(k.source) === sourceId && endId(k.target) === targetId);
    if (!l) return null;
    const { nodes } = Graph.graphData();
    const labelOf = (end) => typeof end === "object" ? end.label : nodes.find((n) => n.id === end)?.label;
    return { label: l.label, rel: l.rel, title: l.title, sourceLabel: labelOf(l.source), targetLabel: labelOf(l.target) };
  }
  function summary() {
    return current ? summarize(current) : null;
  }

  // src/main/resources/static/js/webmcp.js
  var S = (props, required = []) => ({ type: "object", properties: props, required, additionalProperties: false });
  var LOCALE = { type: "string", enum: ["en", "zh-TW"], description: "Output language" };
  var TOOL_DEFS = [
    {
      name: "listSampleCases",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "List the built-in fictional sample disputes that can be analysed with startCase.",
      inputSchema: S({ locale: LOCALE })
    },
    {
      name: "startCase",
      phase: "base",
      annotations: {},
      description: "Start one Taiwan legal dispute from caseText or a sampleId. Only use when the page is in INPUT; never replace an active case.",
      inputSchema: S({
        caseText: { type: "string", minLength: 20 },
        sampleId: { type: "string", description: "Exact id or title returned by listSampleCases, e.g. car-accident." },
        motionRequest: { type: "string", description: "Only with documents containing motion: what the court is asked to grant, e.g. \u8072\u8ACB\u8ABF\u67E5\u8B49\u64DA." },
        locale: LOCALE,
        documents: { type: "array", description: "Litigation documents to draft besides the graph, e.g. complaint (\u8D77\u8A34\u72C0), defense (\u7B54\u8FAF\u72C0).", items: { type: "string", enum: [...DOC_TYPES] } }
      })
    },
    {
      name: "setOutputSelection",
      phase: "base",
      annotations: {},
      description: 'Tick the "outputs to generate" checkboxes on the input form (graph and Taiwan pleading types). Does not start the case.',
      inputSchema: S({ outputs: { type: "array", minItems: 1, description: "Outputs to tick; unlisted ones are unticked.", items: { type: "string", enum: ["graph", ...DOC_TYPES] } } }, ["outputs"])
    },
    {
      name: "getOutputOptions",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: 'List the "outputs to generate" checkboxes shown on the input form: count, code, label, and which are ticked.',
      inputSchema: S({})
    },
    {
      name: "getInputForm",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Read everything shown on the input page: typed case text, character count, minimum, submit state, output checkboxes and sample count.",
      inputSchema: S({})
    },
    {
      name: "getResultTabs",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "List the tabs shown on the result page (graph, drafted documents, analysis, research, brainstorm), which is active and which have content.",
      inputSchema: S({})
    },
    {
      name: "getCaseStatus",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Read the current page case state. WAITING means the human must answer visible questions; call getQuestions before filling.",
      inputSchema: S({})
    },
    {
      name: "getQuestions",
      phase: "questions",
      annotations: { readOnlyHint: true },
      description: "List each visible question with its questionId and the exact fillQuestions answer format. Call before filling.",
      inputSchema: S({})
    },
    {
      name: "fillQuestions",
      phase: "questions",
      annotations: {},
      description: "Fill proposed answers into visible fields using questionId from getQuestions. Does not submit; a human must review and click Continue.",
      inputSchema: S({ answers: { type: "array", description: "One item per visible question; use questionId returned by getQuestions.", items: S({ questionId: { type: "string", description: "The exact questionId returned by getQuestions, such as q1." }, answer: { type: "string", description: "Proposed answer text for that question." } }, ["questionId", "answer"]) } }, ["answers"])
    },
    {
      name: "verifyCitation",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Check whether a Taiwan statute article or judgment citation exists in official databases.",
      inputSchema: S({ ref: { type: "string", description: "e.g. \u6C11\u6CD5\u7B2C184\u689D or \u6700\u9AD8\u6CD5\u9662108\u5E74\u5EA6\u53F0\u4E0A\u5B57\u7B2C2345\u865F" } }, ["ref"])
    },
    {
      name: "resetCase",
      phase: "base",
      annotations: {},
      description: "Discard the current case and return to input. Use only after the human explicitly asks to abandon it; never replace a WAITING case automatically.",
      inputSchema: S({})
    },
    {
      name: "getAnalysis",
      phase: "completed",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: "Return one section of the completed analysis: brainstorm, research or analysis. Long output is summarised.",
      inputSchema: S({ section: { type: "string", enum: ["brainstorm", "research", "analysis", "documents"] } }, ["section"])
    },
    {
      name: "getGraphSummary",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "Counts by node group, edge count, main issues and elements not yet satisfied.",
      inputSchema: S({})
    },
    {
      name: "focusNode",
      phase: "completed",
      annotations: {},
      description: "Fly the 3D camera to a node (by id or label text), open its detail panel and return its neighbours.",
      inputSchema: S({ nodeId: { type: "string" }, label: { type: "string" } })
    },
    {
      name: "filterGraph",
      phase: "completed",
      annotations: {},
      description: "Show only some node groups (fact, law, judgment, issue, element, ...) or one case family; reset restores all.",
      inputSchema: S({ groups: { type: "array", items: { type: "string" } }, family: { type: "string" }, reset: { type: "boolean" } })
    },
    {
      name: "explainEdge",
      phase: "completed",
      annotations: { readOnlyHint: true },
      description: "Explain the relationship on the edge between two node ids (label, relation type, note).",
      inputSchema: S({ sourceId: { type: "string" }, targetId: { type: "string" } }, ["sourceId", "targetId"])
    },
    {
      name: "listCapabilities",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "List what this page can do: case analysis and contract compliance review, their steps and start tools, plus the capability now open.",
      inputSchema: S({})
    },
    {
      name: "selectCapability",
      phase: "base",
      annotations: {},
      description: "Open one capability on this page: case analysis or contract compliance review. Does not start work; use the matching start tool next.",
      inputSchema: S({ mode: { type: "string", enum: ["case", "contract"], description: "case = dispute analysis; contract = compliance review." } }, ["mode"])
    },
    {
      name: "startContractReview",
      phase: "base",
      annotations: {},
      description: "Start one contract compliance review from contractText or a sampleId. Only use when no case is active; never replace an active case.",
      inputSchema: S({
        contractText: { type: "string", minLength: 20, description: "Full contract text to review." },
        sampleId: { type: "string", description: "Exact id or title returned by listSampleCases in contract mode." },
        party: { type: "string", enum: ["partyA", "partyB", "unknown"], description: "Which side the review speaks for." },
        scopes: { type: "array", description: "Review scopes; empty lets the reviewer decide.", items: { type: "string", enum: [...CONTRACT_SCOPES] } },
        outputs: { type: "array", description: "Extra outputs besides the report.", items: { type: "string", enum: ["revised"] } },
        locale: LOCALE
      })
    },
    {
      name: "getComplianceReport",
      phase: "completed",
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: "Return the completed compliance report: overall risk and findings, optionally filtered to one risk level. Long output is summarised.",
      inputSchema: S({ risk: { type: "string", enum: ["all", "high", "medium", "low"], description: "Risk level to keep; all keeps every finding." } })
    },
    {
      name: "filterFindingsByRisk",
      phase: "completed",
      annotations: {},
      description: "Filter the visible compliance findings list on the result page by risk level.",
      inputSchema: S({ risk: { type: "string", enum: ["all", "high", "medium", "low"] } }, ["risk"])
    },
    {
      name: "getUsageStats",
      phase: "base",
      annotations: { readOnlyHint: true },
      description: "Read this page usage statistics for the last N days. Not available yet in this release.",
      inputSchema: S({ days: { type: "integer", minimum: 1, maximum: 90, description: "How many days back to summarise." } })
    }
  ];
  var TOOL_NAMES_BY_VIEW = Object.freeze({
    HOME: Object.freeze(["listCapabilities", "selectCapability", "startCase", "startContractReview", "listSampleCases", "verifyCitation", "getUsageStats"]),
    INPUT: Object.freeze(["listSampleCases", "startCase", "setOutputSelection", "getOutputOptions", "getInputForm", "verifyCitation", "listCapabilities", "selectCapability", "startContractReview", "getUsageStats"]),
    RUNNING: Object.freeze(["getCaseStatus", "resetCase"]),
    QUESTIONS: Object.freeze(["getCaseStatus", "getQuestions", "fillQuestions", "resetCase"]),
    RESULT: Object.freeze(["getCaseStatus", "getResultTabs", "getAnalysis", "getGraphSummary", "focusNode", "filterGraph", "explainEdge", "verifyCitation", "resetCase", "getComplianceReport", "filterFindingsByRisk", "getUsageStats"]),
    FAILED: Object.freeze(["getCaseStatus", "resetCase"])
  });
  function truncate(obj, max = 1500) {
    const s = JSON.stringify(obj);
    if (s.length <= max) return obj;
    return { truncated: true, summary: s.slice(0, max - 120) + "\u2026", hint: "Use a narrower section or focusNode for details." };
  }
  function resolveModelContext(runtime = globalThis) {
    return runtime.document?.modelContext ?? runtime.navigator?.modelContext;
  }
  function watchModelContext(runtime, onFound, { intervalMs = 500, timeoutMs = 2e4 } = {}) {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const mc = resolveModelContext(runtime);
      if (mc) {
        clearInterval(timer);
        onFound(mc);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }
  function createWebMcp({ app: app2, graphView, modelContext, ready = Promise.resolve() }) {
    let hostContext = modelContext;
    let controller = null;
    const registered = /* @__PURE__ */ new Set();
    let activeView = null;
    function normalizeInput(input) {
      if (!input) return {};
      let value = input;
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          return {};
        }
      }
      if (value && typeof value === "object" && value.arguments !== void 0) return normalizeInput(value.arguments);
      return value;
    }
    function currentView() {
      return app2.getState?.()?.view || activeView || "INPUT";
    }
    function isToolAvailable(name, view = currentView()) {
      return (TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT).includes(name);
    }
    function pageStatus() {
      const page = app2.getState?.() || {};
      const last = page.last || {};
      const status = last.status || ({ HOME: "NONE", INPUT: "NONE", RUNNING: "RUNNING", QUESTIONS: "WAITING", RESULT: "COMPLETED", FAILED: "FAILED" }[page.view] || "NONE");
      const waiting = status === "WAITING" || page.view === "QUESTIONS";
      const active = status !== "NONE";
      const questionProgress = app2.getQuestionProgress?.() || { filledQuestionCount: 0, questionCount: 0, missingQuestionIds: [] };
      const allQuestionsFilled = waiting && questionProgress.questionCount > 0 && questionProgress.missingQuestionIds.length === 0;
      return {
        caseId: last.caseId || page.caseId || null,
        status,
        step: last.step || (status === "RUNNING" ? "BRAINSTORM" : status === "WAITING" ? "QUESTIONS" : null),
        locale: last.locale || app2.getLocale?.(),
        view: page.view || "INPUT",
        // 目前開啟的能力（case／contract），HOME 尚未選擇時為 null
        mode: app2.getMode?.() || null,
        humanActionRequired: waiting,
        questionCount: questionProgress.questionCount || (Array.isArray(last.questions) ? last.questions.length : 0),
        filledQuestionCount: questionProgress.filledQuestionCount || 0,
        missingQuestionIds: questionProgress.missingQuestionIds || [],
        nextAction: waiting ? allQuestionsFilled ? "Answers are filled in the visible fields. Ask the human to review and click Continue. Do not call startCase or submit another case." : "Ask the human for answers, or use fillQuestions to place proposed answers in the visible fields. The human must review and submit; do not call startCase or submit another case." : active ? status === "RUNNING" ? "Poll getCaseStatus until WAITING, COMPLETED, or FAILED. Do not call startCase while this case is active." : status === "COMPLETED" ? "Use getAnalysis or graph tools for this completed case." : "Show the failure and wait for the human before retrying or resetting." : (page.view || "INPUT") === "HOME" ? "Call listCapabilities, then selectCapability or a start tool." : "Call startCase with caseText or sampleId to begin one case."
      };
    }
    function questionGuide() {
      const page = app2.getState?.() || {};
      const last = page.last || {};
      const questions = Array.isArray(last.questions) ? last.questions : [];
      const progress = app2.getQuestionProgress?.() || { missingQuestionIds: [] };
      const missing = new Set(progress.missingQuestionIds || []);
      return {
        view: page.view || "INPUT",
        status: last.status || null,
        questions: questions.map((question) => ({
          questionId: question.id,
          question: question.text,
          why: question.why,
          filled: !missing.has(question.id)
        })),
        fillQuestionsExample: {
          answers: questions.map((question) => ({ questionId: question.id, answer: "" }))
        },
        nextAction: "Use fillQuestions with the questionId values above. Filling only updates the visible fields; a human must review and click Continue."
      };
    }
    function unavailable(name) {
      const current2 = pageStatus();
      return {
        ok: false,
        error: "TOOL_UNAVAILABLE",
        message: `${name} is not available in page state ${current2.view}. Use only the tools currently exposed by this page.`,
        current: current2,
        nextAction: current2.nextAction
      };
    }
    const exec = {
      listSampleCases: async ({ locale: locale2 }) => {
        if (locale2 && locale2 !== app2.getLocale()) await app2.setLocale(locale2);
        return app2.getSamples().map(({ id, title, summary: summary2 }) => ({ id, title, summary: summary2 }));
      },
      startCase: async ({ caseText, sampleId, locale: locale2, documents, motionRequest }) => {
        if (app2.getMode?.() === "contract" && currentView() === "INPUT") {
          return { ok: false, error: "WRONG_CAPABILITY", message: 'The contract review form is open. Use startContractReview, or selectCapability("case") first.' };
        }
        if (!["HOME", "INPUT"].includes(currentView())) {
          const current2 = pageStatus();
          return {
            ok: false,
            error: "CASE_IN_PROGRESS",
            message: "A case is already active on this page. Keep the current case; do not send another sample.",
            current: current2,
            nextAction: current2.nextAction
          };
        }
        if (locale2 && locale2 !== app2.getLocale()) await app2.setLocale(locale2);
        if (app2.getMode?.() !== "case" && currentView() === "HOME") await app2.selectMode?.("case");
        const outputs = ["graph", ...Array.isArray(documents) ? documents : []];
        const s = sampleId ? await app2.startSample(sampleId, outputs) : await app2.start(caseText, outputs, [], motionRequest || "");
        if (!s) return { ok: false, error: "Unknown sampleId or empty caseText." };
        return {
          ok: true,
          caseId: s.caseId,
          status: s.status,
          step: s.step,
          nextAction: "Poll getCaseStatus. If it returns WAITING, ask the human to answer the visible questions; do not start another case."
        };
      },
      setOutputSelection: async ({ outputs } = {}) => {
        if (!isToolAvailable("setOutputSelection")) return unavailable("setOutputSelection");
        return app2.setOutputs(outputs);
      },
      getOutputOptions: async () => {
        if (!isToolAvailable("getOutputOptions")) return unavailable("getOutputOptions");
        return app2.getOutputOptions();
      },
      getInputForm: async () => {
        if (!isToolAvailable("getInputForm")) return unavailable("getInputForm");
        return app2.getInputForm();
      },
      getResultTabs: async () => {
        if (!isToolAvailable("getResultTabs")) return unavailable("getResultTabs");
        return app2.getResultTabs();
      },
      getCaseStatus: async () => {
        const page = app2.getState?.() || {};
        const last = page.last;
        if (!last) return pageStatus();
        const { result, ...rest } = last;
        const sections = result ? ["brainstorm", "research", "analysis", "documents", "graph"].filter((k) => result[k]) : [];
        return truncate({
          ...rest,
          ...pageStatus(),
          hasResult: Boolean(result),
          sections,
          questions: rest.questions
        });
      },
      getQuestions: async () => {
        if (!isToolAvailable("getQuestions")) return unavailable("getQuestions");
        return truncate(questionGuide());
      },
      fillQuestions: async (input = {}) => app2.fillQuestions(input.answers),
      verifyCitation: async ({ ref }) => truncate(await app2.verify(ref)),
      resetCase: async () => {
        app2.reset();
        return { ok: true };
      },
      getAnalysis: async ({ section }) => truncate(app2.getState().last?.result?.[section] ?? { error: "not completed" }),
      getGraphSummary: async () => truncate(graphView.summary() ?? { error: "graph not rendered" }),
      focusNode: async ({ nodeId, label }) => truncate(graphView.focus(nodeId || label) ?? { error: "node not found" }),
      filterGraph: async (args) => graphView.filter(args) ?? { error: "graph not rendered" },
      explainEdge: async ({ sourceId, targetId }) => graphView.explainEdge(sourceId, targetId) ?? { error: "edge not found" },
      /** 列出本頁兩種能力、各自流程步驟與啟動工具，以及目前開啟的能力。 */
      listCapabilities: async () => ({
        ok: true,
        view: currentView(),
        current: app2.getMode?.() || null,
        capabilities: [
          { mode: "case", title: "Case analysis", steps: ["BRAINSTORM", "QUESTIONS", "RESEARCH", "ANALYSIS", "ASSESSMENT", "DOCUMENTS", "GRAPH"], startTool: "startCase" },
          { mode: "contract", title: "Contract compliance review", steps: ["LOAD", "QUESTIONS", "RESEARCH", "REVIEW", "SUMMARY", "REVISE", "GRAPH"], startTool: "startContractReview" }
        ],
        nextAction: "Call selectCapability to open a capability, or its start tool directly."
      }),
      /** 開啟指定能力（只在 HOME／INPUT 可用）。 */
      selectCapability: async ({ mode }) => {
        if (!["HOME", "INPUT"].includes(currentView())) return unavailable("selectCapability");
        await app2.selectMode(mode);
        return { ok: true, mode, view: currentView() };
      },
      /** 啟動一次合約合規審查；必要時先切換到合約能力。 */
      startContractReview: async ({ contractText, sampleId, party, scopes, outputs, locale: locale2 }) => {
        if (!["HOME", "INPUT"].includes(currentView())) {
          const c = pageStatus();
          return { ok: false, error: "CASE_IN_PROGRESS", current: c, nextAction: c.nextAction };
        }
        if (locale2 && locale2 !== app2.getLocale()) await app2.setLocale(locale2);
        if (app2.getMode?.() !== "contract") await app2.selectMode("contract");
        const extra = { party: party || "unknown", scopes: Array.isArray(scopes) ? scopes : [] };
        const s = sampleId ? await app2.startSample(sampleId, outputs || [], extra) : await app2.start(contractText, outputs || [], [], "", extra);
        if (!s) return { ok: false, error: "Unknown sampleId or empty contractText." };
        return { ok: true, caseId: s.caseId, status: s.status, step: s.step, mode: "contract", nextAction: "Poll getCaseStatus; on COMPLETED call getComplianceReport." };
      },
      /** 讀取已完成的合規報告，可依風險等級過濾 findings。 */
      getComplianceReport: async ({ risk = "all" } = {}) => {
        const c = app2.getState().last?.result?.compliance;
        if (!c) return { error: "not completed" };
        return truncate({ ...c, findings: (c.findings || []).filter((f) => risk === "all" || f.risk === risk) }, 4e3);
      },
      /** 依風險等級過濾結果頁上顯示的 findings 清單。 */
      filterFindingsByRisk: async ({ risk }) => {
        app2.setRiskFilter(risk);
        return { ok: true, risk };
      },
      /** 使用量統計於下一個里程碑接上，本版先明確回不可用。 */
      getUsageStats: async () => ({ ok: false, error: "NOT_AVAILABLE", message: "Usage statistics arrive in the next release." })
    };
    let syncQueue = Promise.resolve();
    function syncForState(view) {
      const run = syncQueue.then(() => syncForStateNow(view));
      syncQueue = run.catch(() => {
      });
      return run;
    }
    async function syncForStateNow(view) {
      const nextView = TOOL_NAMES_BY_VIEW[view] ? view : "INPUT";
      const desired = TOOL_NAMES_BY_VIEW[nextView];
      const unchanged = activeView === nextView && registered.size === desired.length && desired.every((name) => registered.has(name));
      if (unchanged) return [...registered];
      controller?.abort();
      controller = new AbortController();
      registered.clear();
      for (const name of desired) {
        const def = TOOL_DEFS.find((candidate) => candidate.name === name);
        if (!def) continue;
        if (hostContext?.registerTool) {
          await hostContext.registerTool({
            name: def.name,
            description: def.description,
            inputSchema: def.inputSchema,
            annotations: def.annotations,
            execute: async (input) => {
              await ready;
              return isToolAvailable(def.name) ? exec[def.name](normalizeInput(input)) : unavailable(def.name);
            }
          }, { signal: controller.signal });
        }
        registered.add(def.name);
      }
      activeView = nextView;
      return [...registered];
    }
    return {
      /** 相容舊呼叫端：輸入頁工具等同 INPUT 狀態。 */
      registerBase: () => syncForState("INPUT"),
      /** 相容舊呼叫端：完成頁工具等同 RESULT 狀態。 */
      registerCompleted: () => syncForState("RESULT"),
      /** 依 app view 同步目前可用工具；回傳實際註冊名稱供測試與 Inspector 使用。 */
      syncForState,
      /** host 晚注入 modelContext 時補接上並重新註冊目前狀態的工具。 */
      attachModelContext: (next) => {
        hostContext = next;
        const view = app2.getState?.()?.view || activeView || "INPUT";
        activeView = null;
        return syncForState(view);
      },
      /** 是否已接上可註冊工具的 host。 */
      hasHost: () => Boolean(hostContext?.registerTool),
      /** 全部解除，通常只在頁面離開或測試清理時使用。 */
      unregisterAll: () => {
        controller?.abort();
        controller = null;
        registered.clear();
        activeView = null;
      },
      tools: () => [...registered],
      pageStatus,
      questionGuide,
      availableForState: (view) => [...TOOL_NAMES_BY_VIEW[view] || TOOL_NAMES_BY_VIEW.INPUT],
      /** Inspector 與測試用：直接執行某工具。 */
      execute: async (name, input) => {
        await ready;
        return exec[name](normalizeInput(input));
      }
    };
  }

  // src/main/resources/static/js/webmcpBoot.js
  function createWebMcpBoot({ runtime = globalThis, watchOptions } = {}) {
    const refs = { app: null, graphView: null };
    const lazy = (key) => new Proxy({}, { get: (_, prop) => refs[key]?.[prop] });
    let resolveReady;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const hostListeners = /* @__PURE__ */ new Set();
    const webmcp2 = createWebMcp({ app: lazy("app"), graphView: lazy("graphView"), modelContext: resolveModelContext(runtime), ready });
    let initial = webmcp2.hasHost() ? webmcp2.syncForState("INPUT").catch(() => []) : Promise.resolve([]);
    const stopWatch = webmcp2.hasHost() ? null : watchModelContext(runtime, async (late) => {
      await webmcp2.attachModelContext(late);
      hostListeners.forEach((cb) => cb(true));
    }, watchOptions);
    return {
      webmcp: webmcp2,
      ready,
      /** 綁定真正的 app／graphView；回傳 webmcp 供入口程式繼續使用。工具仍要等 markReady() 才會執行。 */
      bind(app2, graphView) {
        refs.app = app2;
        refs.graphView = graphView;
        return webmcp2;
      },
      /** app.mount() 完成後呼叫：放行所有等待中的工具呼叫。 */
      markReady() {
        resolveReady();
      },
      /** 是否已綁定應用層。 */
      isBound: () => Boolean(refs.app),
      /** 初次註冊完成的 promise（測試用）。 */
      initialRegistration: () => initial,
      onHost: (cb) => {
        hostListeners.add(cb);
        return () => hostListeners.delete(cb);
      },
      stop() {
        stopWatch?.();
        webmcp2.unregisterAll();
      }
    };
  }

  // src/main/resources/static/js/inspector.js
  function mountInspector(root, webmcp2, t2, getLocale) {
    const host = document.createElement("aside");
    host.id = "inspector";
    host.className = "inspector collapsed";
    root.body.appendChild(host);
    const draw = () => {
      const locale2 = getLocale();
      const active = new Set(webmcp2.tools());
      const current2 = webmcp2.pageStatus?.() || { view: "INPUT", status: "NONE", nextAction: "" };
      const availableDefs = TOOL_DEFS.filter((d) => active.has(d.name));
      const stateText = locale2 === "zh-TW" ? `\u76EE\u524D\u72C0\u614B\uFF1A${current2.view}\uFF08${current2.status}\uFF09` : `Page state: ${current2.view} (${current2.status})`;
      const roText = locale2 === "zh-TW" ? "\u552F\u8B80" : "read-only";
      const emptyText = locale2 === "zh-TW" ? "\u76EE\u524D\u72C0\u614B\u6C92\u6709\u53EF\u7528\u5DE5\u5177" : "No tools available in this state";
      const items = availableDefs.map((d) => `<li><code>${esc(d.name)}</code>${d.annotations?.readOnlyHint ? `<span class="insp-ro">${esc(roText)}</span>` : ""}<small>${esc(d.description)}</small></li>`).join("");
      host.dataset.view = current2.view;
      const wasOpen = !host.classList.contains("collapsed");
      mount(host, `<button id="insp-toggle" type="button" aria-expanded="${wasOpen}" aria-controls="insp-body"><span>${esc(t2("inspector.title", locale2))} (${active.size}/${TOOL_DEFS.length})</span>${ICONS.chevronDown}</button>
      <div class="insp-body" id="insp-body"><p id="insp-state">${esc(stateText)}</p>
      <ul id="insp-list">${items || `<li class="insp-empty">${esc(emptyText)}</li>`}</ul>
      <p class="insp-note">${esc(t2("inspector.readonly", locale2))}</p></div>`);
      host.classList.toggle("collapsed", !wasOpen);
      const toggle = host.querySelector("#insp-toggle");
      toggle.addEventListener("click", () => {
        const open = host.classList.toggle("collapsed") === false;
        toggle.setAttribute("aria-expanded", String(open));
      });
    };
    draw();
    return { refresh: draw };
  }

  // src/main/resources/static/js/login.js
  function renderLogin(me2, quota, locale2) {
    if (!me2 || !me2.enabled) return "";
    const memberLimit = quota?.memberLimit ?? 5;
    if (me2.loggedIn && me2.blocked) {
      return `<div class="auth-user auth-blocked" role="alert">
      <span class="auth-name">${esc(me2.blockedMessage || t("license.excluded", locale2))}</span>
      <button type="button" id="logout-btn" class="auth-logout">${esc(t("nav.logout", locale2))}</button>
    </div>`;
    }
    if (me2.loggedIn) {
      const name = me2.name || me2.email || "";
      const avatar = me2.picture ? `<img class="avatar" src="${esc(me2.picture)}" alt="" referrerpolicy="no-referrer" width="28" height="28">` : `<span class="avatar avatar-fallback" aria-hidden="true">${esc((name || "?").slice(0, 1))}</span>`;
      return `<div class="auth-user" title="${esc(me2.email || "")}">
      ${avatar}<span class="auth-name">${esc(name)}</span>
      <button type="button" id="logout-btn" class="auth-logout">${esc(t("nav.logout", locale2))}</button>
    </div>`;
    }
    const benefit = t("nav.loginBenefit", locale2).replace("{limit}", memberLimit);
    return `<a id="login-link" class="login-link" href="${esc(me2.loginPath || "/oauth2/authorization/google")}" title="${esc(benefit)}">
    <svg class="g-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.4 10V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10A6 6 0 0 1 12 6z"/></svg>
    <span>${esc(t("nav.login", locale2))}</span><small>${esc(benefit)}</small>
  </a>`;
  }
  function bindLogin(root, { logout } = {}) {
    const btn = root.querySelector("#logout-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      btn.disabled = true;
      if (typeof logout === "function") {
        logout();
        return;
      }
      const doc = globalThis.document;
      if (!doc?.createElement) return;
      const form = doc.createElement("form");
      form.method = "POST";
      form.action = "/logout";
      form.hidden = true;
      doc.body.appendChild(form);
      form.submit();
    });
  }

  // src/main/resources/static/js/graphAssets.js
  function createGraphAssetLoader({ doc = globalThis.document, runtime = globalThis, timeoutMs = 15e3 } = {}) {
    let pending = null;
    const assets = [["THREE", "/vendor/three.min.js"], ["SpriteText", "/vendor/three-spritetext.min.js"], ["ForceGraph3D", "/vendor/3d-force-graph.min.js"]];
    function load(name, src) {
      if (runtime[name]) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = doc.createElement("script");
        const timer = setTimeout(() => finish(new Error(`Loading timed out: ${src}`)), timeoutMs);
        function finish(error) {
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) {
            script.remove();
            reject(error);
          } else resolve();
        }
        script.src = src;
        script.onload = () => finish(runtime[name] ? null : new Error(`Missing graph dependency: ${name}`));
        script.onerror = () => finish(new Error(`Unable to load: ${src}`));
        doc.head.appendChild(script);
      });
    }
    return () => {
      if (!pending) pending = (async () => {
        for (const [name, src] of assets) await load(name, src);
      })().catch((error) => {
        pending = null;
        throw error;
      });
      return pending;
    };
  }

  // src/main/resources/static/js/main.js
  var loadGraphAssets = createGraphAssetLoader();
  var graphRenderId = 0;
  async function renderGraph(data) {
    const canvas = document.getElementById("network-canvas");
    if (!canvas) return;
    const requestId = ++graphRenderId;
    canvas.textContent = app.getLocale() === "zh-TW" ? "\u6B63\u5728\u8F09\u5165\u95DC\u806F\u5716\u2026" : "Loading graph\u2026";
    try {
      await loadGraphAssets();
      if (requestId !== graphRenderId || document.getElementById("network-canvas") !== canvas) return;
      render(data);
    } catch (error) {
      if (requestId !== graphRenderId || document.getElementById("network-canvas") !== canvas) return;
      canvas.textContent = app.getLocale() === "zh-TW" ? "\u95DC\u806F\u5716\u8F09\u5165\u5931\u6557\uFF0C\u8ACB\u91CD\u65B0\u6574\u7406\u5F8C\u518D\u8A66\u3002\u5176\u4ED6\u7D50\u679C\u5206\u9801\u4ECD\u53EF\u95B1\u8B80\u3002" : "The graph could not load. Refresh to retry; other result tabs remain available.";
      canvas.setAttribute("role", "alert");
      console.error("Graph loading failed", error);
    }
  }
  var app = createApp({
    root: document,
    client: createCaseClient(fetch.bind(globalThis)),
    storage: window.sessionStorage,
    navigatorLanguage: navigator.language
  });
  window.__lawGraphApp = app;
  window.__graphView = graphView_exports;
  setLocale(app.getLocale());
  var boot = window.__webmcpBoot || createWebMcpBoot({ runtime: globalThis });
  window.__webmcpBoot = boot;
  var webmcp = boot.bind(app, graphView_exports);
  window.__webmcp = webmcp;
  var badge = document.getElementById("agent-badge");
  var authSlot = document.getElementById("auth-slot");
  var me = null;
  var updateLoginSlot = () => {
    if (!authSlot) return;
    authSlot.replaceChildren();
    authSlot.insertAdjacentHTML("afterbegin", renderLogin(me, app.getQuota?.(), app.getLocale()));
    bindLogin(authSlot);
  };
  var refreshMe = async () => {
    try {
      me = await app.client?.me?.();
    } catch {
      me = null;
    }
    updateLoginSlot();
  };
  var semanticBadge = document.getElementById("semantic-badge");
  var updateSemanticBadge = () => {
    if (!semanticBadge) return;
    const auth = app.getAuthStatus();
    if (!auth || !auth.enabled) {
      semanticBadge.style.display = "none";
      return;
    }
    semanticBadge.style.display = "";
    semanticBadge.classList.toggle("on", auth.authorized);
    semanticBadge.classList.toggle("warn", !auth.authorized);
    if (auth.authorized) {
      semanticBadge.textContent = t("auth.semantic.ready", app.getLocale());
    } else {
      const link = document.createElement("a");
      link.href = auth.startPath || "/api/auth/tw-legal-rag/start";
      link.textContent = `${t("auth.semantic.required", app.getLocale())} (${t("auth.semantic.action", app.getLocale())})`;
      semanticBadge.replaceChildren(link);
    }
  };
  var setBadge = (available) => {
    badge.dataset.i18n = available ? "agent.available" : "agent.unavailable";
    badge.classList.toggle("on", available);
    badge.textContent = t(badge.dataset.i18n, app.getLocale());
  };
  setBadge(webmcp.hasHost());
  boot.onHost((available) => {
    setBadge(available);
    inspector?.refresh();
  });
  var toolSync = Promise.resolve();
  var inspector = null;
  var syncTools = (view) => {
    toolSync = toolSync.then(async () => {
      await webmcp.syncForState(view);
      inspector?.refresh();
    });
    return toolSync;
  };
  app.onChange(async (state, kind) => {
    if (kind === "LOCALE") {
      setLocale(app.getLocale());
      updateSemanticBadge();
      updateLoginSlot();
      inspector?.refresh();
    }
    if (kind === "STATE") {
      updateSemanticBadge();
      syncTools(state.view);
    }
    if (kind === "RESULT_RENDERED") {
      if (state.last?.result?.graph) await renderGraph(state.last.result.graph);
      syncTools("RESULT");
    }
  });
  (async () => {
    const identityReady = refreshMe();
    await app.mount();
    updateSemanticBadge();
    await identityReady;
    updateLoginSlot();
    await syncTools(app.getState().view);
    boot.markReady();
    inspector = mountInspector(document, webmcp, t, () => app.getLocale());
    inspector.refresh();
  })();
  window.addEventListener("pagehide", () => boot.stop(), { once: true });
})();
