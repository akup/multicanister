export const idlFactory = ({ IDL }) => {
  const DocumentId = IDL.Nat64;
  const GetDocumentRequest = IDL.Record({ 'id' : DocumentId });
  const Verification = IDL.Record({
    'merkle_root' : IDL.Vec(IDL.Nat8),
    'validator_company_principal' : IDL.Principal,
  });
  const Document = IDL.Record({
    'id' : DocumentId,
    'verification' : IDL.Opt(Verification),
  });
  const GetDocumentResponse = IDL.Record({ 'document' : Document });
  const GetDocumentsResponse = IDL.Record({ 'documents' : IDL.Vec(Document) });
  const IssueResponse = IDL.Record({ 'document' : Document });
  const RequestValidationRequest = IDL.Record({
    'document_id' : DocumentId,
    'pubkey' : IDL.Vec(IDL.Nat8),
  });
  const RequestValidationResponse = IDL.Record({
    'validator_selection_principal' : IDL.Principal,
  });
  const VerifyRequest = IDL.Record({
    'id' : DocumentId,
    'verification' : Verification,
  });
  return IDL.Service({
    'get_document' : IDL.Func(
        [GetDocumentRequest],
        [GetDocumentResponse],
        ['query'],
      ),
    'get_documents' : IDL.Func([], [GetDocumentsResponse], ['query']),
    'get_fabric' : IDL.Func([], [IDL.Principal], ['query']),
    'get_schema' : IDL.Func([], [IDL.Text], ['query']),
    'get_validator_selection' : IDL.Func([], [IDL.Principal], ['query']),
    'issue' : IDL.Func([], [IssueResponse], []),
    'request_validation' : IDL.Func(
        [RequestValidationRequest],
        [RequestValidationResponse],
        [],
      ),
    'verify' : IDL.Func([VerifyRequest], [], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Text, IDL.Principal]; };
