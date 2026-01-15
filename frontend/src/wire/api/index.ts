// Unified API client that switches between mock and real backend
import { isMockMode } from './config';
import { wireApi } from './client';
import { mockApi } from '../data/mockApi';

// Export the appropriate API based on mode
export const api = isMockMode() ? mockApi : wireApi;

// Export config for UI to show current mode
export { API_CONFIG, isMockMode } from './config';

// Re-export types
export type {
  TransferIntent,
  VoiceChallenge,
  VoiceProof,
  Decision,
  Beneficiary,
  ApprovalStatus,
  EventLog,
  AuditBundle,
  PolicyVersion,
  ServiceHealth,
} from '../types/wire';
