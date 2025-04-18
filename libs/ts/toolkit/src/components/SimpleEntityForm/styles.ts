import styled from 'styled-components';

export const Container = styled.ul`
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;

	& > *:not(:last-of-type) {
		border-bottom: 1px solid grey;
		border-radius: 0;
	}
`;
