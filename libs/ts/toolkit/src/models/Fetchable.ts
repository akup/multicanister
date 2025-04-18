import { makeObservable, observable, computed, reaction } from 'mobx';

export class Fetchable {
  _fetching = false;
  _error: Error | null | void = null;

  constructor() {
    makeObservable(this, {
      _fetching: observable,
      _error: observable,
      fetching: computed,
      error: computed,
    });

    reaction(
      () => this._error,
      error => {
        if (!error) {
          return;
        }

        console.error(`Error in Fetchable`, error, error.stack);
      }
    );
  }

  get fetching() {
    return this._fetching;
  }

  set fetching(fetching) {
    this._fetching = fetching;
  }

  get error() {
    return this._error ? this._error.message : null;
  }

  setError = (error: Error | null | void, message?: string) => {
    this._error = error;
    if (this._error && message) {
      this._error.message = message;
    }
  };
}
