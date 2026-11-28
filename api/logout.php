<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

start_app_session();
$presenceToken = (string) ($_SESSION['customer_presence_token'] ?? '');
if (preg_match('/^[a-f0-9]{64}$/', $presenceToken)) {
    try {
        database()->prepare('DELETE FROM customer_presence WHERE presence_key = ?')->execute([hash('sha256', $presenceToken)]);
    } catch (PDOException $error) {
        // Sign-out still succeeds if presence storage is unavailable; its heartbeat will expire.
        error_log($error->getMessage());
    }
}
unset($_SESSION['customer_presence_token'], $_SESSION['customer_presence_user_id']);
if (($_SESSION['user']['role'] ?? '') === 'admin' && !isset($_SESSION['dashboard_admin'])) {
    $_SESSION['dashboard_admin'] = $_SESSION['user'];
}
unset($_SESSION['user']);
session_regenerate_id(true);
json_response(['ok' => true]);
