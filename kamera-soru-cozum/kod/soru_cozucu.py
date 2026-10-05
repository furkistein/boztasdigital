#!/usr/bin/env python3
"""Kamera -> Gemini soru cozucu.

Bir kamera kaynagini (RTSP/HTTP IP kamera ya da webcam) okur, belirli
araliklarla (ya da tusla) kareyi Gemini'ye gonderir, donen kisa cevabi
karenin ustune yazar ve cevaplar.log dosyasina kaydeder.

Anahtar koda gomulmez: GEMINI_API_KEY ortam degiskeninden okunur.

Kullanim:
    python soru_cozucu.py 0                                  # webcam
    python soru_cozucu.py rtsp://kullanici:sifre@192.168.1.20/stream1 --aralik 8
    python soru_cozucu.py http://192.168.1.21:8080/video --elle
"""
from __future__ import annotations

import argparse
import base64
import logging
import os
import sys
import textwrap
import time
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Callable, Optional

import cv2
import numpy as np
import requests

VARSAYILAN_MODEL = "gemini-2.0-flash"
API_ADRESI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
ISTEM = (
    "Bu gorselde bir soru var (test, matematik, bilgi sorusu vb.). "
    "Soruyu coz ve KISA cevap ver: once cevabi (ornegin 'C' ya da '42'), "
    "sonra en fazla bir cumlelik gerekce. Turkce yaz. "
    "Gorselde okunabilir bir soru yoksa yalnizca 'SORU YOK' yaz."
)

log = logging.getLogger("soru_cozucu")


class GeminiHatasi(Exception):
    """Gemini cagrisi basarisiz oldu (ag, kota, bos cevap vb.)."""


# --------------------------------------------------------------------------
# Kare yardimcilari
# --------------------------------------------------------------------------
def kare_parmak_izi(kare: np.ndarray) -> int:
    """Kareyi 9x8 gri boyuta indirip 64 bitlik fark (dHash) parmak izi uretir."""
    gri = cv2.cvtColor(kare, cv2.COLOR_BGR2GRAY) if kare.ndim == 3 else kare
    kucuk = cv2.resize(gri, (9, 8), interpolation=cv2.INTER_AREA)
    fark = kucuk[:, 1:] > kucuk[:, :-1]
    deger = 0
    for bit in fark.flatten():
        deger = (deger << 1) | int(bit)
    return deger


def bit_farki(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


class TekrarFiltresi:
    """Son sorulan kareye benzeyen kareleri (Hamming mesafesi <= esik) eler."""

    def __init__(self, esik: int = 5):
        self.esik = esik
        self.son: Optional[int] = None

    def yeni_mi(self, kare: np.ndarray) -> bool:
        if self.son is None:
            return True
        return bit_farki(kare_parmak_izi(kare), self.son) > self.esik

    def kaydet(self, kare: np.ndarray) -> None:
        self.son = kare_parmak_izi(kare)


def jpeg_baytlari(kare: np.ndarray, kalite: int = 85, en_fazla_kenar: int = 1600) -> bytes:
    yuk, gen = kare.shape[:2]
    olcek = en_fazla_kenar / max(yuk, gen)
    if olcek < 1:
        kare = cv2.resize(kare, (int(gen * olcek), int(yuk * olcek)), interpolation=cv2.INTER_AREA)
    ok, tampon = cv2.imencode(".jpg", kare, [cv2.IMWRITE_JPEG_QUALITY, kalite])
    if not ok:
        raise ValueError("kare JPEG'e cevrilemedi")
    return tampon.tobytes()


# --------------------------------------------------------------------------
# Gemini
# --------------------------------------------------------------------------
def gemini_sor(
    jpeg: bytes,
    api_anahtari: str,
    model: str = VARSAYILAN_MODEL,
    istem: str = ISTEM,
    zaman_asimi: float = 30.0,
    deneme: int = 3,
    oturum: Optional[requests.Session] = None,
    bekle: Callable[[float], None] = time.sleep,
) -> str:
    """Kareyi Gemini REST API'sine gonderir, cevap metnini dondurur.

    429 ve 5xx yanitlarinda ustel bekleyerek `deneme` kez dener.
    Basarisizlikta GeminiHatasi firlatir.
    """
    if not api_anahtari:
        raise GeminiHatasi("GEMINI_API_KEY tanimli degil")
    govde = {
        "contents": [{
            "parts": [
                {"text": istem},
                {"inline_data": {"mime_type": "image/jpeg",
                                 "data": base64.b64encode(jpeg).decode("ascii")}},
            ]
        }],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 400},
    }
    istemci = oturum or requests
    adres = API_ADRESI.format(model=model)
    basliklar = {"x-goog-api-key": api_anahtari, "Content-Type": "application/json"}
    son_hata = "bilinmeyen hata"
    for sira in range(deneme):
        try:
            yanit = istemci.post(adres, json=govde, headers=basliklar, timeout=zaman_asimi)
        except requests.RequestException as e:
            son_hata = f"ag hatasi: {e.__class__.__name__}"
        else:
            if yanit.status_code == 200:
                return _cevap_metni(yanit.json())
            son_hata = f"HTTP {yanit.status_code}"
            if yanit.status_code not in (429, 500, 502, 503, 504):
                raise GeminiHatasi(son_hata)  # 400/401/403: tekrar denemenin anlami yok
        if sira < deneme - 1:
            bekle(2 ** sira)
    raise GeminiHatasi(son_hata)


def _cevap_metni(veri: dict) -> str:
    try:
        parcalar = veri["candidates"][0]["content"]["parts"]
        metin = "".join(p.get("text", "") for p in parcalar).strip()
    except (KeyError, IndexError, TypeError):
        sebep = (veri.get("promptFeedback") or {}).get("blockReason", "bos yanit")
        raise GeminiHatasi(f"cevap alinamadi ({sebep})")
    if not metin:
        raise GeminiHatasi("cevap alinamadi (bos metin)")
    return metin


# --------------------------------------------------------------------------
# Bindirme
# --------------------------------------------------------------------------
_TR = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def ascii_yap(metin: str) -> str:
    """OpenCV'nin Hershey yazi tipi Turkce harfleri cizemez; bindirmede sadelestirilir."""
    return metin.translate(_TR)


def cevap_satirlari(metin: str, genislik_px: int, harf_px: int = 11, en_fazla_satir: int = 6) -> list[str]:
    """Cevabi kare genisligine sigacak satirlara boler; cok uzunsa keser."""
    sutun = max(12, genislik_px // harf_px)
    satirlar: list[str] = []
    for parca in ascii_yap(metin).splitlines() or [""]:
        satirlar.extend(textwrap.wrap(parca, sutun) or [""])
    if len(satirlar) > en_fazla_satir:
        satirlar = satirlar[:en_fazla_satir]
        satirlar[-1] = satirlar[-1][: max(0, sutun - 3)].rstrip() + "..."
    return satirlar


def cevap_bindir(kare: np.ndarray, metin: str, baslik: str = "Gemini") -> np.ndarray:
    """Kareyi bozmadan, altina yari saydam bir serit ve cevap yazar; yeni kare dondurur."""
    cikti = kare.copy()
    yuk, gen = cikti.shape[:2]
    olcek = max(0.5, min(1.0, gen / 960))
    satir_yuk = int(26 * olcek) + 6
    satirlar = [baslik + ":"] + cevap_satirlari(metin, gen - 24, harf_px=max(7, int(13 * olcek)))
    serit_yuk = satir_yuk * len(satirlar) + 14
    ust = max(0, yuk - serit_yuk)
    katman = cikti.copy()
    cv2.rectangle(katman, (0, ust), (gen, yuk), (24, 20, 16), -1)
    cikti = cv2.addWeighted(katman, 0.78, cikti, 0.22, 0)
    for i, satir in enumerate(satirlar):
        renk = (120, 214, 88) if i == 0 else (240, 240, 240)
        y = ust + 2 + satir_yuk * (i + 1)
        cv2.putText(cikti, satir, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.62 * olcek, renk, 1, cv2.LINE_AA)
    return cikti


# --------------------------------------------------------------------------
# Kamera (yeniden baglanan)
# --------------------------------------------------------------------------
def kaynak_coz(deger: str):
    """'0' gibi sayilar webcam indeksidir, digerleri URL/dosya yolu olarak kalir."""
    return int(deger) if deger.strip().isdigit() else deger


class KameraOkuyucu:
    """cv2.VideoCapture'i sarar; kare okunamazsa ustel beklemeyle yeniden baglanir."""

    def __init__(
        self,
        kaynak,
        yapici: Callable = cv2.VideoCapture,
        bekle: Callable[[float], None] = time.sleep,
        en_fazla_bekleme: float = 15.0,
        en_fazla_deneme: Optional[int] = None,
    ):
        self.kaynak = kaynak
        self._yapici = yapici
        self._bekle = bekle
        self.en_fazla_bekleme = en_fazla_bekleme
        self.en_fazla_deneme = en_fazla_deneme  # None = sonsuza dek dene
        self._cap = None
        self.yeniden_baglanma = 0

    def _ac(self) -> bool:
        self.kapat()
        try:
            cap = self._yapici(self.kaynak)
        except Exception as e:  # noqa: BLE001 - surucu hatalari cesitli olabilir
            log.warning("kamera acilamadi: %s", e)
            return False
        if cap is not None and cap.isOpened():
            self._cap = cap
            return True
        if cap is not None:
            cap.release()
        return False

    def kapat(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            finally:
                self._cap = None

    def oku(self) -> np.ndarray:
        """Bir kare dondurur. Kopma halinde baglanana kadar bekler; deneme siniri
        asilirsa ConnectionError firlatir."""
        bekleme = 1.0
        deneme = 0
        while True:
            if self._cap is not None:
                try:
                    ok, kare = self._cap.read()
                except Exception as e:  # noqa: BLE001
                    log.warning("kare okuma hatasi: %s", e)
                    ok, kare = False, None
                if ok and kare is not None:
                    return kare
                log.warning("kamera akisi koptu, yeniden baglaniliyor")
                self.kapat()
            deneme += 1
            if self.en_fazla_deneme is not None and deneme > self.en_fazla_deneme:
                raise ConnectionError("kameraya baglanilamadi")
            if self._ac():
                self.yeniden_baglanma += 1
                log.info("kameraya baglandi")
                continue
            self._bekle(bekleme)
            bekleme = min(bekleme * 2, self.en_fazla_bekleme)


# --------------------------------------------------------------------------
# Ana dongu
# --------------------------------------------------------------------------
@dataclass
class Durum:
    cevap: str = ""
    bekleyen: Optional[Future] = None
    son_istek: float = float("-inf")
    sayac: int = 0


def cevap_logla(metin: str, dosya: str) -> None:
    zaman = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(dosya, "a", encoding="utf-8") as f:
        f.write(f"[{zaman}] {metin.replace(chr(10), ' ')}\n")


def adim(durum: Durum, kare: np.ndarray, *, simdi: float, aralik: float, zorla: bool,
         filtre: TekrarFiltresi, havuz, sor: Callable[[bytes], str], log_dosyasi: str) -> None:
    """Dongunun bir adimi: biten istegi isler, gerekirse yeni istek baslatir."""
    if durum.bekleyen is not None and durum.bekleyen.done():
        try:
            metin = durum.bekleyen.result()
        except GeminiHatasi as e:
            log.error("Gemini hatasi: %s", e)
            durum.cevap = f"Hata: {e}"
        except Exception as e:  # noqa: BLE001
            log.exception("beklenmeyen hata")
            durum.cevap = f"Hata: {e}"
        else:
            durum.cevap = metin
            cevap_logla(metin, log_dosyasi)
            log.info("cevap: %s", metin.replace("\n", " "))
        durum.bekleyen = None

    if durum.bekleyen is not None:
        return  # onceki istek suruyor
    if not zorla and (aralik == float("inf") or simdi - durum.son_istek < aralik):
        return  # elle modda yalniz tusla sorulur
    if not zorla and not filtre.yeni_mi(kare):
        durum.son_istek = simdi  # ayni kare: yeniden sorma
        return
    filtre.kaydet(kare)
    durum.son_istek = simdi
    durum.sayac += 1
    durum.bekleyen = havuz.submit(sor, jpeg_baytlari(kare))


def argumanlar(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="IP kameranin gordugu soruyu Gemini ile cozer.")
    p.add_argument("kaynak", help="webcam indeksi (0) ya da RTSP/HTTP kamera adresi")
    p.add_argument("--aralik", type=float, default=10.0, help="otomatik soru araligi, saniye (varsayilan 10)")
    p.add_argument("--elle", action="store_true", help="otomatik sorma; yalniz bosluk tusuna basinca sor")
    p.add_argument("--model", default=VARSAYILAN_MODEL)
    p.add_argument("--log", default="cevaplar.log", help="cevap gunlugu dosyasi")
    p.add_argument("--esik", type=int, default=5, help="ayni kare sayilma esigi (0-64, kucuk = daha hassas)")
    p.add_argument("--pencere-yok", action="store_true", help="ekran acma (sunucuda calistirmak icin)")
    p.add_argument("--en-fazla-deneme", type=int, default=None, help="yeniden baglanma siniri (varsayilan: sinirsiz)")
    return p.parse_args(argv)


def calistir(args: argparse.Namespace) -> int:
    anahtar = os.environ.get("GEMINI_API_KEY", "")
    if not anahtar:
        print("GEMINI_API_KEY ortam degiskeni tanimli degil.", file=sys.stderr)
        return 2
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    oturum = requests.Session()

    def sor(jpeg: bytes) -> str:
        return gemini_sor(jpeg, anahtar, model=args.model, oturum=oturum)

    kamera = KameraOkuyucu(kaynak_coz(args.kaynak), en_fazla_deneme=args.en_fazla_deneme)
    filtre = TekrarFiltresi(args.esik)
    durum = Durum()
    gui = not args.pencere_yok
    aralik = float("inf") if args.elle else args.aralik
    try:
        with ThreadPoolExecutor(max_workers=1) as havuz:
            while True:
                kare = kamera.oku()
                zorla = False
                if gui:
                    ekran = cevap_bindir(kare, durum.cevap) if durum.cevap else kare
                    cv2.imshow("Soru Cozucu  [bosluk: simdi sor | q: cik]", ekran)
                    tus = cv2.waitKey(1) & 0xFF
                    if tus in (ord("q"), 27):
                        break
                    zorla = tus == 32
                else:
                    time.sleep(0.03)
                adim(durum, kare, simdi=time.monotonic(), aralik=aralik, zorla=zorla,
                     filtre=filtre, havuz=havuz, sor=sor, log_dosyasi=args.log)
    except KeyboardInterrupt:
        pass
    except ConnectionError as e:
        log.error("%s", e)
        return 1
    finally:
        kamera.kapat()
        if gui:
            cv2.destroyAllWindows()
    return 0


def main(argv=None) -> int:
    return calistir(argumanlar(argv))


if __name__ == "__main__":
    sys.exit(main())
