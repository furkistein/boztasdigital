<?php
declare(strict_types=1);

/**
 * Büyük zam / indirim onay kuyruğu.
 *
 * Komut satırı:
 *   php onay.php liste
 *   php onay.php onayla 12        (fiyatı siteye yazar)
 *   php onay.php reddet 12        (aynı fiyat bir daha sorulmaz)
 *   php onay.php onayla hepsi
 *
 * Tarayıcı: https://siteniz/.../onay.php?anahtar=AYARLARDAKI_ONAY_ANAHTARI
 */

require __DIR__ . '/lib/yukle.php';

$ayar = require (getenv('FT_AYAR') ?: __DIR__ . '/ayarlar.php');
date_default_timezone_set($ayar['saat_dilimi'] ?? 'Europe/Istanbul');

$db = new PDO($ayar['db']['dsn'], $ayar['db']['kullanici'] ?? null, $ayar['db']['sifre'] ?? null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

/** Onay kaydını uygular ya da reddeder. */
function ft_karar(PDO $db, array $ayar, int $id, bool $onayla): string
{
    $st = $db->prepare("SELECT * FROM ft_onay WHERE id = ? AND durum = 'bekliyor'");
    $st->execute([$id]);
    $o = $st->fetch();
    if (!$o) {
        return "#{$id} bulunamadı ya da zaten karar verilmiş.";
    }
    $db->beginTransaction();
    try {
        if ($onayla) {
            $tablo = ft_ad((string) $ayar['site']['tablo']);
            $fiyat = ft_ad((string) $ayar['site']['alanlar']['fiyat']);
            $anahtar = ft_ad((string) $ayar['site']['alanlar']['anahtar']);
            $db->prepare("UPDATE {$tablo} SET {$fiyat} = ? WHERE {$anahtar} = ?")->execute([$o['yeni_fiyat'], $o['urun_anahtar']]);
            $db->prepare('INSERT INTO ft_degisiklik (calisma_id, tarih, urun_anahtar, urun_adi, tedarikci, alan, tur, eski_deger, yeni_deger, yuzde, aciklama) VALUES (0,?,?,?,?,?,?,?,?,?,?)')
                ->execute([ft_simdi(), $o['urun_anahtar'], $o['urun_adi'], $o['tedarikci'], 'fiyat', (float) $o['yuzde'] > 0 ? 'zam' : 'indirim',
                    $o['eski_fiyat'], $o['yeni_fiyat'], $o['yuzde'], "Onay #{$id} ile uygulandı"]);
        }
        $db->prepare('UPDATE ft_onay SET durum = ?, karar_tarihi = ? WHERE id = ?')->execute([$onayla ? 'onaylandi' : 'reddedildi', ft_simdi(), $id]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    return "#{$id} {$o['urun_anahtar']}: " . ($onayla ? "onaylandı, yeni fiyat {$o['yeni_fiyat']} TL yazıldı." : 'reddedildi, fiyat değişmedi.');
}

function ft_bekleyenler(PDO $db): array
{
    return $db->query("SELECT * FROM ft_onay WHERE durum = 'bekliyor' ORDER BY yuzde DESC")->fetchAll();
}

// ------------------------------------------------------------------ CLI
if (PHP_SAPI === 'cli') {
    $komut = $argv[1] ?? 'liste';
    $hedef = $argv[2] ?? '';
    if ($komut === 'liste') {
        $l = ft_bekleyenler($db);
        if (!$l) {
            echo "Onay bekleyen değişiklik yok.\n";
        }
        foreach ($l as $o) {
            printf("#%-4d %-12s %-40s %10s -> %10s TL  %+6.1f%%  (%s)\n", $o['id'], $o['urun_anahtar'], mb_substr((string) $o['urun_adi'], 0, 40), $o['eski_fiyat'], $o['yeni_fiyat'], $o['yuzde'], $o['tedarikci']);
        }
        exit(0);
    }
    if (!in_array($komut, ['onayla', 'reddet'], true) || $hedef === '') {
        fwrite(STDERR, "Kullanım: php onay.php liste | onayla <id|hepsi> | reddet <id|hepsi>\n");
        exit(1);
    }
    $idler = $hedef === 'hepsi' ? array_column(ft_bekleyenler($db), 'id') : [(int) $hedef];
    foreach ($idler as $id) {
        echo ft_karar($db, $ayar, (int) $id, $komut === 'onayla'), "\n";
    }
    exit(0);
}

// ------------------------------------------------------------------ web
$gizli = (string) ($ayar['onay_anahtari'] ?? '');
$verilen = (string) ($_GET['anahtar'] ?? $_POST['anahtar'] ?? '');
if (strlen($gizli) < 16 || str_contains($gizli, 'BURAYA') || !hash_equals($gizli, $verilen)) {
    http_response_code(403);
    exit('Yetkisiz.');
}
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
$mesaj = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['id'], $_POST['karar'])) {
    $mesaj = ft_karar($db, $ayar, (int) $_POST['id'], $_POST['karar'] === 'onayla');
}
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Onay bekleyen fiyatlar</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f5f6f8;color:#1b1f24}
main{max-width:900px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px}
.zam{color:#b42318;font-weight:600}.ind{color:#067647;font-weight:600}
button{padding:6px 12px;border-radius:6px;border:1px solid #d0d5dd;background:#fff;cursor:pointer}
button.ok{background:#1b1f24;color:#fff;border-color:#1b1f24}
.mesaj{background:#ecfdf3;border:1px solid #abefc6;padding:10px;border-radius:8px;margin-bottom:12px}
</style></head><body><main>
<h1>Onay bekleyen fiyat değişiklikleri</h1>
<?php if ($mesaj): ?><div class="mesaj"><?= $e($mesaj) ?></div><?php endif; ?>
<?php $l = ft_bekleyenler($db); if (!$l): ?><p>Bekleyen değişiklik yok.</p><?php else: ?>
<table><tr><th>Ürün</th><th>Tedarikçi</th><th>Şu an</th><th>Önerilen</th><th>Değişim</th><th></th></tr>
<?php foreach ($l as $o): ?>
<tr><td><?= $e($o['urun_adi']) ?><br><small><?= $e($o['urun_anahtar']) ?></small></td><td><?= $e($o['tedarikci']) ?></td>
<td><?= $e(number_format((float) $o['eski_fiyat'], 2, ',', '.')) ?></td><td><?= $e(number_format((float) $o['yeni_fiyat'], 2, ',', '.')) ?></td>
<td class="<?= (float) $o['yuzde'] > 0 ? 'zam' : 'ind' ?>"><?= $e(sprintf('%+.1f%%', $o['yuzde'])) ?></td>
<td><form method="post" style="display:flex;gap:6px"><input type="hidden" name="anahtar" value="<?= $e($verilen) ?>"><input type="hidden" name="id" value="<?= (int) $o['id'] ?>">
<button class="ok" name="karar" value="onayla">Onayla</button><button name="karar" value="reddet">Reddet</button></form></td></tr>
<?php endforeach; ?></table><?php endif; ?>
</main></body></html>
