/**
 * Single entry surface for Track A + v1 sources (plan §8): same mutation path for all adapters.
 */
export { importCsvToSourcesAndProposals, parseCsv } from '../adapters/csvImport.js';
export { ingestGmailMetadata } from '../adapters/gmailMetadata.js';
export { ingestPublicRegistryFeed } from '../adapters/publicFeedStub.js';
export { resolveAccountCandidate } from './entityResolution.js';
export { routeCandidate } from './candidateRouting.js';
export { defaultAutoApplyAllowed } from './mutationRoutingPolicy.js';
export { freshnessForIngest } from './freshnessPolicy.js';
