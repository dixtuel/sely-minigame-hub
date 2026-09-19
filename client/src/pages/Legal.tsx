import { ArrowLeft, Cookie, ExternalLink, ShieldCheck, HeartHandshake, Sparkles, BatteryCharging, Trophy, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { ProtectedContact, ProtectedName } from "@/components/ProtectedIdentity";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import type { SiteLocale } from "@/lib/i18n";

type LegalPageProps = { kind: "privacy" | "terms" | "accessibility"; locale?: SiteLocale };

export default function Legal({ kind, locale = "tr" }: LegalPageProps) {
  const privacy = kind === "privacy";
  const accessibility = kind === "accessibility";
  const english = locale === "en";
  const title = privacy
    ? (english ? "Privacy & Personal Data Notice (KVKK / GDPR)" : "Gizlilik ve Oyuncu Hakları Bildirimi (KVKK / GDPR)")
    : accessibility
      ? (english ? "Accessibility Statement" : "Erişilebilirlik Bildirimi")
      : (english ? "Terms of Fair Play & Use" : "Kullanım ve Adil Oyun Koşulları");

  return (
    <main className="legal-page">
      <header className="legal-nav">
        <Link href={english ? "/en" : "/"} className="back-button">
          <ArrowLeft size={18} /> {english ? "Game catalogue" : "Oyun kataloğu"}
        </Link>
        <span>SELY.TR · {english ? "PLAYER INFORMATION & PRIVACY" : "OYUNCU BİLGİLENDİRMESİ VE GİZLİLİK"}</span>
      </header>
      <article className="legal-article">
        <div className="legal-heading">
          <span className="studio-kicker">
            {accessibility
              ? (english ? "ACCESSIBILITY · THOUGHTFUL FOR ALL" : "ERİŞİLEBİLİRLİK · HERKES İÇİN ÖZENLE")
              : (english ? "TRANSPARENT & PLAYER-CENTRIC" : "ŞEFFAF VE OYUNCU ODAKLI BİLGİLENDİRME")}
          </span>
          <h1>{title}</h1>
          <p>{english ? "Last updated: 20 September 2026" : "Son güncelleme: 20 Eylül 2026"}</p>
        </div>
        {english ? (
          <EnglishLegalContent kind={kind} />
        ) : privacy ? (
          <PrivacyContent />
        ) : accessibility ? (
          <AccessibilityContent />
        ) : (
          <TermsContent />
        )}
        <section className="legal-note">
          <ShieldCheck size={21} />
          <p>
            {english ? (
              <>
                Have a question about your privacy, a suggestion, or a request? Contact us directly at{" "}
                <ProtectedContact locale="en" />.
              </>
            ) : (
              <>
                Gizliliğiniz, haklarınız veya oyunlar hakkında aklınıza takılan her türlü soru ve öneri için doğrudan{" "}
                <ProtectedContact /> adresi üzerinden bizimle iletişime geçebilirsiniz.
              </>
            )}
          </p>
        </section>
      </article>
    </main>
  );
}

function EnglishLegalContent({ kind }: { kind: LegalPageProps["kind"] }) {
  const { openBanner } = useCookieConsent();

  if (kind === "accessibility") {
    return (
      <div className="legal-copy">
        <section>
          <h2>1. Built for Everyone</h2>
          <p>
            SELY.TR MiniGame Hub is designed to ensure short, thoughtful, and procedural games are
            welcoming and accessible to every player regardless of physical ability, device type, or
            connection speed. Accessibility is baked into typography, touch zone ergonomics, and control schemes.
          </p>
        </section>
        <section>
          <h2>2. Controls & Multimodal Play</h2>
          <p>
            Directional games (Echo, Shadow, Spark) feature complete keyboard bindings (Arrow keys, Space,
            WASD) alongside generous on-screen touch buttons for mobile screens. Text alternatives supplement
            all color-coded feedback so that color blindness never impedes gameplay.
          </p>
        </section>
        <section>
          <h2>3. Gentle on the Senses & Battery</h2>
          <p>
            We honor your operating system&apos;s <code>prefers-reduced-motion</code> setting, softening
            particle effects and camera shakes. All games are 100% playable with audio muted. Furthermore,
            sound loops automatically pause whenever you switch tabs or lock your screen, preventing battery drain.
          </p>
        </section>
        <section>
          <h2>4. Feedback & Reach Out</h2>
          <p>
            If you run into any barriers or have an idea to make games more accessible, please share it with us at{" "}
            <ProtectedContact locale="en" />.
          </p>
        </section>
      </div>
    );
  }

  if (kind === "privacy") {
    return (
      <div className="legal-copy">
        <section>
          <h2>1. Who We Are & Our Privacy-First Commitment</h2>
          <p>
            SELY.TR is an independent, non-intrusive mini-game catalogue created and operated by{" "}
            <ProtectedName /> (dixtuel). Under Turkish Data Protection Law No. 6698 (&ldquo;KVKK&rdquo;)
            and the EU General Data Protection Regulation (&ldquo;GDPR&rdquo;), we act as the data
            controller. You can reach us directly at <ProtectedContact locale="en" />.
          </p>
          <p>
            Our core commitment is simple: <strong>You don&apos;t need to share your identity to have fun.</strong> You
            can play every game without creating an account, registering an email, or handing over personal phone
            numbers.
          </p>
        </section>

        <section>
          <h2>2. What Stays on Your Device (Local Storage)</h2>
          <p>
            To remember your high scores and keep the site responsive without storing user accounts on the
            cloud, small preferences are saved directly on your phone or computer:
          </p>
          <ul>
            <li>
              <strong>Your High Scores (<code>sely_mini_scores_v1</code>):</strong> Your best records for each
              game stay strictly in your personal browser.
            </li>
            <li>
              <strong>Site Preferences:</strong> Your dark/light theme choice (<code>theme</code>), preferred
              language (<code>sely-locale</code>), and cookie preference (<code>sely-cookie-consent</code>).
            </li>
            <li>
              <strong>Offline & Data-Saving Cache (Service Worker):</strong> Game assets, sounds, and fonts are
              cached on your device via <code>/sw.js</code>. This saves your mobile data plan and allows instant
              replay even on weak subway Wi-Fi or offline.
            </li>
          </ul>
          <p>
            These files never leave your device. You can clear them whenever you want simply by clearing your
            browser history or site data.
          </p>
        </section>

        <section>
          <h2>3. Daily Leaderboards: Is My Identity or IP Visible?</h2>
          <p>
            <strong>No, absolutely not.</strong> When you finish a run, your score can join today&apos;s global
            leaderboard to celebrate daily achievements with other players:
          </p>
          <ul>
            <li>
              <strong>Fun Anonymous Nicknames:</strong> Instead of your real name, the system assigns you a
              friendly, procedurally generated gamer tag for the day (e.g. <em>&ldquo;Brave Fox #4829&rdquo;</em> or{" "}
              <em>&ldquo;Silent Architect #1042&rdquo;</em>).
            </li>
            <li>
              <strong>Zero Identity Tracking:</strong> To allow you to beat your own score later in the day, your
              browser generates an anonymous cryptographic signature. Your IP address, device name, and location
              are never displayed or attached to leaderboard records.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. AI Detective Interrogations in &ldquo;Vaka Mystery&rdquo;</h2>
          <p>
            In the mystery case &ldquo;Vaka: Murder on the Orient Express&rdquo;, you can type free-form
            interrogation questions or bluffs to suspect passengers:
          </p>
          <ul>
            <li>
              <strong>How It Works:</strong> Your typed question is sent securely to an AI provider (such as
              NVIDIA NIM or Groq) along with the fictional story context so the suspect can give you an immediate,
              dramatic, and in-character answer.
            </li>
            <li>
              <strong>No Personal Data Attached:</strong> No user accounts, real names, or device profiles are
              included in this request.
            </li>
            <li>
              <strong>Transient & Ephemeral:</strong> Your dialogue is processed in real time solely to generate
              the character&apos;s response; it is never stored to build player profiles or train private AI models.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Protecting Your Device & Battery (Zero Data Sent)</h2>
          <p>
            We take player battery life and device smoothness seriously. When running on low-power phones,
            budget devices, or in-app WebViews:
          </p>
          <ul>
            <li>
              Your browser checks locally if your battery is low or if your device has limited memory.
            </li>
            <li>
              If so, it smoothly scales down canvas render resolution and halts background audio loops to keep
              your phone cool and prevent battery drain.
            </li>
            <li>
              <strong>Completely Local:</strong> This check occurs <strong>entirely inside your phone&apos;s
              temporary memory</strong>. Your battery level or hardware specs are <strong>never transmitted to our
              servers</strong>, never logged, and never used to fingerprint your device.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Non-Intrusive Ads & Cookie Choices</h2>
          <p>
            To cover hosting and bandwidth expenses, SELY.TR displays unobtrusive advertisements via Google
            AdSense:
          </p>
          <ul>
            <li>
              <strong>Google Consent Mode v2:</strong> When you first visit, advertising personalization and ad
              storage cookies are set to <strong>denied by default</strong>.
            </li>
            <li>
              <strong>Full Control:</strong> Personalized ad cookies are only enabled if you explicitly choose
              &ldquo;Accept All&rdquo;. You can review or switch back to strictly essential storage at any time
              using the button below or via the &ldquo;Cookie Settings&rdquo; link in the footer.
            </li>
          </ul>
          <div style={{ marginTop: "14px" }}>
            <button type="button" className="footer-link-button" onClick={openBanner}>
              <Cookie size={14} /> Open Cookie & Ad Preferences
            </button>
          </div>
        </section>

        <section>
          <h2>7. Site Speed & Quality Monitoring (Cookieless Analytics)</h2>
          <p>
            To ensure games load quickly and touch controls don&apos;t lag across various devices, we monitor
            anonymized speed diagnostics (Vercel Speed Insights). This system uses no tracking cookies and does not
            follow you across the web. You can turn this off at any time by selecting &ldquo;Reject (Essential Only)&rdquo;
            in the Cookie Settings banner.
          </p>
        </section>

        <section>
          <h2>8. Your Rights & How to Reach Us</h2>
          <p>
            Under KVKK Art. 11 and GDPR Art. 15&ndash;22, you have full rights to learn what data is processed and
            request deletion. Because we don&apos;t maintain user accounts or personal profiles, there are typically
            no identifiable personal records to query; however, if you ever wish to remove an anonymous leaderboard
            score or have any question, write to us directly at <ProtectedContact locale="en" />.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="legal-copy">
      <section>
        <h2>1. Welcome & The Spirit of Fair Play</h2>
        <p>
          Welcome to SELY.TR MiniGame Hub. This space was built with love to offer short, mindful, and engaging
          mini-games for everyone. By browsing and playing on SELY.TR, you agree to these fair-play principles.
        </p>
      </section>

      <section>
        <h2>2. Free & Open Source (GNU AGPLv3)</h2>
        <p>
          SELY MiniGame Hub is independent and free software licensed under the{" "}
          <strong>GNU Affero General Public License v3.0 (AGPLv3)</strong>. You are welcome to inspect, study,
          and contribute to the code. If you host or adapt the network service, AGPLv3 requires making your
          modifications available to the community under the same open-source terms.
        </p>
      </section>

      <section>
        <h2>3. Fair Play & Community Respect</h2>
        <p>
          Games are most fun when everyone competes on fair, human terms. We kindly ask you to honor these guidelines:
        </p>
        <ul>
          <li>
            <strong>Human Players Only:</strong> Please do not unleash automated scrapers, stress-testing bots, or
            denial-of-service scripts on our servers.
          </li>
          <li>
            <strong>Honest Leaderboards:</strong> Tampering with game memory, manipulating cryptographic signatures,
            or submitting impossible scores ruins the spirit of friendly competition. Unrealistic scores are
            filtered out automatically.
          </li>
          <li>
            <strong>Enjoy the Challenge:</strong> Avoid reverse-engineering daily seeds to spoil solutions for fellow
            players.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Friendly AI Interaction (Vaka Interrogations)</h2>
        <p>
          The detective interrogation in &ldquo;Vaka&rdquo; lets you roleplay with AI-driven characters. While
          interrogating:
        </p>
        <ul>
          <li>
            Please keep your dialogue creative and respectful: harassment, hate speech, threats, and illegal
            content are strictly prohibited.
          </li>
          <li>
            Attempting system prompt injection or jailbreak exploits is not permitted and will be intercepted by
            automated guards.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. As-Is Availability</h2>
        <p>
          Games are provided &ldquo;as is&rdquo; as an independent passion project. While we strive for smooth,
          reliable performance on every phone and desktop, we cannot guarantee uninterrupted uptime or prevent local
          data loss resulting from browser cache wipes.
        </p>
      </section>

      <section>
        <h2>6. Jurisdiction & Contact</h2>
        <p>
          These terms are governed by the laws of the Republic of Turkey, with Istanbul Courts having jurisdiction
          over any disputes. For questions, suggestions, or feedback, you can always reach us at{" "}
          <ProtectedContact locale="en" />.
        </p>
      </section>
    </div>
  );
}

function AccessibilityContent() {
  return (
    <div className="legal-copy">
      <section>
        <h2>1. Herkes İçin Özenli Tasarım</h2>
        <p>
          SELY.TR MiniGame Hub’ın herkes için kullanılabilir, anlaşılır ve keyifli olmasını hedefliyoruz.
          Oyunlarımız kısa, berrak kurallı ve dikkat odaklı deneyimler olarak kurgulanmıştır; erişilebilirlik,
          sonradan eklenen bir katman değil, arayüz, renk kontrastı ve tuş ergonomisi kararlarımızın temelidir.
        </p>
      </section>
      <section>
        <h2>2. Kontroller ve Çok Yönlü Oynanış</h2>
        <p>
          Tüm oyun butonları ve bağlantılar ekran okuyuculara uygun semantik etiketlerle desteklenir.
          Yön temelli oyunlar (Yankı, Gölge, Kıvılcım) hem klavye yön tuşları (oklar, Space, WASD) hem de mobil
          dokunmatik geniş tuş alanlarıyla rahatça yönetilebilir. Renk, bilgi aktarmanın tek yolu olarak
          kullanılmaz; puan, hedef ve tur durumu metin olarak da gösterilerek renk algısı farkı olan oyuncuların
          önündeki engeller kaldırılır.
        </p>
      </section>
      <section>
        <h2>3. Gözü ve Cihazı Yormayan Seçenekler</h2>
        <p>
          Oyun motorlarımız cihazınızın <code>prefers-reduced-motion</code> (azaltılmış hareket) ayarına saygı
          gösterir, parçacık efektlerini ve kamera sarsıntılarını yumuşatır. Oyunlarımızın tamamı sessiz modda da
          %100 oynanabilir durumdadır. Ayrıca sekmeyi alta aldığınızda sesler kendiliğinden durur, telefonunuzun
          şarjı boş yere harcanmaz.
        </p>
      </section>
      <section>
        <h2>4. Geri Bildirim ve İletişim</h2>
        <p>
          Kullandığınız cihazda herhangi bir erişim engeliyle karşılaşırsanız veya erişilebilirliği daha da
          artırmak için bir fikriniz olursa lütfen <ProtectedContact /> üzerinden bize bildirin.
        </p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  const { openBanner } = useCookieConsent();

  return (
    <div className="legal-copy">
      <section>
        <h2>1. Biz Kimiz ve Temel Gizlilik İlkemiz</h2>
        <p>
          SELY.TR, oyun oynamayı seven herkes için bağımsız bir çabayla geliştirilen mini oyun kataloğudur.
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) ve Avrupa Genel Veri Koruma
          Tüzüğü (&ldquo;GDPR&rdquo;) kapsamında veri sorumlusu site kurucusu <ProtectedName />&rsquo;tır
          (dixtuel). Her türlü sorunuz veya veri talebiniz için doğrudan <ProtectedContact /> adresinden bize
          ulaşabilirsiniz.
        </p>
        <p>
          En temel ilkemiz şudur: <strong>Oyun oynamak için kimliğinizi vermek zorunda değilsiniz.</strong> Sitedeki
          tüm oyunlar hesap açmadan, e-posta veya telefon numarası paylaşmadan tamamen anonim olarak oynanabilir.
        </p>
      </section>

      <section>
        <h2>2. Cihazınızda Saklananlar (Yerel Depolama & Çevrimdışı Kolaylık)</h2>
        <p>
          Skorlarınızı ve tercihlerinizi sunucuya kullanıcı hesabı kaydetmeden hatırlayabilmek için yalnızca kendi
          telefonunuzun veya bilgisayarınızın yerel depolama alanı kullanılır:
        </p>
        <ul>
          <li>
            <strong>Oyun Rekorlarınız (<code>sely_mini_scores_v1</code>):</strong> Her oyunda elde ettiğiniz en yüksek
            puanlar yalnızca kendi tarayıcınızda saklanır.
          </li>
          <li>
            <strong>Görünüm ve Dil Tercihleriniz:</strong> Karanlık/aydınlık tema tercihiniz (<code>theme</code>),
            dil seçiminiz (<code>sely-locale</code>) ve çerez onay durumunuz (<code>sely-cookie-consent</code>).
          </li>
          <li>
            <strong>İnternet Kotası Tasarrufu ve Çevrimdışı Oyun (Service Worker):</strong> Oyun grafikleri, sesler
            ve yazı tipleri cihazınızın yerel önbelleğinde (<code>CacheStorage</code>) tutulur. Bu sayede mobil
            internet kotanız tükenmez; oyunlar zayıf bağlantılarda veya çevrimdışıyken bile anında açılır.
          </li>
        </ul>
        <p>
          Bu veriler <strong>kesinlikle sizin cihazınızın dışına çıkmaz</strong>. İstediğiniz zaman tarayıcı
          geçmişinizi veya site verilerinizi temizleyerek bu kayıtları sıfırlayabilirsiniz.
        </p>
      </section>

      <section>
        <h2>3. Günlük Sıralama (Liderlik Tablosu): Kimliğim Görünür mü?</h2>
        <p>
          <strong>Kesinlikle hayır.</strong> Bir oyunu başarıyla tamamladığınızda skorunuz günün tatlı rekabetine
          katılmak üzere günlük liderlik tablosuna iletilir:
        </p>
        <ul>
          <li>
            <strong>Sevimli Rastgele Takma Adlar:</strong> Gerçek adınız veya kullanıcı adınız yerine, sistem her gün
            adınıza rastgele ve eğlenceli bir oyuncu rumuzu üretir (örneğin <em>&ldquo;Cesur Tilki #4829&rdquo;</em> veya{" "}
            <em>&ldquo;Sessiz Mimar #1042&rdquo;</em>).
          </li>
          <li>
            <strong>Sıfır Kimlik Takibi:</strong> Gün içinde aynı cihazdan yeni bir rekor kırdığınızda kendi skorunuzu
            güncelleyebilmeniz için cihazınız tek yönlü bir matematiksel imza kullanır. IP adresiniz, cihaz bilginiz
            veya kimliğiniz hiçbir oyuncuya ya da üçüncü kişiye gösterilmez.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. &ldquo;Vaka: Trende Cinayet&rdquo; Oyununda Yapay Zekâ ile Dedektiflik</h2>
        <p>
          Trende Cinayet oyununda şüphelilere klavyeden dilediğiniz soruları sorabilir ve blöf yapabilirsiniz:
        </p>
        <ul>
          <li>
            <strong>Nasıl Çalışır?</strong> Şüpheliye yazdığınız dedektiflik sorusu, oyunun kurgusal durumuyla
            (şüphelinin karakteri, ipuçları ve stres düzeyi) birlikte güvenli bir yapay zekâ servisine (örneğin NVIDIA
            NIM veya Groq) iletilir. Böylece şüpheli size anında, gerçekçi ve rolüne uygun bir cevap verir.
          </li>
          <li>
            <strong>Kişisel Bilginiz Gitmez:</strong> Bu isteklerde adınız, e-postanız veya cihaz bilginiz asla
            bulunmaz.
          </li>
          <li>
            <strong>Kalıcı Olarak Saklanmaz:</strong> Yazdığınız sorular yalnızca o anki şüpheli cevabını üretmek için
            işlenir; profilinizi oluşturmak veya yapay zekâyı eğitmek amacıyla bir veritabanında saklanmaz.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Telefonunuzu ve Pilinizi Koruma (Sıfır Veri Aktarımı)</h2>
        <p>
          Oyunlarımızın eski telefonlarda, kısıtlı donanımlarda veya şarjınız azaldığında cihazınızı ısıtmadan akıcı
          çalışabilmesi için:
        </p>
        <ul>
          <li>
            Tarayıcınız kendi içinde pil durumunu (şarjın az olup olmadığını) ve cihazın yaklaşık işlem gücünü kontrol
            eder.
          </li>
          <li>
            Gerektiğinde ekran çözünürlüğünü ve animasyon yoğunluğunu hafifleterek pilinizin tükenmesini ve telefonunuzun
            ısınmasını önler.
          </li>
          <li>
            <strong>Tamamen Kendi Cihazınızda:</strong> Bu denetim <strong>yalnızca telefonunuzun kendi anlık
            hafızasında</strong> gerçekleşir. Pil yüzdeniz veya donanım özellikleriniz <strong>kesinlikle sunucularımıza
            gönderilmez</strong>, kaydedilmez ve cihaz parmak izi (fingerprinting) çıkarma amacıyla kullanılmaz.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Reklamlar ve Çerez Tercihleriniz</h2>
        <p>
          SELY.TR&rsquo;nin sunucu ve barındırma masraflarını karşılayabilmek amacıyla sitede Google AdSense sponsorlu
          alanları yer alır:
        </p>
        <ul>
          <li>
            <strong>Google Consent Mode v2 Desteği:</strong> Sitemize ilk girişinizde reklam kişiselleştirme ve çerez
            izinleri <strong>varsayılan olarak kapalıdır</strong>.
          </li>
          <li>
            <strong>Karar Tamamen Sizde:</strong> Kişiselleştirilmiş reklam çerezleri yalnızca siz &ldquo;Tümünü Kabul
            Et&rdquo; butonuna basarsanız devreye girer. Tercihinizi istediğiniz zaman aşağıdaki butondan veya sayfa
            altındaki &ldquo;Çerez Ayarları&rdquo; bağlantısından güncelleyebilir veya iptal edebilirsiniz.
          </li>
        </ul>
        <div style={{ marginTop: "14px" }}>
          <button type="button" className="footer-link-button" onClick={openBanner}>
            <Cookie size={14} /> Çerez ve Reklam Tercihlerini Aç
          </button>
        </div>
      </section>

      <section>
        <h2>7. Site Hızı ve Kalite Ölçümü (Çerezsiz Analitik)</h2>
        <p>
          Hangi oyunların sevildiğini anlamak ve oyunların telefonlarda takılmadan açıldığından emin olmak için Vercel
          Speed Insights kullanılır. Bu ölçüm sizi internette takip eden çerezler kullanmaz; adınızı veya tam IP
          adresinizi kaydetmez. Dilerseniz çerez ayarlarından &ldquo;Yalnızca Zorunlular (Reddet)&rdquo; seçeneğiyle bu
          ölçümü de kolayca kapatabilirsiniz.
        </p>
      </section>

      <section>
        <h2>8. Yasal Haklarınız ve Başvuru (KVKK Madde 11 & GDPR)</h2>
        <p>
          KVKK ve GDPR uyarınca herkes kişisel verilerinin durumunu öğrenme, silinmesini veya düzeltilmesini talep etme
          hakkına sahiptir. Sistemimizde adınıza ait bir kullanıcı hesabı bulunmadığı için doğrudan sorgulanabilir bir
          kişisel profiliniz yoktur; ancak liderlik tablosundaki anonim skorunuzun silinmesini isterseniz veya
          gizliliğe dair herhangi bir sorunuz olursa doğrudan <ProtectedContact /> adresinden bize yazabilirsiniz.
        </p>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="legal-copy">
      <section>
        <h2>1. Hoş Geldiniz ve Oyun Ruhu</h2>
        <p>
          SELY.TR MiniGame Hub&rsquo;a hoş geldiniz! Burası zihninizi dinlendirmek, dikkat ve odaklanma gerektiren kısa,
          özenli oyunlarla keyifli vakit geçirmeniz için hazırlandı. Siteye girerek ve oyunları oynayarak bu dostane
          kuralları kabul etmiş sayılırsınız.
        </p>
      </section>

      <section>
        <h2>2. Özgür ve Açık Kaynak (GNU AGPLv3)</h2>
        <p>
          SELY MiniGame Hub bağımsız bir projedir ve kaynak kodları{" "}
          <strong>GNU Affero General Public License v3.0 (AGPLv3)</strong> lisansıyla açık kaynaktır. Kodları
          inceleyebilir, katkı sunabilir veya kendi ortamınızda çalıştırabilirsiniz. AGPLv3 uyarınca bu yazılımı bir ağ
          üzerinden hizmet olarak sunduğunuzda yaptığınız geliştirmelerin kaynak kodunu da toplulukla paylaşmanız
          gerekir.
        </p>
      </section>

      <section>
        <h2>3. Adil Oyun ve Centilmenlik Kuralları</h2>
        <p>
          Oyunlar herkes eşit ve adil şartlarda yarıştığında güzeldir. Platformumuzu kullanırken aşağıdaki ilkelere
          özen göstermenizi rica ediyoruz:
        </p>
        <ul>
          <li>
            <strong>Gerçek İnsan Deneyimi:</strong> Sunucularımıza otomatik botlar, yük araçları veya siteyi yoracak
            kazıyıcılar (scrapers) yönlendirmeyiniz.
          </li>
          <li>
            <strong>Dürüst Sıralama:</strong> Bellek müdahaleleri, sahte paketler veya hileli skorlar göndermek tatlı
            rekabet ortamını bozar. Mantık dışı veya hileli skorlar sistem filtrelerimiz tarafından otomatik olarak
            reddedilir.
          </li>
          <li>
            <strong>Topluluk Saygısı:</strong> Günlük oyun tohumlarını kırıp diğer oyuncuların oyun keyfini kaçıracak
            şekilde çözümleri yaymaktan kaçınınız.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Yapay Zekâ ile Saygılı Etkileşim (Vaka Dedektiflik Alanı)</h2>
        <p>
          &ldquo;Vaka: Trende Cinayet&rdquo; oyunundaki serbest sorgu alanı, şüphelilerle yaratıcı diyaloglar kurmanız
          için sunulmuştur. Bu alanı kullanırken:
        </p>
        <ul>
          <li>
            Hakaret, tehdit, nefret söylemi veya yasa dışı unsurlar içeren ifadeler kullanılamaz.
          </li>
          <li>
            Yapay zekâ karakterlerini kötüye kullanmaya veya güvenlik kurallarını aşmaya (jailbreak/prompt injection)
            yönelik komutlar gönderilemez.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Kesintisiz Hizmet Garantisi Olmaması</h2>
        <p>
          SELY.TR bağımsız bir çabayla sunulmaktadır. Oyunlarımızın her zaman sorunsuz çalışması için titizlikle
          çalışsak da, sunucu bakımları veya internet kesintilerinden kaynaklanabilecek geçici aksaklıklardan site
          sorumlu tutulamaz.
        </p>
      </section>

      <section>
        <h2>6. Yasal Zemin ve İletişim</h2>
        <p>
          Bu kullanım koşulları Türkiye Cumhuriyeti yasalarına tabidir ve doğabilecek uyuşmazlıklarda İstanbul
          Mahkemeleri yetkilidir. Her türlü soru, görüş ve dostane geri bildirimleriniz için dilediğiniz an{" "}
          <ProtectedContact /> üzerinden bize yazabilirsiniz.
        </p>
      </section>
    </div>
  );
}
