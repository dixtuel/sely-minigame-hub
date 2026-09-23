//! Vaka Deterministic Rule Engine
//! Handles interrogation actions, stress evolution, bluff detection,
//! alibi denials, clue unlocking, and confessions without LLM dependency.
//! Matches server/services/vakaDeterministicEngine.ts.

use super::vaka_types::{VakaDetailedCase, VakaSuspect};

#[derive(Clone, Debug)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
    pub action_type: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct InterrogationPayload<'a> {
    pub question: Option<&'a str>,
    pub presented_clue_id: Option<&'a str>,
    pub cross_suspect_id: Option<&'a str>,
    pub cross_mode: Option<&'a str>, // "ask_about" | "confront"
    pub cross_quote: Option<&'a str>,
    pub bluff_claim: Option<&'a str>,
    pub is_exposed_by_contradiction: bool,
    /// The one user message allowed after a contradiction has been exposed.
    /// This is deliberately separate from `is_exposed_by_contradiction`: the
    /// first request acknowledges the exposure, the next request elicits the
    /// confession.
    pub is_final_interrogation: bool,
    pub exposed_sentence: Option<&'a str>,
    pub exposed_clue: Option<&'a str>,
    pub exposed_explanation: Option<&'a str>,
    pub history: &'a [HistoryMessage],
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeterministicEngineResult {
    pub text: String,
    pub behavioral_cue: String,
    pub new_stress: u32,
    pub stress_delta: i32,
    pub confessed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_clue_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_clue_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_suspect_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlocked_suspect_name: Option<String>,
}

pub fn process_deterministic_interrogation(
    case_data: &VakaDetailedCase,
    suspect_id: &str,
    action_type: &str,
    payload: &InterrogationPayload,
    current_stress: u32,
    locale: &str,
) -> DeterministicEngineResult {
    let is_en = locale == "en";
    let suspect = match case_data.suspects.iter().find(|s| s.id == suspect_id) {
        Some(s) => s,
        None => {
            return DeterministicEngineResult {
                text: if is_en {
                    "Suspect not found in dossier.".to_string()
                } else {
                    "Şüpheli dosyada bulunamadı.".to_string()
                },
                behavioral_cue: String::new(),
                new_stress: current_stress,
                stress_delta: 0,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }
    };

    let mut stress = current_stress.min(100);
    let start_stress = stress;

    // Çelişki Avında Yakalanmış Şüpheli Kontrolü. Exposure and the final
    // question are separate turns; the contradiction itself must not end the
    // interrogation before the detective gets one last question.
    if payload.is_exposed_by_contradiction || payload.is_final_interrogation {
        if suspect.is_culprit {
            stress = (stress + 12).clamp(90, 100);
            let exp_sentence = payload.exposed_sentence.unwrap_or(&suspect.alibi);
            let exp_clue = payload.exposed_clue.unwrap_or("resmi kanıt");
            let motive = if is_en {
                if !case_data.correct_motive_en.is_empty() {
                    &case_data.correct_motive_en
                } else if !suspect.motive_en.is_empty() {
                    &suspect.motive_en
                } else {
                    &suspect.motive
                }
            } else {
                if !case_data.correct_motive.is_empty() {
                    &case_data.correct_motive
                } else {
                    &suspect.motive
                }
            };
            let conf_detail = if is_en {
                if !suspect.confession_en.is_empty() {
                    &suspect.confession_en
                } else {
                    &suspect.confession
                }
            } else {
                &suspect.confession
            };

            if !payload.is_final_interrogation {
                let reply = if is_en {
                    format!(
                        "(Swallows hard, unable to meet your eyes) You found the contradiction in my statement with the {}... I cannot explain it away. Ask your final question, detective.",
                        exp_clue
                    )
                } else {
                    format!(
                        "(Boğazını yutkunarak temizliyor, gözlerini kaçırıyor) İfademdeki çelişkiyi {} ile yakaladınız... Bunu artık açıklayamam. Son sorunuzu sorabilirsiniz dedektif.",
                        exp_clue
                    )
                };

                let cue = if is_en {
                    &suspect.behavioral_cues.breaking.en
                } else {
                    &suspect.behavioral_cues.breaking.tr
                };

                return DeterministicEngineResult {
                    text: reply,
                    behavioral_cue: cue.clone(),
                    new_stress: stress,
                    stress_delta: stress as i32 - start_stress as i32,
                    confessed: false,
                    unlocked_clue_id: None,
                    unlocked_clue_label: None,
                    unlocked_suspect_id: None,
                    unlocked_suspect_name: None,
                };
            }

            let reply = if is_en {
                format!(
                    "(Head hung in defeat, voice trembling) I know you caught my contradiction regarding \"{}\" with the {}, detective... There's no point in denying it anymore. {} (Motive: {})",
                    exp_sentence, exp_clue, conf_detail, motive
                )
            } else {
                format!(
                    "(Başını ellerinin arasına alıp yere bakıyor, sesi titriyor) O resmi ifademdeki \"{}\" yalanımı {} ile yakaladığınızı biliyorum dedektif... Artık inkar etmenin bir anlamı kalmadı. {} (Amacım: {})",
                    exp_sentence, exp_clue, conf_detail, motive
                )
            };

            let cue = if is_en {
                &suspect.behavioral_cues.breaking.en
            } else {
                &suspect.behavioral_cues.breaking.tr
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: cue.clone(),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: true,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        } else if payload.is_exposed_by_contradiction {
            stress = stress.clamp(35, 65);
            let reply = if is_en {
                "(Embarrassed, clearing throat) Fine! You caught that discrepancy in my official statement. But I only lied about my personal embarrassment, I swear to you I didn't murder anyone!".to_string()
            } else {
                "(Mahcupça boğazını temizliyor) Tamam! Resmi ifademdeki o tutarsızlığı yakaladınız. Ama o sadece kendi küçük utancımı gizlemek içindi; yemin ederim cinayetle en ufak bir ilgim yok!".to_string()
            };

            let cue = if is_en {
                &suspect.behavioral_cues.nervous.en
            } else {
                &suspect.behavioral_cues.nervous.tr
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: cue.clone(),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }
    }

    // Beden dili ipucu seçici (0-29 Sakin, 30-64 Huzursuz, 65+ Kırılma)
    let get_cue = |st: u32, s: &VakaSuspect| -> String {
        if st >= 65 {
            if is_en { s.behavioral_cues.breaking.en.clone() } else { s.behavioral_cues.breaking.tr.clone() }
        } else if st >= 30 {
            if is_en { s.behavioral_cues.nervous.en.clone() } else { s.behavioral_cues.nervous.tr.clone() }
        } else {
            if is_en { s.behavioral_cues.calm.en.clone() } else { s.behavioral_cues.calm.tr.clone() }
        }
    };

    let all_history = payload.history;
    let prior_history = if !all_history.is_empty() && all_history.last().map(|m| m.role.as_str()) == Some("user") {
        &all_history[..all_history.len() - 1]
    } else {
        all_history
    };

    // 1. EYLEM: DELİL YÜZLEŞTİRME (present_evidence)
    if action_type == "present_evidence" && payload.presented_clue_id.is_some() {
        let clue_id = payload.presented_clue_id.unwrap();
        let clue = case_data.clues.iter().find(|c| c.id == clue_id);
        if clue.is_none() {
            return DeterministicEngineResult {
                text: if is_en { "That evidence does not exist in our dossier.".to_string() } else { "Bu kanıt dosyamızda kayıtlı değil.".to_string() },
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: 0,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }
        let clue = clue.unwrap();

        // Doğrudan bu şüpheliyi çürüten kritik delil
        if clue.contradicts_suspect_id.as_deref() == Some(&suspect.id) {
            let gain = if stress < 40 { 28 } else { 22 };
            stress = (stress + gain).min(100);

            if stress >= suspect.break_threshold && suspect.is_culprit {
                let motive = if is_en {
                    if !case_data.correct_motive_en.is_empty() { &case_data.correct_motive_en } else { &suspect.motive }
                } else {
                    if !case_data.correct_motive.is_empty() { &case_data.correct_motive } else { &suspect.motive }
                };
                let conf = if is_en && !suspect.confession_en.is_empty() { &suspect.confession_en } else { &suspect.confession };
                let text = if is_en {
                    format!("{} (Motive: {})", conf, motive)
                } else {
                    format!("{} (Amacım: {})", conf, motive)
                };

                return DeterministicEngineResult {
                    text,
                    behavioral_cue: if is_en { suspect.behavioral_cues.breaking.en.clone() } else { suspect.behavioral_cues.breaking.tr.clone() },
                    new_stress: stress,
                    stress_delta: stress as i32 - start_stress as i32,
                    confessed: true,
                    unlocked_clue_id: Some(clue.id.clone()),
                    unlocked_clue_label: None,
                    unlocked_suspect_id: None,
                    unlocked_suspect_name: None,
                };
            }

            let reply = if is_en {
                format!("(Voice shaking) Where... where did you get that {}?! I told you that wasn't me!", clue.label_en.to_lowercase())
            } else {
                format!("(Sesi titreyerek) O... o {} belgesini nereden buldunuz?! Benimle bir ilgisi olmadığını söylemiştim!", clue.label.to_lowercase())
            };
            let lie = if stress >= 65 { &suspect.lies.level3 } else { &suspect.lies.level2 };

            return DeterministicEngineResult {
                text: format!("{} {}", reply, lie),
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: Some(clue.id.clone()),
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        // Şüpheliyi temize çıkaran delil
        if clue.clears_suspect_id.as_deref() == Some(&suspect.id) {
            stress = stress.saturating_sub(10).max(10);
            let reply = if is_en {
                format!("See? Even this {} proves my innocence! You are barking up the wrong tree, detective.", clue.label_en.to_lowercase())
            } else {
                format!("Gördünüz mü? Bu {} bile masumiyetimi kanıtlıyor! Boşuna vaktimi harcıyorsunuz dedektif.", clue.label.to_lowercase())
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        // Alakasız delil
        stress = stress.saturating_sub(4).max(10);
        let reply = if is_en {
            format!("What does this {} have to do with me? You have absolutely nothing on me, detective.", clue.label_en.to_lowercase())
        } else {
            format!("Bu {} ile benim ne alakam var? Elinizde bana dair hiçbir somut delil yok dedektif.", clue.label.to_lowercase())
        };

        return DeterministicEngineResult {
            text: reply,
            behavioral_cue: get_cue(stress, suspect),
            new_stress: stress,
            stress_delta: stress as i32 - start_stress as i32,
            confessed: false,
            unlocked_clue_id: None,
            unlocked_clue_label: None,
            unlocked_suspect_id: None,
            unlocked_suspect_name: None,
        };
    }

    // 2. EYLEM: BLÖF (bluff)
    if action_type == "bluff" {
        let prior_bluffs = prior_history
            .iter()
            .filter(|m| {
                m.role == "user"
                    && (m.action_type.as_deref() == Some("bluff")
                        || m.content.contains("BLÖF")
                        || m.content.contains("BLUFF")
                        || m.content.contains("kamera kayıtları")
                        || m.content.contains("surveillance footage")
                        || m.content.contains("baz istasyon")
                        || m.content.contains("parmak izlerini ve DNA"))
            })
            .count();

        if prior_bluffs >= 1 {
            stress = stress.saturating_sub(5).max(15);
            let reply = if is_en {
                "(Laughs dismissively) The exact same bluff again? Detective, if you actually had conclusive proof, you would have charged me already. Your empty threats are pathetic.".to_string()
            } else {
                "(Alaycı bir tebessümle başını sallıyor) Yine mi aynı temelsiz blöf dedektif? Elinizde gerçekten bir kayıt ya da somut delil olsaydı şimdiye kadar masaya koymuştunuz. Bu boş tehditleriniz sadece çaresizliğinizi gösteriyor!".to_string()
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        if suspect.is_culprit {
            stress = (stress + 16).min(100);
            let reply = if is_en {
                "(Blinks rapidly, sweating) What... you pulled that record?! No, you can't have! The blind spot... I mean, you're bluffing! You have nothing!".to_string()
            } else {
                "(Hızla gözlerini kırpıştırıyor, terliyor) Ne... o kaydı mı buldunuz?! Hayır, bulmuş olamazsınız! O saatteki kör noktayı... Yani, blöf yapıyorsunuz!".to_string()
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        } else {
            stress = (stress + 8).min(60);
            let reply = if is_en {
                "Nice try detective, but that's an obvious bluff. I know my rights and I won't let you intimidate me.".to_string()
            } else {
                "Güzel deneme dedektif, ama bariz bir blöf yapıyorsunuz. Haklarımı biliyorum ve asılsız iddialarla beni yıldıramazsınız.".to_string()
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }
    }

    // 3. EYLEM: ÇAPRAZ SORGU & DEDİKODU (cross_examine)
    if action_type == "cross_examine" && payload.cross_suspect_id.is_some() {
        let other_id = payload.cross_suspect_id.unwrap();
        let other = case_data.suspects.iter().find(|s| s.id == other_id);
        let other_name = other.map(|s| s.name.as_str()).unwrap_or(if is_en { "the other witness" } else { "diğer tanık" });
        let gossip_text = suspect.gossip.get(other_id).map(|g| if is_en { g.en.as_str() } else { g.tr.as_str() }).unwrap_or("");
        let is_ask_about = payload.cross_mode == Some("ask_about");

        if is_ask_about {
            if stress > 25 {
                stress = stress.saturating_sub(4).max(20);
            }
            let reply = if !gossip_text.is_empty() {
                if is_en {
                    format!("Regarding {}? Let me tell you: {}", other_name, gossip_text)
                } else {
                    format!("{} hakkında mı? Size şunu söyleyeyim: {}", other_name, gossip_text)
                }
            } else {
                if is_en {
                    format!("I haven't paid much attention to {}, but their demeanor around here is always suspicious.", other_name)
                } else {
                    format!("{} ile pek muhatap olmam ama hareketleri bana hep tekinsiz ve şüpheli gelmiştir.", other_name)
                }
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        // Confront
        if stress < 75 {
            stress = (stress + 16).min(75);
        } else {
            stress = (stress + 4).min(80);
        }

        let attack = if suspect.is_culprit {
            if is_en {
                format!(
                    "{} said that about me?! That liar is just trying to save their own neck! {}",
                    other_name,
                    if !gossip_text.is_empty() { format!("You should investigate them instead: {}", gossip_text) } else { "Don't believe their slander!".to_string() }
                )
            } else {
                format!(
                    "{} benim hakkımda bunu mu söyledi?! O yalancı sırf kendi paçasını kurtarmak için bana iftira atıyor! {}",
                    other_name,
                    if !gossip_text.is_empty() { format!("Asıl onun yaptıklarına bakın: {}", gossip_text) } else { "Onun uydurmalarına mı inanacaksınız?!".to_string() }
                )
            }
        } else {
            if is_en {
                format!("{} is lying through their teeth! Bring them in here right now, I'll say it to their face!", other_name)
            } else {
                format!("{} kuyruklu bir yalan söylüyor! Getirin onu buraya, bu iftirayı yüzüme karşı söylesin!", other_name)
            }
        };

        return DeterministicEngineResult {
            text: attack,
            behavioral_cue: get_cue(stress, suspect),
            new_stress: stress,
            stress_delta: stress as i32 - start_stress as i32,
            confessed: false,
            unlocked_clue_id: None,
            unlocked_clue_label: None,
            unlocked_suspect_id: None,
            unlocked_suspect_name: None,
        };
    }

    // 4. EYLEM: SESSİZLİK (stay_silent)
    if action_type == "stay_silent" {
        let prior_silences = prior_history
            .iter()
            .filter(|m| {
                m.role == "user"
                    && (m.action_type.as_deref() == Some("stay_silent")
                        || m.content.contains("SESSİZLİK")
                        || m.content.contains("SILENCE")
                        || m.content.contains("sessizliği uzatıyor")
                        || m.content.contains("soğukça süzüyor")
                        || m.content.contains("unbroken eye contact")
                        || m.content.contains("measuring the suspect"))
            })
            .count();

        if prior_silences >= 2 {
            stress = stress.saturating_sub(8).max(10);
            let reply = if is_en {
                "(Crosses arms and checks wristwatch) Staring at me in silence is getting ridiculous, detective. It's clear you've run out of questions and have no case. Call my attorney or let me go.".to_string()
            } else {
                "(Kollarını kavuşturup saatine bakıyor) Dakikalardır boş boş susup bakmanız artık gülünç olmaya başladı dedektif. Soracak sorunuz ve elinizde tek bir delil dahi olmadığı aşikâr. Ya avukatımı çağırın ya da beni serbest bırakın!".to_string()
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        if prior_silences == 1 {
            if stress < 55 {
                stress = (stress + 3).min(55);
            }
            let reply = if is_en {
                "(Shifts slightly) Prolonged silence won't fabricate evidence out of thin air, detective. Ask what you want to ask.".to_string()
            } else {
                "(Hafifçe kıpırdanıyor) Susarak havadan delil yaratamazsınız dedektif. Ne sormak istiyorsanız sorun artık.".to_string()
            };

            return DeterministicEngineResult {
                text: reply,
                behavioral_cue: get_cue(stress, suspect),
                new_stress: stress,
                stress_delta: stress as i32 - start_stress as i32,
                confessed: false,
                unlocked_clue_id: None,
                unlocked_clue_label: None,
                unlocked_suspect_id: None,
                unlocked_suspect_name: None,
            };
        }

        if stress < 55 {
            stress = (stress + 10).min(55);
        }

        let reply = if suspect.is_culprit {
            if stress >= 50 {
                if is_en {
                    "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me walk out of here!".to_string()
                } else {
                    "(Huzursuzca kıpırdanıyor) Neden bana öyle dik dik bakıyorsunuz?! Sorunuz varsa sorun, yoksa beni buradan bırakın!".to_string()
                }
            } else {
                if is_en {
                    "(Clears throat nervously) Your silence won't change the facts, detective. What do you want to know?".to_string()
                } else {
                    "(Boğazını gergince temizliyor) Sessiz kalmanız gerçeği değiştirmez dedektif. Ne bilmek istiyorsunuz?".to_string()
                }
            }
        } else {
            if is_en {
                "Staring at me in silence won't make me guilty. Call my lawyer if you're not going to speak.".to_string()
            } else {
                "Bana sessizce bakmanız beni suçlu yapmaz. Konuşmayacaksanız avukatımı arayacağım.".to_string()
            }
        };

        return DeterministicEngineResult {
            text: reply,
            behavioral_cue: get_cue(stress, suspect),
            new_stress: stress,
            stress_delta: stress as i32 - start_stress as i32,
            confessed: false,
            unlocked_clue_id: None,
            unlocked_clue_label: None,
            unlocked_suspect_id: None,
            unlocked_suspect_name: None,
        };
    }

    // 5. EYLEM: SERBEST SORU (question)
    let q_text = payload.question.unwrap_or("").trim();
    let q_lower = q_text.to_lowercase();

    // Sır, alibi, suçlama kelimeleri
    let touches_secret = {
        let mut words: Vec<String> = suspect.motive.to_lowercase().split_whitespace().map(|s| s.to_string()).collect();
        words.extend(suspect.minor_secret.to_lowercase().split_whitespace().map(|s| s.to_string()));
        words.push(case_data.victim.name.to_lowercase());
        for kw in &["kurban", "victim", "para", "money", "borç", "debt", "miras", "inheritance", "kavga", "fight", "sır", "secret", "cinayet", "murder", "öldür", "kill"] {
            words.push(kw.to_string());
        }
        words.iter().filter(|w| w.len() > 3).any(|w| q_lower.contains(w.as_str()))
    };

    let touches_alibi = ["saat", "time", "neredeydin", "where", "kamera", "camera", "görgü", "witness", "fırtına", "storm", "oda", "room", "otel", "hotel"]
        .iter().any(|&w| q_lower.contains(w));

    let touches_accusation = ["katil", "killer", "suçlu", "guilty", "öldürdün", "öldürdüğünü", "murdered", "yalan", "lie", "lying", "itiraf", "confess", "sen yaptın", "you did it", "inkar", "suç ortağı", "accomplice", "biliyorum", "kurtulamazsın", "cezanı"]
        .iter().any(|&w| q_lower.contains(w));

    let touches_custom_bluff = ["görmüş", "gören var", "şahit var", "tanık var", "saw you", "witness saw", "camdan", "pencereden", "tırmanırken", "koşarken", "climbing", "running", "kamera kaydı", "gizli kamera", "footage", "kayıtlar", "elimde kayıt", "ses kaydı", "parmak izin", "parmak izi", "kan izin", "kan izi", "izlerini bulduk", "suçüstü", "gözleriyle görmüş", "biri seni gördü", "someone saw"]
        .iter().any(|&w| q_lower.contains(w));

    let is_duplicate = prior_history.iter().rev().find(|m| m.role == "user").map(|m| m.content.to_lowercase().trim() == q_lower && q_lower.len() > 5).unwrap_or(false);

    if is_duplicate {
        stress = stress.saturating_sub(4).max(10);
        let rep_reply = if is_en {
            "You just asked me that exact same thing. Repeating questions won't change my answer, detective.".to_string()
        } else {
            "Bana az önce sorduğunuz sorunun tıpatıp aynısını soruyorsunuz. Tekrarlamanız cevabımı değiştirmeyecek dedektif.".to_string()
        };

        return DeterministicEngineResult {
            text: rep_reply,
            behavioral_cue: get_cue(stress, suspect),
            new_stress: stress,
            stress_delta: stress as i32 - start_stress as i32,
            confessed: false,
            unlocked_clue_id: None,
            unlocked_clue_label: None,
            unlocked_suspect_id: None,
            unlocked_suspect_name: None,
        };
    }

    let greetings = ["naber", "selam", "merhaba", "nasılsın", "günaydın", "iyi akşamlar", "hey", "hi", "hello", "how are you", "sup"];
    let is_greeting = greetings.iter().any(|&g| q_lower == g || q_lower.starts_with(&format!("{} ", g)) || q_lower.ends_with(&format!(" {}", g)));

    if is_greeting {
        let greet_reply = if is_en {
            "We're not here for casual chit-chat, detective. If you have an actual question regarding the case, ask it.".to_string()
        } else {
            "Buraya çay sohbetine gelmedik dedektif. Olayla ilgili soracağınız gerçek bir soru varsa sorun, vaktimi çalmayın.".to_string()
        };

        return DeterministicEngineResult {
            text: greet_reply,
            behavioral_cue: get_cue(stress, suspect),
            new_stress: stress,
            stress_delta: 0,
            confessed: false,
            unlocked_clue_id: None,
            unlocked_clue_label: None,
            unlocked_suspect_id: None,
            unlocked_suspect_name: None,
        };
    }

    let gain: u32 = if (touches_accusation || touches_custom_bluff) && suspect.is_culprit {
        if stress < 50 { 18 } else { 12 }
    } else if touches_custom_bluff && !suspect.is_culprit {
        6
    } else if touches_secret {
        if stress < 50 { 14 } else { 7 }
    } else if touches_alibi {
        if stress < 50 { 10 } else { 6 }
    } else if touches_accusation {
        6
    } else {
        4
    };

    if stress < 85 {
        stress = (stress + gain).min(85);
    }

    // Şüphelinin yalanlayacağı sahte alibi ve fail tespiti
    let trigger_suspect = suspect.unlock_condition.as_ref().and_then(|u| {
        u.trigger_suspect_id.as_ref().and_then(|tid| case_data.suspects.iter().find(|s| s.id == *tid))
    });

    let mentions_trigger_suspect = if let Some(ts) = trigger_suspect {
        ts.name.to_lowercase().split_whitespace().any(|part| part.len() > 2 && q_lower.contains(part))
    } else {
        false
    };

    let mentions_alibi_themes = ["çay", "cay", "tea", "akü", "aku", "battery", "prova", "rehearsal", "kafe", "kafeterya", "cafe", "garaj", "kulis", "jeneratör", "şalter", "salter", "restoran", "vagon", "arıza", "tamir", "neredeydin", "neredeydi", "seninle", "beraber", "birlikte", "alibi", "savunma", "doğru mu", "yalan", "gördün mü", "iddia", "with", "true", "saw him", "see him", "was he"]
        .iter().any(|&kw| q_lower.contains(kw));

    let is_alibi_denial_match = suspect.alibi_denial.is_some()
        && (mentions_trigger_suspect
            || (mentions_alibi_themes && touches_alibi)
            || q_lower.contains("seninle")
            || q_lower.contains("birlikte")
            || q_lower.contains("beraber")
            || q_lower.contains("with you")
            || q_lower.contains("alibi")
            || q_lower.contains("doğru mu")
            || q_lower.contains("is that true"));

    let reply_text: String;
    let mut is_denial_triggered = false;

    if is_alibi_denial_match && suspect.alibi_denial.is_some() {
        let d = suspect.alibi_denial.as_ref().unwrap();
        reply_text = if is_en { d.en.clone() } else { d.tr.clone() };
        is_denial_triggered = true;
    } else if touches_custom_bluff {
        if suspect.is_culprit {
            reply_text = if is_en {
                "(Eyes widening in momentary panic, hands trembling) Wh-what window?! Who saw that?! That's a complete lie, no one could have seen me out there... I mean, I was inside all along! Stop trying to rattle me with absurd bluffs, detective!".to_string()
            } else {
                "(Göz bebekleri büyüyor, elleri hafifçe titriyor) N-ne penceresi?! Hangi yolcu görmüş?! Yalan söylüyorlar dedektif, beni o saatte kimse dışarıda göremez... yani ben zaten içerideydim! Bana boş blöfler savurarak bir yere varamazsınız!".to_string()
            };
        } else {
            reply_text = if is_en {
                "(Raises eyebrows in utter disbelief) Climbing out a window?! Detective, have you completely lost your mind? Do I look like an acrobat to you?! Whoever invented that ridiculous lie, bring them in here to say it to my face!".to_string()
            } else {
                "(Hayretle kaşlarını kaldırıyor) Pencereden tırmanırken mi?! Dedektif siz aklınızı mı kaçırdınız, sirk cambazı mıyım ben?! Hangi yalancı bunu uydurduysa getirin karşıma, yüzüme söylesin! Boş iddialarla vaktimi harcamayın!".to_string()
            };
        }
    } else if touches_accusation && suspect.is_culprit {
        if stress >= 65 {
            reply_text = if is_en {
                "(Sweating profusely, pounding table) Stop pointing fingers at me without proof! You don't know what happened that night!".to_string()
            } else {
                "(Alnından ter damlıyor, masaya vuruyor) Elinizde kesin bir kanıt olmadan bana katil diyemezsiniz! O gece orada ne olduğunu bilmiyorsunuz!".to_string()
            };
        } else {
            reply_text = if is_en {
                "(Stiffens defensively) How dare you accuse me of murder, detective?! Watch your tone unless you have hard evidence!".to_string()
            } else {
                "(Savunmaya geçerek dikleşiyor) Bana katil demeye nasıl cüret edersiniz dedektif?! Elinizde somut bir delil olmadan beni suçlayamazsınız!".to_string()
            };
        }
    } else if touches_secret {
        reply_text = if is_en {
            format!("(Eyes shifting nervously) That matter with {} was strictly personal! {}", case_data.victim.name, if stress >= 50 { &suspect.lies.level3 } else { &suspect.lies.level2 })
        } else {
            format!("(Gözleri gergince kaçıyor) {} ile aramızdaki o mesele tamamen kişiseldi! {}", case_data.victim.name, if stress >= 50 { &suspect.lies.level3 } else { &suspect.lies.level2 })
        };
    } else if touches_alibi {
        reply_text = if is_en {
            format!("I already gave my timeline to the precinct: {}", if stress >= 45 { &suspect.lies.level2 } else { &suspect.lies.level1 })
        } else {
            format!("İfade tutanağımda o saatte nerede olduğumu açıkça belirttim: {}", if stress >= 45 { &suspect.lies.level2 } else { &suspect.lies.level1 })
        };
    } else if stress >= 65 {
        reply_text = suspect.lies.level3.clone();
    } else if stress >= 35 {
        reply_text = suspect.lies.level2.clone();
    } else {
        reply_text = suspect.lies.level1.clone();
    }

    let mut unlocked_clue_id: Option<String> = None;
    let mut unlocked_clue_label: Option<String> = None;

    if is_denial_triggered && suspect.alibi_denial.is_some() {
        let clean_key = suspect.id.replace("suspect-", "");
        let testimony_clue = case_data.clues.iter().find(|c| {
            c.category == "witness" && c.clue_type == "alibi" && c.id.contains(&clean_key)
        }).or_else(|| {
            case_data.clues.iter().find(|c| {
                c.category == "witness" && c.clue_type == "alibi" && (c.contradicts_suspect_id.is_some() || c.clears_suspect_id.is_some())
            })
        });

        if let Some(tc) = testimony_clue {
            unlocked_clue_id = Some(tc.id.clone());
            unlocked_clue_label = Some(if is_en && !tc.label_en.is_empty() { tc.label_en.clone() } else { tc.label.clone() });
        }
    }

    let mut unlocked_suspect_id: Option<String> = None;
    let mut unlocked_suspect_name: Option<String> = None;

    let locked_suspects: Vec<&VakaSuspect> = case_data.suspects.iter().filter(|s| s.is_initially_locked.unwrap_or(false)).collect();
    let reply_lower = reply_text.to_lowercase();
    let cross_quote_clean = payload.cross_quote.unwrap_or("").to_lowercase();

    for ls in locked_suspects {
        if let Some(cond) = &ls.unlock_condition {
            if let Some(tid) = &cond.trigger_suspect_id {
                if tid != &suspect.id {
                    continue;
                }
            }
            let mentioned = cond.keywords.iter().any(|kw| reply_lower.contains(&kw.to_lowercase()));
            let asked_directly = cond.keywords.iter().any(|kw| {
                let kw_l = kw.to_lowercase();
                q_lower.contains(&kw_l) || cross_quote_clean.contains(&kw_l)
            }) || (action_type == "cross_examine" && payload.cross_suspect_id == Some(&ls.id));

            if mentioned || asked_directly {
                unlocked_suspect_id = Some(ls.id.clone());
                unlocked_suspect_name = Some(ls.name.clone());
                break;
            }
        }
    }

    DeterministicEngineResult {
        text: reply_text,
        behavioral_cue: get_cue(stress, suspect),
        new_stress: stress,
        stress_delta: stress as i32 - start_stress as i32,
        confessed: false,
        unlocked_clue_id,
        unlocked_clue_label,
        unlocked_suspect_id,
        unlocked_suspect_name,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::vaka_cases::get_all_cases;

    #[test]
    fn test_deterministic_bluff_culprit() {
        let cases = get_all_cases();
        let case0 = &cases[0];
        let culprit_id = &case0.culprit_id;

        let payload = InterrogationPayload {
            question: Some("Kayıtlar elimizde!"),
            ..Default::default()
        };

        let result = process_deterministic_interrogation(
            case0,
            culprit_id,
            "bluff",
            &payload,
            10,
            "tr",
        );

        assert!(result.new_stress > 10);
        assert!(!result.confessed);
    }

    #[test]
    fn test_deterministic_evidence_confession() {
        let cases = get_all_cases();
        let case0 = &cases[0];
        let culprit_id = &case0.culprit_id;
        let win_clue = &case0.winning_contradiction.clue_id;

        let payload = InterrogationPayload {
            presented_clue_id: Some(win_clue),
            ..Default::default()
        };

        let result = process_deterministic_interrogation(
            case0,
            culprit_id,
            "present_evidence",
            &payload,
            80, // high stress triggers confession
            "tr",
        );

        assert!(result.confessed);
        assert!(result.new_stress >= 80);
    }

    #[test]
    fn contradiction_exposure_allows_one_final_question_before_confession() {
        let cases = get_all_cases();
        let case0 = &cases[0];
        let culprit_id = &case0.culprit_id;
        let sentence = &case0.suspects.iter()
            .find(|s| s.id == *culprit_id)
            .expect("culprit exists")
            .detailed_statements[0];

        let exposed = InterrogationPayload {
            is_exposed_by_contradiction: true,
            exposed_sentence: Some(&sentence.text),
            exposed_clue: Some("Radar Kaydı"),
            ..Default::default()
        };
        let first = process_deterministic_interrogation(case0, culprit_id, "question", &exposed, 30, "tr");
        assert!(!first.confessed);
        assert!(first.text.contains("Son sorunuzu sorabilirsiniz"));

        let final_question = InterrogationPayload {
            is_final_interrogation: true,
            exposed_sentence: Some(&sentence.text),
            exposed_clue: Some("Radar Kaydı"),
            question: Some("Neden yaptın?"),
            ..Default::default()
        };
        let confession = process_deterministic_interrogation(case0, culprit_id, "question", &final_question, first.new_stress, "tr");
        assert!(confession.confessed);
        assert!(confession.text.contains("Amacım:"));
    }
}
