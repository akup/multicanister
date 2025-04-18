import type { Principal } from '@dfinity/principal';
export interface CompanyInfo {
  name: string;
  employee: [] | [Principal];
  fabric: Principal;
}
export interface ProxyCallRequest {
  program: Array<RemoteCallPayload>;
}
export interface ProxyCallResponse {
  results: Array<Res>;
}
export interface RemoteCallEndpoint {
  canister_id: Principal;
  method_name: string;
}
export interface RemoteCallPayload {
  endpoint: RemoteCallEndpoint;
  cycles: bigint;
  args_raw: Array<number>;
}
export type Res = { Ok: Array<number> } | { Err: string };
export interface _SERVICE {
  get_company_info: () => Promise<CompanyInfo>;
  proxy_call: (arg_0: ProxyCallRequest) => Promise<ProxyCallResponse>;
  set_employee: (arg_0: Principal) => Promise<undefined>;
}
