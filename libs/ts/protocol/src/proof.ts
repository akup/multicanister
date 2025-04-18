import { hash } from '@dfinity/agent';
import { FactDataValue, TemplateSchema, Value } from './domain';
import { serialize } from './utils';
import { MerkleProofLeaf, RevealedField, Proof } from './privacy-policy';

// export const getProof = async (challenge: Challenge, values: FactData, schema: TemplateSchema): Promise<Proof> => {
// 	return {
// 		revealed_fields: await Promise.all(
// 			values.map(async (v) => {
// 				const schemaItem = schema.find(s => s.alias == v.alias);
// 				if (!schemaItem) {
// 					throw new Error(`Wrong proof of wrong schema: no alias ${v.alias}`);
// 				}

// 				const id = BigInt(schemaItem.id);
// 				const idFromChallenge = challenge.reveal_fields.find(n => n === id);
// 				const erased = new Uint8Array([...v.value, ...v.nonce]);
// 				const erasedHash = await crypto.subtle.digest('SHA-256', erased);

// 				const success = idFromChallenge ? { Witness: {data: v.value, nonce: v.nonce} } : undefined;
// 				const error = { Erased: [...new Uint8Array(erasedHash)] };

// 				const result = {
// 					id,
// 					leaf: success || error
// 				};
// 				return result;
// 			})
// 		)
// 	};
// };

export const merkalizeValues = (
  values: FactDataValue<Value>[],
  schema: TemplateSchema
): number[] => {
  return merkalize(
    values.map(v => ({ ...v, value: serialize(v.value) })),
    schema
  );
};

// returns merkle root of the document
export const merkalize = (values: FactDataValue<number[]>[], schema: TemplateSchema): number[] => {
  let erasedLeaves: number[] = [];

  for (let leaf of values) {
    const fieldId = schema.find(field => field.alias == leaf.alias)!.id;

    let fieldIdBuf = Buffer.alloc(4);
    fieldIdBuf.writeUInt32LE(fieldId);
    const buf = Buffer.from([...fieldIdBuf, ...leaf.value, ...leaf.nonce]) as any;

    const h = [...hash(buf)];

    erasedLeaves = [...erasedLeaves, ...h];
  }

  return [...hash(Buffer.from(erasedLeaves) as any)];
};

export const generateProof = (
  reveal_fields: bigint[],
  values: FactDataValue<number[]>[],
  schema: TemplateSchema
): Proof => {
  const revealedFields: RevealedField[] = values.map(v => {
    const schemaItem = schema.find(s => s.alias == v.alias);

    if (!schemaItem) {
      throw new Error(`Wrong proof of wrong schema: no alias ${v.alias}`);
    }

    const id = BigInt(schemaItem.id);
    const isWitnessed = reveal_fields.some(n => n === id);

    let fieldIdBuf = Buffer.alloc(4);
    fieldIdBuf.writeUInt32LE(Number(id));

    let leaf: MerkleProofLeaf;

    if (isWitnessed) {
      leaf = { Witness: { data: v.value, nonce: v.nonce } };
    } else {
      const erased = new Uint8Array([...fieldIdBuf, ...v.value, ...v.nonce]);
      const erasedHash = hash(Buffer.from(erased) as any);

      leaf = { Erased: [...new Uint8Array(erasedHash)] };
    }

    return { id: schemaItem.id, leaf };
  });

  return { revealed_fields: revealedFields };
};
