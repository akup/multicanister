import { action, observable, makeObservable, computed } from 'mobx';
import { Fetchable } from './Fetchable';

export class FetchStore<T> extends Fetchable {
	_data: T | null = null;

	constructor() {
		super();

		makeObservable(this, {
			_data: observable,
			data: computed,
			setData: action,
			clear: action,
		});
	}

	get data() {
		return this._data;
	}

	set data(data) {
		this._data = data;
	}

	setData = (data: T) => {
		this.data = data;
	};

	clear = () => {
		this.data = null;
		this.fetching = false;
		this.setError(null);
	};
}
