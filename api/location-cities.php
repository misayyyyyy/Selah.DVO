<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/location-data.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$countryCode = strtoupper(trim((string) ($_GET['country'] ?? '')));
if (!preg_match('/^[A-Z]{2}$/', $countryCode) || !isset(location_country_names()[$countryCode])) {
    json_response(['ok' => false, 'message' => 'Choose a valid country.'], 422);
}

$cities = location_city_names($countryCode);
if ($cities === null) {
    json_response(['ok' => false, 'message' => 'City suggestions are unavailable right now.'], 503);
}

json_response(['ok' => true, 'countryCode' => $countryCode, 'cities' => $cities]);
