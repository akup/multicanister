import type { Principal } from '@dfinity/principal';
export interface Document {
  id: DocumentId;
  verification: [] | [Verification];
}
export type DocumentId = bigint;
export interface GetDocumentRequest {
  id: DocumentId;
}
export interface GetDocumentResponse {
  document: Document;
}
export interface GetDocumentsResponse {
  documents: Array<Document>;
}
export interface IssueResponse {
  document: Document;
}
export interface RequestValidationRequest {
  document_id: DocumentId;
  pubkey: Array<number>;
}
export interface RequestValidationResponse {
  validator_selection_principal: Principal;
}
export interface Verification {
  merkle_root: Array<number>;
  validator_company_principal: Principal;
}
export interface VerifyRequest {
  id: DocumentId;
  verification: Verification;
}
export interface _SERVICE {
  get_document: (arg_0: GetDocumentRequest) => Promise<GetDocumentResponse>;
  get_documents: () => Promise<GetDocumentsResponse>;
  get_fabric: () => Promise<Principal>;
  get_schema: () => Promise<string>;
  get_validator_selection: () => Promise<Principal>;
  issue: () => Promise<IssueResponse>;
  request_validation: (arg_0: RequestValidationRequest) => Promise<RequestValidationResponse>;
  verify: (arg_0: VerifyRequest) => Promise<undefined>;
}
