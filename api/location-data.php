<?php
declare(strict_types=1);

function location_country_names(): array
{
    static $countries = null;
    if ($countries !== null) return $countries;

    $rows = json_decode((string) @file_get_contents(__DIR__ . '/../assets/countries.json'), true);
    $countries = [];
    foreach (is_array($rows) ? $rows : [] as $row) {
        $code = strtoupper(trim((string) ($row['Iso2'] ?? '')));
        $name = trim((string) ($row['name'] ?? ''));
        if (preg_match('/^[A-Z]{2}$/', $code) && $name !== '') $countries[$code] = $name;
    }
    return $countries;
}

function location_city_names(string $countryCode): ?array
{
    static $memoryCache = [];
    $countryCode = strtoupper(trim($countryCode));
    if (isset($memoryCache[$countryCode])) return $memoryCache[$countryCode];

    $countryName = location_country_names()[$countryCode] ?? null;
    if ($countryName === null) return null;

    $cachePath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'selah-city-list-' . strtolower($countryCode) . '.json';
    if (is_file($cachePath) && filemtime($cachePath) >= time() - 604800) {
        $cached = json_decode((string) @file_get_contents($cachePath), true);
        if (is_array($cached)) return $memoryCache[$countryCode] = array_values(array_filter($cached, 'is_string'));
    }

    $requestBody = json_encode(['country' => $countryName]);
    if (!is_string($requestBody)) return null;
    $url = 'https://countriesnow.space/api/v0.1/countries/cities';
    $body = false;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $requestBody,
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 9,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $curlBody = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if (is_string($curlBody) && $status >= 200 && $status < 300) $body = $curlBody;
    }

    if (!is_string($body)) {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Accept: application/json\r\nContent-Type: application/json\r\n",
                'content' => $requestBody,
                'timeout' => 9,
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $streamBody = @file_get_contents($url, false, $context);
        if (is_string($streamBody)) $body = $streamBody;
    }

    if (!is_string($body)) return null;
    $result = json_decode($body, true);
    if (!is_array($result) || !empty($result['error']) || !is_array($result['data'] ?? null)) return null;

    $unique = [];
    foreach ($result['data'] as $name) {
        if (!is_string($name)) continue;
        $name = preg_replace('/\s+/u', ' ', trim($name)) ?? trim($name);
        if ($name === '') continue;
        $key = mb_strtolower($name, 'UTF-8');
        if (!array_key_exists($key, $unique)) $unique[$key] = $name;
    }
    $cityNames = array_values($unique);
    sort($cityNames, SORT_NATURAL | SORT_FLAG_CASE);
    @file_put_contents($cachePath, (string) json_encode($cityNames, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $memoryCache[$countryCode] = $cityNames;
}
