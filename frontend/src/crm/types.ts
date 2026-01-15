export interface CrmTodayItem {
  id: string;
  relationshipName: string;
  type: string;
  stage: string;
  status: string;
  ownerName: string;
  expectedValueUsd: number | null;
  confidence: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
}

export interface CrmTodayOpportunity extends CrmTodayItem {
  daysSinceLastInteraction?: number | null;
  blockedReason?: string | null;
}

export interface CrmTodayTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  relationshipName: string | null;
  opportunityId: string | null;
  ownerName: string;
}

export type TodaySectionId =
  | "overdue"
  | "dueToday"
  | "hot"
  | "waitingOnThem"
  | "draftsReady";

export interface TodaySection {
  id: TodaySectionId;
  label: string;
  description: string;
}

export interface TodaySectionBuckets {
  opportunities: CrmTodayOpportunity[];
  tasks: CrmTodayTask[];
}

export type TodaySections = Record<TodaySectionId, TodaySectionBuckets>;


