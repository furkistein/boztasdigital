<?php
declare(strict_types=1);

/**
 * XML feed adaptörü.
 *
 * Ek ayarlar:
 *   urun_etiketi : her ürünü temsil eden eleman adı, ör. 'Urun' ya da 'item'
 *   alanlar      : alt eleman adı ('Barkod'), öznitelik ('@kod') ya da iç içe yol ('Resimler/Resim')
 *
 * Büyük feed'ler için XMLReader ile akış halinde okunur (bellek şişmez).
 */
final class XmlFeedTedarikci extends TemelTedarikci
{
    protected function ham_kayitlar(): iterable
    {
        $govde = $this->oku((string) $this->ayar['adres']);
        $etiket = (string) ($this->ayar['urun_etiketi'] ?? 'Urun');

        $okuyucu = new XMLReader();
        if (!$okuyucu->XML($govde, null, LIBXML_NONET | LIBXML_NOCDATA)) {
            throw new RuntimeException('XML açılamadı');
        }
        $onceki = libxml_use_internal_errors(true);
        $bulunan = 0;
        try {
            while ($okuyucu->read()) {
                if ($okuyucu->nodeType === XMLReader::ELEMENT && $okuyucu->localName === $etiket) {
                    $xml = $okuyucu->readOuterXml();
                    $dugum = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NOCDATA | LIBXML_NONET);
                    if ($dugum !== false) {
                        $bulunan++;
                        yield $dugum;
                    }
                }
            }
            $hatalar = libxml_get_errors();
            libxml_clear_errors();
            if ($bulunan === 0 && $hatalar) {
                throw new RuntimeException('XML hatalı: ' . trim($hatalar[0]->message));
            }
        } finally {
            $okuyucu->close();
            libxml_use_internal_errors($onceki);
        }
    }

    protected function alan(mixed $kayit, string $anahtar): mixed
    {
        $yol = $this->ayar['alanlar'][$anahtar] ?? null;
        if (!$yol || !$kayit instanceof SimpleXMLElement) {
            return null;
        }
        $dugum = $kayit;
        foreach (explode('/', (string) $yol) as $parca) {
            if (str_starts_with($parca, '@')) {
                $oz = $dugum->attributes()[substr($parca, 1)] ?? null;
                return $oz === null ? null : trim((string) $oz);
            }
            if (!isset($dugum->{$parca})) {
                return null;
            }
            $dugum = $dugum->{$parca}[0];
        }
        return trim((string) $dugum);
    }
}
