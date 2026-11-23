<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
start_app_session();

$user = $_SESSION['user'] ?? null;
if (!$user) {
    json_response(['ok' => true, 'user' => null]);
}

$isBuiltInAdmin = ($user['role'] ?? '') === 'admin'
    && strcasecmp((string) ($user['username'] ?? ''), 'Marianne Dionisio') === 0;

if ($isBuiltInAdmin) {
    try {
        $statement = database()->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = 'admin' LIMIT 1");
        $statement->execute(['Marianne Dionisio']);
        $admin = $statement->fetch();
        $user = $admin
            ? public_user($admin)
            : [
                'id' => 0,
                'username' => 'Marianne Dionisio',
                'firstName' => 'Marianne',
                'lastName' => 'Dionisio',
                'role' => 'admin',
            ];
    } catch (PDOException $error) {
        // The built-in admin session remains usable without MySQL.
        $user = [
            'id' => 0,
            'username' => 'Marianne Dionisio',
            'firstName' => 'Marianne',
            'lastName' => 'Dionisio',
            'role' => 'admin',
        ];
    }
    $_SESSION['user'] = $user;
    json_response(['ok' => true, 'user' => $user]);
}

try {
    $statement = database()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $statement->execute([(int) ($user['id'] ?? 0)]);
    if (!$statement->fetchColumn()) {
        unset($_SESSION['user']);
        json_response(['ok' => true, 'user' => null, 'reason' => 'account_unavailable']);
    }
} catch (PDOException $error) {
    unset($_SESSION['user']);
    json_response(['ok' => true, 'user' => null, 'reason' => 'database_unavailable']);
}

json_response(['ok' => true, 'user' => $user]);
