import { randomUUID } from "node:crypto";
import { renderCreditDocument, renderIssuedDocument, TEST_DOCUMENT_WATERMARK } from "./render";
import type {
  CreditDocumentRequest,
  DocumentProvider,
  IssueDocumentRequest,
  ProviderDocument,
} from "./types";

const SIMULATED = "simulated";

export function resolveDocumentProviderName(raw: string | undefined) {
  const name = (raw ?? "").trim().toLowerCase();
  if (name === "" || name === SIMULATED) {
    return SIMULATED;
  }
  return name;
}

export class SimulatedDocumentProvider implements DocumentProvider {
  readonly name = SIMULATED;
  readonly isSimulated = true;
  readonly recorded: Array<IssueDocumentRequest | CreditDocumentRequest> = [];
  sendCalls = 0;

  async issue(request: IssueDocumentRequest): Promise<ProviderDocument> {
    this.sendCalls += 1;
    this.recorded.push(request);
    const externalId = `sim-doc-${randomUUID()}`;
    return {
      externalId,
      body: renderIssuedDocument(request, externalId),
      watermark: TEST_DOCUMENT_WATERMARK,
      simulated: true,
    };
  }

  async cancel(request: CreditDocumentRequest): Promise<ProviderDocument> {
    this.sendCalls += 1;
    this.recorded.push(request);
    const externalId = `sim-credit-${randomUUID()}`;
    return {
      externalId,
      body: renderCreditDocument(request, externalId),
      watermark: TEST_DOCUMENT_WATERMARK,
      simulated: true,
    };
  }
}

export class RefusedDocumentProvider implements DocumentProvider {
  readonly isSimulated = false;
  sendCalls = 0;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async issue(): Promise<ProviderDocument> {
    this.sendCalls += 1;
    throw new Error(`ספק המסמכים ${this.name} אינו מחובר.`);
  }

  async cancel(): Promise<ProviderDocument> {
    this.sendCalls += 1;
    throw new Error(`ספק המסמכים ${this.name} אינו מחובר.`);
  }
}

export function createDocumentProvider(
  env: Record<string, string | undefined> = process.env,
): DocumentProvider {
  const name = resolveDocumentProviderName(env.DOCUMENT_PROVIDER);
  if (name === SIMULATED) {
    return new SimulatedDocumentProvider();
  }
  return new RefusedDocumentProvider(name);
}
