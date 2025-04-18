import { DelegationController, ProxyController } from './controllers';
import { ChannelClientMethods, ChannelHostMethods } from '@validation-poc/protocol';
import { Channel, ChannelOpts } from '@validation-poc/channel-base';

export interface ChannelHostOpts extends ChannelOpts {}

export class ChannelHost<
  Client extends string = ChannelClientMethods,
  Server extends string = string,
> extends Channel<Client | ChannelClientMethods, Server | ChannelHostMethods> {
  public proxy: ProxyController;
  public delegation: DelegationController;

  constructor(opts: ChannelHostOpts) {
    super(opts);

    this.delegation = new DelegationController();
    this.proxy = new ProxyController(this, this.delegation);

    this.addMethod('requestIdentity', this.delegation.requestIdentity.bind(this.delegation));
    this.addMethod('frame_proxy', this.proxy.proxyCall.bind(this.proxy));
  }
}
