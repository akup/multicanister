import styled, { css } from 'styled-components';
import { Text, TextVariant, getFontStyles } from '../Text';
import { ExpanderProps, ExpanderSize } from './types';

const sizeToFont: { [key in ExpanderSize]: TextVariant } = {
	big: 'p3',
	medium: 'p3',
	small: 'caption',
};

export const StyledText = styled(Text)<{ size: ExpanderSize }>`
	flex-grow: 1;
	flex-shrink: 1;
	padding-right: 32px;
	width: 100%;
	box-sizing: border-box;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: black;

	${({ size }: { size: ExpanderSize }) => getFontStyles(sizeToFont[size], 'medium')}
`;

export const sizePaddingMap: { [key in ExpanderSize]: string } = {
	big: '20px 24px 20px 24px',
	medium: '12px 24px 12px 24px',
	small: '6px 24px 6px 24px',
};

export const HeaderHandler = styled.header<{ isStatic: boolean; size: ExpanderSize }>`
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	position: relative;
	padding: ${({ size }) => sizePaddingMap[size]};
	cursor: ${({ isStatic }) => (isStatic ? 'default' : 'pointer')};

	& > * {
		z-index: 2;
	}

	&::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		border-bottom: 1px solid grey;
		z-index: 1;
	}
`;

export const Header = styled.div<ExpanderProps>`
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	flex-shrink: 1;
	min-width: 0;

	& > * {
		z-index: 2;
	}

	&::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1;
	}
`;

export const FooterContainer = styled.div<{ isStatic: boolean; size: ExpanderSize }>`
	position: relative;
	display: flex;
	flex-direction: row;
	justify-content: center;
	padding: ${({ size }) => sizePaddingMap[size]};
	cursor: ${({ isStatic }) => (isStatic ? 'default' : 'pointer')};
	color: grey;
	border-top: 1px solid grey;
	background-color: lightgrey;

	& > * {
		z-index: 2;
	}

	&:empty {
		display: none;
	}

	&::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: -1;
	}
`;

export const Children = styled.div`
	display: flex;
	flex-direction: column;
`;

export const Container = styled.section<{
	isFullScreenWidth: boolean;
}>`
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: 4px;
	border: 1px solid grey;
	transition: border-color 200ms ease;

	${({ isFullScreenWidth }) => {
		if (isFullScreenWidth) {
			return css`
				border-radius: 0;
				border-left-width: 0;
				border-right-width: 0;

				${HeaderHandler} {
					padding-left: 40px;
					padding-right: 40px;
				}
			`;
		}

		return '';
	}}

	${Header}::after, ${FooterContainer}::after {
		background-color: #e6e6e6;
	}

	& & {
		border-radius: 0;
		border-left-width: 0;
		border-right-width: 0;
		
		${StyledText} {
			color: lightgrey;
		}
	}
	& & + & {
		border-top-width: 0;
		
		&:last-of-type {
			border-bottom-width: 0;
		}
	}
`;
