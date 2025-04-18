import { AgentController } from './agent'; // FIXME  это неверная зависимость, исправить
import {Channel, ChannelOpts} from '@validation-poc/channel-base';
import { DelegationController } from './controllers';
import {ChannelClientMethods} from '@validation-poc/protocol';

export interface ChannelConsumerOpts extends ChannelOpts {
  agent: AgentController;
  canisterId: string;
}

export class ChannelConsumer<C extends string = string, S extends string = string> extends Channel<C | ChannelClientMethods, S> {
  public delegation: DelegationController;
  
  constructor(opts: ChannelConsumerOpts) {
    super(opts);

    this.delegation = new DelegationController(this, {agent: opts.agent, canisterId: opts.canisterId});
  }
}
