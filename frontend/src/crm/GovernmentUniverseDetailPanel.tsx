import React from 'react';

export interface GovernmentOwner {
  name: string;
  role: string;
}

export interface GovernmentStrategicContact {
  name: string;
  roleTitle: string;
  channel: string;
  handleOrAddress: string;
  note: string;
}

export interface GovernmentFlagshipProgram {
  program: string;
  note: string;
}

export interface GovernmentPoseUseCase {
  title: string;
  description: string;
  impact: string;
  agencies: string[];
  timeline: string;
  budget: string;
}

export interface GovernmentBrief {
  whyTheyMatter: string;
  howToWinThem: string;
  bestFirstMove: string;
  biggestRisks: string;
  goNoGoRule: string;
}

export interface EconomicAnalysis {
  totalAddressableMarket: string;
  immediateOpportunity: string;
  threeYearRevenuePotential: string;
  budgetBreakdown: Record<string, string>;
  revenueSources: Array<{
    source: string;
    amount: string;
    timeline: string;
    probability: string;
  }>;
  costSavingsForGovernment: string[];
}

export interface TechnicalRequirements {
  compliance: string[];
  poseFeaturesRequired: string[];
  integrationPoints: string[];
}

export interface CompetitivePositioning {
  [key: string]: string;
}

export interface WinStrategy {
  strategy: string;
  approach: string;
  timeline: string;
  revenue: string;
}

export interface DeploymentPhase {
  duration: string;
  activities: string[];
  deliverables: string[];
  revenue: string;
}

export interface DeploymentSchedule {
  [phaseName: string]: DeploymentPhase;
}

export interface EnrichedGovernmentRow {
  id: string;
  name: string;
  region: string;
  population: number;
  gdp: number;
  digitalAdoption: string;
  identityPriorities?: string[];
  flagshipPrograms?: GovernmentFlagshipProgram[];
  strategicContacts?: GovernmentStrategicContact[];
  owners?: GovernmentOwner[];
  governmentBrief?: GovernmentBrief;
  poseUseCases?: GovernmentPoseUseCase[];
  economicAnalysis?: EconomicAnalysis;
  technicalRequirements?: TechnicalRequirements;
  competitivePositioning?: CompetitivePositioning;
  winStrategies?: WinStrategy[];
  deploymentSchedule?: DeploymentSchedule;
  lastUpdated?: string;
  nextSteps?: string[];
}

interface GovernmentUniverseDetailPanelProps {
  government: EnrichedGovernmentRow;
  onClose: () => void;
}

export const GovernmentUniverseDetailPanel: React.FC<GovernmentUniverseDetailPanelProps> = ({
  government,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-red-900/50 p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{government.name}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span>Region: {government.region}</span>
                <span>Population: {government.population.toLocaleString()}</span>
                <span>GDP: ${government.gdp}B</span>
                <span>Digital Adoption: {government.digitalAdoption}</span>
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
              {/* Identity Priorities */}
              {government.identityPriorities && government.identityPriorities.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Identity Priorities</h3>
                  <div className="space-y-3">
                    {government.identityPriorities.map((priority, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-gray-300 text-sm leading-relaxed">{priority}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagship Programs */}
              {government.flagshipPrograms && government.flagshipPrograms.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Flagship Programs</h3>
                  <div className="space-y-4">
                    {government.flagshipPrograms.map((program, index) => (
                      <div key={index} className="border-l-4 border-green-400 pl-4">
                        <h4 className="text-white font-semibold mb-1">{program.program}</h4>
                        <p className="text-gray-300 text-sm">{program.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strategic Contacts */}
              {government.strategicContacts && government.strategicContacts.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Strategic Contacts</h3>
                  <div className="space-y-4">
                    {government.strategicContacts.map((contact, index) => (
                      <div key={index} className="bg-gray-700/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-white font-semibold">{contact.name}</h4>
                            <p className="text-gray-300 text-sm">{contact.roleTitle}</p>
                          </div>
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
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
              {/* Government Brief */}
              {government.governmentBrief && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Government Brief</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-green-400 font-semibold mb-2">Why They Matter</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{government.governmentBrief.whyTheyMatter}</p>
                    </div>
                    <div>
                      <h4 className="text-blue-400 font-semibold mb-2">How to Win Them</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{government.governmentBrief.howToWinThem}</p>
                    </div>
                    <div>
                      <h4 className="text-purple-400 font-semibold mb-2">Best First Move</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{government.governmentBrief.bestFirstMove}</p>
                    </div>
                    <div>
                      <h4 className="text-red-400 font-semibold mb-2">Biggest Risks</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{government.governmentBrief.biggestRisks}</p>
                    </div>
                    <div>
                      <h4 className="text-orange-400 font-semibold mb-2">Go/No-Go Rule</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{government.governmentBrief.goNoGoRule}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Owners */}
              {government.owners && government.owners.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Account Owners</h3>
                  <div className="flex flex-wrap gap-2">
                    {government.owners.map((owner, index) => (
                      <div key={index} className="bg-purple-500/20 text-purple-300 px-3 py-2 rounded-lg text-sm">
                        {owner.name} ({owner.role})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* POSE Use Cases */}
          {government.poseUseCases && government.poseUseCases.length > 0 && (
            <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">POSE Use Cases</h3>
              <div className="grid gap-6">
                {government.poseUseCases.map((useCase, index) => (
                  <div key={index} className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2">{useCase.title}</h4>
                        <p className="text-gray-300 mb-4">{useCase.description}</p>
                        <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                          <h5 className="text-green-400 font-semibold mb-1">Impact</h5>
                          <p className="text-gray-300 text-sm">{useCase.impact}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-blue-400 font-semibold mb-2">Target Agencies</h5>
                          <div className="flex flex-wrap gap-2">
                            {useCase.agencies.map((agency, i) => (
                              <span key={i} className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs">
                                {agency}
                              </span>
                            ))}
                          </div>
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