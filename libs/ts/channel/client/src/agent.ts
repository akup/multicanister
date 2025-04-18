import {HttpAgent} from '@dfinity/agent';
import * as mobx from 'mobx';

export class AgentController {
	agent: HttpAgent | null = null;

  constructor() {
		mobx.makeObservable(this, {
			agent: mobx.observable,
		});
  }

	setAgent = (agent: HttpAgent) => {
		this.agent = agent;
	};
}

