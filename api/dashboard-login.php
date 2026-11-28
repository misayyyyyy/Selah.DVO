<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentType !== 'application/json' || $contentLength > 8192) {
    json_response(['ok' => false, 'message' => 'Invalid sign-in request.'], 415);
}
$body = file_get_contents('php://input', false, null, 0, 8193);
$data = json_decode($body ?: '', true);
if (!is_array($data) || strlen((string) $body) > 8192) {
    json_response(['ok' => false, 'message' => 'Invalid sign-in request.'], 400);
}

$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');
if ($username === '' || strlen($username) > 128 || $password === '' || strlen($password) > 4096) {
    json_response(['ok' => false, 'message' => 'Enter your admin username and password.'], 422);
}

try {
    $pdo = database();
    $loginBucket = 'l:' . hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $rate = $pdo->prepare(
        'INSERT INTO analytics_rate_limits (bucket_key, window_started_at, request_count) VALUES (?, NOW(), 1)
         ON DUPLICATE KEY UPDATE
           request_count = IF(window_started_at <= NOW() - INTERVAL 10 MINUTE, 1, request_count + 1),
           window_started_at = IF(window_started_at <= NOW() - INTERVAL 10 MINUTE, NOW(), window_started_at)'
    );
    $rate->execute([$loginBucket]);
    $rateCheck = $pdo->prepare('SELECT request_count FROM analytics_rate_limits WHERE bucket_key = ?');
    $rateCheck->execute([$loginBucket]);
    if ((int) $rateCheck->fetchColumn() > 10) {
        header('Retry-After: 600');
        json_response(['ok' => false, 'message' => 'Too many sign-in attempts. Please try again in a few minutes.'], 429);
    }
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM analytics_rate_limits WHERE window_started_at < NOW() - INTERVAL 1 DAY');
    }

    $statement = $pdo->prepare("SELECT * FROM users WHERE username = ? AND role = 'admin' LIMIT 1");
    $statement->execute([$username]);
    $admin = $statement->fetch();
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        json_response(['ok' => false, 'message' => 'The admin username or password is incorrect.'], 401);
    }

    start_app_session();
    session_regenerate_id(true);
    $_SESSION['dashboard_admin'] = public_user($admin);
    json_response(['ok' => true, 'user' => $_SESSION['dashboard_admin']]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    $isLoopback = in_array((string) ($_SERVER['REMOTE_ADDR'] ?? ''), ['127.0.0.1', '::1'], true);
    $demoAdminEnabled = getenv('POOKIE_ENABLE_BUILTIN_ADMIN') === '1';
    $isBuiltinDemo = strcasecmp($username, 'Marianne Dionisio') === 0 && hash_equals('Admin', $password);
    if (!$demoAdminEnabled || !$isLoopback || !$isBuiltinDemo) {
        json_response(['ok' => false, 'message' => 'Could not sign in. Check the database setup and try again.'], 503);
    }

    start_app_session();
    session_regenerate_id(true);
    $_SESSION['dashboard_admin'] = [
        'id' => 0,
        'username' => 'Marianne Dionisio',
        'firstName' => 'Marianne',
        'lastName' => 'Dionisio',
        'role' => 'admin',
    ];
    json_response(['ok' => true, 'user' => $_SESSION['dashboard_admin']]);
}
