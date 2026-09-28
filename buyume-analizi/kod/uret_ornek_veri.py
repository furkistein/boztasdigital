"""Hayali bir online eğitim şirketi için ÖRNEK veri üretir (gerçek müşteri verisi değildir).

Çıktılar (ornek-veri/):
  reklam_harcama.csv  : ay, kanal, harcama_tl, gosterim, tiklama        (Google Ads / Meta / TikTok dışa aktarımı gibi)
  leadler.csv         : lead_id, tarih, kanal, sayfa, ilk_donus_dk, temsilci, temas_kanali,
                        ulasildi, gorusme, satis, tutar_tl              (CRM / form / çağrı merkezi dökümü gibi)
  sayfalar.csv        : sayfa, oturum, cikis_orani, ort_sure_sn, form_acilis (GA4 sayfa raporu gibi)
"""
import csv
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(42)
KLASOR = Path(__file__).parent / "ornek-veri"
KLASOR.mkdir(exist_ok=True)

AYLAR = ["2026-07", "2026-08", "2026-09"]
# kanal: (aylık harcama, lead/ay, satışa dönüşüm çarpanı, ort. sepet)
KANALLAR = {
    "Google Ads (Arama)": (62000, 310, 1.45, 5400),
    "Meta Ads": (88000, 720, 0.55, 4600),
    "TikTok Ads": (31000, 290, 0.45, 3900),
    "Organik / SEO": (0, 260, 1.25, 5200),
    "Instagram (organik)": (0, 140, 0.9, 4800),
    "Tavsiye": (0, 70, 2.1, 5600),
}
SAYFALAR = {  # sayfa: (lead payı ağırlığı, oturum/ay, çıkış, süre, form açılış)
    "/yks-kocluk": (0.34, 21000, 0.46, 96, 0.061),
    "/lgs-paket": (0.22, 16500, 0.52, 81, 0.049),
    "/ucretsiz-deneme-dersi": (0.24, 9800, 0.38, 64, 0.112),
    "/fiyatlar": (0.12, 12400, 0.71, 38, 0.019),
    "/blog/*": (0.08, 41000, 0.83, 52, 0.004),
}
TEMSILCILER = {  # ad: (temas kanalı, ort. dönüş dk, kapanış çarpanı)
    "Temsilci A": ("WhatsApp", 6, 1.30),
    "Temsilci B": ("WhatsApp", 35, 0.95),
    "Temsilci C": ("WhatsApp", 140, 0.70),
    "Temsilci D": ("Çağrı merkezi", 12, 1.15),
    "Temsilci E": ("Çağrı merkezi", 55, 0.85),
    "Temsilci F": ("Çağrı merkezi", 240, 0.60),
}


def donus_carpani(dk: float) -> float:
    """İlk dönüş hızı satış olasılığını belirgin biçimde etkiler (sektörde bilinen etki)."""
    if dk <= 5:
        return 1.6
    if dk <= 30:
        return 1.15
    if dk <= 120:
        return 0.8
    if dk <= 1440:
        return 0.5
    return 0.3


with open(KLASOR / "reklam_harcama.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ay", "kanal", "harcama_tl", "gosterim", "tiklama"])
    for ay in AYLAR:
        for kanal, (harcama, *_rest) in KANALLAR.items():
            if harcama:
                h = round(harcama * random.uniform(0.9, 1.1))
                gos = int(h * random.uniform(9, 16))
                w.writerow([ay, kanal, h, gos, int(gos * random.uniform(0.011, 0.024))])

sayfa_adlari = list(SAYFALAR)
sayfa_agirlik = [v[0] for v in SAYFALAR.values()]
temsilci_adlari = list(TEMSILCILER)

with open(KLASOR / "leadler.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["lead_id", "tarih", "kanal", "sayfa", "ilk_donus_dk", "temsilci", "temas_kanali",
                "ulasildi", "gorusme", "satis", "tutar_tl"])
    no = 1
    for i, ay in enumerate(AYLAR):
        bas = date(2026, 7 + i, 1)
        for kanal, (_h, lead_ay, carpan, sepet) in KANALLAR.items():
            for _ in range(int(lead_ay * random.uniform(0.9, 1.1))):
                t = bas + timedelta(days=random.randint(0, 29))
                sayfa = random.choices(sayfa_adlari, sayfa_agirlik)[0]
                temsilci = random.choice(temsilci_adlari)
                temas, ort_dk, kapanis = TEMSILCILER[temsilci]
                # akşam/hafta sonu gelen leadlere dönüş daha geç
                gec = 3.5 if t.weekday() >= 5 else 1.0
                dk = max(1, round(random.expovariate(1 / (ort_dk * gec))))
                ulas = random.random() < min(0.95, 0.72 * donus_carpani(dk) ** 0.5)
                gor = ulas and random.random() < 0.55 * min(1.4, carpan ** 0.5)
                p = 0.30 * carpan * kapanis * donus_carpani(dk) ** 0.6
                if sayfa == "/ucretsiz-deneme-dersi":
                    p *= 1.35
                sat = gor and random.random() < min(0.85, p)
                tutar = round(sepet * random.uniform(0.7, 1.3), -1) if sat else 0
                w.writerow([f"L{no:05d}", t.isoformat(), kanal, sayfa, dk, temsilci, temas,
                            int(ulas), int(gor), int(sat), int(tutar)])
                no += 1

with open(KLASOR / "sayfalar.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sayfa", "oturum", "cikis_orani", "ort_sure_sn", "form_acilis"])
    for s, (_a, oturum, cikis, sure, form) in SAYFALAR.items():
        w.writerow([s, oturum * 3, cikis, sure, round(oturum * 3 * form)])

print("örnek veri yazıldı:", KLASOR)
