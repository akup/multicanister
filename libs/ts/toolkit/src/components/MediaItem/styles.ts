import styled, { css } from 'styled-components';
import * as I from '../Image';

export const Image = styled(I.Image)`
	width: 100%;
	height: 100%;
	flex-grow: 1;
`;

export const HoverAdornment = styled.div`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.25s ease;
	z-index: 102;
`;

export const Children = styled.div`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	opacity: 1;
	pointer-events: none;
	transition: opacity 0.25s ease;
	z-index: 101;

	&:empty {
		display: none;
	}
`;

export const Container = styled.div<{ disabled: boolean; $locked: boolean; size: number }>`
	position: relative;
	flex-shrink: 0;
	flex-grow: 0;
	cursor: pointer;
	height: ${({ size }) => size}px;
	width: ${({ size }) => size}px;
	border: 1px solid grey;
	overflow: hidden;
	border-radius: 4px;
	box-sizing: content-box;

	&::after {
		content: '';
		position: absolute;
		z-index: 3;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: black;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	${({ disabled }) => {
		if (!disabled) {
			return css`
				&:hover {
					&::after {
						opacity: 0.3;
					}

					${HoverAdornment} {
						opacity: 1;
					}
				}
			`;
		}

		return css`
			opacity: 0.3;
			pointer-events: none;
			cursor: pointer;
		`;
	}}

	${({ $locked }) => {
		if (!$locked) {
			return '';
		}

		return css`
			pointer-events: none;
			cursor: pointer;
		`;
	}}
`;
