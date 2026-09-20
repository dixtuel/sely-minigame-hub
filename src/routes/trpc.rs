//! tRPC v11 JSON-RPC Batch Router
//! Provides full bidirectional compatibility with @trpc/client httpBatchLink and SuperJSON transformer.
//! Implements daily.today (with 600s Edge CDN caching), auth.*, system.*, and vaka.* procedures.
//! Matches server/routers.ts and server/routers/vakaRouter.ts.

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};

use super::leaderboard::AppState;
use crate::services::vaka_cases::{
    get_all_cases, get_case_detail_dto, get_cases_summary, get_daily_case_dto,
};
use crate::services::vaka_engine::{
    process_deterministic_interrogation, HistoryMessage, InterrogationPayload,
};
use crate::services::vaka_llm::{clean_interrogation_text, has_llm_api_key};
use crate::storage::daily_content::MemoryDailyStore;

#[derive(Clone, Debug, serde::Deserialize)]
pub struct TrpcQuery {
    pub batch: Option<u8>,
    pub input: Option<String>,
}

fn wrap_superjson_response(data: Value, is_batch: bool) -> Value {
    let item = json!({
        "result": {
            "data": {
                "json": data
            }
        }
    });

    if is_batch {
        json!([item])
    } else {
        item
    }
}

fn parse_superjson_input(raw: Option<&str>) -> Value {
    if let Some(s) = raw {
        if let Ok(parsed) = serde_json::from_str::<Value>(s) {
            if let Some(batch_0) = parsed.get("0") {
                if let Some(json_field) = batch_0.get("json") {
                    return json_field.clone();
                }
                return batch_0.clone();
            }
            if let Some(json_field) = parsed.get("json") {
                return json_field.clone();
            }
            return parsed;
        }
    }
    json!({})
}

pub async fn trpc_get_handler(
    Path(path): Path<String>,
    Query(query): Query<TrpcQuery>,
    State(_state): State<AppState>,
) -> Response {
    let is_batch = query.batch.unwrap_or(0) == 1;
    let input = parse_superjson_input(query.input.as_deref());

    let mut headers = HeaderMap::new();

    let result_data = match path.as_str() {
        "daily.today" => {
            headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=600, s-maxage=600, stale-while-revalidate=86400"),
            );
            let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
            let store = MemoryDailyStore::new();
            let ensured = store.ensure(&today);
            serde_json::to_value(ensured).unwrap_or(json!({}))
        }
        "auth.me" => json!(null),
        "system.health" => json!({ "ok": true }),
        "vaka.config" | "vaka.getConfig" => json!({
            "enabledModes": ["interrogation", "contradiction", "daily"],
            "defaultMode": "interrogation",
            "hasLlmKeys": has_llm_api_key(),
        }),
        "vaka.getCases" => {
            let cases = get_cases_summary();
            serde_json::to_value(cases).unwrap_or(json!([]))
        }
        "vaka.getCaseDetail" => {
            let case_id = input.get("caseId").and_then(|v| v.as_str()).unwrap_or("case-01-atlantis-saati");
            let dto = get_case_detail_dto(case_id);
            serde_json::to_value(dto).unwrap_or(json!({}))
        }
        "vaka.getDailyCase" => {
            let now = chrono::Utc::now();
            use chrono::Datelike;
            let daily = get_daily_case_dto(now.year(), now.month(), now.day());
            serde_json::to_value(daily).unwrap_or(json!({}))
        }
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": { "message": format!("Procedure not found: {}", path) } })),
            )
                .into_response();
        }
    };

    (StatusCode::OK, headers, Json(wrap_superjson_response(result_data, is_batch))).into_response()
}

pub async fn trpc_post_handler(
    Path(path): Path<String>,
    Query(query): Query<TrpcQuery>,
    State(_state): State<AppState>,
    Json(body): Json<Value>,
) -> Response {
    let is_batch = query.batch.unwrap_or(0) == 1;
    let input = if let Some(batch_0) = body.get("0") {
        if let Some(json_field) = batch_0.get("json") {
            json_field.clone()
        } else {
            batch_0.clone()
        }
    } else if let Some(json_field) = body.get("json") {
        json_field.clone()
    } else {
        body
    };

    let result_data = match path.as_str() {
        "auth.logout" => json!({ "success": true }),
        "system.notifyOwner" => json!({ "success": true }),
        "vaka.checkContradiction" => {
            let case_id = input.get("caseId").and_then(|v| v.as_str()).unwrap_or("");
            let suspect_id = input.get("suspectId").and_then(|v| v.as_str()).unwrap_or("");
            let sentence_id = input.get("sentenceId").and_then(|v| v.as_str()).unwrap_or("");
            let clue_id = input.get("clueId").and_then(|v| v.as_str()).unwrap_or("");
            let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("tr");
            let is_en = locale == "en";

            let cases = get_all_cases();
            let case_data = cases.iter().find(|c| c.id == case_id).unwrap_or(&cases[0]);
            let suspect = case_data.suspects.iter().find(|s| s.id == suspect_id);

            if let Some(s) = suspect {
                let sentence = s.detailed_statements.iter().find(|ds| ds.id == sentence_id);
                let clue = case_data.clues.iter().find(|c| c.id == clue_id);

                if let (Some(st), Some(cl)) = (sentence, clue) {
                    let is_match = st.is_contradiction && st.contradiction_clue_id.as_deref() == Some(cl.id.as_str());
                    if is_match {
                        let msg = if is_en {
                            st.explanation_en.as_deref().unwrap_or("OBJECTION! The testimony directly contradicts the physical evidence!")
                        } else {
                            st.explanation.as_deref().unwrap_or("İTİRAZ! İfade doğrudan fiziksel kanıtla çelişiyor!")
                        };
                        json!({ "success": true, "message": msg, "penalty": 0 })
                    } else {
                        let msg = if is_en {
                            "OBJECTION OVERRULED! This clue does not disprove this specific statement."
                        } else {
                            "İTİRAZ REDDEDİLDİ! Bu kanıt seçtiğin cümleyi yalanlamıyor."
                        };
                        json!({ "success": false, "message": msg, "penalty": 15 })
                    }
                } else {
                    json!({ "success": false, "message": if is_en { "Invalid selection." } else { "Geçersiz seçim." }, "penalty": 0 })
                }
            } else {
                json!({ "success": false, "message": if is_en { "Suspect not found." } else { "Şüpheli bulunamadı." }, "penalty": 0 })
            }
        }
        "vaka.accuse" => {
            let case_id = input.get("caseId").and_then(|v| v.as_str()).unwrap_or("");
            let accused_id = input.get("accusedId").and_then(|v| v.as_str()).unwrap_or("");
            let decisive_clue_id = input.get("decisiveClueId").and_then(|v| v.as_str()).unwrap_or("");
            let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("tr");
            let is_en = locale == "en";

            let cases = get_all_cases();
            let case_data = cases.iter().find(|c| c.id == case_id).unwrap_or(&cases[0]);
            let suspect = case_data.suspects.iter().find(|s| s.id == accused_id);
            let is_culprit = case_data.culprit_id == accused_id;
            let is_correct_clue = case_data.winning_contradiction.clue_id == decisive_clue_id;

            let success = is_culprit && is_correct_clue;
            let (score, grade) = if success {
                (280, "S")
            } else if is_culprit && !is_correct_clue {
                (140, "B")
            } else {
                (0, "C")
            };

            let culprit_name = case_data.suspects.iter().find(|s| s.id == case_data.culprit_id).map(|s| s.name.as_str()).unwrap_or("");
            let confession = if success {
                suspect.map(|s| if is_en && !s.confession_en.is_empty() { s.confession_en.as_str() } else { s.confession.as_str() })
            } else {
                None
            };

            let message = if success {
                if is_en {
                    format!("CASE CLOSED! {} was formally indicted. The court unanimously accepted the charges.", suspect.map(|s| s.name.as_str()).unwrap_or(""))
                } else {
                    format!("VAKA KAPANDI! {} resmen tutuklandı. Mahkeme sunduğun delilleri eksiksiz kabul etti.", suspect.map(|s| s.name.as_str()).unwrap_or(""))
                }
            } else {
                if is_en {
                    "CHARGES DISMISSED! Insufficient evidence or wrong suspect. The true culprit walked free.".to_string()
                } else {
                    "DAVA DÜŞTÜ! Yetersiz delil veya yanlış şüpheli suçlandı. Gerçek fail serbest kaldı.".to_string()
                }
            };

            json!({
                "success": success,
                "grade": grade,
                "score": score,
                "verdict": if success { "guilty" } else { "not_guilty" },
                "culpritName": culprit_name,
                "confession": confession,
                "message": message,
            })
        }
        "vaka.interrogate" => {
            let case_id = input.get("caseId").and_then(|v| v.as_str()).unwrap_or("");
            let suspect_id = input.get("suspectId").and_then(|v| v.as_str()).unwrap_or("");
            let action_type = input.get("actionType").and_then(|v| v.as_str()).unwrap_or("question");
            let raw_question = input.get("question").and_then(|v| v.as_str()).unwrap_or("");
            let presented_clue_id = input.get("presentedClueId").and_then(|v| v.as_str());
            let cross_suspect_id = input.get("crossSuspectId").and_then(|v| v.as_str());
            let cross_mode = input.get("crossMode").and_then(|v| v.as_str());
            let cross_quote = input.get("crossQuote").and_then(|v| v.as_str());
            let bluff_claim = input.get("bluffClaim").and_then(|v| v.as_str());
            let is_exposed = input.get("isExposedByContradiction").and_then(|v| v.as_bool()).unwrap_or(false);
            let current_stress = input.get("currentStress").and_then(|v| v.as_u64()).unwrap_or(10) as u32;
            let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("tr");

            let cases = get_all_cases();
            let case_data = cases.iter().find(|c| c.id == case_id).unwrap_or(&cases[0]);
            let suspect = case_data.suspects.iter().find(|s| s.id == suspect_id).unwrap_or(&case_data.suspects[0]);

            let clean_q = clean_interrogation_text(raw_question);

            let mut history_msgs: Vec<HistoryMessage> = Vec::new();
            if let Some(hist_arr) = input.get("history").and_then(|h| h.as_array()) {
                for item in hist_arr {
                    let role = item.get("role").and_then(|v| v.as_str()).unwrap_or("user").to_string();
                    let content = clean_interrogation_text(item.get("content").and_then(|v| v.as_str()).unwrap_or(""));
                    let act = item.get("actionType").and_then(|v| v.as_str()).map(|s| s.to_string());
                    history_msgs.push(HistoryMessage { role, content, action_type: act });
                }
            }

            let payload = InterrogationPayload {
                question: Some(&clean_q),
                presented_clue_id,
                cross_suspect_id,
                cross_mode,
                cross_quote,
                bluff_claim,
                is_exposed_by_contradiction: is_exposed,
                exposed_sentence: None,
                exposed_clue: None,
                exposed_explanation: None,
                history: &history_msgs,
            };

            let det = process_deterministic_interrogation(
                case_data,
                &suspect.id,
                action_type,
                &payload,
                current_stress,
                locale,
            );

            json!({
                "reply": det.text,
                "behavioralCue": det.behavioral_cue,
                "stress": det.new_stress,
                "stressDelta": det.stress_delta,
                "confessed": det.confessed,
                "unlockedClueId": det.unlocked_clue_id,
                "unlockedClueLabel": det.unlocked_clue_label,
                "unlockedSuspectId": det.unlocked_suspect_id,
                "unlockedSuspectName": det.unlocked_suspect_name,
                "source": "engine",
            })
        }
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": { "message": format!("Procedure not found: {}", path) } })),
            )
                .into_response();
        }
    };

    (StatusCode::OK, Json(wrap_superjson_response(result_data, is_batch))).into_response()
}

pub fn trpc_routes() -> Router<AppState> {
    Router::new()
        .route("/api/trpc/:path", get(trpc_get_handler))
        .route("/api/trpc/:path", post(trpc_post_handler))
}
