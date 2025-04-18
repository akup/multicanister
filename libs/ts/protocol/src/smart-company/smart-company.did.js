export const idlFactory = ({ IDL }) => {
  const CompanyInfo = IDL.Record({
    'name' : IDL.Text,
    'employee' : IDL.Opt(IDL.Principal),
    'fabric' : IDL.Principal,
  });
  const RemoteCallEndpoint = IDL.Record({
    'canister_id' : IDL.Principal,
    'method_name' : IDL.Text,
  });
  const RemoteCallPayload = IDL.Record({
    'endpoint' : RemoteCallEndpoint,
    'cycles' : IDL.Nat64,
    'args_raw' : IDL.Vec(IDL.Nat8),
  });
  const ProxyCallRequest = IDL.Record({
    'program' : IDL.Vec(RemoteCallPayload),
  });
  const Res = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Nat8), 'Err' : IDL.Text });
  const ProxyCallResponse = IDL.Record({ 'results' : IDL.Vec(Res) });
  return IDL.Service({
    'get_company_info' : IDL.Func([], [CompanyInfo], ['query']),
    'proxy_call' : IDL.Func([ProxyCallRequest], [ProxyCallResponse], []),
    'set_employee' : IDL.Func([IDL.Principal], [], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Principal, IDL.Text]; };
