// v0.2b:
export interface IPipelineOrchestrator {
  runIngest(relPath: string): Promise<unknown>;
  runCompile(sinceDays?: number): Promise<unknown>;
  runLint(): Promise<unknown>;
  runTag(relPath: string, ontology: string[]): Promise<unknown>;
  runLink(relPath: string): Promise<unknown>;
  runEnrich(relPath: string): Promise<unknown>;
  runQuery(question: string): Promise<unknown>;
}
