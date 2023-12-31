import { useEffect, useRef, useState } from "react";
import {
  MessageBroker,
  ChannelEvent,
  StorageManager,
  StorageType,
  AckBroker,
  AckEvent,
  AckSettings,
} from "api-management-widget-helper";

export interface UseMessageBrokerProps {
  channelName?: string | undefined;
  topic?: string;
  callback?: (event: ChannelEvent) => void;
}

export interface IUseMessageBroker {
  publish: (message: string, topicOverride?: string) => void;
  subscribe: (topicOverride?: string, callbackOverride?: (event: ChannelEvent | any) => void) => boolean;
  close: () => Promise<void>;
  lastEvent: ChannelEvent | null;
}
export function useMessageBroker({
  channelName,
  topic = "default",
  callback,
}: UseMessageBrokerProps): IUseMessageBroker {
  const brokerRef = useRef<MessageBroker | null>(null);
  const [lastEvent, setLastEvent] = useState<ChannelEvent | null>(null);

  useEffect(() => {
    if (!brokerRef.current) {
      brokerRef.current = new MessageBroker(channelName);
    }
  }, []);

  const subscribe = (topicOverride?: string, callbackOverride?: (event: ChannelEvent | any) => void) => {
    if (!brokerRef.current) {
      return false;
    }
    return brokerRef?.current?.subscribe(topicOverride || topic, (event: ChannelEvent) => {
      setLastEvent(event);
      if (callback && typeof callback === "function") {
        callback(event);
      }
      if (callbackOverride && typeof callbackOverride === "function") {
        callbackOverride(event);
      }
    });
  };

  const publish = (message: string, topicOverride?: string) => {
    brokerRef?.current?.publish({ topic: topicOverride || topic, message });
  };
  const close = (): Promise<void> => {
    return brokerRef?.current?.close() ?? Promise.reject();
  };

  return {
    publish,
    subscribe,
    close,
    lastEvent,
  };
}

export interface IUseStorageManager {
  getItem: (key: string) => string;
  setItem: (key: string, value: string) => void;
  clear: () => void;
}
export function useStorageManager(storageType?: StorageType) {
  const storageRef = useRef<StorageManager | null>(null);

  useEffect(() => {
    if (!storageRef.current) {
      storageRef.current = new StorageManager(storageType);
    }
  }, []);

  const getItem = (key: string) => {
    return storageRef?.current?.getItem(key);
  };
  const setItem = (key: string, value: string) => {
    storageRef?.current?.setItem(key, value);
  };
  const clear = () => {
    storageRef?.current?.clear();
  };
  return {
    getItem,
    setItem,
    clear,
  };
}

export interface UseAckBrokerProps {
  channelName?: string;
  settings?: AckSettings;
}

export interface IUseAckBroker {
  send: (topic: string, message: string) => void;
  received: (event: AckEvent) => void;
  close: () => Promise<void>;
}

export function useAckBroker({ channelName, settings }: UseAckBrokerProps): IUseAckBroker {
  const ackBrokerRef = useRef<AckBroker | null>(null);

  useEffect(() => {
    if (!ackBrokerRef.current) {
      ackBrokerRef.current = new AckBroker(channelName, settings);
    }
  }, []);

  const send = (topic: string, message: string): Promise<AckEvent | Error> => {
    return ackBrokerRef?.current?.send({ topic, message }) ?? Promise.reject();
  };
  const received = (event: AckEvent): void => {
    ackBrokerRef?.current?.received(event);
  };

  const close = (): Promise<void> => {
    return ackBrokerRef?.current?.close() ?? Promise.reject();
  };

  return {
    send,
    received,
    close,
  };
}
