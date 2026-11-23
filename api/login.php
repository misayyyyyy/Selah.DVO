<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$data = request_data();
$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');
if ($username === '' || $password === '') {
    json_response(['ok' => false, 'message' => 'Enter your username and password.'], 422);
}

$isBuiltInAdminUsername = strcasecmp($username, 'Marianne Dionisio') === 0;
if ($isBuiltInAdminUsername) {
    try {
        $statement = database()->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = 'admin' LIMIT 1");
        $statement->execute(['Marianne Dionisio']);
        $adminUser = $statement->fetch();
        if (!$adminUser || !password_verify($password, $adminUser['password_hash'])) {
            json_response(['ok' => false, 'message' => 'Password doesn’t match. Please try again.'], 401);
        }

        start_app_session();
        session_regenerate_id(true);
        $_SESSION['user'] = public_user($adminUser);
        json_response(['ok' => true, 'user' => $_SESSION['user']]);
    } catch (PDOException $error) {
        error_log($error->getMessage());
        $isLoopback = in_array((string) ($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
        // The weak built-in credential is a local-only demo fallback and must be explicitly enabled.
        $demoAdminEnabled = getenv('POOKIE_ENABLE_BUILTIN_ADMIN') === '1';
        if (!$demoAdminEnabled || !$isLoopback || !hash_equals('Admin', $password)) {
            json_response(['ok' => false, 'message' => 'Could not sign in. Check the database setup and try again.'], 503);
        }
    }

    start_app_session();
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => 0,
        'username' => 'Marianne Dionisio',
        'firstName' => 'Marianne',
        'lastName' => 'Dionisio',
        'role' => 'admin',
    ];
    json_response(['ok' => true, 'user' => $_SESSION['user']]);
}

try {
    $statement = database()->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
    $statement->execute([$username]);
    $user = $statement->fetch();
    if (!$user) {
        json_response(['ok' => false, 'message' => 'Username not found. Check it or create an account.'], 401);
    }
    if (!password_verify($password, $user['password_hash'])) {
        json_response(['ok' => false, 'message' => 'Password doesn’t match. Please try again.'], 401);
    }

    start_app_session();
    session_regenerate_id(true);
    $_SESSION['user'] = public_user($user);
    json_response(['ok' => true, 'user' => $_SESSION['user']]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Could not sign in. Check the database setup and try again.'], 500);
}
