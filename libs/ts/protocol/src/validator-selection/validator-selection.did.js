export const idlFactory = ({ IDL }) => {
  const MyRoleFilter = IDL.Variant({
    'Applicant' : IDL.Null,
    'Verifier' : IDL.Null,
  });
  const GetApplicationsRequest = IDL.Record({ 'filter' : MyRoleFilter });
  const ApplicationStatus = IDL.Variant({
    'ValidationFailed' : IDL.Null,
    'ValidationSucceeded' : IDL.Null,
    'ValidatorSelected' : IDL.Null,
    'ValidationSmartAgreementCreated' : IDL.Null,
    'Created' : IDL.Null,
  });
  const DocumentId = IDL.Nat64;
  const Application = IDL.Record({
    'status' : ApplicationStatus,
    'applicant' : IDL.Principal,
    'document_id' : DocumentId,
    'validator_smart_company' : IDL.Opt(IDL.Principal),
    'applicant_pubkey' : IDL.Vec(IDL.Nat8),
    'validation_smart_agreement' : IDL.Opt(IDL.Principal),
    'document_smart_template' : IDL.Principal,
  });
  const GetApplicationsResponse = IDL.Record({
    'applications' : IDL.Vec(Application),
  });
  const RequestValidationRequest = IDL.Record({
    'applicant' : IDL.Principal,
    'document_id' : DocumentId,
    'applicant_pubkey' : IDL.Vec(IDL.Nat8),
  });
  const RequestValidationResponse = IDL.Record({ 'application' : Application });
  const ValidationSummary = IDL.Record({ 'root_hash' : IDL.Vec(IDL.Nat8) });
  const ValidationStatus = IDL.Variant({
    'Fail' : IDL.Null,
    'Success' : ValidationSummary,
  });
  const SetValidationStatusRequest = IDL.Record({
    'status' : ValidationStatus,
    'document_id' : DocumentId,
  });
  return IDL.Service({
    'get_applications' : IDL.Func(
        [GetApplicationsRequest],
        [GetApplicationsResponse],
        ['query'],
      ),
    'register_validator_smart_company' : IDL.Func([], [], []),
    'request_validation' : IDL.Func(
        [RequestValidationRequest],
        [RequestValidationResponse],
        [],
      ),
    'set_validation_status' : IDL.Func([SetValidationStatusRequest], [], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Principal]; };
