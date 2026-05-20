import EventEmitter from 'events';

/**
 * In-process domain event bus (Phase 4: swap implementation for Redis/NATS).
 * API mirrors Node EventEmitter so listeners stay unchanged.
 */
class DurableEventBus {
  constructor() {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(50);
  }

  on(eventName, listener) {
    this._emitter.on(eventName, listener);
    return this;
  }

  off(eventName, listener) {
    this._emitter.off(eventName, listener);
    return this;
  }

  emit(eventName, payload) {
    return this._emitter.emit(eventName, payload);
  }

  setMaxListeners(n) {
    this._emitter.setMaxListeners(n);
    return this;
  }
}

const durableEventBus = new DurableEventBus();

export const emitDomainEvent = (eventName, payload) => {
  durableEventBus.emit(eventName, payload);
};

export default durableEventBus;
