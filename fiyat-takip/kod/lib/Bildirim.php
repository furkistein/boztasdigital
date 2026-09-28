<?php
declare(strict_types=1);

/**
 * E-posta ve Telegram bildirimi. İkisi de ayarlar.php'den açılır; varsayılan kapalı.
 * Bir çalışmadaki tüm uyarılar tek mesajda toplanır (bildirim yağmuru olmaz).
 */
final class Bildirim
{
    private array $satirlar = [];

    public function __construct(private array $ayar)
    {
    }

    public function ekle(string $satir): void
    {
        $this->satirlar[] = $satir;
    }

    public function bos_mu(): bool
    {
        return !$this->satirlar;
    }

    /** @return list<string> gönderim sonuçları */
    public function gonder(string $konu): array
    {
        if (!$this->satirlar) {
            return [];
        }
        $metin = $konu . "\n\n" . implode("\n", $this->satirlar);
        $sonuc = [];

        $ep = $this->ayar['eposta'] ?? [];
        if (!empty($ep['acik']) && !empty($ep['kime'])) {
            $basliklar = 'Content-Type: text/plain; charset=UTF-8';
            if (!empty($ep['kimden'])) {
                $basliklar .= "\r\nFrom: " . $ep['kimden'];
            }
            $ok = @mail((string) $ep['kime'], '=?UTF-8?B?' . base64_encode($konu) . '?=', $metin, $basliklar);
            $sonuc[] = 'e-posta: ' . ($ok ? 'gönderildi' : 'gönderilemedi');
        }

        $tg = $this->ayar['telegram'] ?? [];
        if (!empty($tg['acik']) && !empty($tg['bot_anahtari']) && !empty($tg['sohbet_id'])) {
            $url = 'https://api.telegram.org/bot' . $tg['bot_anahtari'] . '/sendMessage';
            $veri = http_build_query(['chat_id' => $tg['sohbet_id'], 'text' => mb_substr($metin, 0, 4000)]);
            $baglam = stream_context_create(['http' => [
                'method' => 'POST', 'timeout' => 15,
                'header' => 'Content-Type: application/x-www-form-urlencoded',
                'content' => $veri,
            ]]);
            $ok = @file_get_contents($url, false, $baglam) !== false;
            $sonuc[] = 'telegram: ' . ($ok ? 'gönderildi' : 'gönderilemedi');
        }
        return $sonuc;
    }
}
