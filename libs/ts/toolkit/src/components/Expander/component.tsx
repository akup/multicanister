import * as React from 'react';
import AnimateHeight from 'react-animate-height';
import { CSSTransition } from 'react-transition-group';
import { TextVariant, Text } from '../Text';
import { Container, Header, HeaderHandler, Children, StyledText } from './styles';
import { ExpanderProps, ExpanderSize } from './types';
import { ExpanderContext } from './context';

const DEFAULT_TIMEOUT = 300;

const plusSize: { [key in ExpanderSize]: TextVariant } = {
  big: 'h5',
  medium: 'p1',
  small: 'p1',
};

export const Expander: React.FC<ExpanderProps> = ({
  className = '',
  style,
  title = '',
  timeout = DEFAULT_TIMEOUT,
  isStatic = false,
  disabled = false,
  isFullScreenWidth = false,
  size = 'big',
  headerRenderer,
  children,
  indicator = 'arrow',
  isDefaultOpened = false,
}) => {
  const initialOpened = isDefaultOpened || !!isStatic;
  const [isOpened, setOpened] = React.useState(initialOpened);

  React.useEffect(() => {
    if (isStatic && !isOpened) {
      setOpened(true);
    }
  }, [isStatic, isOpened, setOpened]);

  const handleOpen = React.useCallback(() => {
    if (!isStatic && !disabled) {
      setOpened(!isOpened);
    }
  }, [isOpened, isStatic, disabled]);

  const height = isOpened ? 'auto' : 0;
  const defaultHeader = (
    <Header>
      <StyledText size={size}>{title}</StyledText>
    </Header>
  );

  const indicatorNode = React.useMemo(() => {
    switch (indicator) {
      case 'plus':
        return (
          <Text variant={plusSize[size]} weight="regular">
            {isOpened ? '-' : '+'}
          </Text>
        );
      case 'arrow':
      default:
        return '';
    }
  }, [indicator, isOpened, size]);

  return (
    <ExpanderContext.Provider
      value={{
        onClick: handleOpen,
        isStatic,
        size,
      }}
    >
      <Container className={className} style={style} isFullScreenWidth={isFullScreenWidth}>
        <HeaderHandler onClick={handleOpen} isStatic={isStatic} size={size}>
          {headerRenderer
            ? headerRenderer({ isOpened, isStatic, title, isDefaultOpened, size, defaultHeader }) ||
              defaultHeader
            : defaultHeader}
          {!isStatic && !disabled && indicatorNode}
        </HeaderHandler>
        <AnimateHeight height={height} duration={timeout}>
          <CSSTransition in={isOpened} unmountOnExit timeout={timeout}>
            <Children>{children}</Children>
          </CSSTransition>
        </AnimateHeight>
      </Container>
    </ExpanderContext.Provider>
  );
};
