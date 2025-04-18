import * as React from 'react';
import { Text, TextVariant } from './Text';
import styled, { css } from 'styled-components';
import { TextBlockVariant, TextBlockType } from './types';

export interface TextBlockProps {
	className?: string;
	style?: React.CSSProperties;
	variant?: TextBlockVariant;
	type?: TextBlockType;
	title: React.ReactNode;
	children: React.ReactChild | React.ReactChild[] | false | void;
}

const Container = styled.div<{ type: TextBlockType; variant: TextBlockVariant }>`
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;

	${Text}:empty {
		display: none;
	}

	& > *:first-child {
		color: black;
	}
	& > *:last-child {
		color: darkslategrey;
	}

	${({ type, variant }) => {
		switch (type) {
			case 'common':
				return css`
					& > ${Text}:first-child {
						margin-bottom: ${['p3-p3', 'p3-caption'].includes(variant) ? 4 : 8}px;
					}
				`;
			case 'quote':
				return css``;
			case 'note':
				return css`
					padding-left: 20px;

					&::after {
						content: '';
						position: absolute;
						top: 0;
						bottom: 0;
						left: 0;
						width: 4px;
						background-color: black;
					}

					& > ${Text}:first-child {
						margin-bottom: 4px;
					}
				`;
			case 'list':
				return css`
					& > ${Text}:first-child {
						margin-bottom: ${['p3-p3', 'p3-caption'].includes(variant) ? 4 : 8}px;
					}

					& > ${Text}:last-child {
						display: flex;
						flex-direction: column;

						& > *:before {
							content: '•';
							margin-right: 8px;
						}
					}
				`;
			case 'numeric-list':
				return css`
					counter-reset: number 0;

					& > ${Text}:first-child {
						margin-bottom: ${['p3-p3', 'p3-caption'].includes(variant) ? 4 : 8}px;
					}

					& > ${Text}:last-child {
						display: flex;
						flex-direction: column;

						& > *:before {
							counter-increment: number;
							content: counter(number) '.';
							margin-right: 12px;
						}
					}
				`;
		}
	}}
`;

export const TextBlock = ({
	variant = 'h5-p2',
	type = 'common',
	title,
	children,
	...p
}: TextBlockProps) => {
	const variants = React.useMemo(() => variant.split('-') as TextVariant[], [variant]);

	return (
		<Container type={type} variant={variant} {...p}>
			<Text weight='medium' variant={variants[0]}>
				{title}
			</Text>
			<Text weight='regular' variant={variants[1]}>
				{children || ''}
			</Text>
		</Container>
	);
};
