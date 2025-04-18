export const idlFactory = ({ IDL }) => {
  const FieldId = IDL.Nat32;
  const Challenge = IDL.Record({
    'reveal_fields' : IDL.Vec(FieldId),
    'doc_template_principal' : IDL.Principal,
  });
  const GetChallengeResponse = IDL.Record({ 'challenge' : Challenge });
  const GetRevealedDataRequest = IDL.Record({ 'owner' : IDL.Principal });
  const RevealedBit = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'field_id' : FieldId,
  });
  const RevealedData = IDL.Record({ 'bits' : IDL.Vec(RevealedBit) });
  const GetRevealedDataResponse = IDL.Record({ 'data' : RevealedData });
  const DocumentId = IDL.Nat64;
  const MerkleWitness = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'nonce' : IDL.Vec(IDL.Nat8),
  });
  const MerkleProofLeaf = IDL.Variant({
    'Witness' : MerkleWitness,
    'Erased' : IDL.Vec(IDL.Nat8),
  });
  const RevealedField = IDL.Record({
    'id' : FieldId,
    'leaf' : MerkleProofLeaf,
  });
  const Proof = IDL.Record({ 'revealed_fields' : IDL.Vec(RevealedField) });
  const RevealDataRequest = IDL.Record({
    'document_id' : DocumentId,
    'proof' : Proof,
  });
  const RevealDataResponse = IDL.Record({ 'result' : IDL.Bool });
  return IDL.Service({
    'get_challenge' : IDL.Func([], [GetChallengeResponse], ['query']),
    'get_fabric' : IDL.Func([], [IDL.Principal], ['query']),
    'get_revealed_data' : IDL.Func(
        [GetRevealedDataRequest],
        [GetRevealedDataResponse],
        ['query'],
      ),
    'reveal_data' : IDL.Func([RevealDataRequest], [RevealDataResponse], []),
    'revoke_data' : IDL.Func([], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
