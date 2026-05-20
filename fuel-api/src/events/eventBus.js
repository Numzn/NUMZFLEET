/**
 * Domain event bus — delegates to durableEventBus (in-process today; Redis/NATS later).
 */
export { emitDomainEvent, default } from './durableEventBus.js';
