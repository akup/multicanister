import styled from 'styled-components';
import * as MaterialUI from '@mui/material';

export const Container = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	align-items: center;

	* {
		z-index: 100;
	}
`;

export const Id = styled(MaterialUI.Typography)<{len: number}>`
	transition: color 200ms ease;
	cursor: pointer;
	padding-top: 1px;
`;
