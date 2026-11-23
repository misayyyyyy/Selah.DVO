<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

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
if (strlen($password) < 8) {
    json_response(['ok' => false, 'message' => 'Password must be at least 8 characters.'], 422);
}
if (!hash_equals($password, $confirmPassword)) {
    json_response(['ok' => false, 'message' => 'Passwords do not match.'], 422);
}

try {
    $statement = database()->prepare(
        'INSERT INTO users (username, first_name, middle_name, last_name, age, sex, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $username,
        $firstName,
        $middleName === '' ? null : $middleName,
        $lastName,
        $age,
        $sex,
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
