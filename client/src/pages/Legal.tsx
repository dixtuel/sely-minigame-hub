import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { publicContactEmail } from "@/lib/contact";
import type { SiteLocale } from "@/lib/i18n";

type LegalPageProps = { kind: "privacy" | "terms" | "accessibility"; locale?: SiteLocale };

const Contact = () => <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>;

export default function Legal({ kind, locale = "tr" }: LegalPageProps) {
  const privacy = kind === "privacy";
  const accessibility = kind === "accessibility";
  const english = locale === "en";
  const title = privacy
    ? (english ? "Privacy & Personal Data Notice (KVKK)" : "Gizlilik ve Kişisel Verilerin Korunması (KVKK)")
    : accessibility
      ? (english ? "Accessibility Statement" : "Erişilebilirlik Bildirimi")
      : (english ? "Terms of Use" : "Kullanım Koşulları");

  return <main className="legal-page">
    <header className="legal-nav">
      <Link href={english ? "/en" : "/"} className="back-button">
        <ArrowLeft size={18} /> {english ? "Game catalogue" : "Oyun kataloğu"}
      </Link>
      <span>SELY.TR · {english ? "INFORMATION & RIGHTS" : "BİLGİLER VE HAKLAR"}</span>
    </header>
    <article className="legal-article">
      <div className="legal-heading">
        <span className="studio-kicker">
          {accessibility
            ? (english ? "ACCESSIBILITY · CONTINUOUS IMPROVEMENT" : "ERİŞİLEBİLİRLİK · SÜREKLİ İYİLEŞTİRME")
            : (english ? "POLICIES & LEGAL RIGHTS" : "BİLGİLENDİRME VE YASAL HAKLAR")}
        </span>
        <h1>{title}</h1>
        <p>{english ? "Last updated: 13 September 2026" : "Son güncelleme: 13 Eylül 2026"}</p>
      </div>
      {english ? <EnglishLegalContent kind={kind} /> : privacy ? <PrivacyContent /> : accessibility ? <AccessibilityContent /> : <TermsContent />}
      <section className="legal-note">
        <ShieldCheck size={21} />
        <p>
          {english
            ? <>For questions, privacy requests or feedback, contact <Contact />.</>
            : <>Gizlilik politikası, KVKK başvuruları veya geri bildirimleriniz için doğrudan <Contact /> adresi üzerinden iletişime geçebilirsiniz.</>}
        </p>
      </section>
    </article>
  </main>;
}

function EnglishLegalContent({ kind }: { kind: LegalPageProps["kind"] }) {
  if (kind === "accessibility") {
    return <div className="legal-copy">
      <section>
        <h2>1. Our Approach</h2>
        <p>SELY.TR MiniGame Hub is designed to ensure short, thoughtful games are accessible and enjoyable to everyone regardless of physical ability or device. Accessibility is not an afterthought; it is integrated directly into interface layouts, typography, and controls.</p>
      </section>
      <section>
        <h2>2. Available Features</h2>
        <p>Meaningful semantic markup and accessible labels are maintained across all game cards and navigation bars. Directional games (Echo, Shadow, Spark) feature comprehensive keyboard bindings (arrow keys, Space, WASD) as well as touch zones. Color contrast is audited against WCAG 2.1 AA standards, and text alternatives supplement color-coded indicators.</p>
      </section>
      <section>
        <h2>3. Motion & Auditory Options</h2>
        <p>The interface respects the <code>prefers-reduced-motion</code> operating system setting by muting excessive particle effects and aggressive camera shakes. All games are fully playable with sound muted; audio serves purely as supplementary feedback.</p>
      </section>
      <section>
        <h2>4. Feedback & Support</h2>
        <p>If you encounter any accessibility barriers on any device or browser, please report the details to <Contact />.</p>
      </section>
    </div>;
  }

  if (kind === "privacy") {
    return <div className="legal-copy">
      <section>
        <h2>1. Data Controller</h2>
        <p>This privacy notice is issued by the operator of SELY.TR (Asrın Kılıç / dixtuel). You may address any privacy or data rights inquiries to <Contact />.</p>
      </section>
      <section>
        <h2>2. Data Minimisation & No Account Requirement</h2>
        <p>You can play all games on SELY.TR completely anonymously. Playing games does not require an account, registration, email submission, or telephone number. We believe in radical data minimisation.</p>
      </section>
      <section>
        <h2>3. Local Storage (On-Device Data)</h2>
        <p>To preserve your high scores and preferences without requiring a cloud profile, SELY.TR stores minimal information directly in your browser’s local storage (<code>localStorage</code>):</p>
        <ul>
          <li><code>sely_mini_scores_v1</code>: Your personal best scores across each mini-game.</li>
          <li><code>sely-cookie-consent</code>: Your cookie notice confirmation (accepted/rejected).</li>
          <li><code>sely-locale</code>: Your selected language (Turkish or English).</li>
          <li><code>theme</code>: Your visual theme preference (light or dark).</li>
        </ul>
        <p>These values stay strictly on your personal device, are never transmitted to our database, and can be cleared at any time via your browser settings.</p>
      </section>
      <section>
        <h2>4. Cookies & Third-Party Trackers</h2>
        <p>SELY.TR does not use third-party advertising cookies, behavioural trackers, analytics beacons, or marketing pixels. No tracking cookies are planted on your device.</p>
      </section>
      <section>
        <h2>5. Server Logs & Security</h2>
        <p>When you access SELY.TR, standard technical connection data (client IP address, request timestamp, HTTP status code, user agent) is processed transiently by our edge proxy and server infrastructure to prevent DDoS attacks, mitigate abusive automated scraping, and ensure system uptime. This processing is grounded in legitimate interest (KVKK Art. 5/2-f and GDPR Art. 6/1-f). These transient records are not retained in long-term databases or linked to player identities.</p>
      </section>
      <section>
        <h2>6. Your Rights</h2>
        <p>Under Turkish Law No. 6698 on the Protection of Personal Data (KVKK Art. 11) and applicable data protection regulations, you have the right to learn whether your data is processed, request information, and demand deletion. Because we do not store persistent player profiles or identifiable databases, there are typically no personal records to query; however, you may direct any inquiry to <Contact />.</p>
      </section>
    </div>;
  }

  return <div className="legal-copy">
    <section>
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and playing games on SELY.TR, you agree to these Terms of Use. If you do not agree, you should discontinue using the site.</p>
    </section>
    <section>
      <h2>2. Open Source License</h2>
      <p>SELY MiniGame Hub is free and open-source software licensed under the <strong>GNU Affero General Public License version 3 (AGPLv3)</strong>. You are free to inspect, study, modify, and host the code in accordance with the AGPLv3 terms, provided source code of any modified network service is made available under the same license.</p>
    </section>
    <section>
      <h2>3. Acceptable Use of the Hosted Service</h2>
      <p>While the codebase is open-source, the public hosted service at <code>sely.tr</code> must not be abused. Users may not subject the infrastructure to denial-of-service attempts, automated high-frequency abuse, or intentional disruption of daily challenge endpoints.</p>
    </section>
    <section>
      <h2>4. Disclaimer of Warranty</h2>
      <p>The service and games are provided "as is", without warranty of any kind, express or implied. We do not guarantee uninterrupted availability, error-free gameplay, or persistence of unbacked browser state.</p>
    </section>
    <section>
      <h2>5. Inquiries & Contact</h2>
      <p>For questions or operational notices, contact <Contact />.</p>
    </section>
  </div>;
}

function AccessibilityContent() {
  return <div className="legal-copy">
    <section>
      <h2>1. Yaklaşımımız</h2>
      <p>SELY.TR MiniGame Hub’ın herkes için kullanılabilir, anlaşılır ve keyifli olmasını hedefliyoruz. Oyunlar kısa, berrak kurallı ve dikkat odaklı deneyimler olarak kurgulanır; erişilebilirlik, sonradan eklenen bir katman değil, arayüz ve oyun kontrolü kararlarının temel bileşenidir.</p>
    </section>
    <section>
      <h2>2. Kullanılabilir Özellikler</h2>
      <p>Katalog, oyun başlatma ve hukuki bilgi bağlantıları anlamlı semantik metinlerle etiketlenir. Yön temelli oyunlar (Yankı, Gölge, Kıvılcım) hem klavye yön tuşları (oklar, Space, WASD) hem de mobil dokunmatik geniş tuş alanlarıyla yönetilebilir. Renk, bilgi aktarmanın tek yolu olarak kullanılmaz; skor, hedef ve tur durumu metinsel olarak da eşzamanlı aktarılır.</p>
    </section>
    <section>
      <h2>3. Hareket ve Görsel Tercihler</h2>
      <p>Arayüz ve Canvas motorları, işletim sistemi düzeyinde tanımlanan <code>prefers-reduced-motion</code> (azaltılmış hareket) tercihini dinler ve aşırı parçacık ya da kamera sarsıntılarını sınırlar. Ses efektleri oyunun tamamlanması için zorunlu değildir; oyunlar sessiz modda da %100 oynanabilir durumdadır.</p>
    </section>
    <section>
      <h2>4. Geri Bildirim ve İletişim</h2>
      <p>Kullandığınız yardımcı teknoloji veya cihazda herhangi bir erişilebilirlik engeliyle karşılaşırsanız, detayları <Contact /> adresine iletebilirsiniz.</p>
    </section>
  </div>;
}

function PrivacyContent() {
  return <div className="legal-copy">
    <section>
      <h2>1. Veri Sorumlusu</h2>
      <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, SELY.TR MiniGame Hub platformunun veri sorumlusu site işleticisi Asrın Kılıç’tır (dixtuel). Her türlü bilgi talebi veya başvuru için doğrudan <Contact /> adresini kullanabilirsiniz.</p>
    </section>
    <section>
      <h2>2. Veri Minimizasyonu ve Hesapsız Kullanım</h2>
      <p>SELY.TR üzerinde sunulan tüm mini oyunlar <strong>tamamen anonim</strong> olarak oynanabilir. Platformumuz kullanıcı kaydı, e-posta toplama, şifre belirleme veya telefon doğrulama gibi kimlik tespitine yarayan hiçbir hesap oluşturma adımı içermez. Temel felsefemiz, oyun deneyimini kişisel verilerden tamamen arındırmaktır.</p>
    </section>
    <section>
      <h2>3. Tarayıcı Yerel Depolaması (LocalStorage)</h2>
      <p>Skorlarınızı ve tercihlerinizi sunucuya göndermeden hatırlayabilmek için yalnızca cihazınızın tarayıcısındaki yerel depolama (<code>localStorage</code>) mekanizması kullanılır:</p>
      <ul>
        <li><code>sely_mini_scores_v1</code>: Her bir mini oyundaki kişisel rekor skorlarınız.</li>
        <li><code>sely-cookie-consent</code>: Çerez bilgilendirme tercihiniz (kabul/red).</li>
        <li><code>sely-locale</code>: Tercih ettiğiniz arayüz dili (Türkçe veya İngilizce).</li>
        <li><code>theme</code>: Görsel tema tercihiniz (açık veya koyu tema).</li>
      </ul>
      <p>Bu veriler <strong>yalnızca sizin cihazınızda saklanır</strong>, sunucularımıza iletilmez veya üçüncü kişilerle paylaşılmaz. İstediğiniz zaman tarayıcı geçmişinizi ve yerel depolama verilerinizi temizleyerek bu bilgileri silebilirsiniz.</p>
    </section>
    <section>
      <h2>4. Çerezler ve Takipçiler</h2>
      <p>SELY.TR’de üçüncü taraf reklam çerezleri, davranışsal profil çıkarma araçları, Google Analytics veya Facebook/Meta pikseli gibi pazarlama izleyicileri <strong>kesinlikle kullanılmaz</strong>. Ziyaretçilerimizin internet alışkanlıkları takip edilmez.</p>
    </section>
    <section>
      <h2>5. Sunucu Güvenlik Kayıtları ve Hukuki Sebepler</h2>
      <p>Siteye bağlandığınızda, web sunucusu ve ters vekil altyapısı (Caddy, Cloudflare) tarafından kötü niyetli saldırıları (DDoS, brute-force vb.) engellemek ve sistem güvenliğini sağlamak amacıyla teknik erişim kayıtları (IP adresi, istek zamanı, kullanıcı istemci bilgisi) geçici olarak işlenir. Bu veriler KVKK m. 5/2-f (veri sorumlusunun meşru menfaati) hukuki sebebiyle işlenmekte olup, kullanıcı profili oluşturmak amacıyla kullanılmaz ve kalıcı veritabanlarına kaydedilmez.</p>
    </section>
    <section>
      <h2>6. İlgili Kişi Hakları (KVKK Madde 11)</h2>
      <p>KVKK’nın 11. maddesi uyarınca herkes; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, verilerin işlenme amacına uygun kullanılıp kullanılmadığını öğrenme ve silinmesini talep etme haklarına sahiptir. Sitede kalıcı kişisel veri tutulmadığı için pratikte sorgulanabilecek bir kullanıcı kaydı bulunmamakla birlikte, yasal haklarınıza dair her türlü sorunuz için <Contact /> adresine başvurabilirsiniz.</p>
    </section>
    <section>
      <h2>7. Yasal Dayanak ve Güncellik</h2>
      <p>Bu metin, Kişisel Verileri Koruma Kurumu’nun Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliği dikkate alınarak hazırlanmıştır.</p>
      <a className="source-link" href="https://www.kvkk.gov.tr/Icerik/5395/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi-Kurum-Internet-Sayfasinda-Yayinlanmistir-" target="_blank" rel="noreferrer">
        KVKK Resmi Aydınlatma Rehberi <ExternalLink size={14} />
      </a>
    </section>
  </div>;
}

function TermsContent() {
  return <div className="legal-copy">
    <section>
      <h2>1. Kapsam ve Kabul</h2>
      <p>Bu kullanım koşulları, SELY.TR MiniGame Hub platformu ve sunulan tüm oyun içerikleri için geçerlidir. Siteye erişerek ve oyunları oynayarak bu koşulları kabul etmiş sayılırsınız.</p>
    </section>
    <section>
      <h2>2. Açık Kaynak Lisansı (GNU AGPLv3)</h2>
      <p>SELY MiniGame Hub'ın kaynak kodları <strong>GNU Affero General Public License v3.0 (AGPLv3)</strong> kapsamında açık kaynaktır. Kodları inceleyebilir, değiştirebilir, yerelinizde veya sunucunuzda çalıştırabilirsiniz. AGPLv3 gereğince, yazılımı bir ağ üzerinden hizmet olarak sunduğunuzda yaptığınız tüm değişikliklerin kaynak kodunu da aynı lisansla toplulukla paylaşmanız gerekmektedir.</p>
    </section>
    <section>
      <h2>3. Barındırılan Hizmetin Kabul Edilebilir Kullanımı</h2>
      <p>Kaynak kodlarının açık kaynak olması, canlı olarak sunulan <code>sely.tr</code> sunucu altyapısının kötüye kullanılabileceği anlamına gelmez. Ziyaretçiler sunucuya yönelik hizmet aksatma (DoS/DDoS) girişimlerinde bulunamaz, günlük bölüm üretim API'lerini orantısız veya zararlı otomatik döngülerle suistimal edemez.</p>
    </section>
    <section>
      <h2>4. Sorumluluk Reddi (Garanti Yoktur)</h2>
      <p>SELY.TR üzerindeki oyunlar ve servisler "olduğu gibi" (as-is) sunulur. Kesintisiz, hatasız veya her donanımla kusursuz çalışacağı yönünde açık veya zımni bir garanti verilmez. İnternet bağlantısı, sunucu bakımı veya tarayıcı uyumsuzluklarından kaynaklanan aksaklıklardan site sorumlu tutulamaz.</p>
    </section>
    <section>
      <h2>5. İletişim</h2>
      <p>Kullanım koşulları veya hizmetle ilgili teknik bildirimleriniz için <Contact /> üzerinden iletişim kurabilirsiniz.</p>
    </section>
  </div>;
}
