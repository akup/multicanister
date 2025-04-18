import React, { useState, useEffect, createContext, useContext } from 'react';
import { ChannelConsumer } from './client';

// FIXME поправить generic типы, получается какая-то шляпа
export interface AuthContext<C extends string = any, S extends string = any> {
  channel: ChannelConsumer<C, S>;
  isAuthReady: boolean;
  isAuthentificated: boolean;
}

const authContext = createContext<AuthContext>(null!);

export function ProvideAuth<C extends string = any, S extends string = any>({
  channel,
  children,
}: {
  channel: ChannelConsumer<C, S>;
  children: any;
}) {
  const auth = useProvideAuth(channel);
  return <authContext.Provider value={auth}>{children}</authContext.Provider>;
}

export function useProvideAuth<C extends string = any, S extends string = any>(
  channel: ChannelConsumer<C, S>
) {
  const [isAuthentificated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      await channel.delegation.requestAuth();
      setIsAuthenticated(await channel.delegation.isAuthentificated());
    })();
  }, []);

  return {
    channel,
    isAuthReady: isAuthentificated,
    isAuthentificated: isAuthentificated,
  };
}

export const useAuth = () => {
  return useContext(authContext);
};
