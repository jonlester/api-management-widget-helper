// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
declare enum StorageType {
    LocalStorage = "localStorage",
    SessionStorage = "sessionStorage"
}
/**
 * A class wrapping storing data in local or session Storage
 */
declare class StorageManager {
    private storage;
    constructor(storageType?: StorageType);
    /**
     * Get Item from Storage
     * @param key
     * @returns any
     */
    getItem(key: string): any;
    /**
     * Set Item in Storage
     * @param key
     * @param value
     */
    setItem(key: string, value: any): void;
    /**
     * Remove Item from Storage
     * @param key
     */
    removeItem(key: string): void;
    /**
     * Clear Storage
     */
    clear(): void;
}
/**
 * The event in which widgets communicate with each other
 */
interface ChannelEvent {
    topic: string;
    sender: string;
    message: string;
}
interface PublishParams {
    topic: string;
    sender: string;
    senderOverride?: string;
    message: string;
}
/**
 * A class wrapping broadcasting communication between widgets.
 */
declare class MessageBroker {
    private channel;
    private subscriptions;
    private storedMessages;
    constructor(channelName?: string);
    private handleIncomingMessage;
    private hasSubscribers;
    private storeMessage;
    private messageSubscribers;
    private saveSubscriptionToTopic;
    private sendStoredMessages;
    /**
     * Returns name of the broadcast channel
     * @returns string
     */
    getChannelName(): string;
    /**
     * Return the name of the current sender
     * @returns string
     */
    getSenderName(): string;
    /**
     * Subscribe to a topic
     * @param topic
     * @param callback
     * @returns boolean
     */
    subscribe(topic: string, callback: (event: ChannelEvent | any) => void): boolean;
    /**
     * Publish a message to a topic
     * @param params
     */
    publish(params: PublishParams | any): void;
    /**
     * Close channel
     * @returns Promise<void>
     */
    close(): Promise<void>;
}
interface AckEvent extends ChannelEvent {
    id: string;
    needsAck: boolean;
}
interface AckSettings {
    retryAttempts: number;
    retryIntervalMS: number;
}
/**
 * A class wrapping broadcasting communication between widgets using intervals and retry attempts and Message Broker
 */
declare class AckBroker {
    private broker;
    private messages;
    private RETRY_ATTEMPTS;
    private RETRY_INTERVALMS;
    constructor(channelName?: string, settings?: AckSettings);
    private generateUniqueId;
    received(event: AckEvent): void;
    /**
     * Send Message with Acknowledgment
     * @param event
     */
    send(event: ChannelEvent | any): Promise<any>;
    /**
     * Close broker channel
     * @returns Promise<void>
     */
    close(): Promise<void>;
}
export { StorageType, StorageManager, AckBroker, MessageBroker };
export type { AckEvent, AckSettings, PublishParams, ChannelEvent };
//# sourceMappingURL=index.d.ts.map