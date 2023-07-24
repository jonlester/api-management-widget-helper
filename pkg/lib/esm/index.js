import { BroadcastChannel } from 'broadcast-channel';

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
var StorageType;
(function (StorageType) {
    StorageType["LocalStorage"] = "localStorage";
    StorageType["SessionStorage"] = "sessionStorage";
})(StorageType || (StorageType = {}));
/**
 * A class wrapping storing data in local or session Storage
 */
class StorageManager {
    constructor(storageType = StorageType.SessionStorage) {
        if (storageType === StorageType.LocalStorage) {
            this.storage = window.localStorage;
        }
        else {
            this.storage = window.sessionStorage;
        }
    }
    /**
     * Get Item from Storage
     * @param key
     * @returns any
     */
    getItem(key) {
        const item = this.storage.getItem(key);
        if (item) {
            try {
                return JSON.parse(item);
            }
            catch (error) {
                console.error(`Failed to parse item '${key}' from storage.`, error);
            }
        }
        return null;
    }
    /**
     * Set Item in Storage
     * @param key
     * @param value
     */
    setItem(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            this.storage.setItem(key, serializedValue);
        }
        catch (error) {
            console.error(`Failed to serialize item '${key}' for storage.`, error);
        }
    }
    /**
     * Remove Item from Storage
     * @param key
     */
    removeItem(key) {
        this.storage.removeItem(key);
    }
    /**
     * Clear Storage
     */
    clear() {
        this.storage.clear();
    }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
/**
 * A class wrapping broadcasting communication between widgets.
 */
class MessageBroker {
    constructor(channelName) {
        const name = channelName || "widget-message-channel";
        this.channel = new BroadcastChannel(name);
        this.subscriptions = new Map();
        this.storedMessages = new Map();
        this.channel.addEventListener("message", (event) => {
            this.handleIncomingMessage(event);
        });
    }
    handleIncomingMessage(event) {
        if (!this.hasSubscribers(event)) {
            return;
        }
        this.storeMessage(event);
        this.messageSubscribers(event);
    }
    hasSubscribers(event) {
        return this.subscriptions.has(event === null || event === void 0 ? void 0 : event.topic);
    }
    storeMessage(event) {
        if (!this.storedMessages.has(event.topic)) {
            this.storedMessages.set(event.topic, [event]);
        }
        else {
            const storedMessages = this.storedMessages.get(event.topic);
            storedMessages.push(event);
        }
    }
    messageSubscribers(event) {
        const topicSubscriptions = this.subscriptions.get(event.topic);
        const subscribers = Array.from(topicSubscriptions);
        subscribers.forEach((callback) => {
            if (event.sender !== this.getSenderName()) {
                callback(event);
            }
        });
    }
    saveSubscriptionToTopic(topic) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
        }
    }
    sendStoredMessages(topic, callback) {
        const storedMessages = this.storedMessages.get(topic);
        storedMessages.forEach((message) => {
            if (message.sender !== this.getSenderName()) {
                callback(message);
            }
        });
    }
    /**
     * Returns name of the broadcast channel
     * @returns string
     */
    getChannelName() {
        return this.channel.name;
    }
    /**
     * Return the name of the current sender
     * @returns string
     */
    getSenderName() {
        return `${window.location.pathname}`;
    }
    /**
     * Subscribe to a topic
     * @param topic
     * @param callback
     * @returns boolean
     */
    subscribe(topic, callback) {
        this.saveSubscriptionToTopic(topic);
        const topicSubscriptions = this.subscriptions.get(topic);
        if (!topicSubscriptions.has(callback)) {
            topicSubscriptions.add(callback);
            if (this.storedMessages.has(topic)) {
                this.sendStoredMessages(topic, callback);
            }
            return true;
        }
        return false;
    }
    /**
     * Publish a message to a topic
     * @param params
     */
    publish(params) {
        const { senderOverride } = params || { senderOverride: false };
        this.channel.postMessage(Object.assign(Object.assign({}, params), { sender: senderOverride || this.getSenderName() }));
    }
    /**
     * Close channel
     * @returns Promise<void>
     */
    close() {
        return this.channel.close();
    }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
/**
 * A class wrapping broadcasting communication between widgets using intervals and retry attempts and Message Broker
 */
class AckBroker {
    constructor(channelName, settings) {
        const defaultSettings = { retryAttempts: 3, retryIntervalMS: 1500 };
        const appliedSettings = settings ? Object.assign(Object.assign({}, defaultSettings), settings) : defaultSettings;
        this.RETRY_ATTEMPTS = appliedSettings.retryAttempts;
        this.RETRY_INTERVALMS = appliedSettings.retryIntervalMS;
        this.broker = new MessageBroker(channelName);
        this.messages = new Map();
    }
    generateUniqueId() {
        return Math.random().toString(36).substring(7);
    }
    received(event) {
        if (event.id && event.needsAck) {
            this.broker.publish(event);
        }
    }
    /**
     * Send Message with Acknowledgment
     * @param event
     */
    send(event) {
        return new Promise((resolve, reject) => {
            const uniqueId = this.generateUniqueId();
            const ackEvent = Object.assign(Object.assign({}, event), { sender: event.sender || this.broker.getChannelName(), id: uniqueId, needsAck: true });
            this.messages.set(uniqueId, false);
            this.broker.publish(ackEvent);
            let retryCount = 0;
            const retryInterval = setInterval(() => {
                const isAcknowledged = this.messages.get(uniqueId);
                if (!isAcknowledged && retryCount < this.RETRY_ATTEMPTS) {
                    retryCount++;
                    this.broker.publish(ackEvent);
                }
                else {
                    clearInterval(retryInterval);
                    if (!isAcknowledged) {
                        reject(new Error(`Failed to receive acknowledgement for message: ${uniqueId}`));
                    }
                }
            }, this.RETRY_INTERVALMS);
            this.broker.subscribe(event.topic, (event) => {
                if (event.id == uniqueId && event.needsAck) {
                    this.messages.set(uniqueId, true);
                    resolve(Object.assign(Object.assign({}, event), { needsAck: false }));
                }
            });
        });
    }
    /**
     * Close broker channel
     * @returns Promise<void>
     */
    close() {
        return this.broker.close();
    }
}

export { AckBroker, MessageBroker, StorageManager, StorageType };
