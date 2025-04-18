export const idlFactory = ({ IDL }) => {
  const RemoveRequest = IDL.Record({ 'id' : IDL.Vec(IDL.Nat8) });
  const RemoveResponse = IDL.Record({ 'data' : IDL.Vec(IDL.Nat8) });
  const RetrieveRequest = IDL.Record({ 'id' : IDL.Vec(IDL.Nat8) });
  const RetrieveResponse = IDL.Record({ 'data' : IDL.Opt(IDL.Vec(IDL.Nat8)) });
  const StoreRequest = IDL.Record({
    'id' : IDL.Vec(IDL.Nat8),
    'data' : IDL.Vec(IDL.Nat8),
  });
  return IDL.Service({
    'remove' : IDL.Func([RemoveRequest], [RemoveResponse], []),
    'retrieve' : IDL.Func([RetrieveRequest], [RetrieveResponse], ['query']),
    'store' : IDL.Func([StoreRequest], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
