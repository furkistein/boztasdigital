"""soru_cozucu.py testleri: Gemini ve kamera tamamen sahte, ag/kamera gerekmez.

Calistirma:  python -m pytest test_soru_cozucu.py -q
"""
from concurrent.futures import Future

import cv2
import numpy as np
import pytest
import requests

import soru_cozucu as sc


# ---------------------------------------------------------------- yardimcilar
def desen_kare(tohum: int, boyut=(240, 320)) -> np.ndarray:
    """Her tohum icin belirgin sekilde farkli, tekrarlanabilir bir kare."""
    rng = np.random.default_rng(tohum)
    kucuk = rng.integers(0, 255, (6, 8, 3), dtype=np.uint8)
    return cv2.resize(kucuk, (boyut[1], boyut[0]), interpolation=cv2.INTER_NEAREST)


class SahteYanit:
    def __init__(self, kod=200, veri=None):
        self.status_code = kod
        self._veri = veri if veri is not None else {}

    def json(self):
        return self._veri


def gemini_yaniti(metin):
    return {"candidates": [{"content": {"parts": [{"text": metin}]}}]}


class SahteOturum:
    def __init__(self, *yanitlar):
        self.yanitlar = list(yanitlar)
        self.cagrilar = []

    def post(self, adres, json=None, headers=None, timeout=None):
        self.cagrilar.append((adres, json, headers))
        y = self.yanitlar.pop(0)
        if isinstance(y, Exception):
            raise y
        return y


class SahteCap:
    """Verilen kare dizisini sirayla verir; bitince okuma basarisiz olur (kopma)."""

    def __init__(self, kareler, acik=True):
        self.kareler = list(kareler)
        self.acik = acik
        self.serbest = False

    def isOpened(self):
        return self.acik

    def read(self):
        if self.kareler:
            return True, self.kareler.pop(0)
        return False, None

    def release(self):
        self.serbest = True


# ---------------------------------------------------------------- yineleme filtresi
def test_ayni_kare_tekrar_sorulmaz():
    f = sc.TekrarFiltresi(esik=5)
    kare = desen_kare(1)
    assert f.yeni_mi(kare)  # ilk kare her zaman yeni
    f.kaydet(kare)
    assert not f.yeni_mi(kare.copy())


def test_hafif_gurultu_ayni_sayilir_farkli_kare_yeni_sayilir():
    f = sc.TekrarFiltresi(esik=5)
    kare = desen_kare(1)
    f.kaydet(kare)
    gurultulu = np.clip(kare.astype(int) + np.random.default_rng(0).integers(-3, 4, kare.shape), 0, 255).astype(np.uint8)
    assert not f.yeni_mi(gurultulu)
    assert f.yeni_mi(desen_kare(2))


def test_adim_ayni_kareyi_ikinci_kez_gondermez():
    gonderilen = []
    havuz = AnindaHavuz()
    f = sc.TekrarFiltresi()
    d = sc.Durum()
    kare = desen_kare(3)
    sor = lambda jpeg: gonderilen.append(jpeg) or "C"
    for t in (100.0, 111.0, 122.0):  # aralik 10 sn, kare hic degismiyor
        sc.adim(d, kare, simdi=t, aralik=10, zorla=False, filtre=f, havuz=havuz, sor=sor, log_dosyasi=ORTAK_LOG[0])
    assert len(gonderilen) == 1
    sc.adim(d, desen_kare(4), simdi=133.0, aralik=10, zorla=False, filtre=f, havuz=havuz, sor=sor, log_dosyasi=ORTAK_LOG[0])
    assert len(gonderilen) == 2


def test_elle_modda_tus_olmadan_sorulmaz_tusla_ayni_kare_de_sorulur():
    gonderilen = []
    havuz = AnindaHavuz()
    f = sc.TekrarFiltresi()
    d = sc.Durum()
    kare = desen_kare(5)
    sor = lambda jpeg: gonderilen.append(1) or "B"
    inf = float("inf")
    sc.adim(d, kare, simdi=1.0, aralik=inf, zorla=False, filtre=f, havuz=havuz, sor=sor, log_dosyasi=ORTAK_LOG[0])
    assert gonderilen == []
    sc.adim(d, kare, simdi=2.0, aralik=inf, zorla=True, filtre=f, havuz=havuz, sor=sor, log_dosyasi=ORTAK_LOG[0])
    sc.adim(d, kare, simdi=3.0, aralik=inf, zorla=True, filtre=f, havuz=havuz, sor=sor, log_dosyasi=ORTAK_LOG[0])
    assert len(gonderilen) == 2


class AnindaHavuz:
    """ThreadPoolExecutor yerine isi hemen yapan sahte havuz (testi deterministik yapar)."""

    def submit(self, fn, *a):
        f = Future()
        try:
            f.set_result(fn(*a))
        except Exception as e:  # noqa: BLE001
            f.set_exception(e)
        return f


ORTAK_LOG = [None]


@pytest.fixture(autouse=True)
def _log_dosyasi(tmp_path):
    ORTAK_LOG[0] = str(tmp_path / "cevaplar.log")
    yield


def test_cevap_log_dosyasina_yazilir_ve_ekrandaki_cevap_guncellenir(tmp_path):
    d = sc.Durum()
    sc.adim(d, desen_kare(6), simdi=50.0, aralik=10, zorla=False, filtre=sc.TekrarFiltresi(),
            havuz=AnindaHavuz(), sor=lambda j: "Cevap: 42\nGerekce: 6x7", log_dosyasi=ORTAK_LOG[0])
    # sonuc bir sonraki adimda islenir
    sc.adim(d, desen_kare(6), simdi=51.0, aralik=10, zorla=False, filtre=sc.TekrarFiltresi(),
            havuz=AnindaHavuz(), sor=lambda j: "x", log_dosyasi=ORTAK_LOG[0])
    assert d.cevap == "Cevap: 42\nGerekce: 6x7"
    icerik = open(ORTAK_LOG[0], encoding="utf-8").read()
    assert "Cevap: 42 Gerekce: 6x7" in icerik and icerik.startswith("[")


def test_gemini_hatasi_programi_dusurmez_hata_metni_gosterilir():
    def sor(_):
        raise sc.GeminiHatasi("HTTP 429")

    d = sc.Durum()
    f = sc.TekrarFiltresi()
    sc.adim(d, desen_kare(7), simdi=50.0, aralik=10, zorla=False, filtre=f, havuz=AnindaHavuz(), sor=sor, log_dosyasi=ORTAK_LOG[0])
    sc.adim(d, desen_kare(7), simdi=51.0, aralik=10, zorla=False, filtre=f, havuz=AnindaHavuz(), sor=sor, log_dosyasi=ORTAK_LOG[0])
    assert d.cevap == "Hata: HTTP 429"


# ---------------------------------------------------------------- yeniden baglanma
def test_baglanti_kopunca_yeniden_baglanir():
    kare_a, kare_b = desen_kare(1), desen_kare(2)
    caplar = [SahteCap([kare_a]), SahteCap([kare_b])]  # ilki 1 kare verip kopar
    acilan = []

    def yapici(kaynak):
        acilan.append(kaynak)
        return caplar[len(acilan) - 1]

    beklemeler = []
    k = sc.KameraOkuyucu("rtsp://ornek/akis", yapici=yapici, bekle=beklemeler.append)
    assert np.array_equal(k.oku(), kare_a)
    assert np.array_equal(k.oku(), kare_b)  # kopma sonrasi ikinci baglantidan
    assert acilan == ["rtsp://ornek/akis", "rtsp://ornek/akis"]
    assert caplar[0].serbest  # eski baglanti birakildi
    assert k.yeniden_baglanma == 2


def test_acilamayan_kamera_ustel_beklemeyle_tekrar_denenir():
    kare = desen_kare(1)
    sayac = {"n": 0}

    def yapici(_):
        sayac["n"] += 1
        return SahteCap([kare], acik=sayac["n"] >= 4)  # ilk 3 acilis basarisiz

    beklemeler = []
    k = sc.KameraOkuyucu(0, yapici=yapici, bekle=beklemeler.append, en_fazla_bekleme=3.0)
    assert np.array_equal(k.oku(), kare)
    assert beklemeler == [1.0, 2.0, 3.0]  # 1, 2, sonra 3 sn'de sabit


def test_deneme_siniri_asilirsa_hata_verir():
    k = sc.KameraOkuyucu(0, yapici=lambda _: SahteCap([], acik=False), bekle=lambda s: None, en_fazla_deneme=2)
    with pytest.raises(ConnectionError):
        k.oku()


def test_yapici_istisna_firlatirsa_da_denemeye_devam_eder():
    kare = desen_kare(1)
    sayac = {"n": 0}

    def yapici(_):
        sayac["n"] += 1
        if sayac["n"] == 1:
            raise RuntimeError("surucu hatasi")
        return SahteCap([kare])

    k = sc.KameraOkuyucu(0, yapici=yapici, bekle=lambda s: None)
    assert np.array_equal(k.oku(), kare)


def test_kaynak_coz():
    assert sc.kaynak_coz("0") == 0
    assert sc.kaynak_coz("rtsp://a/b") == "rtsp://a/b"


# ---------------------------------------------------------------- bindirme
def test_bindirme_orijinali_bozmaz_ve_alt_seridi_degistirir():
    kare = desen_kare(8, boyut=(480, 640))
    asil = kare.copy()
    cikti = sc.cevap_bindir(kare, "Cevap: C - cunku 2+2=4")
    assert cikti.shape == kare.shape
    assert np.array_equal(kare, asil)  # girdi degismedi
    assert np.array_equal(cikti[:100], kare[:100])  # ust kisim ayni
    assert not np.array_equal(cikti[-80:], kare[-80:])  # serit cizildi


def test_turkce_karakterler_bindirmede_sadelestirilir():
    assert sc.ascii_yap("Çözüm: Şık İ, ığ") == "Cozum: Sik I, ig"


def test_uzun_cevap_satirlara_bolunur_ve_kesilir():
    satirlar = sc.cevap_satirlari("kelime " * 200, genislik_px=400, harf_px=10, en_fazla_satir=4)
    assert len(satirlar) == 4
    assert satirlar[-1].endswith("...")
    assert all(len(s) <= 40 for s in satirlar)


def test_cok_uzun_cevapta_bile_serit_kare_disina_tasmaz():
    kare = desen_kare(9, boyut=(120, 160))
    cikti = sc.cevap_bindir(kare, "uzun " * 300)
    assert cikti.shape == kare.shape


# ---------------------------------------------------------------- gemini_sor (mock)
def test_gemini_basarili_cevap_ve_istek_bicimi():
    oturum = SahteOturum(SahteYanit(200, gemini_yaniti("  C - cunku  ")))
    cevap = sc.gemini_sor(b"\xff\xd8jpeg", "ANAHTAR", model="m-1", oturum=oturum)
    assert cevap == "C - cunku"
    adres, govde, basliklar = oturum.cagrilar[0]
    assert adres.endswith("/models/m-1:generateContent")
    assert basliklar["x-goog-api-key"] == "ANAHTAR"
    parcalar = govde["contents"][0]["parts"]
    assert parcalar[1]["inline_data"]["mime_type"] == "image/jpeg"
    assert "ANAHTAR" not in adres  # anahtar URL'de gorunmez


def test_gemini_429da_tekrar_dener_sonra_basarir():
    oturum = SahteOturum(SahteYanit(429), SahteYanit(503), SahteYanit(200, gemini_yaniti("42")))
    beklemeler = []
    assert sc.gemini_sor(b"x", "k", oturum=oturum, bekle=beklemeler.append) == "42"
    assert beklemeler == [1, 2]


def test_gemini_yetki_hatasinda_tekrar_denemez():
    oturum = SahteOturum(SahteYanit(403))
    with pytest.raises(sc.GeminiHatasi, match="403"):
        sc.gemini_sor(b"x", "k", oturum=oturum, bekle=lambda s: None)
    assert len(oturum.cagrilar) == 1


def test_gemini_ag_hatasi_sonunda_gemini_hatasina_donusur():
    oturum = SahteOturum(*[requests.ConnectionError("x")] * 3)
    with pytest.raises(sc.GeminiHatasi, match="ag hatasi"):
        sc.gemini_sor(b"x", "k", oturum=oturum, bekle=lambda s: None)


def test_gemini_bos_ya_da_engellenmis_cevap_hata_verir():
    oturum = SahteOturum(SahteYanit(200, {"promptFeedback": {"blockReason": "SAFETY"}}))
    with pytest.raises(sc.GeminiHatasi, match="SAFETY"):
        sc.gemini_sor(b"x", "k", oturum=oturum)


def test_anahtar_yoksa_hata():
    with pytest.raises(sc.GeminiHatasi):
        sc.gemini_sor(b"x", "")


def test_anahtar_ortam_degiskeni_yoksa_program_cikis_kodu_2(monkeypatch, capsys):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert sc.main(["0", "--pencere-yok"]) == 2
    assert "GEMINI_API_KEY" in capsys.readouterr().err
