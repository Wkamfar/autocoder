export type PoseVoiceIhcPrompt = {
  tone_duration_ms: number;
  boundary_rule: "WAIT_FOR_TONE_END_THEN_SPEAK";
};

export type PoseVoiceEnrollStartResponse = {
  enrollment_id: string;
  pose_id: string;
  challenge: {
    ihc_prompt: PoseVoiceIhcPrompt;
    phrase: string;
    pose_challenge_id: string;
    policy_version: string;
  };
};

export type PoseVoiceEnrollCompleteResponse = {
  pose_id: string;
  voice_identity_commitment: string;
  voice_profile_version: string;
  public_identity_handle?: string;
};

export type PoseVoiceStatusResponse = {
  has_pose_identity: boolean;
  pose_id?: string;
  voice_profile_version?: string;
};

export type PoseVoiceVerifyResponse = {
  voice_similarity_score: number;
  presence_score: number;
  liveness_score: number | null;
  final_score: number;
  decision: "pass" | "fail";
  explanation: string;
  model_version: string;
  voice_profile_version: string;
};

