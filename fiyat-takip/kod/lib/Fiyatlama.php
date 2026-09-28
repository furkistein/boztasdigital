<?php
declare(strict_types=1);

/**
 * Kâr kuralı ve yuvarlama.
 *
 *   net   = alış_TL × (1 + yüzde/100) + sabit
 *   net   = max(net, alış_TL × (1 + min_marj/100))        ← minimum marj koruması
 *   satış = yuvarla(net × (1 + kdv/100))                    ← yukarı yuvarlanır, marj asla düşmez
 *
 * Kural önceliği: tedarikçi+kategori > kategori > tedarikçi > varsayılan.
 * Yuvarlama kademeleri: [['alt'=>0,'adim'=>1,'son'=>0.90], ['alt'=>100,'adim'=>10,'son'=>9.90]]
 *   -> 87,20 TL => 87,90 ; 1.243,17 TL => 1.249,90
 */
final class Fiyatlama
{
    public function __construct(private array $kar)
    {
    }

    /** @return array{yuzde: float, sabit: float, kaynak: string} */
    public function kural(string $tedarikci, string $kategori): array
    {
        $adaylar = [
            ['tedarikci_kategori', $this->kar['tedarikci_kategori'][$tedarikci][$kategori] ?? null, "{$tedarikci}/{$kategori}"],
            ['kategori', $this->kar['kategori'][$kategori] ?? null, $kategori],
            ['tedarikci', $this->kar['tedarikci'][$tedarikci] ?? null, $tedarikci],
        ];
        foreach ($adaylar as [$tur, $k, $etiket]) {
            if (is_array($k)) {
                return ['yuzde' => (float) ($k['yuzde'] ?? 0), 'sabit' => (float) ($k['sabit'] ?? 0), 'kaynak' => "{$tur}:{$etiket}"];
            }
        }
        $v = $this->kar['varsayilan'] ?? ['yuzde' => 30, 'sabit' => 0];
        return ['yuzde' => (float) $v['yuzde'], 'sabit' => (float) ($v['sabit'] ?? 0), 'kaynak' => 'varsayilan'];
    }

    /** @return array{fiyat: float, kural: string, marj_korundu: bool} */
    public function satis_fiyati(float $alisTl, string $tedarikci, string $kategori): array
    {
        $k = $this->kural($tedarikci, $kategori);
        $net = $alisTl * (1 + $k['yuzde'] / 100) + $k['sabit'];
        $alt = $alisTl * (1 + (float) ($this->kar['min_marj'] ?? 0) / 100);
        $korundu = false;
        if ($net < $alt) {
            $net = $alt;
            $korundu = true;
        }
        $brut = $net * (1 + (float) ($this->kar['kdv'] ?? 0) / 100);
        return ['fiyat' => $this->yuvarla($brut), 'kural' => $k['kaynak'], 'marj_korundu' => $korundu];
    }

    public function yuvarla(float $fiyat): float
    {
        $kademeler = $this->kar['yuvarlama'] ?? [];
        if (!$kademeler) {
            return round($fiyat, 2);
        }
        usort($kademeler, fn($a, $b) => ($a['alt'] ?? 0) <=> ($b['alt'] ?? 0));
        $secili = null;
        foreach ($kademeler as $kd) {
            if ($fiyat >= (float) ($kd['alt'] ?? 0)) {
                $secili = $kd;
            }
        }
        $secili ??= $kademeler[0];
        $adim = (float) ($secili['adim'] ?? 1);
        $son = (float) ($secili['son'] ?? 0);
        if ($adim <= 0) {
            return round($fiyat, 2);
        }
        // Kuruş hatalarına karşı küçük tolerans: 1249.9000001 -> 1249.90 kalsın.
        $n = ceil(round(($fiyat - $son) / $adim, 6));
        return round(max($n * $adim + $son, $son > 0 ? $son : $adim), 2);
    }
}
