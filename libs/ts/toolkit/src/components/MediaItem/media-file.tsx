import * as React from 'react';
import { MediaItem, MediaItemProps } from './component';
import { readPhotos } from '../../utils';

export interface MediaItemFileProps extends Omit<MediaItemProps, 'src'> {
	src: string | File | null | void;
}

export const MediaItemFile: React.FC<MediaItemFileProps> = ({ src: propSrc, ...p }) => {
	const [src, setSrc] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [failed, setFailed] = React.useState(false);

	React.useEffect(() => {
		if (!propSrc) {
			return;
		}

		if (typeof propSrc === 'string') {
			setSrc(propSrc);

			return;
		}

		const file = propSrc;

		setLoading(true);
		readPhotos([file])
			.then((result) => setSrc(result.previews[0]))
			.catch(() => setFailed(true))
			.finally(() => setLoading(false));
	}, [propSrc]);

	return (
		<MediaItem {...p} src={src} hoverAdornment={failed ? <></> : undefined}>
			{loading ? 'loading' : undefined}
			{failed ? 'error' : null}
		</MediaItem>
	);
};
