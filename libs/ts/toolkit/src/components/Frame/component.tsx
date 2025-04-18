import * as React from 'react';
import styled from 'styled-components';
import {Progress} from '../Progress';
import {Text} from '../Text';
import { useFrameCheck } from './hook';

const IFrame = styled.iframe`
	width: 100%;
	height: 100%;
	border: none;
	outline: none;
`;

const Zero = styled(Text)`
	position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Container = styled.section`
	position: relative;
	width: 100%;
	height: 100%;
`;

export interface FrameProps extends IClassName {
	id: string;
	route?: string; // TODO
	query?: {[key: string | number]: string | number};
}

export function Frame({ id, route, query = {}, ...p }: FrameProps) {
	const check = useFrameCheck(id);

	console.log('Check result', check);

	const src = React.useMemo(() => {
		if (!check || !check.success) {
			return '';
		}

		const url = new URL(check.src);

		const entries = Object.entries(query);
		if (entries.length) {
			const extraSearch = entries.reduce((acc, [k, v]) => acc ? `${acc}&${k}=${v}` : `${k}=${v}`, '');
	
			url.search = url.search ? `${url.search}&${extraSearch}` : `?${extraSearch}`;
		}

		return url.toString();
	}, [query, check?.src, route]);

	if (!check) {
		return (
			<Container {...p}>
				<Progress absolute size={32} />
			</Container>
		);
	}

	if (!check.success) {
		return (
			<Container {...p}>
				<Zero>{check.message}</Zero>
			</Container>
		);
	}

	return (
		<IFrame
			{...p}
			id={id}
			src={src}
		>
		</IFrame>
	)
}
