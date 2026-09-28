"""Büyüme teşhisi: reklam + CRM/lead + GA4 sayfa dökümlerini birleştirip aksiyon listesi çıkarır.

Kullanım:  python analiz.py [veri_klasoru] [cikti.js]
Girdi CSV'leri (sütun adları uret_ornek_veri.py'de): reklam_harcama.csv, leadler.csv, sayfalar.csv
Çıktı: sayfanın okuduğu veri.js (window.VERI = {...}) ve ekrana kısa özet.
Gerçek müşteride aynı sütunlara eşleyen küçük bir dönüştürücü yazılır (GA4/Ads/Meta/CRM dışa aktarımları).
"""
import csv
import json
import statistics
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
KOK = Path(__file__).parent
VERI = Path(sys.argv[1]) if len(sys.argv) > 1 else KOK / "ornek-veri"
CIKTI = Path(sys.argv[2]) if len(sys.argv) > 2 else KOK.parent / "veri.js"

KOVALAR = [(5, "0-5 dk"), (30, "5-30 dk"), (120, "30 dk-2 sa"), (1440, "2-24 sa"), (10**9, "24 sa+")]


def oku(ad):
    with open(VERI / ad, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def y(x):
    return "%" + f"{x*100:.1f}".replace(".", ",")


def oran(a, b):
    return round(a / b, 4) if b else 0.0


reklam = oku("reklam_harcama.csv")
leadler = oku("leadler.csv")
sayfalar = oku("sayfalar.csv")
for l in leadler:
    for k in ("ilk_donus_dk", "ulasildi", "gorusme", "satis", "tutar_tl"):
        l[k] = int(l[k])

# --- 1) kanal verimliliği ---------------------------------------------------------------
harcama = defaultdict(int)
for r in reklam:
    harcama[r["kanal"]] += int(r["harcama_tl"])
kanal = defaultdict(lambda: {"lead": 0, "satis": 0, "ciro": 0})
for l in leadler:
    k = kanal[l["kanal"]]
    k["lead"] += 1
    k["satis"] += l["satis"]
    k["ciro"] += l["tutar_tl"]
kanallar = []
for ad, k in kanal.items():
    h = harcama.get(ad, 0)
    kanallar.append({
        "kanal": ad, "harcama": h, "lead": k["lead"], "satis": k["satis"], "ciro": k["ciro"],
        "lead_satis": oran(k["satis"], k["lead"]),
        "cpl": round(h / k["lead"]) if h else None,
        "cac": round(h / k["satis"]) if h and k["satis"] else None,
        "roas": round(k["ciro"] / h, 2) if h else None,
    })
kanallar.sort(key=lambda x: -x["ciro"])

# --- 2) huni --------------------------------------------------------------------------
n = len(leadler)
huni = [
    {"asama": "Lead (form / WhatsApp)", "adet": n},
    {"asama": "Ulaşıldı", "adet": sum(l["ulasildi"] for l in leadler)},
    {"asama": "Görüşme yapıldı", "adet": sum(l["gorusme"] for l in leadler)},
    {"asama": "Satış", "adet": sum(l["satis"] for l in leadler)},
]
for i, a in enumerate(huni):
    a["onceki_oran"] = oran(a["adet"], huni[i - 1]["adet"]) if i else 1.0
    a["kayip"] = huni[i - 1]["adet"] - a["adet"] if i else 0

# --- 3) ilk dönüş süresi ----------------------------------------------------------------
kova = defaultdict(lambda: [0, 0])
for l in leadler:
    etiket = next(e for sinir, e in KOVALAR if l["ilk_donus_dk"] <= sinir)
    kova[etiket][0] += 1
    kova[etiket][1] += l["satis"]
donus = [{"kova": e, "lead": kova[e][0], "satis_orani": oran(kova[e][1], kova[e][0])} for _, e in KOVALAR]
hs = [l["ilk_donus_dk"] for l in leadler if date.fromisoformat(l["tarih"]).weekday() >= 5]
hi = [l["ilk_donus_dk"] for l in leadler if date.fromisoformat(l["tarih"]).weekday() < 5]
medyan_hafta_sonu = statistics.median(hs)
medyan_hafta_ici = statistics.median(hi)

# --- 4) temsilci / temas kanalı -----------------------------------------------------------
tem = defaultdict(list)
for l in leadler:
    tem[l["temsilci"]].append(l)
temsilciler = []
for ad, ls in sorted(tem.items()):
    temsilciler.append({
        "temsilci": ad, "temas": ls[0]["temas_kanali"], "lead": len(ls),
        "medyan_donus_dk": statistics.median(x["ilk_donus_dk"] for x in ls),
        "ulasma": oran(sum(x["ulasildi"] for x in ls), len(ls)),
        "satis_orani": oran(sum(x["satis"] for x in ls), len(ls)),
        "ciro": sum(x["tutar_tl"] for x in ls),
    })
temas = {}
for t in ("WhatsApp", "Çağrı merkezi"):
    ls = [l for l in leadler if l["temas_kanali"] == t]
    temas[t] = {"lead": len(ls), "satis_orani": oran(sum(x["satis"] for x in ls), len(ls))}

# --- 5) sayfalar ------------------------------------------------------------------------
sl = defaultdict(lambda: [0, 0])
for l in leadler:
    sl[l["sayfa"]][0] += 1
    sl[l["sayfa"]][1] += l["satis"]
sayfa_tablo = []
for s in sayfalar:
    ot = int(s["oturum"])
    lead, sat = sl[s["sayfa"]]
    sayfa_tablo.append({
        "sayfa": s["sayfa"], "oturum": ot, "cikis": float(s["cikis_orani"]), "sure": int(s["ort_sure_sn"]),
        "lead": lead, "lead_orani": oran(lead, ot), "satis_orani": oran(sat, lead),
    })
sayfa_tablo.sort(key=lambda x: -x["oturum"])

# --- 6) ana göstergeler ve aksiyonlar --------------------------------------------------
top_h = sum(harcama.values())
top_ciro = sum(l["tutar_tl"] for l in leadler)
top_sat = huni[-1]["adet"]
reklam_kanal = [k for k in kanallar if k["harcama"]]
en_iyi = max(reklam_kanal, key=lambda k: k["roas"])
en_kotu = min(reklam_kanal, key=lambda k: k["roas"])
hizli = donus[0]["satis_orani"]
genel = oran(top_sat, n)
gec_lead = sum(d["lead"] for d in donus[2:])
gec_oran = sum(d["lead"] * d["satis_orani"] for d in donus[2:]) / gec_lead
ort_sepet = top_ciro / top_sat
# gecikmeli leadlerin yarısı 30 dk içine çekilirse (5-30 dk kovasının oranıyla) ek satış tahmini
ek_satis_donus = round(gec_lead / 2 * (donus[1]["satis_orani"] - gec_oran))
# en kötü kanaldan %30 bütçe en iyiye; azalan verim için en iyi kanalın ROAS'ı 0,7 ile iskontolu
kaydir = round(en_kotu["harcama"] * 0.3)
ek_ciro_butce = round(kaydir * (en_iyi["roas"] * 0.7 - en_kotu["roas"]))
fiyat = next(s for s in sayfa_tablo if s["sayfa"] == "/fiyatlar")
deneme = next(s for s in sayfa_tablo if s["sayfa"] == "/ucretsiz-deneme-dersi")
en_iyi_t = max(temsilciler, key=lambda t: t["satis_orani"])
en_kotu_t = min(temsilciler, key=lambda t: t["satis_orani"])

aksiyonlar = [
    {"baslik": "İlk dönüşü 5 dakikanın altına çekin",
     "neden": f"0-5 dk içinde dönülen leadlerde satış oranı {y(hizli)}, 30 dk'yı geçenlerde {y(gec_oran)}. "
              f"Hafta sonu medyan dönüş {medyan_hafta_sonu:.0f} dk (hafta içi {medyan_hafta_ici:.0f} dk).",
     "ne": "WhatsApp'a otomatik karşılama + randevu linki, hafta sonu nöbet, 15 dk'yı geçen lead için yöneticiye uyarı.",
     "etki": f"Geciken leadlerin yarısı 30 dk içine çekilirse 3 ayda ~{ek_satis_donus} ek satış (~{ek_satis_donus*ort_sepet/1000:.0f} bin TL).",
     "sure": "1 hafta", "puan": 1},
    {"baslik": f"Bütçenin bir kısmını {en_kotu['kanal']} → {en_iyi['kanal']} kaydırın",
     "neden": f"ROAS {en_kotu['kanal']}'da {str(en_kotu['roas']).replace('.', '|')}, {en_iyi['kanal']}'da {str(en_iyi['roas']).replace('.', '|')}. "
              f"Satış başı maliyet {en_kotu['cac']:,} TL'ye karşı {en_iyi['cac']:,} TL.".replace(",", ".").replace("|", ","),
     "ne": f"3 ayda {kaydir:,} TL'yi kademeli kaydırın; kampanya bazında haftalık kontrol.".replace(",", "."),
     "etki": f"Azalan verim payı düşülerek ~{ek_ciro_butce/1000:.0f} bin TL ek ciro (tahmin).",
     "sure": "2-4 hafta", "puan": 2},
    {"baslik": "Deneme dersini ana dönüşüm kapısı yapın",
     "neden": f"/ucretsiz-deneme-dersi oturumların {y(deneme['lead_orani'])}'ini lead'e çeviriyor, /fiyatlar yalnız "
              f"{y(fiyat['lead_orani'])}'ini; /fiyatlar sayfasında çıkış %{fiyat['cikis']*100:.0f}.",
     "ne": "Reklamların ve /fiyatlar sayfasının ana düğmesini 'Ücretsiz deneme dersi al' yapın; fiyat sayfasına veli yorumları ve taksit tablosu.",
     "etki": "Aynı trafikle daha fazla ve daha nitelikli lead.", "sure": "1 hafta", "puan": 3},
    {"baslik": "Satış konuşmasını en iyi temsilcinin akışına göre standartlaştırın",
     "neden": f"{en_iyi_t['temsilci']} satış oranı {y(en_iyi_t['satis_orani'])}, "
              f"{en_kotu_t['temsilci']} {y(en_kotu_t['satis_orani'])} (aynı lead havuzu).",
     "ne": "Başarılı görüşmelerden 1 sayfalık konuşma akışı + itiraz cevapları; haftalık 3 görüşme dinleme.",
     "etki": "Temsilciler arası farkın yarısı kapanırsa satışlarda belirgin artış.", "sure": "2 hafta", "puan": 4},
    {"baslik": "Blog trafiğini lead'e bağlayın",
     "neden": "Blog en çok trafik alan bölüm ama lead oranı en düşük.",
     "ne": "Her yazıya konuya özel ücretsiz kaynak (deneme sınavı PDF'i) karşılığında WhatsApp kaydı.",
     "etki": "Reklamsız yeni lead kaynağı.", "sure": "2-3 hafta", "puan": 5},
]

veri = {
    "not": "ÖRNEK VERİ: hayali bir online eğitim şirketi; gerçek müşteri verisi değildir.",
    "donem": "Temmuz-Eylül 2026",
    "ozet": {"harcama": top_h, "lead": n, "satis": top_sat, "ciro": top_ciro,
             "roas": round(top_ciro / top_h, 2), "lead_satis": genel, "ort_sepet": round(ort_sepet)},
    "kanallar": kanallar, "huni": huni, "donus": donus,
    "medyan_donus": {"hafta_ici": medyan_hafta_ici, "hafta_sonu": medyan_hafta_sonu},
    "temsilciler": temsilciler, "temas": temas, "sayfalar": sayfa_tablo, "aksiyonlar": aksiyonlar,
}
CIKTI.write_text("window.VERI = " + json.dumps(veri, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

print(f"lead {n}, satış {top_sat}, ciro {top_ciro:,} TL, harcama {top_h:,} TL, ROAS {top_ciro/top_h:.2f}")
for k in kanallar:
    print(f"  {k['kanal']:<22} lead {k['lead']:>4} satış {k['satis']:>3} lead>satış %{k['lead_satis']*100:4.1f} "
          f"CAC {k['cac']} ROAS {k['roas']}")
for d in donus:
    print(f"  dönüş {d['kova']:<11} lead {d['lead']:>4}  satış {y(d['satis_orani'])}")
for a in aksiyonlar:
    print(" *", a["baslik"], "|", a["etki"])
print("yazıldı:", CIKTI)
