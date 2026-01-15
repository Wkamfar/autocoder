import React from 'react';

export interface EnterpriseOwner {
  name: string;
  role: string;
  rationale?: string;
}

export interface EnterpriseStrategicContact {
  name: string;
  roleTitle: string;
  channel: string;
  handleOrAddress: string;
  note: string;
}

export interface EnterpriseFlagshipInitiative {
  initiative: string;
  note: string;
}

export interface EnterpriseVoiceUseCase {
  title: string;
  description: string;
  impact: string;
  department: string;
  timeline: string;
  budget: string;
  currentChallenge: string;
}

export interface EnterpriseBrief {
  whyTheyMatter: string;
  howToWinThem: string;
  bestFirstMove: string;
  biggestRisks: string;
  goNoGoRule: string;
}

export type CompetitivePositioning = string | Record<string, string>;

export interface EconomicAnalysis {
  totalAddressableMarket?: string;
  immediateOpportunity?: string;
  threeYearRevenuePotential?: string;
  budgetBreakdown?: Record<string, string>;
  revenueSources?: Array<{
    source: string;
    amount: string;
    timeline: string;
    probability: string;
  }>;
  costSavingsForEnterprise?: string[];
  totalCloudSpending?: string;
  enterpriseSoftwareBudget?: string;
  developerPlatformAdoption?: string;
  poseRevenuePotential?: string;
  revenueBreakdown?: Record<string, string>;
  [key: string]: any; // Allow additional properties
}

export interface EnrichedEnterpriseRow {
  id: string;
  name: string;
  industry: string;
  revenue: number;
  employees: number;
  marketCap?: number;
  identityChallenges?: string[];
  flagshipInitiatives?: EnterpriseFlagshipInitiative[];
  strategicContacts?: EnterpriseStrategicContact[];
  owners?: EnterpriseOwner[];
  enterpriseBrief?: EnterpriseBrief;
  voiceTechnologyUseCases?: EnterpriseVoiceUseCase[];
  competitivePositioning?: CompetitivePositioning;
  riskMitigation?: string;
  timelineOptimization?: string;
  economicAnalysis?: EconomicAnalysis;
  lastUpdated?: string;
  nextSteps?: string[];
}

interface EnterpriseUniverseDetailPanelProps {
  enterprise: EnrichedEnterpriseRow;
  onClose: () => void;
}

export const EnterpriseUniverseDetailPanel: React.FC<EnterpriseUniverseDetailPanelProps> = ({
  enterprise,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{enterprise.name}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span>Industry: {enterprise.industry}</span>
                <span>Revenue: ${enterprise.revenue}B</span>
                <span>Employees: {enterprise.employees.toLocaleString()}</span>
                {enterprise.marketCap && <span>Market Cap: ${enterprise.marketCap}B</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Identity Challenges */}
              {enterprise.identityChallenges && enterprise.identityChallenges.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Identity Challenges</h3>
                  <div className="space-y-3">
                    {enterprise.identityChallenges.map((challenge, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-gray-300 text-sm leading-relaxed">{challenge}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagship Initiatives */}
              {enterprise.flagshipInitiatives && enterprise.flagshipInitiatives.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Flagship Initiatives</h3>
                  <div className="space-y-4">
                    {enterprise.flagshipInitiatives.map((initiative, index) => (
                      <div key={index} className="border-l-4 border-blue-400 pl-4">
                        <h4 className="text-white font-semibold mb-1">{initiative.initiative}</h4>
                        <p className="text-gray-300 text-sm">{initiative.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strategic Contacts */}
              {enterprise.strategicContacts && enterprise.strategicContacts.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Strategic Contacts</h3>
                  <div className="space-y-4">
                    {enterprise.strategicContacts.map((contact, index) => (
                      <div key={index} className="bg-gray-700/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-white font-semibold">{contact.name}</h4>
                            <p className="text-gray-300 text-sm">{contact.roleTitle}</p>
                          </div>
                          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                            {contact.channel}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{contact.handleOrAddress}</p>
                        <p className="text-gray-300 text-sm">{contact.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Enterprise Brief */}
              {enterprise.enterpriseBrief && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Enterprise Brief</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-blue-400 font-semibold mb-2">Why They Matter</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{enterprise.enterpriseBrief.whyTheyMatter}</p>
                    </div>
                    <div>
                      <h4 className="text-green-400 font-semibold mb-2">How to Win Them</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{enterprise.enterpriseBrief.howToWinThem}</p>
                    </div>
                    <div>
                      <h4 className="text-purple-400 font-semibold mb-2">Best First Move</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{enterprise.enterpriseBrief.bestFirstMove}</p>
                    </div>
                    <div>
                      <h4 className="text-red-400 font-semibold mb-2">Biggest Risks</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{enterprise.enterpriseBrief.biggestRisks}</p>
                    </div>
                    <div>
                      <h4 className="text-orange-400 font-semibold mb-2">Go/No-Go Rule</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{enterprise.enterpriseBrief.goNoGoRule}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Owners */}
              {enterprise.owners && enterprise.owners.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Account Owners</h3>
                  <div className="flex flex-wrap gap-2">
                    {enterprise.owners.map((owner, index) => (
                      <div key={index} className="bg-green-500/20 text-green-300 px-3 py-2 rounded-lg text-sm">
                        {owner.name} ({owner.role})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Voice Technology Use Cases */}
          {enterprise.voiceTechnologyUseCases && enterprise.voiceTechnologyUseCases.length > 0 && (
            <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Voice Technology Use Cases</h3>
              <div className="grid gap-6">
                {enterprise.voiceTechnologyUseCases.map((useCase, index) => (
                  <div key={index} className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2">{useCase.title}</h4>
                        <p className="text-gray-300 mb-4">{useCase.description}</p>

                        <div className="mb-4">
                          <h5 className="text-green-400 font-semibold mb-1">Impact</h5>
                          <p className="text-gray-300 text-sm">{useCase.impact}</p>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                          <h5 className="text-red-400 font-semibold mb-1">Current Challenge</h5>
                          <p className="text-gray-300 text-sm">{useCase.currentChallenge}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-blue-400 font-semibold mb-2">Target Department</h5>
                          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                            {useCase.department}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-purple-400 font-semibold mb-1">Timeline</h5>
                            <p className="text-gray-300 text-sm">{useCase.timeline}</p>
                          </div>
                          <div>
                            <h5 className="text-purple-400 font-semibold mb-1">Budget Range</h5>
                            <p className="text-gray-300 text-sm">{useCase.budget}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};