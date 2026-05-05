export type ProcessorType =
  | "grok-parser"
  | "date-remapper"
  | "status-remapper"
  | "service-remapper"
  | "message-remapper"
  | "attribute-remapper"
  | "url-parser"
  | "category-processor"
  | "trace-id-remapper";

export type Processor = {
  type: ProcessorType;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type LogPipeline = {
  id: string;
  name: string;
  filterQuery: string;
  processors: Processor[];
  isNested: boolean;
  parentPipelineId: string | null;
  enabled: boolean;
  orderIndex: number;
  isIntegration: boolean;
  integrationName: string | null;
  createdMs: number;
  updatedMs: number;
};

export type LibraryPipeline = {
  name: string;
  integration: string;
  description: string;
};

export type LogFacet = {
  id: string;
  path: string;
  displayName: string;
  facetKind: "qualitative" | "quantitative";
  dataType: "string" | "integer" | "double" | "boolean";
  groupName: string;
  hidden: boolean;
};

export type ScrubberRule = {
  id: string;
  name: string;
  description: string | null;
  patternKind: "library" | "custom";
  libraryPatternId: string | null;
  customRegex: string | null;
  replacementStrategy: "redact" | "hash" | "partial_redact";
  scopeNamespaces: string[];
  enabled: boolean;
  createdMs: number;
  updatedMs: number;
};

export type ScrubberFinding = {
  id: string;
  ruleId: string;
  occurredMs: number;
  logId: string | null;
  service: string;
  excerptRedacted: string;
  patternMatched: string;
};

export type LibraryPattern = {
  id: string;
  label: string;
  regex: string;
};
