//! Vaka 16 Detailed Cases Repository
//! Loads embedded vaka_cases.json with full 16 cases data.

use std::sync::OnceLock;
use super::vaka_types::{to_public_case_dto, VakaCaseSummaryDto, VakaDetailedCase, VakaPublicCaseDto};

static CASES: OnceLock<Vec<VakaDetailedCase>> = OnceLock::new();

pub fn get_all_cases() -> &'static [VakaDetailedCase] {
    CASES.get_or_init(|| {
        let raw = include_str!("vaka_cases.json");
        serde_json::from_str(raw).expect("Failed to parse embedded vaka_cases.json")
    })
}

pub fn find_case_by_id(case_id: &str) -> Option<&'static VakaDetailedCase> {
    get_all_cases().iter().find(|c| c.id == case_id)
}

pub fn get_case_or_default(case_id: &str) -> &'static VakaDetailedCase {
    find_case_by_id(case_id).unwrap_or(&get_all_cases()[0])
}

pub fn get_cases_summary() -> Vec<VakaCaseSummaryDto> {
    get_all_cases()
        .iter()
        .map(|c| VakaCaseSummaryDto {
            id: c.id.clone(),
            title: c.title.clone(),
            title_en: c.title_en.clone(),
            difficulty: c.difficulty.clone(),
            briefing: c.briefing.clone(),
            briefing_en: c.briefing_en.clone(),
            incident_time: c.incident_time.clone(),
            location: c.location.clone(),
            location_en: c.location_en.clone(),
            victim: c.victim.clone(),
            suspect_count: c.suspects.len(),
            clue_count: c.clues.len(),
        })
        .collect()
}

pub fn get_case_detail_dto(case_id: &str) -> VakaPublicCaseDto {
    let case_data = get_case_or_default(case_id);
    to_public_case_dto(case_data)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyCaseResponse {
    pub date: String,
    pub case_index: usize,
    pub case: VakaPublicCaseDto,
}

pub fn get_daily_case_dto(year: i32, month: u32, day: u32) -> DailyCaseResponse {
    let cases = get_all_cases();
    let day_index = ((year * 365 + (month as i32) * 31 + day as i32) as usize) % cases.len();
    let selected = &cases[day_index];
    DailyCaseResponse {
        date: format!("{:04}-{:02}-{:02}", year, month, day),
        case_index: day_index + 1,
        case: to_public_case_dto(selected),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_all_16_cases() {
        let cases = get_all_cases();
        assert_eq!(cases.len(), 16);
        assert_eq!(cases[0].id, "case-01-atlantis-saati");
        assert_eq!(cases[0].culprit_id, "suspect-bora");
        assert_eq!(cases[0].suspects.len(), 3);
        assert_eq!(cases[0].clues.len(), 4);
    }

    #[test]
    fn test_find_case() {
        let found = find_case_by_id("case-01-atlantis-saati");
        assert!(found.is_some());
        assert_eq!(found.unwrap().title, "Kayıp Atlantis Saati");
    }

    #[test]
    fn test_daily_case() {
        let daily = get_daily_case_dto(2026, 9, 20);
        assert_eq!(daily.date, "2026-09-20");
        assert!(daily.case_index >= 1 && daily.case_index <= 16);
    }
}
