import type { VakaDetailedCase } from "./vakaTypes";

export const newCases: VakaDetailedCase[] = [
  // Case 09
  {
    id: "case-09-bogaz-yalisi",
    title: "Boğaz Yalısında Kasa Soygunu",
    titleEn: "Vault Heist at the Bosphorus Mansion",
    difficulty: "normal",
    briefing: "Emekli armatör Hikmet Paşazade'nin Boğaz'daki yalısından milyon dolarlık hamiline senetler ve antika mühür çalındı.",
    briefingEn: "Million dollar bearer bonds and an antique seal were stolen from retired magnate Hikmet Paşazade's Bosphorus mansion.",
    incidentTime: "23:15",
    location: "Yalı Ana Kasa Odası",
    locationEn: "Mansion Main Vault Room",
    victim: {
      name: "Hikmet Paşazade",
      occupation: "Emekli Armatör",
      occupationEn: "Retired Shipping Magnate",
      causeOfDeath: "Can kaybı yok (Nitelikli Hırsızlık)",
      causeOfDeathEn: "No casualties (Grand Larceny)"
    },
    timeline: [
      { time: "22:00", event: "Misafirler yalıdan ayrıldı.", eventEn: "Guests left the mansion.", verified: true },
      { time: "23:15", event: "Kasa kapağı açıldı.", eventEn: "Vault door opened.", verified: true },
      { time: "00:30", event: "Kasanın boş olduğu fark edildi.", eventEn: "Vault discovered empty.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kasa şifre paneli temiz, zorlama yok.",
        "İskelede taze sürtünme izleri."
      ],
      en: [
        "Vault combination panel is clean, no forced entry.",
        "Fresh friction marks on the dock."
      ]
    },
    culpritId: "suspect-selim",
    correctMethod: "Şifresini bildiği kasayı açıp çaldıklarını iskeledeki sürat motoruna gizledi.",
    correctMethodEn: "Opened the vault using the known code and hid the stolen items in his speedboat at the dock.",
    correctMotive: "Büyük kumar borçlarını kapatmak.",
    correctMotiveEn: "To pay off massive gambling debts.",
    winningContradiction: {
      suspectId: "suspect-selim",
      sentenceId: "selim-s2",
      clueId: "clue-yali-dock-rope"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli iskeleye inmediğini iddia ediyor ancak iskele babasında motorunun ipine ait lifler bulundu.",
      en: "Analyst Note: Suspect claims he never went to the dock, but fibers from his boat's rope were found on the bollard."
    },
    suspects: [
      {
        id: "suspect-selim",
        name: "Selim Paşazade",
        role: "Mirasyedi Yeğen",
        roleEn: "Spendthrift Nephew",
        age: 28,
        temperament: "Kibirli ve rahat",
        temperamentEn: "Arrogant and relaxed",
        relationshipToVictim: "Hikmet Paşazade'nin yeğeni.",
        relationshipToVictimEn: "Nephew of Hikmet Paşazade.",
        statement: "Bütün akşam kendi odamda oyun oynadım, dışarı adım atmadım.",
        statementEn: "I played games in my room all evening, didn't step outside.",
        isCulprit: true,
        alibi: "Odasında olduğunu iddia ediyor.",
        alibiEn: "Claims to be in his room.",
        motive: "Büyük kumar borçları.",
        motiveEn: "Massive gambling debts.",
        minorSecret: "Amcasının antika arabasını izinsiz kullanırdı.",
        minorSecretEn: "Used his uncle's antique car without permission.",
        breakThreshold: 85,
        gossip: {
          "suspect-aylin": { tr: "Doktorun amcama verdiği ilaçlar çok şüpheli.", en: "The doctor's meds for my uncle are very suspicious." },
          "suspect-riza": { tr: "Rıza Efendi kasanın şifresini biliyor olabilir.", en: "Rıza Efendi might know the vault code." }
        },
        behavioralCues: {
          calm: { tr: "Telefonuyla oynuyor.", en: "Playing with his phone." },
          nervous: { tr: "Dudaklarını kemiriyor.", en: "Chewing his lips." },
          breaking: { tr: "Bağırarak suçlamaları reddediyor.", en: "Yelling and denying accusations." }
        },
        lies: {
          level1: "Ben sadece oyun oynuyordum.",
          level2: "Amcamın kasası umurumda değil.",
          level3: "O motoru günlerdir kullanmadım!"
        },
        confession: "Borçlarım vardı, beni öldüreceklerdi! Mecburdum!",
        confessionEn: "I had debts, they were going to kill me! I had to!",
        detailedStatements: [
          { id: "selim-s1", text: "Akşam yemeğinden sonra odama çıktım.", textEn: "I went up to my room after dinner.", isContradiction: false },
          { id: "selim-s2", text: "Bütün gece deniz tarafındaki iskeleye adım dahi atmadım.", textEn: "I didn't even step on the seaside dock all night.", isContradiction: true, contradictionClueId: "clue-yali-dock-rope", explanation: "İskele babasındaki taze palamar sürtünme izi ve Selim'in motorunun lifleri bulundu.", explanationEn: "Fresh mooring friction marks and fibers from Selim's speedboat rope were found on the dock bollard." }
        ]
      },
      {
        id: "suspect-aylin",
        name: "Dr. Aylin Kurt",
        role: "Özel Hekim",
        roleEn: "Private Physician",
        age: 35,
        temperament: "Ciddi ve soğuk",
        temperamentEn: "Serious and cold",
        relationshipToVictim: "Hikmet Bey'in özel doktoru.",
        relationshipToVictimEn: "Hikmet's private doctor.",
        statement: "Sadece tansiyonunu ölçtüm ve ayrıldım.",
        statementEn: "I only checked his blood pressure and left.",
        isCulprit: false,
        alibi: "Klinikte nöbetçiydi.",
        alibiEn: "Was on duty at the clinic.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Yanlış ilaç yazdığını gizliyordu.",
        minorSecretEn: "Hid the fact she prescribed the wrong medication.",
        breakThreshold: 94,
        gossip: {
          "suspect-selim": { tr: "Selim çok borçluydu.", en: "Selim was heavily in debt." }
        },
        behavioralCues: {
          calm: { tr: "Not defterine bakıyor.", en: "Looking at her notepad." },
          nervous: { tr: "Stetoskopuyla oynuyor.", en: "Playing with her stethoscope." },
          breaking: { tr: "Ağlamaya başlıyor.", en: "Starts crying." }
        },
        lies: {
          level1: "Ben sadece doktorum.",
          level2: "Kasa umurumda değil.",
          level3: "Kliniğin kameraları bozuktu."
        },
        confession: "Masumum, sadece yanlış ilaç yazdım!",
        confessionEn: "I am innocent, I just prescribed the wrong med!",
        detailedStatements: [
          { id: "aylin-s1", text: "Hikmet Bey'in tedavisini yapıp çıktım.", textEn: "I treated Hikmet and left.", isContradiction: false }
        ]
      },
      {
        id: "suspect-riza",
        name: "Rıza Efendi",
        role: "Baş Kahya",
        roleEn: "Head Butler",
        age: 58,
        temperament: "Sadık ve telaşlı",
        temperamentEn: "Loyal and frantic",
        relationshipToVictim: "Yalının 30 yıllık çalışanı.",
        relationshipToVictimEn: "30-year employee of the mansion.",
        statement: "Mutfakta personeli yönetiyordum.",
        statementEn: "I was managing the staff in the kitchen.",
        isCulprit: false,
        alibi: "Personelle birlikteydi.",
        alibiEn: "Was with the staff.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Mutfak bütçesinden biraz kesinti yapıyordu.",
        minorSecretEn: "Was skimming a bit off the kitchen budget.",
        breakThreshold: 92,
        gossip: {
          "suspect-selim": { tr: "Selim Bey anahtarları gizlice kopyalamış olabilir.", en: "Mr. Selim might have secretly copied the keys." }
        },
        behavioralCues: {
          calm: { tr: "Ceketini ilikliyor.", en: "Buttoning his jacket." },
          nervous: { tr: "Terini siliyor.", en: "Wiping his sweat." },
          breaking: { tr: "Diz çöküp yalvarıyor.", en: "Kneeling and begging." }
        },
        lies: {
          level1: "Ben yılların kahyasıyım.",
          level2: "Hırsızlıkla işim olmaz.",
          level3: "Kasa şifresini bilmem."
        },
        confession: "Ben yapmadım, Hikmet Bey'e ihanet etmem!",
        confessionEn: "I didn't do it, I wouldn't betray Hikmet!",
        detailedStatements: [
          { id: "riza-s1", text: "Personelle ilgileniyordum.", textEn: "I was dealing with the staff.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-yali-dock-rope",
        label: "İskele Babasında Sürtünme İzi",
        labelEn: "Friction Mark on Dock Bollard",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-selim",
        detail: "İskele babasında Selim'in sürat motoruna ait halat lifleri bulundu.",
        detailEn: "Rope fibers belonging to Selim's speedboat were found on the dock bollard.",
        significance: "Selim'in motoru o gece kullandığını kanıtlar.",
        significanceEn: "Proves Selim used the boat that night."
      },
      {
        id: "clue-09-camera",
        label: "Klinik Kamera Kaydı",
        labelEn: "Clinic Camera Footage",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-aylin",
        detail: "Aylin Hanım gece boyunca klinikteydi.",
        detailEn: "Aylin was at the clinic all night.",
        significance: "Aylin'i temize çıkarır.",
        significanceEn: "Clears Aylin."
      },
      {
        id: "clue-09-staff",
        label: "Personel İfadesi",
        labelEn: "Staff Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-riza",
        detail: "Rıza Efendi personelin yanından ayrılmadı.",
        detailEn: "Rıza Efendi didn't leave the staff's side.",
        significance: "Rıza Efendi'yi temize çıkarır.",
        significanceEn: "Clears Rıza Efendi."
      }
    ]
  },

  // Case 10
  {
    id: "case-10-siber-zirve",
    title: "Siber Zirvede Sıfırıncı Gün Sızıntısı",
    titleEn: "Zero-Day Leak at the Cyber Summit",
    difficulty: "hard",
    briefing: "Siber güvenlik zirvesinde, Kaan Sencer'in koruduğu ana sunucudan HSM anahtarı çalındı.",
    briefingEn: "At the cybersecurity summit, the HSM key was stolen from the main server guarded by Kaan Sencer.",
    incidentTime: "14:30",
    location: "B-4 Sunucu Katı",
    locationEn: "B-4 Server Floor",
    victim: {
      name: "Kaan Sencer",
      occupation: "Baş Güvenlik Mimarı",
      occupationEn: "Chief Security Architect",
      causeOfDeath: "Sistem Sızıntısı",
      causeOfDeathEn: "System Leak"
    },
    timeline: [
      { time: "14:00", event: "Sunucu odası yetkisiz girişlere kapatıldı.", eventEn: "Server room locked for unauthorized access.", verified: true },
      { time: "14:30", event: "HSM anahtarı klonlandı.", eventEn: "HSM key was cloned.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Donanım bypass implantı lehimlenmiş.",
        "Havalandırma filtresinde ilaç kalıntısı."
      ],
      en: [
        "Hardware bypass implant soldered.",
        "Drug residue in the ventilation filter."
      ]
    },
    culpritId: "suspect-ozan",
    correctMethod: "Donanım bypass implantı lehimleyip HSM anahtarını USB belleğe klonladı.",
    correctMethodEn: "Soldered a hardware bypass implant and cloned the HSM key to a USB drive.",
    correctMotive: "Rakip firmaya sıfırıncı gün açığını satmak.",
    correctMotiveEn: "To sell the zero-day exploit to a rival company.",
    winningContradiction: {
      suspectId: "suspect-ozan",
      sentenceId: "ozan-s2",
      clueId: "clue-inhaler-vent"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli sunucu katına inmediğini belirtiyor ancak havalandırmada ona ait astım ilacı izi bulundu.",
      en: "Analyst Note: Suspect claims he didn't go down to the server floor, but his asthma drug residue was found in the vent."
    },
    suspects: [
      {
        id: "suspect-ozan",
        name: "Ozan Çelik",
        role: "Kıdemli Pentester",
        roleEn: "Senior Pentester",
        age: 39,
        temperament: "Kibirli ve gergin",
        temperamentEn: "Arrogant and tense",
        relationshipToVictim: "Kaan'ın ekibindeki kıdemli testçi.",
        relationshipToVictimEn: "Senior tester in Kaan's team.",
        statement: "Benim astımım var, soğuk sunucu odalarına girmem.",
        statementEn: "I have asthma, I don't enter cold server rooms.",
        isCulprit: true,
        alibi: "Odasında kod yazdığını iddia ediyor.",
        alibiEn: "Claims to be writing code in his room.",
        motive: "Finansal kazanç.",
        motiveEn: "Financial gain.",
        minorSecret: "Şirket verilerini kişisel diskine kopyalıyordu.",
        minorSecretEn: "Was copying company data to his personal drive.",
        breakThreshold: 84,
        gossip: {
          "suspect-merve": { tr: "Merve çok dikkatsiz.", en: "Merve is very careless." },
          "suspect-tarik": { tr: "Tarık'ın logları silmeye çalıştığını gördüm.", en: "I saw Tarık trying to delete logs." }
        },
        behavioralCues: {
          calm: { tr: "Gözlüğünü siliyor.", en: "Cleaning his glasses." },
          nervous: { tr: "Astım ilacına uzanıyor.", en: "Reaching for his inhaler." },
          breaking: { tr: "Ekrana vurup küfrediyor.", en: "Hitting the screen and swearing." }
        },
        lies: {
          level1: "Ben sadece test yaparım.",
          level2: "Lehim yapmayı bilmem.",
          level3: "O odaya hiç girmedim!"
        },
        confession: "Evet, anahtarı ben klonladım! Bu sistem zaten çürüktü!",
        confessionEn: "Yes, I cloned the key! This system was rotten anyway!",
        detailedStatements: [
          { id: "ozan-s1", text: "Öğleden sonra odamda testlerimi sürdürdüm.", textEn: "I continued my tests in my room in the afternoon.", isContradiction: false },
          { id: "ozan-s2", text: "Astımım yüzünden soğuk hava olan B-4 sunucu katına asla inmedim.", textEn: "Because of my asthma, I never went down to the cold B-4 server floor.", isContradiction: true, contradictionClueId: "clue-inhaler-vent", explanation: "Sunucu odası hava filtresinde Ozan'ın reçeteli Salbutamol ilacı partikülleri bulundu.", explanationEn: "Particles of Ozan's prescribed Salbutamol medication were found in the server room air filter." }
        ]
      },
      {
        id: "suspect-merve",
        name: "Merve Aydın",
        role: "Altyapı Şefi",
        roleEn: "Infrastructure Chief",
        age: 32,
        temperament: "Ciddi ve detaycı",
        temperamentEn: "Serious and meticulous",
        relationshipToVictim: "Kaan'ın altyapı yöneticisi.",
        relationshipToVictimEn: "Kaan's infrastructure manager.",
        statement: "Kablolamaları bitirip üst kata çıktım.",
        statementEn: "I finished the wiring and went upstairs.",
        isCulprit: false,
        alibi: "Üst katta toplantıdaydı.",
        alibiEn: "Was in a meeting upstairs.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Bir sunucuyu yanlış konfigüre etmişti.",
        minorSecretEn: "Had misconfigured a server.",
        breakThreshold: 92,
        gossip: {
          "suspect-ozan": { tr: "Ozan çok gergindi.", en: "Ozan was very tense." }
        },
        behavioralCues: {
          calm: { tr: "Notlarına bakıyor.", en: "Looking at her notes." },
          nervous: { tr: "Kalemini çeviriyor.", en: "Spinning her pen." },
          breaking: { tr: "Ağlamaya başlıyor.", en: "Starts crying." }
        },
        lies: {
          level1: "Sistem kusursuzdu.",
          level2: "Ben yapmadım.",
          level3: "O odaya dönmedim."
        },
        confession: "Masumum, sadece yanlış konfigürasyon yaptım!",
        confessionEn: "I am innocent, I just did a misconfiguration!",
        detailedStatements: [
          { id: "merve-s1", text: "Üst katta toplantıdaydım.", textEn: "I was in a meeting upstairs.", isContradiction: false }
        ]
      },
      {
        id: "suspect-tarik",
        name: "Tarık Doğan",
        role: "Denetçi",
        roleEn: "Auditor",
        age: 41,
        temperament: "Şüpheci ve soğuk",
        temperamentEn: "Suspicious and cold",
        relationshipToVictim: "Dış denetçi.",
        relationshipToVictimEn: "External auditor.",
        statement: "Sadece logları inceliyordum.",
        statementEn: "I was only reviewing the logs.",
        isCulprit: false,
        alibi: "Kameralar onun ofisinde olduğunu doğruluyor.",
        alibiEn: "Cameras confirm he was in his office.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Denetim raporunu geciktirmişti.",
        minorSecretEn: "Delayed the audit report.",
        breakThreshold: 95,
        gossip: {
          "suspect-ozan": { tr: "Ozan'ın loglarında boşluklar var.", en: "There are gaps in Ozan's logs." }
        },
        behavioralCues: {
          calm: { tr: "Kravatını düzeltiyor.", en: "Adjusting his tie." },
          nervous: { tr: "Saatine bakıyor.", en: "Looking at his watch." },
          breaking: { tr: "Sinirle bağırıyor.", en: "Yelling angrily." }
        },
        lies: {
          level1: "Ben sadece denetlerim.",
          level2: "Donanımla işim olmaz.",
          level3: "Sızma benim işim değil."
        },
        confession: "Ben masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "tarik-s1", text: "Ofisimde rapor yazıyordum.", textEn: "I was writing a report in my office.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-inhaler-vent",
        label: "Havalandırmadaki İlaç İzi",
        labelEn: "Drug Trace in Vent",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-ozan",
        detail: "Sunucu odası hava filtresinde Ozan'ın reçeteli Salbutamol ilacı partikülleri bulundu.",
        detailEn: "Ozan's prescribed Salbutamol medication particles were found in the server room air filter.",
        significance: "Ozan'ın odaya girdiğini kanıtlar.",
        significanceEn: "Proves Ozan entered the room."
      },
      {
        id: "clue-10-camera",
        label: "Üst Kat Kamera Kaydı",
        labelEn: "Upper Floor Camera Footage",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-merve",
        detail: "Merve üst kattaki toplantıdan hiç ayrılmadı.",
        detailEn: "Merve never left the meeting upstairs.",
        significance: "Merve'yi temize çıkarır.",
        significanceEn: "Clears Merve."
      },
      {
        id: "clue-10-office-cam",
        label: "Ofis Kamerası",
        labelEn: "Office Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-tarik",
        detail: "Tarık olay sırasında kendi ofisindeydi.",
        detailEn: "Tarık was in his own office during the incident.",
        significance: "Tarık'ı temize çıkarır.",
        significanceEn: "Clears Tarık."
      }
    ]
  },

  // Case 11
  {
    id: "case-11-acik-deniz-yat",
    title: "Açık Deniz Yatta Fırtına Vurgunu",
    titleEn: "Storm Strike on the Offshore Yacht",
    difficulty: "normal",
    briefing: "Fırtınalı bir gecede Tarık Soydan'ın yatından 5 milyon dolarlık 'Mavi Safir' kolye çalındı.",
    briefingEn: "On a stormy night, a 5 million dollar 'Blue Sapphire' necklace was stolen from Tarık Soydan's yacht.",
    incidentTime: "23:50",
    location: "Yat Ana Güverte ve Kasa Odası",
    locationEn: "Yacht Main Deck and Vault Room",
    victim: {
      name: "Tarık Soydan",
      occupation: "Portföy Yöneticisi",
      occupationEn: "Portfolio Manager",
      causeOfDeath: "Can Kaybı Yok",
      causeOfDeathEn: "No Casualties"
    },
    timeline: [
      { time: "23:00", event: "Fırtına şiddetlendi, herkes kamaralara çekildi.", eventEn: "Storm intensified, everyone retreated to cabins.", verified: true },
      { time: "23:50", event: "Güverte pompası çalıştırıldı, kasa açıldı.", eventEn: "Deck pump activated, vault opened.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Seyir defteri manipüle edilmeye çalışılmış.",
        "Kasa şifresiyle açılmış."
      ],
      en: [
        "Attempt to manipulate the logbook.",
        "Vault opened with code."
      ]
    },
    culpritId: "suspect-melih",
    correctMethod: "Fırtınada güverteye çıkıp pompayı çalıştırarak dikkat dağıttı, ardından kasayı açtı.",
    correctMethodEn: "Went to deck in the storm, started the pump to distract, then opened the vault.",
    correctMotive: "Kolye ile yurtdışına kaçıp borçlarını ödemek.",
    correctMotiveEn: "To flee abroad with the necklace and pay off debts.",
    winningContradiction: {
      suspectId: "suspect-melih",
      sentenceId: "melih-s2",
      clueId: "clue-deck-pump-log"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli tüm gece uyuduğunu söylüyor fakat anahtar kartı gece yarısı güverte pompasını çalıştırmak için kullanılmış.",
      en: "Analyst Note: Suspect claims he slept all night, but his keycard was used to activate the deck pump at midnight."
    },
    suspects: [
      {
        id: "suspect-melih",
        name: "Melih Erdem",
        role: "Ortak & CFO",
        roleEn: "Partner & CFO",
        age: 48,
        temperament: "Kurnaz ve soğukkanlı",
        temperamentEn: "Cunning and stoic",
        relationshipToVictim: "Tarık'ın iş ortağı.",
        relationshipToVictimEn: "Tarık's business partner.",
        statement: "Fırtına yüzünden midem bulandı, bütün gece yattım.",
        statementEn: "I was seasick from the storm, lay in bed all night.",
        isCulprit: true,
        alibi: "Kamarasında olduğunu iddia ediyor.",
        alibiEn: "Claims to be in his cabin.",
        motive: "Şirketin parasını batırdığı için kaçış fonu.",
        motiveEn: "Escape fund because he sank the company's money.",
        minorSecret: "Yatın yakıt bütçesinden çalıyordu.",
        minorSecretEn: "Was stealing from the yacht's fuel budget.",
        breakThreshold: 85,
        gossip: {
          "suspect-burak": { tr: "Kaptan seyir defterini sık sık değiştirir.", en: "The captain frequently changes the logbook." },
          "suspect-canan": { tr: "Canan kolyeden nefret ederdi.", en: "Canan hated the necklace." }
        },
        behavioralCues: {
          calm: { tr: "Viskisini yudumluyor.", en: "Sipping his whiskey." },
          nervous: { tr: "Parmaklarıyla ritim tutuyor.", en: "Tapping his fingers." },
          breaking: { tr: "Bardağı yere fırlatıyor.", en: "Throws his glass to the floor." }
        },
        lies: {
          level1: "Ben sadece uyudum.",
          level2: "Güverteye hiç çıkmadım.",
          level3: "Kolyenin nerede olduğunu bilmiyorum!"
        },
        confession: "Evet, ben aldım! Tarık bizi batırmıştı!",
        confessionEn: "Yes, I took it! Tarık had ruined us!",
        detailedStatements: [
          { id: "melih-s1", text: "Fırtına başlayınca kamarama girdim.", textEn: "When the storm started, I went to my cabin.", isContradiction: false },
          { id: "melih-s2", text: "Bütün gece kamaramda uyudum, güverteye hiç çıkmadım.", textEn: "I slept in my cabin all night, never went out on deck.", isContradiction: true, contradictionClueId: "clue-deck-pump-log", explanation: "Güverte otomatik yıkama pompası 23:50'de Melih'in anahtar kartıyla çalıştırılmış.", explanationEn: "The deck automatic wash pump was activated at 23:50 with Melih's keycard." }
        ]
      },
      {
        id: "suspect-burak",
        name: "Kaptan Burak Reis",
        role: "Yat Kaptanı",
        roleEn: "Yacht Captain",
        age: 52,
        temperament: "Otoriter ve ciddi",
        temperamentEn: "Authoritative and serious",
        relationshipToVictim: "Yatın kaptanı.",
        relationshipToVictimEn: "Captain of the yacht.",
        statement: "Bütün gece köprü üstünde dümen tutuyordum.",
        statementEn: "I was at the helm on the bridge all night.",
        isCulprit: false,
        alibi: "Köprü kamera kayıtları.",
        alibiEn: "Bridge camera records.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Gizlice içki içiyordu.",
        minorSecretEn: "Was secretly drinking.",
        breakThreshold: 95,
        gossip: {
          "suspect-melih": { tr: "Melih Bey'in o gece kapısı kilitli değildi.", en: "Mr. Melih's door wasn't locked that night." }
        },
        behavioralCues: {
          calm: { tr: "Pipo içiyor.", en: "Smoking his pipe." },
          nervous: { tr: "Sakallarını sıvazlıyor.", en: "Stroking his beard." },
          breaking: { tr: "Sinirle bağırıyor.", en: "Yelling angrily." }
        },
        lies: {
          level1: "Ben sadece gemiyi yönetirim.",
          level2: "Aşağıya inmedim.",
          level3: "Kolye umurumda değil."
        },
        confession: "Masumum, ben sadece gemiyi kurtarmaya çalışıyordum!",
        confessionEn: "I am innocent, I was just trying to save the ship!",
        detailedStatements: [
          { id: "burak-s1", text: "Köprüdeydim.", textEn: "I was on the bridge.", isContradiction: false }
        ]
      },
      {
        id: "suspect-canan",
        name: "Canan Soydan",
        role: "Tarık'ın Eşi",
        roleEn: "Tarık's Wife",
        age: 38,
        temperament: "Soğuk ve mesafeli",
        temperamentEn: "Cold and distant",
        relationshipToVictim: "Tarık'ın eşi.",
        relationshipToVictimEn: "Tarık's wife.",
        statement: "Kocamla salonda oturduk.",
        statementEn: "I sat in the lounge with my husband.",
        isCulprit: false,
        alibi: "Kocasıyla birlikteydi.",
        alibiEn: "Was with her husband.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Gizli bir hesabı vardı.",
        minorSecretEn: "Had a secret bank account.",
        breakThreshold: 93,
        gossip: {
          "suspect-melih": { tr: "Melih çok paragöz biridir.", en: "Melih is a very greedy person." }
        },
        behavioralCues: {
          calm: { tr: "Kitap okuyor.", en: "Reading a book." },
          nervous: { tr: "Yüzüğünü çeviriyor.", en: "Spinning her ring." },
          breaking: { tr: "Ağlamaya başlıyor.", en: "Starts crying." }
        },
        lies: {
          level1: "Kocamlaydım.",
          level2: "Ben yapmadım.",
          level3: "Kolyeyi ben çalmadım."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "canan-s1", text: "Tarık ile birlikteydik.", textEn: "I was with Tarık.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-deck-pump-log",
        label: "Güverte Pompası Logu",
        labelEn: "Deck Pump Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-melih",
        detail: "Güverte otomatik yıkama pompası 23:50'de Melih'in anahtar kartıyla çalıştırılmış.",
        detailEn: "The deck automatic wash pump was activated at 23:50 with Melih's keycard.",
        significance: "Melih'in güverteye çıktığını kanıtlar.",
        significanceEn: "Proves Melih went on deck."
      },
      {
        id: "clue-11-bridge-cam",
        label: "Köprü Kamerası",
        labelEn: "Bridge Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-burak",
        detail: "Kaptan köprüden hiç ayrılmadı.",
        detailEn: "Captain never left the bridge.",
        significance: "Burak Reis'i temize çıkarır.",
        significanceEn: "Clears Captain Burak."
      },
      {
        id: "clue-11-witness",
        label: "Koca İfadesi",
        labelEn: "Husband Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-canan",
        detail: "Tarık Soydan eşinin tüm gece yanında olduğunu doğruladı.",
        detailEn: "Tarık Soydan confirmed his wife was with him all night.",
        significance: "Canan'ı temize çıkarır.",
        significanceEn: "Clears Canan."
      }
    ]
  },

  // Case 12
  {
    id: "case-12-kapadokya-balon",
    title: "Kapadokya Balonunda İrtifa Vanası Sabotajı",
    titleEn: "Altitude Valve Sabotage on the Cappadocia Balloon",
    difficulty: "normal",
    briefing: "Turizm Heyeti Başkanı Haldun Kaya'nın bulunduğu bölmenin mekanik emniyet kilidi açıldı ve sabotaj yapıldı.",
    briefingEn: "The mechanical safety lock of the compartment where Tourism Board President Haldun Kaya was located was opened and sabotaged.",
    incidentTime: "06:15",
    location: "Kapadokya Hava Sahası",
    locationEn: "Cappadocia Airspace",
    victim: {
      name: "Haldun Kaya",
      occupation: "Turizm Heyeti Başkanı",
      occupationEn: "Tourism Board President",
      causeOfDeath: "Araç Hasarı (Sabotaj)",
      causeOfDeathEn: "Vehicle Damage (Sabotage)"
    },
    timeline: [
      { time: "05:30", event: "Balon havalandı.", eventEn: "Balloon took off.", verified: true },
      { time: "06:15", event: "Emniyet kilidi açıldı.", eventEn: "Safety lock was opened.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kilit vidasında zorlama izleri.",
        "Mekanizma elle müdahale ile gevşetilmiş."
      ],
      en: [
        "Pry marks on the lock screw.",
        "Mechanism manually loosened."
      ]
    },
    culpritId: "suspect-mehmet",
    correctMethod: "Haldun Bey'in bulunduğu bölmenin mekanik emniyet kilidini karga burnu aletiyle gevşetti.",
    correctMethodEn: "Loosened the mechanical safety lock of Haldun's compartment using needle-nose pliers.",
    correctMotive: "Başkanın yeni uçuş lisans kurallarını engellemesi.",
    correctMotiveEn: "To stop the president from imposing new flight license rules.",
    winningContradiction: {
      suspectId: "suspect-mehmet",
      sentenceId: "mehmet-s2",
      clueId: "clue-pliers-mark"
    },
    analystSummary: {
      tr: "Analist Notu: Pilot, yolcunun kemeri kendisinin açtığını söylüyor, fakat kilit üzerinde alet izleri var.",
      en: "Analyst Note: Pilot claims the passenger unbuckled himself, but there are tool marks on the lock."
    },
    suspects: [
      {
        id: "suspect-mehmet",
        name: "Mehmet Usta",
        role: "Kıdemli Balon Pilotu",
        roleEn: "Senior Balloon Pilot",
        age: 46,
        temperament: "Otoriter ve sinirli",
        temperamentEn: "Authoritative and angry",
        relationshipToVictim: "Uçuşu gerçekleştiren pilot.",
        relationshipToVictimEn: "Pilot conducting the flight.",
        statement: "Haldun Bey panikleyip mandalı kendi açtı.",
        statementEn: "Haldun panicked and opened the latch himself.",
        isCulprit: true,
        alibi: "Sepette görev başındaydı.",
        alibiEn: "Was on duty in the basket.",
        motive: "Lisans yenileme sorunları.",
        motiveEn: "License renewal issues.",
        minorSecret: "Görme bozukluğu vardı.",
        minorSecretEn: "Had vision impairment.",
        breakThreshold: 83,
        gossip: {
          "suspect-gokhan": { tr: "Gökhan Bey uçuş öncesi bizim balona çok yaklaştı.", en: "Gökhan got very close to our balloon pre-flight." }
        },
        behavioralCues: {
          calm: { tr: "Eldivenini düzeltiyor.", en: "Adjusts his glove." },
          nervous: { tr: "Burnunu çekiyor.", en: "Sniffles." },
          breaking: { tr: "Bağırarak inkar ediyor.", en: "Loudly denies." }
        },
        lies: {
          level1: "Ben sadece pilotum.",
          level2: "Haldun Bey kendi yaptı.",
          level3: "Benim aletle işim olmaz!"
        },
        confession: "Bizi işimizden edecekti! Kilidi gevşettim, evet!",
        confessionEn: "He was going to put us out of business! I loosened the lock, yes!",
        detailedStatements: [
          { id: "mehmet-s1", text: "Uçuş normal seyrindeydi.", textEn: "The flight was proceeding normally.", isContradiction: false },
          { id: "mehmet-s2", text: "Haldun Bey kemer mandalını kendi eliyle açtı.", textEn: "Mr. Haldun unbuckled the belt latch with his own hand.", isContradiction: true, contradictionClueId: "clue-pliers-mark", explanation: "Kilit vidasında karga burnu aletiyle yapılmış derin çizikler bulundu.", explanationEn: "Deep scratches made by needle-nose pliers were found on the lock screw." }
        ]
      },
      {
        id: "suspect-gokhan",
        name: "Gökhan Varol",
        role: "Rakip Şirket Sahibi",
        roleEn: "Rival Company Owner",
        age: 50,
        temperament: "Kibirli",
        temperamentEn: "Arrogant",
        relationshipToVictim: "Sektördeki rakibi.",
        relationshipToVictimEn: "Rival in the industry.",
        statement: "Kendi balonumdaydım.",
        statementEn: "I was in my own balloon.",
        isCulprit: false,
        alibi: "Kendi balonunun GPS ve kamera kayıtları.",
        alibiEn: "GPS and camera records of his own balloon.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Vergi kaçırıyordu.",
        minorSecretEn: "Was evading taxes.",
        breakThreshold: 92,
        gossip: {
          "suspect-mehmet": { tr: "Mehmet çok agresif bir pilot.", en: "Mehmet is a very aggressive pilot." }
        },
        behavioralCues: {
          calm: { tr: "Gülümseyerek poz veriyor.", en: "Posing with a smile." },
          nervous: { tr: "Gözlüğünü siliyor.", en: "Cleaning his glasses." },
          breaking: { tr: "Ağlamaya başlıyor.", en: "Starts crying." }
        },
        lies: {
          level1: "Benimle ilgisi yok.",
          level2: "Onların balonuna yaklaşmadım.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "gokhan-s1", text: "Olay sırasında havada kendi balonumdaydım.", textEn: "I was in the air in my own balloon during the incident.", isContradiction: false }
        ]
      },
      {
        id: "suspect-derya",
        name: "Derya Akın",
        role: "Yer Ekibi Şefi",
        roleEn: "Ground Crew Chief",
        age: 28,
        temperament: "Telaşlı",
        temperamentEn: "Frantic",
        relationshipToVictim: "Uçuş koordinatörü.",
        relationshipToVictimEn: "Flight coordinator.",
        statement: "Yerde ekipmanları topluyordum.",
        statementEn: "I was gathering equipment on the ground.",
        isCulprit: false,
        alibi: "Yer ekibiyle birlikteydi.",
        alibiEn: "Was with the ground crew.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Geç kalmıştı.",
        minorSecretEn: "Was late.",
        breakThreshold: 95,
        gossip: {
          "suspect-mehmet": { tr: "Mehmet Usta çok kızgındı.", en: "Mehmet was very angry." }
        },
        behavioralCues: {
          calm: { tr: "Telsizi tutuyor.", en: "Holding the radio." },
          nervous: { tr: "Tırnaklarını yiyor.", en: "Biting her nails." },
          breaking: { tr: "Diz çöküp ağlıyor.", en: "Kneels down and cries." }
        },
        lies: {
          level1: "Ben yer ekibindeyim.",
          level2: "Balona binmedim.",
          level3: "Kilitle işim olmaz."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "derya-s1", text: "Yerde ekiple beraberdim.", textEn: "I was with the team on the ground.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-pliers-mark",
        label: "Kilit Vidasındaki İzler",
        labelEn: "Marks on Lock Screw",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-mehmet",
        detail: "Kilit vidasında karga burnu aletiyle yapılmış derin çizikler tespit edildi.",
        detailEn: "Deep scratches made by needle-nose pliers were detected on the lock screw.",
        significance: "Kilidin mekanik olarak zorlandığını kanıtlar.",
        significanceEn: "Proves the lock was mechanically forced."
      },
      {
        id: "clue-12-gokhan-gps",
        label: "GPS ve Kamera",
        labelEn: "GPS and Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-gokhan",
        detail: "Gökhan'ın kendi balonunda olduğu tespit edildi.",
        detailEn: "Confirmed Gökhan was in his own balloon.",
        significance: "Gökhan'ı temize çıkarır.",
        significanceEn: "Clears Gökhan."
      },
      {
        id: "clue-12-ground",
        label: "Yer Ekibi Tutanak",
        labelEn: "Ground Crew Log",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-derya",
        detail: "Derya'nın yer ekibiyle tüm zamanı geçirdiği onaylandı.",
        detailEn: "Confirmed Derya spent the entire time with the ground crew.",
        significance: "Derya'yı temize çıkarır.",
        significanceEn: "Clears Derya."
      }
    ]
  },

  // Case 13
  {
    id: "case-13-gobeklitepe-muhur",
    title: "Göbeklitepe Kazısında Çalınan Mühür",
    titleEn: "Stolen Seal at the Göbeklitepe Excavation",
    difficulty: "hard",
    briefing: "Prof. Dr. Demir Karahan'ın kazı başkanlığını yaptığı Göbeklitepe'deki çadırdan orijinal Neolitik silindir mühür çalınıp yerine alçı kopyası kondu.",
    briefingEn: "An original Neolithic cylinder seal was stolen from the tent at Göbeklitepe directed by Prof. Dr. Demir Karahan and replaced with a plaster copy.",
    incidentTime: "01:30",
    location: "Ana Kazı Çadırı",
    locationEn: "Main Excavation Tent",
    victim: {
      name: "Prof. Dr. Demir Karahan",
      occupation: "Kazı Heyeti Başkanı",
      occupationEn: "Head of Excavation",
      causeOfDeath: "Tarihi Eser Çalınması",
      causeOfDeathEn: "Stolen Artifact"
    },
    timeline: [
      { time: "23:00", event: "Çadır kilitlendi.", eventEn: "Tent was locked.", verified: true },
      { time: "01:30", event: "Mühür çalındı.", eventEn: "Seal was stolen.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Mühür kopyası mükemmel bir şekilde yerleştirilmiş.",
        "Sensörler atlatılmış."
      ],
      en: [
        "Seal copy placed perfectly.",
        "Sensors bypassed."
      ]
    },
    culpritId: "suspect-sinan",
    correctMethod: "Orijinal Neolitik silindir mührü çalıp yerine alçı kopyasını bıraktı.",
    correctMethodEn: "Stole the original Neolithic cylinder seal and left a plaster copy.",
    correctMotive: "Kaçakçılara satmak.",
    correctMotiveEn: "To sell to smugglers.",
    winningContradiction: {
      suspectId: "suspect-sinan",
      sentenceId: "sinan-s2",
      clueId: "clue-laptop-power-log"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli tüm gece bilgisayarda çalıştığını söylüyor ancak batarya logları bilgisayarın o saatlerde kapalı olduğunu gösteriyor.",
      en: "Analyst Note: Suspect claims to be working on his laptop all night, but battery logs show it was off during those hours."
    },
    suspects: [
      {
        id: "suspect-sinan",
        name: "Sinan Bilgin",
        role: "Saha Jeoloğu",
        roleEn: "Field Geologist",
        age: 37,
        temperament: "Kurnaz ve sessiz",
        temperamentEn: "Cunning and quiet",
        relationshipToVictim: "Kazı ekibi üyesi.",
        relationshipToVictimEn: "Excavation team member.",
        statement: "Gece boyu çadırımda bilgisayarda çalıştım.",
        statementEn: "I worked on my laptop in my tent all night.",
        isCulprit: true,
        alibi: "Çadırında çalıştığını iddia ediyor.",
        alibiEn: "Claims to be working in his tent.",
        motive: "Tarihi eser satışı.",
        motiveEn: "Selling antiquities.",
        minorSecret: "Buluntuların kopyalarını yapıyordu.",
        minorSecretEn: "Was making copies of the finds.",
        breakThreshold: 85,
        gossip: {
          "suspect-zeynep": { tr: "Zeynep eserleri çok iyi inceler.", en: "Zeynep examines the artifacts very well." }
        },
        behavioralCues: {
          calm: { tr: "Gözlüğünü siliyor.", en: "Cleaning his glasses." },
          nervous: { tr: "Ellerini oğuşturuyor.", en: "Rubbing his hands." },
          breaking: { tr: "Bilgisayarı kapatıyor.", en: "Shuts the laptop." }
        },
        lies: {
          level1: "Ben sadece jeoloğum.",
          level2: "Kopyalamakla işim olmaz.",
          level3: "Tüm gece uyanıktım!"
        },
        confession: "Evet, o mühür benim geleceğimdi!",
        confessionEn: "Yes, that seal was my future!",
        detailedStatements: [
          { id: "sinan-s1", text: "Akşam yemeğinden sonra çadırıma çekildim.", textEn: "Retired to my tent after dinner.", isContradiction: false },
          { id: "sinan-s2", text: "Gece boyu çadırımda dizüstü bilgisayarda jeoradar verisi işledim.", textEn: "I processed GPR data on my laptop in my tent all night.", isContradiction: true, contradictionClueId: "clue-laptop-power-log", explanation: "Bilgisayarın sistem logları 23:30 - 02:15 arası tamamen kapalı olduğunu gösteriyor.", explanationEn: "System logs show the laptop was completely off from 23:30 to 02:15." }
        ]
      },
      {
        id: "suspect-zeynep",
        name: "Dr. Zeynep Ateş",
        role: "Restoratör",
        roleEn: "Restorer",
        age: 41,
        temperament: "Ciddi",
        temperamentEn: "Serious",
        relationshipToVictim: "Kazının restoratörü.",
        relationshipToVictimEn: "Restorer of the excavation.",
        statement: "Uyuyordum.",
        statementEn: "I was sleeping.",
        isCulprit: false,
        alibi: "Çadır arkadaşı onaylıyor.",
        alibiEn: "Tentmate confirms.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Ekipman bütçesinden çalıyordu.",
        minorSecretEn: "Was stealing from the equipment budget.",
        breakThreshold: 94,
        gossip: {
          "suspect-sinan": { tr: "Sinan'ın çadırından gece sesler geliyordu.", en: "Noises came from Sinan's tent at night." }
        },
        behavioralCues: {
          calm: { tr: "Notlarına bakıyor.", en: "Looking at her notes." },
          nervous: { tr: "Fırçasıyla oynuyor.", en: "Playing with her brush." },
          breaking: { tr: "Ağlıyor.", en: "Crying." }
        },
        lies: {
          level1: "Ben eserleri korurum.",
          level2: "Mühürü çalmadım.",
          level3: "Ben masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "zeynep-s1", text: "Tüm gece uyudum.", textEn: "I slept all night.", isContradiction: false }
        ]
      },
      {
        id: "suspect-numan",
        name: "Numan Çavuş",
        role: "Gece Bekçisi",
        roleEn: "Night Watchman",
        age: 55,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "Bekçi.",
        relationshipToVictimEn: "Guard.",
        statement: "Nöbet kulübesindeydim.",
        statementEn: "I was in the guardhouse.",
        isCulprit: false,
        alibi: "Güvenlik kameraları.",
        alibiEn: "Security cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Nöbette uyuyordu.",
        minorSecretEn: "Slept on duty.",
        breakThreshold: 92,
        gossip: {
          "suspect-sinan": { tr: "Sinan çok garip davranıyordu.", en: "Sinan was acting very weird." }
        },
        behavioralCues: {
          calm: { tr: "El fenerini tutuyor.", en: "Holding his flashlight." },
          nervous: { tr: "Bıyığını buruyor.", en: "Twirling his mustache." },
          breaking: { tr: "Diz çöküyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Hep uyanıktım.",
          level2: "Çadırı korudum.",
          level3: "Ben çalmadım."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "numan-s1", text: "Nöbetteydim.", textEn: "I was on duty.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-laptop-power-log",
        label: "Dizüstü Bilgisayar Güç Logu",
        labelEn: "Laptop Power Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-sinan",
        detail: "Bilgisayar 23:30 ile 02:15 arasında kapalıydı.",
        detailEn: "Laptop was completely shut down between 23:30 and 02:15.",
        significance: "Sinan'ın yalanını kanıtlar.",
        significanceEn: "Proves Sinan's lie."
      },
      {
        id: "clue-13-zeynep-alibi",
        label: "Çadır Arkadaşı İfadesi",
        labelEn: "Tentmate Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-zeynep",
        detail: "Zeynep'in gece boyunca uyuduğu onaylandı.",
        detailEn: "Confirmed Zeynep slept through the night.",
        significance: "Zeynep'i temize çıkarır.",
        significanceEn: "Clears Zeynep."
      },
      {
        id: "clue-13-numan-cam",
        label: "Güvenlik Kamerası",
        labelEn: "Security Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-numan",
        detail: "Numan nöbet yerinden ayrılmadı.",
        detailEn: "Numan didn't leave his post.",
        significance: "Numan'ı temize çıkarır.",
        significanceEn: "Clears Numan."
      }
    ]
  },

  // Case 14
  {
    id: "case-14-f1-sabotaj",
    title: "Formula 1 Padokunda Telemetri Sabotajı",
    titleEn: "Telemetry Sabotage at the Formula 1 Paddock",
    difficulty: "normal",
    briefing: "F1 baş yarış pilotu Lucas Rossi'nin aracının ECU fren basınç limiti telemetri terminalinden hileyle düşürüldü.",
    briefingEn: "F1 lead driver Lucas Rossi's car ECU brake pressure limit was fraudulently lowered from the telemetry terminal.",
    incidentTime: "22:28",
    location: "Takım Garajı",
    locationEn: "Team Garage",
    victim: {
      name: "Lucas Rossi",
      occupation: "Baş Yarış Pilotu",
      occupationEn: "Lead Race Driver",
      causeOfDeath: "Araç Sabotajı",
      causeOfDeathEn: "Car Sabotage"
    },
    timeline: [
      { time: "22:00", event: "Garaj kapandı.", eventEn: "Garage closed.", verified: true },
      { time: "22:28", event: "ECU limitleri değiştirildi.", eventEn: "ECU limits changed.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Sistem loglarında yetkisiz erişim izi.",
        "Ağ kablolarında müdahale yok."
      ],
      en: [
        "Unauthorized access trace in system logs.",
        "No tampering with network cables."
      ]
    },
    culpritId: "suspect-hans",
    correctMethod: "Telemetri terminalinden ECU fren basınç limitini hileyle düşürdü.",
    correctMethodEn: "Fraudulently lowered the ECU brake pressure limit from the telemetry terminal.",
    correctMotive: "Rakip takımdan rüşvet almak.",
    correctMotiveEn: "To take a bribe from the rival team.",
    winningContradiction: {
      suspectId: "suspect-hans",
      sentenceId: "hans-s2",
      clueId: "clue-ecu-telemetry-log"
    },
    analystSummary: {
      tr: "Analist Notu: Mühendis sisteme dokunmadığını söylüyor ancak kendi kriptografik anahtarıyla girilmiş bypass logu mevcut.",
      en: "Analyst Note: Engineer claims he didn't touch the system, but there is a bypass log entered with his cryptographic key."
    },
    suspects: [
      {
        id: "suspect-hans",
        name: "Hans Weber",
        role: "Baş Yarış Mühendisi",
        roleEn: "Chief Race Engineer",
        age: 45,
        temperament: "Soğukkanlı ve disiplinli",
        temperamentEn: "Stoic and disciplined",
        relationshipToVictim: "Pilotun baş mühendisi.",
        relationshipToVictimEn: "Driver's chief engineer.",
        statement: "Odamdaydım, araca hiç dokunmadım.",
        statementEn: "I was in my room, never touched the car.",
        isCulprit: true,
        alibi: "Odasında olduğunu iddia ediyor.",
        alibiEn: "Claims to be in his room.",
        motive: "Büyük miktarda rüşvet.",
        motiveEn: "Large bribe.",
        minorSecret: "Rakip takımla anlaştı.",
        minorSecretEn: "Agreed with the rival team.",
        breakThreshold: 85,
        gossip: {
          "suspect-arda": { tr: "Arda 1. pilot olmak istiyor.", en: "Arda wants to be the 1st driver." }
        },
        behavioralCues: {
          calm: { tr: "Kulaklığını düzeltiyor.", en: "Adjusts his headset." },
          nervous: { tr: "Saatini kontrol ediyor.", en: "Checks his watch." },
          breaking: { tr: "Masaya vuruyor.", en: "Hits the table." }
        },
        lies: {
          level1: "Ben sadece veri okurum.",
          level2: "Frenlere dokunmadım.",
          level3: "Sisteme giriş yapmadım!"
        },
        confession: "Evet ben yaptım, bana hak ettiğimi vermediler!",
        confessionEn: "Yes I did it, they didn't give me what I deserved!",
        detailedStatements: [
          { id: "hans-s1", text: "Toplantıdan sonra odama geçtim.", textEn: "Went to my room after the meeting.", isContradiction: false },
          { id: "hans-s2", text: "Bütün gece araca veya sisteme hiç dokunmadım, odamdaydım.", textEn: "I didn't touch the car or system all night, I was in my room.", isContradiction: true, contradictionClueId: "clue-ecu-telemetry-log", explanation: "Hans'ın kriptografik anahtarıyla 22:28'de ECU fren bypass logu sisteme girilmiş.", explanationEn: "An ECU brake bypass log was entered into the system at 22:28 with Hans's cryptographic key." }
        ]
      },
      {
        id: "suspect-arda",
        name: "Arda Tan",
        role: "2. Pilot",
        roleEn: "2nd Driver",
        age: 24,
        temperament: "Heyecanlı",
        temperamentEn: "Excited",
        relationshipToVictim: "Takım arkadaşı.",
        relationshipToVictimEn: "Teammate.",
        statement: "Antrenmandaydım.",
        statementEn: "I was at training.",
        isCulprit: false,
        alibi: "Antrenör onaylıyor.",
        alibiEn: "Trainer confirms.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Simülatörde çok kaza yapıyordu.",
        minorSecretEn: "Crashed a lot in the simulator.",
        breakThreshold: 93,
        gossip: {
          "suspect-hans": { tr: "Hans her zaman Lucas'ı kayırır.", en: "Hans always favors Lucas." }
        },
        behavioralCues: {
          calm: { tr: "Kaskını tutuyor.", en: "Holding his helmet." },
          nervous: { tr: "Bacağını sallıyor.", en: "Shaking his leg." },
          breaking: { tr: "Bağırıyor.", en: "Shouting." }
        },
        lies: {
          level1: "Ben aracı sadece sürerim.",
          level2: "Sabotajla işim olmaz.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "arda-s1", text: "Antrenmandaydım.", textEn: "I was at training.", isContradiction: false }
        ]
      },
      {
        id: "suspect-marco",
        name: "Marco Vieri",
        role: "Pit Şefi",
        roleEn: "Pit Chief",
        age: 50,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "Pit sorumlusu.",
        relationshipToVictimEn: "Pit manager.",
        statement: "Aletleri temizliyordum.",
        statementEn: "I was cleaning the tools.",
        isCulprit: false,
        alibi: "Pit kameraları onaylıyor.",
        alibiEn: "Pit cameras confirm.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Lastik basınçlarında hile yapıyordu.",
        minorSecretEn: "Cheated on tire pressures.",
        breakThreshold: 96,
        gossip: {
          "suspect-hans": { tr: "Hans'ın şifreleri herkesten gizli.", en: "Hans's passwords are hidden from everyone." }
        },
        behavioralCues: {
          calm: { tr: "Matkabını siliyor.", en: "Cleaning his drill." },
          nervous: { tr: "Terini siliyor.", en: "Wiping his sweat." },
          breaking: { tr: "Diz çöküyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Sadece lastiklerle ilgilenirim.",
          level2: "Elektronikten anlamam.",
          level3: "Ben masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "marco-s1", text: "Garaj önündeydim.", textEn: "I was in front of the garage.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-ecu-telemetry-log",
        label: "ECU Telemetri Logu",
        labelEn: "ECU Telemetry Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-hans",
        detail: "Sistemde Hans'ın özel kriptografik anahtarıyla saat 22:28'de girilen yetkisiz ECU bypass komutu tespit edildi.",
        detailEn: "Unauthorized ECU bypass command entered at 22:28 with Hans's private cryptographic key was detected in the system.",
        significance: "Hans'ın araca dışarıdan müdahale ettiğini kanıtlar.",
        significanceEn: "Proves Hans tampered with the car externally."
      },
      {
        id: "clue-14-arda-trainer",
        label: "Antrenör Raporu",
        labelEn: "Trainer Report",
        category: "document",
        type: "alibi",
        clearsSuspectId: "suspect-arda",
        detail: "Arda tüm gece simülatörde eğitimdeydi.",
        detailEn: "Arda was in simulator training all night.",
        significance: "Arda'yı temize çıkarır.",
        significanceEn: "Clears Arda."
      },
      {
        id: "clue-14-marco-cam",
        label: "Pit Kamerası",
        labelEn: "Pit Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-marco",
        detail: "Marco garaj dışından hiç ayrılmadı.",
        detailEn: "Marco never left the front of the garage.",
        significance: "Marco'yu temize çıkarır.",
        significanceEn: "Clears Marco."
      }
    ]
  },

  // Case 15
  {
    id: "case-15-gurme-mutfak",
    title: "Michelin Yıldızlı Mutfakta Gizli Tarif Hırsızlığı",
    titleEn: "Secret Recipe Theft in the Michelin Starred Kitchen",
    difficulty: "normal",
    briefing: "3 Yıldızlı Şef Julien Laurent'in gizli imza menü tarif defteri çalındı.",
    briefingEn: "3 Star Chef Julien Laurent's secret signature menu recipe book was stolen.",
    incidentTime: "23:45",
    location: "Şefin Özel Tadım Odası",
    locationEn: "Chef's Private Tasting Room",
    victim: {
      name: "Julien Laurent",
      occupation: "3 Yıldızlı Şef",
      occupationEn: "3 Star Chef",
      causeOfDeath: "Tarif Hırsızlığı",
      causeOfDeathEn: "Recipe Theft"
    },
    timeline: [
      { time: "23:00", event: "Restoran kapandı.", eventEn: "Restaurant closed.", verified: true },
      { time: "23:45", event: "Tarif defteri çalındı.", eventEn: "Recipe book stolen.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Tadım masasında renkli bir iplik.",
        "Kasa şifresiyle açılmış."
      ],
      en: [
        "Colored thread on the tasting table.",
        "Vault opened with code."
      ]
    },
    culpritId: "suspect-emre",
    correctMethod: "Şefin özel tadım masasına gizlice girip tarif defterini çaldı.",
    correctMethodEn: "Secretly entered the chef's private tasting table and stole the recipe book.",
    correctMotive: "Rakip gruba satmak.",
    correctMotiveEn: "To sell to a rival group.",
    winningContradiction: {
      suspectId: "suspect-emre",
      sentenceId: "emre-s2",
      clueId: "clue-apron-thread"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli, masaya hiç yaklaşmadığını iddia etse de masada onun önlüğüne ait mercan renkli iplik bulundu.",
      en: "Analyst Note: Suspect claims he never approached the table, but a coral colored thread from his apron was found on it."
    },
    suspects: [
      {
        id: "suspect-emre",
        name: "Emre Yılmaz",
        role: "Sous Chef",
        roleEn: "Sous Chef",
        age: 32,
        temperament: "Hırslı ve kurnaz",
        temperamentEn: "Ambitious and cunning",
        relationshipToVictim: "Şefin yardımcısı.",
        relationshipToVictimEn: "Chef's assistant.",
        statement: "Odanın yanına bile yaklaşmadım.",
        statementEn: "I didn't even go near the room.",
        isCulprit: true,
        alibi: "Mutfakta temizlik yaptığını iddia ediyor.",
        alibiEn: "Claims to be cleaning in the kitchen.",
        motive: "Büyük para ödülü.",
        motiveEn: "Large monetary reward.",
        minorSecret: "Tariflerin bazılarını kopyalamıştı.",
        minorSecretEn: "Had copied some of the recipes.",
        breakThreshold: 84,
        gossip: {
          "suspect-pierre": { tr: "Pierre çok sarhoştu.", en: "Pierre was very drunk." }
        },
        behavioralCues: {
          calm: { tr: "Bıçağını bileyliyor.", en: "Sharpening his knife." },
          nervous: { tr: "Önlüğünü çekiştiriyor.", en: "Tugging at his apron." },
          breaking: { tr: "Tabak fırlatıyor.", en: "Throws a plate." }
        },
        lies: {
          level1: "Ben sadece yemek yaparım.",
          level2: "Tadım masasına gitmedim.",
          level3: "Defter bende değil!"
        },
        confession: "Evet çaldım, kendi restoranımı açacağım!",
        confessionEn: "Yes I stole it, I will open my own restaurant!",
        detailedStatements: [
          { id: "emre-s1", text: "Temizlikte görevliydim.", textEn: "I was assigned to cleaning.", isContradiction: false },
          { id: "emre-s2", text: "Bütün gece Şefin özel tadım masasına hiç yaklaşmadım.", textEn: "I never approached the Chef's private tasting table all night.", isContradiction: true, contradictionClueId: "clue-apron-thread", explanation: "Tadım masasında Emre'nin özel önlüğüne ait mercan renkli lif bulundu.", explanationEn: "A coral colored fiber belonging to Emre's custom apron was found on the tasting table." }
        ]
      },
      {
        id: "suspect-pierre",
        name: "Pierre Martin",
        role: "Sommelier",
        roleEn: "Sommelier",
        age: 44,
        temperament: "Rahat",
        temperamentEn: "Relaxed",
        relationshipToVictim: "Şarap uzmanı.",
        relationshipToVictimEn: "Wine expert.",
        statement: "Mahzendeydim.",
        statementEn: "I was in the cellar.",
        isCulprit: false,
        alibi: "Mahzen kameraları.",
        alibiEn: "Cellar cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Şarapları kendisi içiyordu.",
        minorSecretEn: "Drank the wines himself.",
        breakThreshold: 94,
        gossip: {
          "suspect-emre": { tr: "Emre çok hırslı biri.", en: "Emre is very ambitious." }
        },
        behavioralCues: {
          calm: { tr: "Şarap kadehini siliyor.", en: "Wiping a wine glass." },
          nervous: { tr: "Boğazını temizliyor.", en: "Clearing his throat." },
          breaking: { tr: "Ağlıyor.", en: "Crying." }
        },
        lies: {
          level1: "Sadece şaraplara bakarım.",
          level2: "Tariflerle ilgilenmem.",
          level3: "Ben çalmadım."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "pierre-s1", text: "Mahzende sayım yapıyordum.", textEn: "I was doing inventory in the cellar.", isContradiction: false }
        ]
      },
      {
        id: "suspect-melis",
        name: "Melis Akdağ",
        role: "Pasta Şefi",
        roleEn: "Pastry Chef",
        age: 29,
        temperament: "Tatlı",
        temperamentEn: "Sweet",
        relationshipToVictim: "Tatlılardan sorumlu şef.",
        relationshipToVictimEn: "Chef in charge of desserts.",
        statement: "Tatlı hazırlıyordum.",
        statementEn: "I was preparing desserts.",
        isCulprit: false,
        alibi: "Mutfaktaki diğer çalışanlar.",
        alibiEn: "Other workers in the kitchen.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Tatlıları hazır alıyordu bazen.",
        minorSecretEn: "Sometimes bought pre-made desserts.",
        breakThreshold: 92,
        gossip: {
          "suspect-emre": { tr: "Emre sürekli şefin odasına bakıyordu.", en: "Emre kept looking at the chef's room." }
        },
        behavioralCues: {
          calm: { tr: "Krema torbasını tutuyor.", en: "Holding the piping bag." },
          nervous: { tr: "Ellerini oğuşturuyor.", en: "Rubbing her hands." },
          breaking: { tr: "Diz çöküyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Ben sadece tatlı yaparım.",
          level2: "Şefin odasına girmedim.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "melis-s1", text: "Kendi istasyonumdaydım.", textEn: "I was at my own station.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-apron-thread",
        label: "Önlük Lifi",
        labelEn: "Apron Fiber",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-emre",
        detail: "Tadım masasında Emre'nin özel önlüğüne ait mercan renkli lif bulundu.",
        detailEn: "A coral colored fiber from Emre's custom apron was found on the tasting table.",
        significance: "Emre'nin masaya yaklaştığını kanıtlar.",
        significanceEn: "Proves Emre approached the table."
      },
      {
        id: "clue-15-pierre-cam",
        label: "Mahzen Kamerası",
        labelEn: "Cellar Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-pierre",
        detail: "Pierre tüm gece mahzendeydi.",
        detailEn: "Pierre was in the cellar all night.",
        significance: "Pierre'i temize çıkarır.",
        significanceEn: "Clears Pierre."
      },
      {
        id: "clue-15-melis-staff",
        label: "Personel İfadesi",
        labelEn: "Staff Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-melis",
        detail: "Melis diğer personelle birlikteydi.",
        detailEn: "Melis was with the other staff.",
        significance: "Melis'i temize çıkarır.",
        significanceEn: "Clears Melis."
      }
    ]
  },

  // Case 16
  {
    id: "case-16-oyun-studyosu",
    title: "Bağımsız Oyun Stüdyosunda Kaynak Kod Sabotajı",
    titleEn: "Source Code Sabotage at the Indie Game Studio",
    difficulty: "normal",
    briefing: "Lansmana saatler kala ana repoya yetkisiz force-push yapılarak Baş Geliştirici Berk Taner'in kaynak kodları çalındı.",
    briefingEn: "Hours before launch, the main repo was subjected to an unauthorized force-push and Lead Developer Berk Taner's source codes were stolen.",
    incidentTime: "03:18",
    location: "Ana Sistem Sunucusu",
    locationEn: "Main System Server",
    victim: {
      name: "Berk Taner",
      occupation: "Baş Geliştirici",
      occupationEn: "Lead Developer",
      causeOfDeath: "Veri Hırsızlığı",
      causeOfDeathEn: "Data Theft"
    },
    timeline: [
      { time: "02:00", event: "Ekip ofisten ayrıldı.", eventEn: "Team left the office.", verified: true },
      { time: "03:18", event: "Force-push ile kodlar değiştirildi.", eventEn: "Codes changed via force-push.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Git loglarında garip bir SSH anahtarı kullanımı.",
        "Ofis iç ağından yapılmış erişim."
      ],
      en: [
        "Strange SSH key usage in Git logs.",
        "Access made from the office internal network."
      ]
    },
    culpritId: "suspect-deniz",
    correctMethod: "Lansmana saatler kala ana repoya yetkisiz force-push yaparak kodu çaldı.",
    correctMethodEn: "Stole the code by making an unauthorized force-push to the main repo hours before launch.",
    correctMotive: "Projeyi tek başına satıp parayı almak.",
    correctMotiveEn: "To sell the project alone and take the money.",
    winningContradiction: {
      suspectId: "suspect-deniz",
      sentenceId: "deniz-s2",
      clueId: "clue-git-commit-log"
    },
    analystSummary: {
      tr: "Analist Notu: Şüpheli gece evde olduğunu belirtiyor ama SSH anahtarı ile ofisteki masasından işlem yapılmış.",
      en: "Analyst Note: Suspect claims to be home at night, but his SSH key was used to execute commands from his office desk."
    },
    suspects: [
      {
        id: "suspect-deniz",
        name: "Deniz Soylu",
        role: "Kurucu Ortak & Tasarımcı",
        roleEn: "Co-Founder & Designer",
        age: 31,
        temperament: "Agresif ve hırslı",
        temperamentEn: "Aggressive and ambitious",
        relationshipToVictim: "Berk'in ortağı.",
        relationshipToVictimEn: "Berk's partner.",
        statement: "Gece yarısı ofisten çıkıp evimde uyudum.",
        statementEn: "I left the office at midnight and slept at home.",
        isCulprit: true,
        alibi: "Evinde olduğunu iddia ediyor.",
        alibiEn: "Claims to be at home.",
        motive: "Projeyi çalıp satmak.",
        motiveEn: "Steal the project and sell it.",
        minorSecret: "Kumar borcu vardı.",
        minorSecretEn: "Had a gambling debt.",
        breakThreshold: 83,
        gossip: {
          "suspect-asli": { tr: "Aslı kodlara çok meraklıydı.", en: "Aslı was very curious about the codes." }
        },
        behavioralCues: {
          calm: { tr: "Telefonuyla oynuyor.", en: "Playing with his phone." },
          nervous: { tr: "Tırnaklarını yiyor.", en: "Biting his nails." },
          breaking: { tr: "Ekrana yumruk atıyor.", en: "Punches the screen." }
        },
        lies: {
          level1: "Ben tasarımcıyım, koddan anlamam.",
          level2: "Evdeydim.",
          level3: "O push bana ait değil!"
        },
        confession: "Evet çaldım, o oyun benim fikrimdi!",
        confessionEn: "Yes I stole it, that game was my idea!",
        detailedStatements: [
          { id: "deniz-s1", text: "Partiden sonra doğrudan eve gittim.", textEn: "Went straight home after the party.", isContradiction: false },
          { id: "deniz-s2", text: "Gece yarısı ofisten çıkıp evimde uyudum, hiçbir sisteme dokunmadım.", textEn: "I left the office at midnight and slept at home, touched no system.", isContradiction: true, contradictionClueId: "clue-git-commit-log", explanation: "Saat 03:18'de Deniz'in ofis masasındaki SSH anahtarıyla git push işlemi yapılmış.", explanationEn: "A git push was executed at 03:18 using Deniz's SSH key from his office desk." }
        ]
      },
      {
        id: "suspect-asli",
        name: "Aslı Vural",
        role: "3D Artist",
        roleEn: "3D Artist",
        age: 26,
        temperament: "Heyecanlı",
        temperamentEn: "Excited",
        relationshipToVictim: "Tasarım ekibi üyesi.",
        relationshipToVictimEn: "Design team member.",
        statement: "Sabaha kadar çizim yaptım evimde.",
        statementEn: "I drew at home until morning.",
        isCulprit: false,
        alibi: "Twitch yayını yapıyordu.",
        alibiEn: "Was live streaming on Twitch.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Başka stüdyoyla görüşüyordu.",
        minorSecretEn: "Was interviewing with another studio.",
        breakThreshold: 92,
        gossip: {
          "suspect-deniz": { tr: "Deniz Bey patronla çok tartışıyordu.", en: "Mr. Deniz argued a lot with the boss." }
        },
        behavioralCues: {
          calm: { tr: "Tabletiyle ilgileniyor.", en: "Attending to her tablet." },
          nervous: { tr: "Saçlarıyla oynuyor.", en: "Playing with her hair." },
          breaking: { tr: "Ağlıyor.", en: "Crying." }
        },
        lies: {
          level1: "Ben sadece modellerim.",
          level2: "Git loglarını bilmem.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "asli-s1", text: "Evimde yayındaydım.", textEn: "I was streaming at home.", isContradiction: false }
        ]
      },
      {
        id: "suspect-cem",
        name: "Cem Ertekin",
        role: "Yatırımcı",
        roleEn: "Investor",
        age: 40,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "Şirket yatırımcısı.",
        relationshipToVictimEn: "Company investor.",
        statement: "Oteldeydim.",
        statementEn: "I was at the hotel.",
        isCulprit: false,
        alibi: "Otel kameraları.",
        alibiEn: "Hotel cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Projeyi iptal etmeyi düşünüyordu.",
        minorSecretEn: "Was considering canceling the project.",
        breakThreshold: 96,
        gossip: {
          "suspect-deniz": { tr: "Deniz kodların haklarını istiyordu.", en: "Deniz wanted the rights to the codes." }
        },
        behavioralCues: {
          calm: { tr: "Puro içiyor.", en: "Smoking a cigar." },
          nervous: { tr: "Bacağını sallıyor.", en: "Shaking his leg." },
          breaking: { tr: "Bağırıyor.", en: "Yelling." }
        },
        lies: {
          level1: "Ben sadece para veririm.",
          level2: "Kodlarla işim olmaz.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "cem-s1", text: "Otelimde uyuyordum.", textEn: "I was sleeping at my hotel.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-git-commit-log",
        label: "Git SSH Erişim Logu",
        labelEn: "Git SSH Access Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-deniz",
        detail: "03:18'de Deniz'in ofis masasındaki kişisel SSH anahtarıyla yetkisiz git push yapıldı.",
        detailEn: "Unauthorized git push executed at 03:18 from Deniz's office desk using his personal SSH key.",
        significance: "Deniz'in işlemi yaptığını kanıtlar.",
        significanceEn: "Proves Deniz executed the operation."
      },
      {
        id: "clue-16-asli-stream",
        label: "Twitch Yayını Kaydı",
        labelEn: "Twitch Stream VOD",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-asli",
        detail: "Aslı tüm gece canlı yayındaydı.",
        detailEn: "Aslı was live streaming all night.",
        significance: "Aslı'yı temize çıkarır.",
        significanceEn: "Clears Aslı."
      },
      {
        id: "clue-16-cem-hotel",
        label: "Otel Kamera Kaydı",
        labelEn: "Hotel Camera Log",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-cem",
        detail: "Cem gece boyunca otelinden ayrılmadı.",
        detailEn: "Cem didn't leave his hotel all night.",
        significance: "Cem'i temize çıkarır.",
        significanceEn: "Clears Cem."
      }
    ]
  }
];
