import { ChannelBase, ChannelBaseOpts } from './base';
import { UIController, setFrameSize } from './controllers';

export type ChannelOpts = ChannelBaseOpts;

export type ControllerMethods = 'setFrameSize';

export class Channel<C extends string, S extends string> extends ChannelBase<
  C | ControllerMethods,
  S | ControllerMethods
> {
  public ui: UIController;

  constructor(opts: ChannelOpts) {
    super(opts);

    // FIXME возможно это нарушение S из SOLID
    // Тут и клиент и сервер
    this.ui = new UIController(this);
    this.addMethod('setFrameSize', setFrameSize);
  }
}
