import React from 'react';
import styled, { css } from 'styled-components';
import { CircularProgress, CircularProgressProps } from '@mui/material';

const CProgress = styled(CircularProgress)``;

const Children = styled.div`
  display: flex;
`;

const Container = styled.div<{ absolute: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;

  ${({ absolute }) =>
    absolute
      ? css`
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        `
      : ''}
`;

export interface ProgressProps extends CircularProgressProps {
  absolute?: boolean;
  children?: React.ReactChild;
}

export const Progress = ({ absolute = false, className, style, children, ...p }: ProgressProps) => (
  <Container className={className} style={style} absolute={absolute}>
    <CProgress {...p} />
    <Children>{children}</Children>
  </Container>
);
