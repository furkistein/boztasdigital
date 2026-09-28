<?php
declare(strict_types=1);

/**
 * CSV / Excel'den kaydedilmiş liste adaptörü (URL ya da FTP'ye bırakılan dosya).
 *
 * Ek ayarlar:
 *   ayirici  : ';' (Türkçe Excel varsayılanı) ya da ','
 *   kodlama  : 'UTF-8' (varsayılan) ya da 'Windows-1254' gibi; UTF-8'e çevrilir
 *   alanlar  : başlık satırındaki sütun adları (büyük/küçük harf duyarsız)
 */
final class CsvTedarikci extends TemelTedarikci
{
    protected function ham_kayitlar(): iterable
    {
        $govde = $this->oku((string) $this->ayar['adres']);
        $kodlama = strtoupper((string) ($this->ayar['kodlama'] ?? 'UTF-8'));
        if ($kodlama !== 'UTF-8') {
            $cevrilen = @iconv($kodlama, 'UTF-8//IGNORE', $govde);
            if ($cevrilen === false) {
                throw new RuntimeException("Karakter kodlaması çevrilemedi: {$kodlama}");
            }
            $govde = $cevrilen;
        }
        $govde = preg_replace('/^\xEF\xBB\xBF/', '', $govde); // BOM

        $akis = fopen('php://temp', 'r+');
        fwrite($akis, $govde);
        rewind($akis);
        $ayirici = (string) ($this->ayar['ayirici'] ?? ';');

        $baslik = fgetcsv($akis, 0, $ayirici, '"', '');
        if (!$baslik || count($baslik) < 2) {
            fclose($akis);
            throw new RuntimeException('CSV başlık satırı okunamadı (ayırıcı doğru mu?)');
        }
        $baslik = array_map(fn($b) => mb_strtoupper(trim((string) $b), 'UTF-8'), $baslik);
        while (($satir = fgetcsv($akis, 0, $ayirici, '"', '')) !== false) {
            if ($satir === [null] || count(array_filter($satir, fn($h) => trim((string) $h) !== '')) === 0) {
                continue; // boş satır
            }
            $kayit = [];
            foreach ($baslik as $i => $ad) {
                $kayit[$ad] = $satir[$i] ?? null;
            }
            yield $kayit;
        }
        fclose($akis);
    }

    protected function alan(mixed $kayit, string $anahtar): mixed
    {
        $sutun = $this->ayar['alanlar'][$anahtar] ?? null;
        if (!$sutun) {
            return null;
        }
        return $kayit[mb_strtoupper((string) $sutun, 'UTF-8')] ?? null;
    }
}
