<?php
declare(strict_types=1);

// Tüm sınıfları yükler (Composer gerekmez).
require_once __DIR__ . '/yardimci.php';
require_once __DIR__ . '/Fiyatlama.php';
require_once __DIR__ . '/Doviz.php';
require_once __DIR__ . '/Bildirim.php';
require_once __DIR__ . '/Senkron.php';
require_once dirname(__DIR__) . '/tedarikci/Tedarikci.php';
require_once dirname(__DIR__) . '/tedarikci/JsonApiTedarikci.php';
require_once dirname(__DIR__) . '/tedarikci/XmlFeedTedarikci.php';
require_once dirname(__DIR__) . '/tedarikci/CsvTedarikci.php';
