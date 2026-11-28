<?php
declare(strict_types=1);

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $databaseConfig = [];
    $configFile = __DIR__ . '/config.php';
    if (is_file($configFile)) {
        $loadedConfig = require $configFile;
        if (is_array($loadedConfig)) {
            $databaseConfig = $loadedConfig;
        }
    }

    $host = getenv('POOKIE_DB_HOST') ?: ($databaseConfig['host'] ?? '127.0.0.1');
    $name = getenv('POOKIE_DB_NAME') ?: ($databaseConfig['name'] ?? 'pookieeater');
    $user = getenv('POOKIE_DB_USER') ?: ($databaseConfig['user'] ?? 'root');
    $password = getenv('POOKIE_DB_PASSWORD') ?: ($databaseConfig['password'] ?? '');
    $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_data(): array
{
    $body = file_get_contents('php://input');
    $data = json_decode($body ?: '', true);
    return is_array($data) ? $data : $_POST;
}

function public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'firstName' => $user['first_name'],
        'lastName' => $user['last_name'],
        'role' => $user['role'],
    ];
}
