import { css, FlattenSimpleInterpolation } from 'styled-components';

export const isBase64 = (url: string) =>
  url.includes('base64') ||
  url.includes('data:image') ||
  (url.length >= 32 &&
    !!url.match(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/));

export const IEStyle = (content: FlattenSimpleInterpolation | string) => css`
  @media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
    ${content}
  }
`;
