<?php
declare(strict_types=1);

/**
 * JSON API adaptörü.
 *
 * Ek ayarlar:
 *   liste_yolu   : ürün dizisinin yolu, ör. 'data.items' ya da 'products' (boş = kök dizi)
 *   sayfa_boyutu : sayfalı API'lerde; adres içinde {sayfa} geçmeli. Dönen kayıt sayısı
 *                  sayfa_boyutu'ndan azsa son sayfa sayılır.
 *   en_cok_sayfa : güvenlik sınırı (varsayılan 500)
 */
final class JsonApiTedarikci extends TemelTedarikci
{
    protected function ham_kayitlar(): iterable
    {
        $adres = (string) $this->ayar['adres'];
        $sayfali = str_contains($adres, '{sayfa}');
        $boyut = (int) ($this->ayar['sayfa_boyutu'] ?? 0);
        $sinir = (int) ($this->ayar['en_cok_sayfa'] ?? 500);

        for ($sayfa = 1; $sayfa <= ($sayfali ? $sinir : 1); $sayfa++) {
            $govde = $this->oku(str_replace('{sayfa}', (string) $sayfa, $adres));
            $veri = json_decode($govde, true);
            if (!is_array($veri)) {
                throw new RuntimeException('JSON çözülemedi (sayfa ' . $sayfa . '): ' . json_last_error_msg());
            }
            $liste = ft_yol($veri, (string) ($this->ayar['liste_yolu'] ?? ''));
            if (!is_array($liste)) {
                throw new RuntimeException("Beklenen ürün listesi bulunamadı: '" . ($this->ayar['liste_yolu'] ?? '') . "'");
            }
            yield from array_values($liste);
            if (!$sayfali || count($liste) === 0 || ($boyut > 0 && count($liste) < $boyut)) {
                break;
            }
        }
    }
}
