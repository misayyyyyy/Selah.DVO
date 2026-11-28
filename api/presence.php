<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
if ($contentType !== 'application/json') {
    json_response(['ok' => false, 'message' => 'Invalid presence request.'], 415);
}
$data = request_data();
$state = (string) ($data['state'] ?? 'online');
if (!in_array($state, ['online', 'offline'], true)) {
    json_response(['ok' => false, 'message' => 'Invalid presence state.'], 422);
}

start_app_session();
$user = $_SESSION['user'] ?? null;
$presenceToken = (string) ($_SESSION['customer_presence_token'] ?? '');
$presenceKey = preg_match('/^[a-f0-9]{64}$/', $presenceToken)
    ? hash('sha256', $presenceToken)
    : '';

if ($state === 'offline') {
    if ($presenceKey !== '') {
        try {
            $statement = database()->prepare('DELETE FROM customer_presence WHERE presence_key = ?');
            $statement->execute([$presenceKey]);
        } catch (PDOException $error) {
            error_log($error->getMessage());
        }
    }
    unset($_SESSION['customer_presence_token'], $_SESSION['customer_presence_user_id']);
    json_response(['ok' => true]);
}

$userId = (int) ($user['id'] ?? 0);
if (($user['role'] ?? '') !== 'customer' || $userId < 1) {
    json_response(['ok' => false, 'message' => 'Sign in with a customer account to send presence.'], 401);
}

try {
    $pdo = database();
    if ($presenceKey !== '' && (int) ($_SESSION['customer_presence_user_id'] ?? 0) !== $userId) {
        $pdo->prepare('DELETE FROM customer_presence WHERE presence_key = ?')->execute([$presenceKey]);
        $presenceKey = '';
        $presenceToken = '';
    }
    if ($presenceKey === '') {
        $presenceToken = bin2hex(random_bytes(32));
        $presenceKey = hash('sha256', $presenceToken);
        $_SESSION['customer_presence_token'] = $presenceToken;
        $_SESSION['customer_presence_user_id'] = $userId;
    }

    $statement = $pdo->prepare(
        'INSERT INTO customer_presence (presence_key, user_id, last_seen_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), last_seen_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([$presenceKey, $userId]);

    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM customer_presence WHERE last_seen_at < CURRENT_TIMESTAMP - INTERVAL 2 DAY');
    }
    json_response(['ok' => true]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Could not update customer presence.'], 503);
}
