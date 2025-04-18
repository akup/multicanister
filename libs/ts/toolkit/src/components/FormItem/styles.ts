import styled from 'styled-components';
import { Text } from '../Text';

export type FormItemAligning = {
	direction: 'row' | 'column';
	basis: { label: string; value: string };
};

export const LabelContainer = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	align-items: center;
	width: 100%;
`;

export const Label = styled(Text)`
	color: grey;
`;

export const ValueContainer = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	flex-grow: 1;
	flex-shrink: 1;
	flex-wrap: nowrap;
	white-space: pre-line;
	width: 100%;
`;

export const Container = styled.div<{ align: FormItemAligning }>`
	display: flex;
	flex-direction: ${({ align }) => align.direction};
	justify-content: space-between;
	align-items: flex-start;

	${LabelContainer} {
		flex-basis: ${({ align }) => align.basis.label};
		margin: ${({ align }) => (align.direction === 'column' ? '0 0 4px 0' : 0)};
		padding: ${({ align }) => (align.direction === 'row' ? '0 8px 0 0' : 0)};
	}
	${ValueContainer} {
		flex-basis: ${({ align }) => align.basis.value};
	}
`;

export const Value = styled(Text)`
	display: flex;
	color: black;
`;

