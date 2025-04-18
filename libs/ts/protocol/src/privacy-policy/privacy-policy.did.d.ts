import type { Principal } from '@dfinity/principal';
export interface Challenge {
  reveal_fields: Array<FieldId>;
  doc_template_principal: Principal;
}
export type DocumentId = bigint;
export type FieldId = number;
export interface GetChallengeResponse {
  challenge: Challenge;
}
export interface GetRevealedDataRequest {
  owner: Principal;
}
export interface GetRevealedDataResponse {
  data: RevealedData;
}
export type MerkleProofLeaf = { Witness: MerkleWitness } | { Erased: Array<number> };
export interface MerkleWitness {
  data: Array<number>;
  nonce: Array<number>;
}
export interface Proof {
  revealed_fields: Array<RevealedField>;
}
export interface RevealDataRequest {
  document_id: DocumentId;
  proof: Proof;
}
export interface RevealDataResponse {
  result: boolean;
}
export interface RevealedBit {
  data: Array<number>;
  field_id: FieldId;
}
export interface RevealedData {
  bits: Array<RevealedBit>;
}
export interface RevealedField {
  id: FieldId;
  leaf: MerkleProofLeaf;
}
export interface _SERVICE {
  get_challenge: () => Promise<GetChallengeResponse>;
  get_fabric: () => Promise<Principal>;
  get_revealed_data: (arg_0: GetRevealedDataRequest) => Promise<GetRevealedDataResponse>;
  reveal_data: (arg_0: RevealDataRequest) => Promise<RevealDataResponse>;
  revoke_data: () => Promise<undefined>;
}
