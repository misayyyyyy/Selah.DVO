<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/location-data.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$data = request_data();
$username = trim((string) ($data['username'] ?? ''));
$firstName = trim((string) ($data['firstName'] ?? ''));
$middleName = trim((string) ($data['middleName'] ?? ''));
$lastName = trim((string) ($data['lastName'] ?? ''));
$age = filter_var($data['age'] ?? null, FILTER_VALIDATE_INT);
$sex = (string) ($data['sex'] ?? '');
$city = trim((string) ($data['city'] ?? ''));
$countryCode = strtoupper(trim((string) ($data['countryCode'] ?? '')));
$location = '';
$password = (string) ($data['password'] ?? '');
$confirmPassword = (string) ($data['confirmPassword'] ?? '');
$allowedSex = ['female', 'male', 'prefer-not-to-say'];

if (!preg_match('/^[A-Za-z0-9_]{3,24}$/', $username)) {
    json_response(['ok' => false, 'message' => 'Username must be 3–24 letters, numbers, or underscores.'], 422);
}
if ($firstName === '' || mb_strlen($firstName) > 60 || $lastName === '' || mb_strlen($lastName) > 60 || mb_strlen($middleName) > 60) {
    json_response(['ok' => false, 'message' => 'Enter valid first and last names.'], 422);
}
if ($age === false || $age < 1 || $age > 120 || !in_array($sex, $allowedSex, true)) {
    json_response(['ok' => false, 'message' => 'Enter a valid age and select a sex option.'], 422);
}
if ($city === '') {
    json_response(['ok' => false, 'message' => 'Enter a city and select it from the suggestions before creating an account.'], 422);
}
if (!preg_match('/^[A-Z]{2}$/', $countryCode)) {
    json_response(['ok' => false, 'message' => 'Choose a country for the city you entered.'], 422);
}

$countryName = location_country_names()[$countryCode] ?? null;
if ($countryName === null || $countryName === '') {
    json_response(['ok' => false, 'message' => 'Choose a valid country for this city.'], 422);
}

$city = preg_replace('/\s+/u', ' ', $city) ?? $city;
$requestedCity = mb_strtolower($city, 'UTF-8');
$knownCities = location_city_names($countryCode);
if ($knownCities === null) {
    json_response(['ok' => false, 'message' => 'We couldn’t verify the city list. Try again later.'], 503);
}
$canonicalCity = null;
foreach ($knownCities as $knownCity) {
    if (mb_strtolower((string) $knownCity, 'UTF-8') === $requestedCity) {
        $canonicalCity = (string) $knownCity;
        break;
    }
}
if ($canonicalCity === null) {
    json_response(['ok' => false, 'message' => 'Choose a city from the suggestions for the selected country.'], 422);
}
$city = $canonicalCity;
$location = $countryName . ', ' . $city;
if (mb_strlen($location) > 120) {
    json_response(['ok' => false, 'message' => 'Location must be 120 characters or fewer.'], 422);
}
if (strlen($password) < 8) {
    json_response(['ok' => false, 'message' => 'Password must be at least 8 characters.'], 422);
}
if (!hash_equals($password, $confirmPassword)) {
    json_response(['ok' => false, 'message' => 'Passwords do not match.'], 422);
}

try {
    $statement = database()->prepare(
        'INSERT INTO users (username, first_name, middle_name, last_name, age, sex, location, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $username,
        $firstName,
        $middleName === '' ? null : $middleName,
        $lastName,
        $age,
        $sex,
        $location === '' ? null : $location,
        password_hash($password, PASSWORD_DEFAULT),
    ]);
    json_response(['ok' => true, 'message' => 'Account created. You can now sign in.']);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        json_response(['ok' => false, 'message' => 'That username is already taken.'], 409);
    }
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Could not create the account. Check the database setup and try again.'], 500);
}
