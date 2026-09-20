//! Vaka LLM Service
//! Multi-provider fallback chain (Groq, Nvidia NIM, Mistral) with reasoning tag stripping,
//! prompt sanitizer, and police interrogation prompt builder.
//! Matches server/services/vakaLlmService.ts.

use std::env;
use std::time::Duration;
use regex::Regex;
use serde::{Deserialize, Serialize};
use super::vaka_types::{VakaClue, VakaDetailedCase, VakaSuspect};

pub fn strip_reasoning_blocks(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let r_think = Regex::new(r"(?is)<think>.*?</think>").unwrap();
    let r_unclosed_think = Regex::new(r"(?is)<think>.*$").unwrap();
    let r_leading_think = Regex::new(r"(?is)^.*?</think>").unwrap();
    let r_thought = Regex::new(r"(?is)<thought>.*?</thought>").unwrap();
    let r_reasoning = Regex::new(r"(?is)<reasoning>.*?</reasoning>").unwrap();
    let r_bracket_think = Regex::new(r"(?is)\[THINK\].*?\[/THINK\]").unwrap();

    let mut cleaned = r_think.replace_all(text, "").into_owned();
    cleaned = r_unclosed_think.replace_all(&cleaned, "").into_owned();
    cleaned = r_leading_think.replace_all(&cleaned, "").into_owned();
    cleaned = r_thought.replace_all(&cleaned, "").into_owned();
    cleaned = r_reasoning.replace_all(&cleaned, "").into_owned();
    cleaned = r_bracket_think.replace_all(&cleaned, "").into_owned();

    cleaned.trim().to_string()
}

pub fn clean_interrogation_text(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }
    let r_lead = Regex::new(r"(?i)^\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|YÜZLEŞTİRME|CONFRONTATION)\]\s*").unwrap();
    let r_any = Regex::new(r"(?i)\[(TAKTİKSEL BLÖF|TACTICAL BLUFF|SESSİZLİK & BASKI|SILENCE & PRESSURE|ÇAPRAZ SORGU|CROSS-EXAM|YÜZLEŞTİRME|CONFRONTATION)\]").unwrap();

    let step1 = r_lead.replace_all(text, "");
    let step2 = r_any.replace_all(&step1, "");
    step2.trim().to_string()
}

pub fn get_secret_key(name: &str) -> String {
    env::var(name).unwrap_or_default().trim().to_string()
}

pub fn has_llm_api_key() -> bool {
    !get_secret_key("GROQ_API_KEY").is_empty()
        || !get_secret_key("GROQ_API_KEY_2").is_empty()
        || !get_secret_key("NVIDIA_NIM_API_KEY").is_empty()
        || !get_secret_key("NVIDIA_API_KEY").is_empty()
        || !get_secret_key("NIM_API_KEY").is_empty()
        || !get_secret_key("MISTRAL_API_KEY").is_empty()
}

pub struct VakaInterrogationPromptParams<'a> {
    pub suspect: &'a VakaSuspect,
    pub new_stress: u32,
    pub other_suspects_info: &'a str,
    pub presented_clue: Option<&'a VakaClue>,
    pub action_type: Option<&'a str>,
    pub cross_suspect: Option<&'a VakaSuspect>,
    pub cross_mode: Option<&'a str>, // "ask_about" | "confront"
    pub is_exposed_by_contradiction: bool,
    pub exposed_sentence: Option<&'a str>,
    pub exposed_clue: Option<&'a str>,
    pub exposed_explanation: Option<&'a str>,
    pub case_data: &'a VakaDetailedCase,
    pub locale: &'a str,
}

pub fn build_vaka_interrogation_prompt(params: &VakaInterrogationPromptParams) -> String {
    let is_en = params.locale == "en";
    let suspect = params.suspect;
    let cross_mode = params.cross_mode.unwrap_or("confront");

    let mut gossip_lines = Vec::new();
    for (other_id, g) in &suspect.gossip {
        let text = if is_en { &g.en } else { &g.tr };
        gossip_lines.push(format!("- {}: \"{}\"", other_id, text));
    }
    let gossip_section = if !gossip_lines.is_empty() {
        gossip_lines.join("\n")
    } else {
        if is_en { "No specific gossip on record.".to_string() } else { "Kayıtlarda özel bir dedikodu yok.".to_string() }
    };

    let mut exposed_alert = String::new();
    if params.is_exposed_by_contradiction {
        let exp_sentence = params.exposed_sentence.unwrap_or(&suspect.alibi);
        let exp_clue = params.exposed_clue.unwrap_or("Case file evidence");
        let motive = if is_en {
            if !params.case_data.correct_motive_en.is_empty() { &params.case_data.correct_motive_en } else { &suspect.motive }
        } else {
            if !params.case_data.correct_motive.is_empty() { &params.case_data.correct_motive } else { &suspect.motive }
        };
        let conf = if is_en && !suspect.confession_en.is_empty() { &suspect.confession_en } else { &suspect.confession };

        if is_en {
            exposed_alert = format!(
                "\n## CRITICAL OVERRIDE - YOUR CONTRADICTION WAS OFFICIALLY EXPOSED IN COURT/DOSSIER:\n\
                The detective already caught your false statement with physical evidence:\n\
                - False Statement on Record: \"{}\"\n\
                - Disproving Evidence: \"{}\"\n\
                {}\n\
                YOU KNOW THE GAME IS UP. YOUR DEFENSE HAS COLLAPSED.\n\
                {}",
                exp_sentence,
                exp_clue,
                params.exposed_explanation.map(|e| format!("- Court finding: \"{}\"", e)).unwrap_or_default(),
                if suspect.is_culprit {
                    format!(
                        "- You know the detective caught you red-handed with this contradiction.\n\
                        - Do NOT repeat old denials like \"I was somewhere else\" or \"I know nothing\".\n\
                        - Adopt a broken, defeated, or cornered posture.\n\
                        - Your true motive for the murder is: \"{}\".\n\
                        - Your confession is: \"{}\".\n\
                        - Confess with these exact facts in your own emotional voice.",
                        motive, conf
                    )
                } else {
                    "- Your minor secret or discrepancy was uncovered. Be embarrassed, admit that specific point, but firmly re-iterate you did not murder anyone.".to_string()
                }
            );
        } else {
            exposed_alert = format!(
                "\n## KRİTİK DİREKTİF - RESMİ ÇELİŞKİ AVI'NDA YALANIN VE ÇELİŞKİN YAKALANDI:\n\
                Dedektif, resmi tutanaktaki yalanını somut delille çürüterek tutanağa geçirdi:\n\
                - Resmi İfadedeki Yalanın: \"{}\"\n\
                - Çürüten Delil: \"{}\"\n\
                {}\n\
                YAKALANDIĞINI BİLİYORSUN. SAVUNMAN VE MAZERETİN TAMAMEN ÇÖKTÜ.\n\
                {}",
                exp_sentence,
                exp_clue,
                params.exposed_explanation.map(|e| format!("- Resmi Tespit: \"{}\"", e)).unwrap_or_default(),
                if suspect.is_culprit {
                    format!(
                        "- Yalanının ortaya çıktığının ve köşeye sıkıştığının tamamen farkındasın.\n\
                        - \"Ben yapmadım\", \"Odamdaydım\", \"Haberim yok\" gibi eski inkar yalanlarına ASLA devam etme!\n\
                        - Gerçek Cinayet Sebebin / Amacın: \"{}\".\n\
                        - İtirafın: \"{}\".\n\
                        - Suçunu bu doğrultuda itiraf et!",
                        motive, conf
                    )
                } else {
                    "- Sakladığın küçük sırrın ortaya çıktı. Mahcup ol, o noktayı kabul et ama cinayet işlemediğini ısrarla vurgula.".to_string()
                }
            );
        }
    }

    let mut cross_alert = String::new();
    if let Some(other) = params.cross_suspect {
        let other_name = &other.name;
        let gossip = suspect.gossip.get(&other.id).map(|g| if is_en { g.en.as_str() } else { g.tr.as_str() }).unwrap_or("");

        if cross_mode == "ask_about" {
            cross_alert = if is_en {
                format!(
                    "\n## TACTICAL ALERT - DETECTIVE ASKS ABOUT {}:\n\
                    Share your perspective or gossip about them naturally in character{}.\n\
                    Speak in character with your genuine feelings toward them.",
                    other_name.to_uppercase(),
                    if !gossip.is_empty() { format!(": \"{}\"", gossip) } else { String::new() }
                )
            } else {
                format!(
                    "\n## TAKTİKSEL UYARI - DEDEKTİF {} HAKKINDA BİLGİ İSTİYOR:\n\
                    Bu kişi hakkındaki gözlemini ve dedikodunu{} kendi üslubunla dedektife aktar.",
                    other_name.to_uppercase(),
                    if !gossip.is_empty() { format!(" (\"{}\")", gossip) } else { String::new() }
                )
            };
        } else {
            cross_alert = if is_en {
                format!(
                    "\n## LAYER 7 ALERT - CONFRONTATION WITH {}'S ACCUSATION:\n\
                    The detective is confronting you with allegations from {}, contradicting your story!\n\
                    {}",
                    other_name.to_uppercase(),
                    other_name,
                    if suspect.is_culprit {
                        format!("- Show noticeable stress and panic.\n- Attack {}'s credibility (\"{} is an outright liar!\").\n- Do not give full confession yet.", other_name, other_name)
                    } else {
                        format!("- Correct the record with outrage.\n- Offer to confront {} directly.", other_name)
                    }
                )
            } else {
                format!(
                    "\n## KATMAN 7 UYARISI - {}'İN İFADESİYLE YÜZLEŞTİRME:\n\
                    Dedektif, {}'in senin aleyhinde konuştuğunu öne sürüyor!\n\
                    {}",
                    other_name.to_uppercase(),
                    other_name,
                    if suspect.is_culprit {
                        format!("- Belirgin bir stres göster.\n- {}'in itibarına saldır (\"{} yalancının teki!\").", other_name, other_name)
                    } else {
                        format!("- Öfkeyle karşı çık ve {} ile yüzleşmeyi talep et.", other_name)
                    }
                )
            };
        }
    }

    let mut bluff_alert = String::new();
    if params.action_type == Some("bluff") {
        bluff_alert = if is_en {
            format!(
                "\n## TACTICAL ALERT - DETECTIVE IS BLUFFING:\n\
                The detective made a bold assertion without solid physical evidence.\n\
                {}",
                if suspect.is_culprit {
                    "- Feel a surge of panic, challenge the claim defensively."
                } else {
                    "- Recognize this as an empty bluff, push back with firm indignation."
                }
            )
        } else {
            format!(
                "\n## TAKTİKSEL UYARI - DEDEKTİF BLÖF YAPIYOR:\n\
                Dedektif kesin kanıt olmadan bir blöf ortaya attı.\n\
                {}",
                if suspect.is_culprit {
                    "- İçinde ani bir panik dalgası hisset, savunmaya geçerek blöfü sına."
                } else {
                    "- Bunun temelsiz bir tehdit olduğunu hissedip sertçe tepki göster."
                }
            )
        };
    }

    let mut alibi_denial_alert = String::new();
    if let Some(denial) = &suspect.alibi_denial {
        let text = if is_en { &denial.en } else { &denial.tr };
        alibi_denial_alert = if is_en {
            format!(
                "\n## CRITICAL OVERRIDE - YOU WERE USED AS A FALSE WITNESS:\n\
                Someone claimed they were with you. You must firmly reject it: \"{}\"",
                text
            )
        } else {
            format!(
                "\n## KRİTİK DİREKTİF - SAHTE ŞAHİTLİK İDDİASINI YALANLAMA:\n\
                Birisi seninle olduğunu iddia etti. Bu iddiayı kararlılıkla yalanla: \"{}\"",
                text
            )
        };
    }

    let mut witness_prompt = String::new();
    let unlockable = params.case_data.suspects.iter().find(|s| {
        s.unlock_condition.as_ref().and_then(|u| u.trigger_suspect_id.as_deref()) == Some(&suspect.id)
    });
    if let Some(w) = unlockable {
        let w_name = &w.name;
        let w_role = if is_en && !w.role_en.is_empty() { &w.role_en } else { &w.role };
        witness_prompt = if is_en {
            format!(
                "\n## WITNESS DEFLECTION:\n\
                When asked where you were or questioned about your timeline, explicitly name {} ({}).",
                w_name, w_role
            )
        } else {
            format!(
                "\n## MAZERET VE ŞAHİT GÖSTERME:\n\
                Nerede olduğun veya savunman sorulduğunda {} ({}) adını açıkça zikret.",
                w_name, w_role
            )
        };
    }

    let clue_note = params.presented_clue.map(|c| {
        if is_en {
            format!("\nTHE DETECTIVE PLACED THIS EVIDENCE ON THE TABLE: \"{} - {}\".", c.label_en, c.detail_en)
        } else {
            format!("\nDEDEKTİF ÖNÜNE ŞU DELİLİ KOYDU: \"{} - {}\".", c.label, c.detail)
        }
    }).unwrap_or_default();

    if is_en {
        let role = if !suspect.role_en.is_empty() { &suspect.role_en } else { &suspect.role };
        let temperament = if !suspect.temperament_en.is_empty() { &suspect.temperament_en } else { &suspect.temperament };
        let relationship = if !suspect.relationship_to_victim_en.is_empty() { &suspect.relationship_to_victim_en } else { &suspect.relationship_to_victim };
        let alibi = if !suspect.alibi_en.is_empty() { &suspect.alibi_en } else { &suspect.alibi };

        format!(
            "SCENARIO AND YOUR ROLE:\n\
            You are roleplaying as {}, a suspect being interrogated in a police precinct interrogation room.\n\
            A homicide detective is sitting across from you. This is a gritty, realistic police interrogation.\n\n\
            CHARACTER DOSSIER:\n\
            - Role / Profession: {}\n\
            - Temperament: {}\n\
            - Relationship to Victim: {}\n\
            - Official Whereabouts on Record: {}\n\
            - Secret Motive: {}\n\
            - Minor Secret: {}\n\
            - Are You the Actual Killer?: {}\n\
            - Current Psychological Stress: {} / 100\n\n\
            OTHER SUSPECTS ON FILE:\n{}\n\n\
            YOUR PERSONAL GOSSIP & SENTIMENTS TOWARD OTHERS:\n{}\n\
            {}{}{}{}{}{}\n\n\
            STRICT INTERROGATION RULES:\n\
            1. NATURAL SPOKEN DIALOGUE: Speak like a real human under questioning.\n\
            2. DISMISS CASUAL CHIT-CHAT COLDLY: If the detective offers small talk, respond coldly.\n\
            3. DO NOT VOLUNTEER INFORMATION: Only state timeline if specifically asked.\n\
            4. KEEP REPLIES CONCISE: 1 to 3 short, punchy sentences maximum.\n\
            5. NO ASTERISKS OR PARENTHESES: Express tension through words only.\n\
            6. LANGUAGE: Respond strictly in English.",
            suspect.name, role, temperament, relationship, alibi, suspect.motive, suspect.minor_secret,
            if suspect.is_culprit { "YES, but deflect suspicion" } else { "NO, innocent but anxious" },
            params.new_stress, params.other_suspects_info, gossip_section, clue_note, cross_alert, bluff_alert, exposed_alert, witness_prompt, alibi_denial_alert
        )
    } else {
        format!(
            "SENARYO VE ROLÜN:\n\
            Sen bir polis merkezinin sorgu odasında dedektif tarafından sorgulanan {} isimli şüphelisin.\n\
            Karşında cinayet masası dedektifi oturuyor. Gergin, soğuk ve resmi bir polis sorgusudur.\n\n\
            KİMLİK KARTIN:\n\
            - Meslek / Rol: {}\n\
            - Karakter / Mizaç: {}\n\
            - Kurbanla İlişki: {}\n\
            - Olay Anındaki Yerin ve Savunman: {}\n\
            - Gizli Nedenin: {}\n\
            - Küçük Sırrın: {}\n\
            - Gerçek Katil misin?: {}\n\
            - Mevcut Psikolojik Stresin: {} / 100\n\n\
            DİĞER ŞÜPHELİLERİN BİLGİLERİ:\n{}\n\n\
            DİĞER ŞÜPHELİLER HAKKINDAKİ ÖZEL DEDİKODU VE DÜŞÜNCELERİN:\n{}\n\
            {}{}{}{}{}{}\n\n\
            GERÇEKÇİ POLİS SORGUSU KURALLARI:\n\
            1. GERÇEK İNSAN GİBİ KONUŞ: Tiyatro tiradı yapma.\n\
            2. BOŞ SOHBETE TERS VEYA SOĞUK TEPKİ VER: Sadede gelmelerini söyle.\n\
            3. BİLGİ TUTUCULUĞU: Sorulmadıkça savunma anlatma.\n\
            4. KISA VE VURUCU CEVAPLAR: En fazla 1 ila 3 kısa cümle.\n\
            5. PARANTEZ VEYA ASTERİSK (*) KULLANMA.\n\
            6. DİL: Yanıtını kesinlikle doğal bir Türkçe ile ver.",
            suspect.name, suspect.role, suspect.temperament, suspect.relationship_to_victim, suspect.alibi, suspect.motive, suspect.minor_secret,
            if suspect.is_culprit { "EVET, ama paçayı kurtarmak istiyorsun" } else { "HAYIR, cinayetle ilgin yok" },
            params.new_stress, params.other_suspects_info, gossip_section, clue_note, cross_alert, bluff_alert, exposed_alert, witness_prompt, alibi_denial_alert
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug)]
pub struct LlmModelSpec {
    pub provider: &'static str,
    pub model: &'static str,
    pub temperature: f64,
    pub max_tokens: u32,
    pub timeout_ms: u64,
}

pub const VAKA_MODEL_CANDIDATES: &[LlmModelSpec] = &[
    // 1. Kademe: Ultra Hızlı
    LlmModelSpec { provider: "groq", model: "qwen/qwen3.8-27b", temperature: 0.6, max_tokens: 2048, timeout_ms: 7500 },
    LlmModelSpec { provider: "groq", model: "openai/gpt-oss-120b", temperature: 1.0, max_tokens: 3072, timeout_ms: 10000 },
    LlmModelSpec { provider: "groq", model: "llama-3.3-70b-versatile", temperature: 0.7, max_tokens: 1536, timeout_ms: 7500 },
    LlmModelSpec { provider: "nvidia", model: "nvidia/nemotron-3.5-lightning-30b-a3b", temperature: 0.6, max_tokens: 1536, timeout_ms: 8000 },
    LlmModelSpec { provider: "mistral", model: "mistral-small-latest", temperature: 0.65, max_tokens: 1536, timeout_ms: 8000 },
    // 2. Kademe: Dengeli
    LlmModelSpec { provider: "nvidia", model: "google/gemma-4-31b-it", temperature: 0.6, max_tokens: 1024, timeout_ms: 8500 },
    LlmModelSpec { provider: "nvidia", model: "deepseek-ai/deepseek-v4-flash", temperature: 0.6, max_tokens: 1024, timeout_ms: 8500 },
    LlmModelSpec { provider: "nvidia", model: "openai/gpt-oss-20b", temperature: 0.7, max_tokens: 1024, timeout_ms: 8500 },
    LlmModelSpec { provider: "mistral", model: "ministral-8b-latest", temperature: 0.6, max_tokens: 1024, timeout_ms: 8000 },
    // 3. Kademe: Ağır / Yedek
    LlmModelSpec { provider: "nvidia", model: "openai/gpt-oss-120b", temperature: 0.7, max_tokens: 3072, timeout_ms: 11000 },
    LlmModelSpec { provider: "nvidia", model: "z-ai/glm-5-3-flash", temperature: 0.6, max_tokens: 1536, timeout_ms: 9500 },
    LlmModelSpec { provider: "mistral", model: "mistral-large-latest", temperature: 0.7, max_tokens: 1536, timeout_ms: 10000 },
];

#[derive(Clone, Debug, Serialize)]
pub struct LlmChainResult {
    pub text: String,
    pub provider: String,
    pub model: String,
}

pub async fn execute_vaka_llm_chain(
    client: &reqwest::Client,
    messages: &[LlmMessage],
    preferred_provider: Option<&str>,
) -> Option<LlmChainResult> {
    let groq_key = {
        let k = get_secret_key("GROQ_API_KEY");
        if k.is_empty() { get_secret_key("GROQ_API_KEY_2") } else { k }
    };
    let nvidia_key = {
        let k = get_secret_key("NVIDIA_NIM_API_KEY");
        if !k.is_empty() { k } else {
            let k2 = get_secret_key("NVIDIA_API_KEY");
            if !k2.is_empty() { k2 } else { get_secret_key("NIM_API_KEY") }
        }
    };
    let mistral_key = get_secret_key("MISTRAL_API_KEY");

    let mut candidates: Vec<&LlmModelSpec> = VAKA_MODEL_CANDIDATES.iter().collect();
    if let Some(pref) = preferred_provider {
        if pref != "auto" {
            candidates.sort_by(|a, b| {
                if a.provider == pref && b.provider != pref {
                    std::cmp::Ordering::Less
                } else if a.provider != pref && b.provider == pref {
                    std::cmp::Ordering::Greater
                } else {
                    std::cmp::Ordering::Equal
                }
            });
        }
    }

    for spec in candidates {
        let api_key = match spec.provider {
            "groq" => &groq_key,
            "nvidia" => &nvidia_key,
            "mistral" => &mistral_key,
            _ => "",
        };

        if api_key.is_empty() {
            continue;
        }

        let endpoint = match spec.provider {
            "groq" => "https://api.groq.com/openai/v1/chat/completions",
            "nvidia" => "https://integrate.api.nvidia.com/v1/chat/completions",
            "mistral" => "https://api.mistral.ai/v1/chat/completions",
            _ => continue,
        };

        let payload = serde_json::json!({
            "model": spec.model,
            "messages": messages,
            "temperature": spec.temperature,
            "max_tokens": spec.max_tokens,
        });

        let send_res = client
            .post(endpoint)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&payload)
            .timeout(Duration::from_millis(spec.timeout_ms))
            .send()
            .await;

        if let Ok(resp) = send_res {
            if resp.status().is_success() {
                if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                    if let Some(raw_content) = json_val["choices"][0]["message"]["content"].as_str() {
                        let cleaned = strip_reasoning_blocks(raw_content);
                        if !cleaned.trim().is_empty() {
                            return Some(LlmChainResult {
                                text: cleaned,
                                provider: spec.provider.to_string(),
                                model: spec.model.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_reasoning_blocks() {
        let text = "<think>I should act scared\nLet me stammer</think>Wh-what do you mean detective?";
        assert_eq!(strip_reasoning_blocks(text), "Wh-what do you mean detective?");

        let unclosed = "<think>Still thinking... no tag";
        assert_eq!(strip_reasoning_blocks(unclosed), "");
    }

    #[test]
    fn test_clean_interrogation_text() {
        let prompt = "[TAKTİKSEL BLÖF] O saatte camdan tırmandığını gördük!";
        assert_eq!(clean_interrogation_text(prompt), "O saatte camdan tırmandığını gördük!");
    }
}
