import { css, FlattenSimpleInterpolation } from 'styled-components';
import { TextVariant, TextWeight } from './types';

interface FontParams {
  size: number;
  lineHeight: number;
  weight: number;
}

export const FONT_PARAMS: Record<TextVariant, Record<TextWeight, FontParams>> = {
  h1: {
    regular: { size: 48, lineHeight: 56, weight: 400 },
    medium: { size: 48, lineHeight: 56, weight: 500 },
  },
  h2: {
    regular: { size: 40, lineHeight: 48, weight: 400 },
    medium: { size: 40, lineHeight: 48, weight: 500 },
  },
  h3: {
    regular: { size: 32, lineHeight: 40, weight: 400 },
    medium: { size: 32, lineHeight: 40, weight: 500 },
  },
  h4: {
    regular: { size: 24, lineHeight: 32, weight: 400 },
    medium: { size: 24, lineHeight: 32, weight: 500 },
  },
  h5: {
    regular: { size: 20, lineHeight: 30, weight: 400 },
    medium: { size: 20, lineHeight: 30, weight: 500 },
  },
  p1: {
    regular: { size: 18, lineHeight: 26, weight: 400 },
    medium: { size: 18, lineHeight: 26, weight: 500 },
  },
  p2: {
    regular: { size: 16, lineHeight: 24, weight: 400 },
    medium: { size: 16, lineHeight: 24, weight: 500 },
  },
  p3: {
    regular: { size: 14, lineHeight: 22, weight: 400 },
    medium: { size: 14, lineHeight: 22, weight: 500 },
  },
  caption: {
    regular: { size: 12, lineHeight: 20, weight: 400 },
    medium: { size: 12, lineHeight: 20, weight: 500 },
  },
};

export function getFontStyles(
  textVariant: TextVariant,
  textWeight: TextWeight
): FlattenSimpleInterpolation {
  const { size, lineHeight, weight } = FONT_PARAMS[textVariant][textWeight];

  return css`
    font-size: ${size}px;
    line-height: ${lineHeight}px;
    font-weight: ${weight};
  `;
}
