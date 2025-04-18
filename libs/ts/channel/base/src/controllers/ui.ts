import { ServerParams, ChannelGateway } from '../types';

export const setFrameSize = (
  payload?: { height?: number; width?: number },
  params?: ServerParams
) => {
  if (!params?.origin) {
    console.error('No origin');
    return;
  }

  const frames = document.querySelectorAll('iframe');
  frames.forEach((frame: HTMLIFrameElement) => {
    if (!frame.src.includes(params.origin)) {
      return;
    }

    if (payload?.height) {
      frame.style.height = `${payload.height}px`;
      frame.style.maxHeight = `${payload.height}px`;
    }
    if (payload?.width) {
      frame.style.width = `${payload.width}px`;
      frame.style.maxWidth = `${payload.width}px`;
    }
  });

  return payload;
};

export interface ChangeFrameSizeDynamicallyProps {
  exclude?: 'height' | 'width';
}

export class UIController implements Controller {
  private resizeObserver: ResizeObserver | null = null;

  constructor(public gateway: ChannelGateway<any>) {}

  public changeFrameSizeDynamically = (
    selector = 'body',
    { exclude }: ChangeFrameSizeDynamicallyProps
  ) => {
    this.resizeObserver = new ResizeObserver(() => {
      const body = document.querySelector(selector) as HTMLElement;
      const rect = body.getBoundingClientRect();

      if (!rect.height) {
        return;
      }

      let payload = { height: rect.height, width: rect.width };
      if (exclude) {
        delete payload[exclude];
      }

      this.gateway.request('setFrameSize', payload, { target: 'parent' });
    });

    this.resizeObserver.observe(document.querySelector(selector) as HTMLElement);
  };

  public stopChangeFrameSizeDynamically = () => {
    if (!this.resizeObserver) {
      return;
    }
    this.resizeObserver.disconnect();
  };
}
