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
use crate::services::vaka_llm::{
    build_vaka_interrogation_prompt, clean_interrogation_text, execute_vaka_llm_chain,
    has_llm_api_key, LlmMessage,
};
use crate::storage::daily_content::ensure_daily_content;

#[derive(Clone, Debug, serde::Deserialize)]
pub struct TrpcQuery {
    pub batch: Option<u8>,
    pub input: Option<String>,
}

fn build_vaka_llm_messages(
    system_prompt: String,
    history: &[HistoryMessage],
    user_prompt: &str,
) -> Vec<LlmMessage> {
    // The current detective action is sent below as user_prompt, so omit the
    // trailing user item when the client already included it in history.
    let history_end = if history.last().map(|message| message.role.as_str()) == Some("user") {
        history.len().saturating_sub(1)
    } else {
        history.len()
    };

    let mut normalized: Vec<LlmMessage> = Vec::new();
    for item in &history[..history_end] {
        let role = if item.role == "assistant" { "assistant" } else { "user" };
        if let Some(previous) = normalized.last_mut().filter(|previous| previous.role == role) {
            if !item.content.is_empty() {
                if !previous.content.is_empty() {
                    previous.content.push('\n');
                }
                previous.content.push_str(&item.content);
            }
        } else {
            normalized.push(LlmMessage {
                role: role.to_string(),
                content: item.content.clone(),
            });
        }
    }

    if normalized.len() > 10 {
        normalized.drain(..normalized.len() - 10);
    }
    if normalized.first().map(|message| message.role.as_str()) == Some("assistant") {
        normalized.remove(0);
    }
    if normalized.last().map(|message| message.role.as_str()) == Some("user") {
        normalized.pop();
    }

    let mut messages = Vec::with_capacity(normalized.len() + 2);
    messages.push(LlmMessage {
        role: "system".to_string(),
        content: system_prompt,
    });
    messages.extend(normalized);
    messages.push(LlmMessage {
        role: "user".to_string(),
        content: user_prompt.to_string(),
    });
    messages
}

fn wrap_superjson_success(data: Value) -> Value {
    json!({ "result": { "data": { "json": data } } })
}

fn wrap_superjson_error(message: String) -> Value {
    json!({ "error": { "message": message, "code": -32004, "data": { "code": "NOT_FOUND", "httpStatus": 404 } } })
}

/// @trpc/client's httpBatchLink joins N procedure calls into one request: the path becomes
/// "proc1,proc2,..." and `input` (GET query string or POST body) becomes an object keyed by
/// index ("0", "1", ...). Extracts the superjson `.json` payload for a specific index.
fn parse_superjson_input_at(raw: &Value, index: usize) -> Value {
    let key = index.to_string();
    if let Some(entry) = raw.get(&key) {
        if let Some(json_field) = entry.get("json") {
            return json_field.clone();
        }
        return entry.clone();
    }
    // Non-batched single call: the whole payload IS the entry.
    if index == 0 {
        if let Some(json_field) = raw.get("json") {
            return json_field.clone();
        }
        return raw.clone();
    }
    json!({})
}

fn parse_query_input(raw: Option<&str>) -> Value {
    raw.and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or(json!({}))
}

fn semantic_field_match(answer: &str, expected: &str) -> bool {
    let answer_tokens: std::collections::HashSet<String> = answer
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| token.len() >= 3)
        .map(str::to_string)
        .collect();
    let expected_tokens: std::collections::HashSet<String> = expected
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| token.len() >= 3)
        .map(str::to_string)
        .collect();
    if answer_tokens.is_empty() || expected_tokens.is_empty() {
        return false;
    }
    let overlap = answer_tokens.intersection(&expected_tokens).count();
    overlap >= 2 || (overlap as f32 / expected_tokens.len() as f32) >= 0.28
}

async fn resolve_get_procedure(path: &str, input: &Value, headers: &mut HeaderMap) -> Result<Value, String> {
    Ok(match path {
        "daily.today" => {
            headers.insert(
                header::CACHE_CONTROL,
                // The 00:05 UTC daily-content cron changes this manifest once per day.
                // Keep the edge window short so the post-cron client refresh sees it.
                HeaderValue::from_static("public, max-age=0, s-maxage=60, stale-while-revalidate=60"),
            );
            let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
            let ensured = ensure_daily_content(&today, None, None).await;
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
        other => return Err(format!("Procedure not found: {other}")),
    })
}

async fn resolve_post_procedure(
    path: &str,
    input: &Value,
    llm_client: &reqwest::Client,
) -> Result<Value, String> {
    Ok(match path {
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
            let method = input.get("method").and_then(|v| v.as_str()).unwrap_or("");
            let motive = input.get("motive").and_then(|v| v.as_str()).unwrap_or("");
            let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("tr");
            let is_en = locale == "en";

            let cases = get_all_cases();
            let case_data = cases.iter().find(|c| c.id == case_id).unwrap_or(&cases[0]);
            let suspect = case_data.suspects.iter().find(|s| s.id == accused_id);
            let is_culprit = case_data.culprit_id == accused_id;
            let is_correct_clue = case_data.winning_contradiction.clue_id == decisive_clue_id;

            let method_match = semantic_field_match(method, if is_en { &case_data.correct_method_en } else { &case_data.correct_method });
            let motive_match = semantic_field_match(motive, if is_en { &case_data.correct_motive_en } else { &case_data.correct_motive });
            let success = is_culprit && is_correct_clue;
            let (score, grade) = if success && method_match && motive_match {
                (320, "S")
            } else if success && (method_match || motive_match) {
                (300, "A")
            } else if success {
                (280, "B")
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
                "methodMatch": method_match,
                "motiveMatch": motive_match,
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
            let is_final_interrogation = input.get("isFinalInterrogation").and_then(|v| v.as_bool()).unwrap_or(false);
            let exposed_sentence_id = input.get("exposedSentenceId").and_then(|v| v.as_str());
            let exposed_clue_id = input.get("exposedClueId").and_then(|v| v.as_str());
            let current_stress = input.get("currentStress").and_then(|v| v.as_u64()).unwrap_or(10) as u32;
            let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("tr");

            let cases = get_all_cases();
            let case_data = cases.iter().find(|c| c.id == case_id).unwrap_or(&cases[0]);
            let suspect = case_data.suspects.iter().find(|s| s.id == suspect_id).unwrap_or(&case_data.suspects[0]);

            let clean_q = clean_interrogation_text(raw_question);

            // Button actions create an automatic detective message. Keep that message in the
            // conversation history, but also resolve its structured entities here so the prompt
            // receives the real clue/suspect/contradiction facts instead of hard-coded prose.
            let presented_clue = presented_clue_id.and_then(|id| case_data.clues.iter().find(|c| c.id == id));
            let exposed_sentence = exposed_sentence_id
                .and_then(|id| suspect.detailed_statements.iter().find(|s| s.id == id));
            let exposed_clue = exposed_clue_id.and_then(|id| case_data.clues.iter().find(|c| c.id == id));
            let exposed_explanation = exposed_sentence.and_then(|s| {
                if locale == "en" { s.explanation_en.as_deref() } else { s.explanation.as_deref() }
            });

            let resolved_cross_suspect = cross_suspect_id
                .and_then(|id| case_data.suspects.iter().find(|s| s.id == id))
                .or_else(|| {
                    if clean_q.is_empty() { return None; }
                    case_data.suspects.iter().find(|s| {
                        s.id != suspect.id && clean_q.to_lowercase().contains(&s.name.to_lowercase())
                    })
                });
            let resolved_cross_mode = cross_mode.or_else(|| {
                if resolved_cross_suspect.is_some() && action_type == "cross_examine" {
                    Some("confront")
                } else { None }
            });

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
                cross_suspect_id: resolved_cross_suspect.map(|s| s.id.as_str()),
                cross_mode: resolved_cross_mode,
                cross_quote,
                bluff_claim,
                is_exposed_by_contradiction: is_exposed,
                is_final_interrogation,
                exposed_sentence: exposed_sentence.map(|s| s.text.as_str()),
                exposed_clue: exposed_clue.map(|c| if locale == "en" && !c.label_en.is_empty() { c.label_en.as_str() } else { c.label.as_str() }),
                exposed_explanation,
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

            let mut reply = det.text.clone();
            let mut source = "engine";
            let mut provider = None;
            let mut model = None;

            // Match the legacy behavior, but include structured context for every action that
            // originated from a button as well as free-form questions. The deterministic engine
            // remains the authoritative fallback if providers are unavailable or time out.
            if has_llm_api_key()
                && !det.confessed
                // The first post-exposure turn is an engine-controlled
                // acknowledgement. Do not let the LLM skip the guaranteed
                // final-question window by confessing early.
                && !(is_exposed && suspect.is_culprit && !is_final_interrogation)
                && matches!(action_type, "question" | "present_evidence" | "cross_examine" | "stay_silent" | "bluff" | "confront")
            {
                let other_suspects_info = case_data.suspects.iter()
                    .filter(|s| s.id != suspect.id)
                    .map(|s| format!("- {} ({}): {}", s.name, if locale == "en" && !s.role_en.is_empty() { &s.role_en } else { &s.role }, if locale == "en" && !s.statement_en.is_empty() { &s.statement_en } else { &s.statement }))
                    .collect::<Vec<_>>()
                    .join("\n");
                let action_truth_context = if locale == "en" {
                    let clue_truth = presented_clue.map(|c| {
                        if c.contradicts_suspect_id.as_deref() == Some(suspect.id.as_str()) {
                            "THIS IS THE CASE'S RELEVANT CONTRADICTING CLUE FOR THIS SUSPECT"
                        } else if c.clears_suspect_id.as_deref() == Some(suspect.id.as_str()) {
                            "THIS CLUE CLEARS THIS SUSPECT; IT IS NOT PROOF AGAINST THEM"
                        } else {
                            "THIS CLUE IS NOT A DIRECT CONTRADICTION OF THIS SUSPECT"
                        }
                    }).unwrap_or("NO EVIDENCE WAS PRESENTED");
                    let sentence_truth = exposed_sentence.map(|s| if s.is_contradiction {
                        "THE EXPOSED STATEMENT IS MARKED AS A TRUE CONTRADICTION BY THE CASE RULES"
                    } else {
                        "THE EXPOSED STATEMENT IS NOT MARKED AS A WINNING CONTRADICTION"
                    }).unwrap_or("NO SPECIFIC STATEMENT WAS EXPOSED");
                    format!(
                        "GAME-TRUTH CONTEXT (AUTHORITATIVE RULE ENGINE; DO NOT OVERRIDE):\n\
                         - Action: {}\n- Suspect is actual culprit: {}\n- Stress before/after: {}/{}; break threshold: {}\n\
                         - Evidence classification: {}\n- Statement classification: {}\n\
                         - Deterministic engine confessed: {}\n- Deterministic clue unlocked: {}\n\
                         - Deterministic suspect unlocked: {}\n\
                         Use these facts to make the response consistent. Do not invent a new culprit,\
                         change whether evidence is valid, or claim a confession unless the rule state supports it.",
                        action_type, suspect.is_culprit, current_stress, det.new_stress, suspect.break_threshold,
                        clue_truth, sentence_truth, det.confessed,
                        det.unlocked_clue_id.as_deref().unwrap_or("none"),
                        det.unlocked_suspect_id.as_deref().unwrap_or("none")
                    )
                } else {
                    let clue_truth = presented_clue.map(|c| {
                        if c.contradicts_suspect_id.as_deref() == Some(suspect.id.as_str()) {
                            "BU ŞÜPHELİYİ ÇÜRÜTEN DOSYA DELİLİ"
                        } else if c.clears_suspect_id.as_deref() == Some(suspect.id.as_str()) {
                            "BU ŞÜPHELİYİ AKLAYAN DELİL; ALEYHİNE KANIT DEĞİL"
                        } else {
                            "BU ŞÜPHELİYLE DOĞRUDAN ÇELİŞMEYEN DELİL"
                        }
                    }).unwrap_or("DELİL SUNULMADI");
                    let sentence_truth = exposed_sentence.map(|s| if s.is_contradiction {
                        "AÇIĞA ÇIKARILAN İFADE OLAY KURALLARINA GÖRE GERÇEK ÇELİŞKİ"
                    } else {
                        "AÇIĞA ÇIKARILAN İFADE KAZANDIRAN ÇELİŞKİ OLARAK İŞARETLİ DEĞİL"
                    }).unwrap_or("BELİRLİ BİR İFADE AÇIĞA ÇIKARILMADI");
                    format!(
                        "OYUN GERÇEĞİ BAĞLAMI (YETKİLİ DETERMINISTIC ENGINE; BUNU EZME):\n\
                         - Aksiyon: {}\n- Şüpheli gerçek fail: {}\n- Stres önce/sonra: {}/{}; kırılma eşiği: {}\n\
                         - Delil sınıflandırması: {}\n- İfade sınıflandırması: {}\n\
                         - Deterministic engine itiraf üretti: {}\n- Açılan delil: {}\n\
                         - Açılan şüpheli: {}\n\
                         Bu gerçeklere uygun tepki ver. Yeni fail uydurma, delilin geçerliliğini değiştirme \
                         ve kural durumu desteklemiyorsa itiraf etmiş gibi konuşma.",
                        action_type, suspect.is_culprit, current_stress, det.new_stress, suspect.break_threshold,
                        clue_truth, sentence_truth, det.confessed,
                        det.unlocked_clue_id.as_deref().unwrap_or("yok"),
                        det.unlocked_suspect_id.as_deref().unwrap_or("yok")
                    )
                };
                let prompt = build_vaka_interrogation_prompt(&crate::services::vaka_llm::VakaInterrogationPromptParams {
                    suspect,
                    new_stress: det.new_stress,
                    other_suspects_info: &other_suspects_info,
                    presented_clue,
                    action_type: Some(action_type),
                    cross_suspect: resolved_cross_suspect,
                    cross_mode: resolved_cross_mode,
                    is_exposed_by_contradiction: is_exposed,
                    exposed_sentence: exposed_sentence.map(|s| if locale == "en" && !s.text_en.is_empty() { s.text_en.as_str() } else { s.text.as_str() }),
                    exposed_clue: exposed_clue.map(|c| if locale == "en" && !c.label_en.is_empty() { c.label_en.as_str() } else { c.label.as_str() }),
                    exposed_explanation,
                    game_state_context: &action_truth_context,
                    case_data,
                    locale,
                });
                let user_prompt = if clean_q.is_empty() {
                    if locale == "en" { "Respond to the detective's latest action." } else { "Dedektifin son hamlesine yanıt ver." }
                } else { clean_q.as_str() };
                let messages = build_vaka_llm_messages(prompt, &history_msgs, user_prompt);

                if let Some(llm_result) = execute_vaka_llm_chain(llm_client, &messages, None).await {
                    reply = llm_result.text;
                    source = "llm";
                    provider = Some(llm_result.provider);
                    model = Some(llm_result.model);
                }
            }

            json!({
                "reply": reply,
                "behavioralCue": det.behavioral_cue,
                "stress": det.new_stress,
                "stressDelta": det.stress_delta,
                "confessed": det.confessed,
                "finalInterrogationAvailable": is_exposed && suspect.is_culprit && !is_final_interrogation && !det.confessed,
                "unlockedClueId": det.unlocked_clue_id,
                "unlockedClueLabel": det.unlocked_clue_label,
                "unlockedSuspectId": det.unlocked_suspect_id,
                "unlockedSuspectName": det.unlocked_suspect_name,
                "source": source,
                "provider": provider,
                "model": model,
            })
        }
        other => return Err(format!("Procedure not found: {other}")),
    })
}

pub async fn trpc_get_handler(
    Path(path): Path<String>,
    Query(query): Query<TrpcQuery>,
    State(_state): State<AppState>,
) -> Response {
    // httpBatchLink joins multiple procedure calls with commas ("vaka.config,vaka.getDailyCase")
    // and indexes their inputs ("0", "1", ...) in the query string — a single-call request is
    // just the degenerate N=1 case of the same shape.
    let procedures: Vec<&str> = path.split(',').collect();
    let is_batch = query.batch.unwrap_or(0) == 1 || procedures.len() > 1;
    let raw_input = parse_query_input(query.input.as_deref());

    let mut headers = HeaderMap::new();
    let mut items = Vec::with_capacity(procedures.len());
    for (index, proc_path) in procedures.iter().enumerate() {
        let input = parse_superjson_input_at(&raw_input, index);
        match resolve_get_procedure(proc_path, &input, &mut headers).await {
            Ok(data) => items.push(wrap_superjson_success(data)),
            Err(message) => items.push(wrap_superjson_error(message)),
        }
    }

    let body = if is_batch { json!(items) } else { items.into_iter().next().unwrap_or(json!({})) };
    (StatusCode::OK, headers, Json(body)).into_response()
}

pub async fn trpc_post_handler(
    Path(path): Path<String>,
    Query(query): Query<TrpcQuery>,
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Response {
    let procedures: Vec<&str> = path.split(',').collect();
    let is_batch = query.batch.unwrap_or(0) == 1 || procedures.len() > 1;

    let mut items = Vec::with_capacity(procedures.len());
    for (index, proc_path) in procedures.iter().enumerate() {
        let input = parse_superjson_input_at(&body, index);
        match resolve_post_procedure(proc_path, &input, &state.llm_client).await {
            Ok(data) => items.push(wrap_superjson_success(data)),
            Err(message) => items.push(wrap_superjson_error(message)),
        }
    }

    let response_body = if is_batch { json!(items) } else { items.into_iter().next().unwrap_or(json!({})) };
    (StatusCode::OK, Json(response_body)).into_response()
}

pub fn trpc_routes() -> Router<AppState> {
    Router::new()
        .route("/api/trpc/{path}", get(trpc_get_handler))
        .route("/api/trpc/{path}", post(trpc_post_handler))
}
