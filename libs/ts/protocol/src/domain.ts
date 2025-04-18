export type TemplateSchema = TemplateField[];

export interface TemplateField {
  id: number;
  alias: string;
  name: string;
  rank: number;
  type: 'text' | 'date' | 'blob';
}

export type Value = null | string | number | BValue;
export type BValue = { name: string; type: string; bytes: number[] };

export type FactDataValue<V = number[]> = {
  alias: string;
  value: V;
  nonce: number[];
};
export type FactData<V = number[]> = FactDataValue<V>[];

export type Fact<V = number[]> = {
  documentId: string;
  templateId: string;
  name: string;
  values: FactData<V>;
};

export const isFact = (p: any): p is Fact => {
  const base =
    !!p &&
    'documentId' in p &&
    typeof p.documentId == 'string' &&
    'values' in p &&
    Array.isArray(p.values);
  if (!base) {
    return false;
  }

  if (!p.values.length) {
    return true;
  }

  const e = p.values[0];

  return (
    'alias' in e &&
    typeof e.alias == 'string' &&
    e.alias &&
    'value' in e &&
    Array.isArray(e.value) &&
    'nonce' in e &&
    Array.isArray(e.nonce) &&
    !!e.nonce.length
  );
};
