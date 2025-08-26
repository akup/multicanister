export const idlFactory = ({ IDL }) => {
  return IDL.Service({ 'get' : IDL.Func([IDL.Nat], [IDL.Text], []) });
};
export const init = ({ IDL }) => { return []; };
