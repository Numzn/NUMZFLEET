import EventEmitter from 'events';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export const emitDomainEvent = (eventName, payload) => {
  eventBus.emit(eventName, payload);
};

export default eventBus;
