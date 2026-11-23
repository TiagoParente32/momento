import type { CalendarEvent, IntegrationId } from '@/lib/types';

export type AuthType = 'oauth' | 'token' | 'unavailable';

export interface ExternalTask {
  integration: IntegrationId;
  id: string;
  title: string;
  url?: string;
  due?: string | null;
}

/** Credentials collected from the user in the connect form. */
export interface ConnectInput {
  token?: string;
  key?: string; // Trello API key
}

export interface TokenField { name: keyof ConnectInput; label: string; placeholder?: string; help?: string; secret?: boolean }

export interface Integration {
  id: IntegrationId;
  name: string;
  description: string;
  category: 'calendar' | 'tasks' | 'dev' | 'media';
  authType: AuthType;
  /** OAuth provider whose client ID must be configured */
  oauthProvider?: 'google' | 'microsoft';
  /** fields to show for token auth */
  fields?: TokenField[];
  docsUrl?: string;
  /** explanation shown when authType === 'unavailable' */
  unavailableReason?: string;
  connect?: (input: ConnectInput) => Promise<void>;
  disconnect?: () => Promise<void>;
  /** verifies credentials; throws with a readable message on failure */
  test?: () => Promise<void>;
  fetchTasks?: () => Promise<ExternalTask[]>;
  fetchEvents?: (from: Date, to: Date) => Promise<CalendarEvent[]>;
}

export class IntegrationError extends Error {
  constructor(message: string, public reconnect = false) { super(message); }
}
