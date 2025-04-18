import * as React from 'react';
import { TextVariant } from '../Text';
import {
  FormItemAligning,
  Container,
  LabelContainer,
  Label,
  ValueContainer,
  Value,
} from './styles';

export { FormItemAligning } from './styles';

export type FormItemSize = 'small' | 'medium';

export interface FormItemProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  label: React.ReactNode | void;
  withoutLabel?: boolean;
  loading?: boolean;
  align?: FormItemAligning;
  tooltip?: string;
  size?: FormItemSize;
  onClick?(e: React.MouseEvent<HTMLElement> | React.UIEvent): void;
  children: React.ReactNode | null;
}

const fontVariantMap: Record<FormItemSize, { label: TextVariant; value: TextVariant }> = {
  small: { label: 'caption', value: 'caption' },
  medium: { label: 'p3', value: 'p3' },
};

export const FormItem = ({
  className,
  style,
  label,
  children,
  tooltip,
  id,
  align = { direction: 'column', basis: { label: '100%', value: '100%' } },
  loading,
  size = 'small',
  ...p
}: FormItemProps) => {
  const variants = fontVariantMap[size];

  return (
    <Container className={className} style={style} onClick={p.onClick} align={align} id={id}>
      {typeof label !== 'undefined' && (
        <LabelContainer>
          <Label variant={variants.label} weight="regular">
            {label}
          </Label>
        </LabelContainer>
      )}
      <ValueContainer>
        {loading ? (
          'loading'
        ) : (
          <>
            <Value variant={variants.value}>
              {typeof children !== 'undefined' && children !== null ? children : '-'}
            </Value>
          </>
        )}
      </ValueContainer>
    </Container>
  );
};
