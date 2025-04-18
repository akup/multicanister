import * as React from 'react';
import { ExpanderSize } from './types';

export interface ExpanderContextProps {
  onClick: () => void;
  isStatic: boolean;
  size: ExpanderSize;
}

export const ExpanderContext = React.createContext<ExpanderContextProps>({
  onClick: () => undefined,
  isStatic: false,
  size: 'big',
});
