//! Vaka Detective & AI Case Data Types
//! Matches shared/vakaTypes.ts.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LocalizedText {
    pub tr: String,
    pub en: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct BehavioralCues {
    pub calm: LocalizedText,
    pub nervous: LocalizedText,
    pub breaking: LocalizedText,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Lies {
    pub level1: String,
    pub level2: String,
    pub level3: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UnlockCondition {
    pub keywords: Vec<String>,
    pub hint_tr: String,
    pub hint_en: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger_suspect_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaSuspectSentence {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub text_en: String,
    pub is_contradiction: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contradiction_clue_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation_en: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaSuspect {
    pub id: String,
    pub name: String,
    pub role: String,
    #[serde(default)]
    pub role_en: String,
    pub age: u32,
    pub temperament: String,
    #[serde(default)]
    pub temperament_en: String,
    pub relationship_to_victim: String,
    #[serde(default)]
    pub relationship_to_victim_en: String,
    pub statement: String,
    #[serde(default)]
    pub statement_en: String,
    pub detailed_statements: Vec<VakaSuspectSentence>,
    pub is_culprit: bool,
    pub alibi: String,
    #[serde(default)]
    pub alibi_en: String,
    pub motive: String,
    #[serde(default)]
    pub motive_en: String,
    pub minor_secret: String,
    #[serde(default)]
    pub minor_secret_en: String,
    pub break_threshold: u32,
    #[serde(default)]
    pub gossip: HashMap<String, LocalizedText>,
    pub behavioral_cues: BehavioralCues,
    pub lies: Lies,
    pub confession: String,
    #[serde(default)]
    pub confession_en: String,
    #[serde(default)]
    pub is_initially_locked: Option<bool>,
    #[serde(default)]
    pub unlock_condition: Option<UnlockCondition>,
    #[serde(default)]
    pub alibi_denial: Option<LocalizedText>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaClue {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub label_en: String,
    pub detail: String,
    #[serde(default)]
    pub detail_en: String,
    pub category: String,
    #[serde(rename = "type")]
    pub clue_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contradicts_suspect_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clears_suspect_id: Option<String>,
    pub significance: String,
    #[serde(default)]
    pub significance_en: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaTimelineEvent {
    pub time: String,
    pub event: String,
    #[serde(default)]
    pub event_en: String,
    pub verified: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaVictim {
    pub name: String,
    pub occupation: String,
    #[serde(default)]
    pub occupation_en: String,
    pub cause_of_death: String,
    #[serde(default)]
    pub cause_of_death_en: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct VakaCrimeSceneNotes {
    pub tr: Vec<String>,
    pub en: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WinningContradiction {
    pub suspect_id: String,
    pub sentence_id: String,
    pub clue_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaDetailedCase {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub title_en: String,
    pub difficulty: String,
    pub briefing: String,
    #[serde(default)]
    pub briefing_en: String,
    pub incident_time: String,
    pub location: String,
    #[serde(default)]
    pub location_en: String,
    pub victim: VakaVictim,
    pub timeline: Vec<VakaTimelineEvent>,
    pub crime_scene_notes: VakaCrimeSceneNotes,
    pub suspects: Vec<VakaSuspect>,
    pub clues: Vec<VakaClue>,
    pub culprit_id: String,
    pub correct_method: String,
    #[serde(default)]
    pub correct_method_en: String,
    pub correct_motive: String,
    #[serde(default)]
    pub correct_motive_en: String,
    pub winning_contradiction: WinningContradiction,
    pub analyst_summary: LocalizedText,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaCaseSummaryDto {
    pub id: String,
    pub title: String,
    pub title_en: String,
    pub difficulty: String,
    pub briefing: String,
    pub briefing_en: String,
    pub incident_time: String,
    pub location: String,
    pub location_en: String,
    pub victim: VakaVictim,
    pub suspect_count: usize,
    pub clue_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaPublicSuspectSentenceDto {
    pub id: String,
    pub text: String,
    pub text_en: String,
    pub is_contradiction: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaPublicSuspectDto {
    pub id: String,
    pub name: String,
    pub role: String,
    pub role_en: String,
    pub age: u32,
    pub temperament: String,
    pub temperament_en: String,
    pub relationship_to_victim: String,
    pub relationship_to_victim_en: String,
    pub statement: String,
    pub statement_en: String,
    pub alibi: String,
    pub alibi_en: String,
    pub detailed_statements: Vec<VakaPublicSuspectSentenceDto>,
    pub gossip: HashMap<String, LocalizedText>,
    pub behavioral_cues: BehavioralCues,
    pub is_initially_locked: bool,
    pub unlock_condition: Option<UnlockCondition>,
    pub alibi_denial: Option<LocalizedText>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaPublicClueDto {
    pub id: String,
    pub label: String,
    pub label_en: String,
    pub detail: String,
    pub detail_en: String,
    pub category: String,
    #[serde(rename = "type")]
    pub clue_type: String,
    pub significance: String,
    pub significance_en: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VakaPublicCaseDto {
    pub id: String,
    pub title: String,
    pub title_en: String,
    pub difficulty: String,
    pub briefing: String,
    pub briefing_en: String,
    pub incident_time: String,
    pub location: String,
    pub location_en: String,
    pub victim: VakaVictim,
    pub timeline: Vec<VakaTimelineEvent>,
    pub crime_scene_notes: VakaCrimeSceneNotes,
    pub analyst_summary: LocalizedText,
    pub suspects: Vec<VakaPublicSuspectDto>,
    pub clues: Vec<VakaPublicClueDto>,
}

pub fn to_public_case_dto(found: &VakaDetailedCase) -> VakaPublicCaseDto {
    VakaPublicCaseDto {
        id: found.id.clone(),
        title: found.title.clone(),
        title_en: found.title_en.clone(),
        difficulty: found.difficulty.clone(),
        briefing: found.briefing.clone(),
        briefing_en: found.briefing_en.clone(),
        incident_time: found.incident_time.clone(),
        location: found.location.clone(),
        location_en: found.location_en.clone(),
        victim: found.victim.clone(),
        timeline: found.timeline.clone(),
        crime_scene_notes: found.crime_scene_notes.clone(),
        analyst_summary: found.analyst_summary.clone(),
        suspects: found
            .suspects
            .iter()
            .map(|s| VakaPublicSuspectDto {
                id: s.id.clone(),
                name: s.name.clone(),
                role: s.role.clone(),
                role_en: s.role_en.clone(),
                age: s.age,
                temperament: s.temperament.clone(),
                temperament_en: s.temperament_en.clone(),
                relationship_to_victim: s.relationship_to_victim.clone(),
                relationship_to_victim_en: s.relationship_to_victim_en.clone(),
                statement: s.statement.clone(),
                statement_en: s.statement_en.clone(),
                alibi: s.alibi.clone(),
                alibi_en: s.alibi_en.clone(),
                detailed_statements: s
                    .detailed_statements
                    .iter()
                    .map(|ds| VakaPublicSuspectSentenceDto {
                        id: ds.id.clone(),
                        text: ds.text.clone(),
                        text_en: ds.text_en.clone(),
                        is_contradiction: ds.is_contradiction,
                    })
                    .collect(),
                gossip: s.gossip.clone(),
                behavioral_cues: s.behavioral_cues.clone(),
                is_initially_locked: s.is_initially_locked.unwrap_or(false),
                unlock_condition: s.unlock_condition.clone(),
                alibi_denial: s.alibi_denial.clone(),
            })
            .collect(),
        clues: found
            .clues
            .iter()
            .map(|c| VakaPublicClueDto {
                id: c.id.clone(),
                label: c.label.clone(),
                label_en: c.label_en.clone(),
                detail: c.detail.clone(),
                detail_en: c.detail_en.clone(),
                category: c.category.clone(),
                clue_type: c.clue_type.clone(),
                significance: c.significance.clone(),
                significance_en: c.significance_en.clone(),
            })
            .collect(),
    }
}
