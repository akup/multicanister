import * as React from 'react';

export const useOnceEffect = (handler: () => any, watch: any[], condition: () => boolean) => {
  const [fired, setFired] = React.useState(false);

  React.useEffect(() => {
    if (fired || !condition()) {
      return;
    }

    const res = handler();
    setFired(true);

    return res;
  }, [...watch, condition, fired, setFired]);
};
