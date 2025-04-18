import type { Principal } from '@dfinity/principal';
export interface Application {
  status: ApplicationStatus;
  applicant: Principal;
  document_id: DocumentId;
  validator_smart_company: [] | [Principal];
  applicant_pubkey: Array<number>;
  validation_smart_agreement: [] | [Principal];
  document_smart_template: Principal;
}
export type ApplicationStatus =
  | { ValidationFailed: null }
  | { ValidationSucceeded: null }
  | { ValidatorSelected: null }
  | { ValidationSmartAgreementCreated: null }
  | { Created: null };
export type DocumentId = bigint;
export interface GetApplicationsRequest {
  filter: MyRoleFilter;
}
export interface GetApplicationsResponse {
  applications: Array<Application>;
}
export type MyRoleFilter = { Applicant: null } | { Verifier: null };
export interface RequestValidationRequest {
  applicant: Principal;
  document_id: DocumentId;
  applicant_pubkey: Array<number>;
}
export interface RequestValidationResponse {
  application: Application;
}
export interface SetValidationStatusRequest {
  status: ValidationStatus;
  document_id: DocumentId;
}
export type ValidationStatus = { Fail: null } | { Success: ValidationSummary };
export interface ValidationSummary {
  root_hash: Array<number>;
}
export interface _SERVICE {
  get_applications: (arg_0: GetApplicationsRequest) => Promise<GetApplicationsResponse>;
  register_validator_smart_company: () => Promise<undefined>;
  request_validation: (arg_0: RequestValidationRequest) => Promise<RequestValidationResponse>;
  set_validation_status: (arg_0: SetValidationStatusRequest) => Promise<undefined>;
}
