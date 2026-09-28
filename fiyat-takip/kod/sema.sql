-- Fiyat / stok takip sistemi — MySQL / MariaDB şeması
-- Sitenin kendi ürün tablosuna DOKUNMAZ; yalnızca ft_ önekli yardımcı tablolar oluşturur.
-- Kurulum: phpMyAdmin > sitenin veritabanı > İçe Aktar > bu dosya.

SET NAMES utf8mb4;

-- Her cron çalışmasının kaydı
CREATE TABLE IF NOT EXISTS ft_calisma (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  baslangic   DATETIME     NOT NULL,
  bitis       DATETIME     NULL,
  durum       VARCHAR(20)  NOT NULL,            -- calisiyor | tamam | kismi (bazı tedarikçiler hatalı) | hata
  hata        TEXT         NULL,
  ozet        TEXT         NULL,                -- JSON: işlenen, değişen, pasife alınan...
  PRIMARY KEY (id),
  KEY ix_baslangic (baslangic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tedarikçinin son başarılı listesi (hata olursa yedek veri + görsel değişim tespiti)
CREATE TABLE IF NOT EXISTS ft_tedarikci_urun (
  tedarikci    VARCHAR(40)   NOT NULL,
  sku          VARCHAR(100)  NOT NULL,
  barkod       VARCHAR(32)   NULL,
  ad           VARCHAR(255)  NULL,
  alis_fiyati  DECIMAL(14,4) NOT NULL,
  para_birimi  CHAR(3)       NOT NULL DEFAULT 'TRY',
  stok         INT           NOT NULL DEFAULT 0,
  gorsel_url   VARCHAR(500)  NULL,
  kategori     VARCHAR(150)  NULL,
  guncellendi  DATETIME      NOT NULL,
  PRIMARY KEY (tedarikci, sku),
  KEY ix_barkod (barkod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tedarikçi başına son durum (panel kartları)
CREATE TABLE IF NOT EXISTS ft_tedarikci_durum (
  tedarikci    VARCHAR(40)  NOT NULL,
  son_deneme   DATETIME     NULL,
  son_basari   DATETIME     NULL,
  urun_sayisi  INT          NOT NULL DEFAULT 0,
  durum        VARCHAR(20)  NOT NULL DEFAULT 'ok',   -- ok | onbellek (hata, yedek veri) | belirsiz (hata, veri eski)
  hata         TEXT         NULL,
  uyari        TEXT         NULL,
  sure_ms      INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (tedarikci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Elle eşleme (barkod/SKU tutmayan ürünler için): tedarikçinin kodu -> sitedeki ürün anahtarı
CREATE TABLE IF NOT EXISTS ft_eslesme (
  tedarikci     VARCHAR(40)  NOT NULL,
  tedarikci_sku VARCHAR(100) NOT NULL,
  urun_anahtar  VARCHAR(100) NOT NULL,
  PRIMARY KEY (tedarikci, tedarikci_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ürün başına sistem durumu: seçili tedarikçi, bu sistemin pasife aldığı ürünler
CREATE TABLE IF NOT EXISTS ft_urun_durum (
  urun_anahtar     VARCHAR(100)  NOT NULL,
  secili_tedarikci VARCHAR(40)   NULL,
  alis_tl          DECIMAL(14,4) NULL,
  bizce_pasif      TINYINT(1)    NOT NULL DEFAULT 0,  -- 1: stok bitti diye BU SİSTEM kapattı (stok gelince açar)
  guncellendi      DATETIME      NOT NULL,
  PRIMARY KEY (urun_anahtar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Değişiklik günlüğü (eski/yeni fiyat, % değişim)
CREATE TABLE IF NOT EXISTS ft_degisiklik (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calisma_id   INT UNSIGNED  NOT NULL,
  tarih        DATETIME      NOT NULL,
  urun_anahtar VARCHAR(100)  NOT NULL,
  urun_adi     VARCHAR(255)  NULL,
  tedarikci    VARCHAR(40)   NULL,
  alan         VARCHAR(20)   NOT NULL,   -- fiyat | stok | durum | gorsel | tedarikci
  tur          VARCHAR(20)   NOT NULL,   -- zam | indirim | onay | stok | stok_bitti | stok_geldi | pasif | aktif | gorsel | tedarikci
  eski_deger   VARCHAR(500)  NULL,
  yeni_deger   VARCHAR(500)  NULL,
  yuzde        DECIMAL(8,2)  NULL,
  aciklama     VARCHAR(500)  NULL,
  PRIMARY KEY (id),
  KEY ix_urun (urun_anahtar, tarih),
  KEY ix_calisma (calisma_id),
  KEY ix_tarih (tarih)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Büyük zam / indirim onay kuyruğu
CREATE TABLE IF NOT EXISTS ft_onay (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  urun_anahtar VARCHAR(100)  NOT NULL,
  urun_adi     VARCHAR(255)  NULL,
  tedarikci    VARCHAR(40)   NULL,
  eski_fiyat   DECIMAL(14,2) NOT NULL,
  yeni_fiyat   DECIMAL(14,2) NOT NULL,
  yuzde        DECIMAL(8,2)  NOT NULL,
  alis_tl      DECIMAL(14,2) NULL,
  durum        VARCHAR(20)   NOT NULL DEFAULT 'bekliyor',  -- bekliyor | onaylandi | reddedildi | iptal
  olusturma    DATETIME      NOT NULL,
  karar_tarihi DATETIME      NULL,
  karar_notu   VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  KEY ix_durum (durum, urun_anahtar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Eski günlükleri temizlemek için (isteğe bağlı, ayda bir):
-- DELETE FROM ft_degisiklik WHERE tarih < NOW() - INTERVAL 180 DAY;
