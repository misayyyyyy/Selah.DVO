<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

function analytics_rate_limit(PDO $pdo, string $key, int $limit): bool
{
    $statement = $pdo->prepare(
        'INSERT INTO analytics_rate_limits (bucket_key, window_started_at, request_count) VALUES (?, NOW(), 1)
         ON DUPLICATE KEY UPDATE
           request_count = IF(window_started_at <= NOW() - INTERVAL 10 MINUTE, 1, request_count + 1),
           window_started_at = IF(window_started_at <= NOW() - INTERVAL 10 MINUTE, NOW(), window_started_at)'
    );
    $statement->execute([$key]);
    $check = $pdo->prepare('SELECT request_count FROM analytics_rate_limits WHERE bucket_key = ?');
    $check->execute([$key]);
    return (int) $check->fetchColumn() <= $limit;
}

function analytics_product_catalog(): array|false
{
    $catalog = @simplexml_load_file(__DIR__ . '/../Cookies.xml', 'SimpleXMLElement', LIBXML_NONET);
    if (!$catalog) return false;
    $products = [];
    foreach ($catalog->Cookie as $product) {
        $id = trim((string) ($product['id'] ?? ''));
        $name = trim((string) ($product->Name ?? ''));
        $price = filter_var((string) ($product->Price ?? ''), FILTER_VALIDATE_FLOAT);
        if ($id !== '' && $name !== '' && $price !== false && $price >= 0) {
            $products[$id] = ['name' => $name, 'price' => (float) $price];
        }
    }
    return $products;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentType !== 'application/json' || $contentLength > 16384) {
    json_response(['ok' => false, 'message' => 'Invalid analytics request.'], 415);
}
$body = file_get_contents('php://input', false, null, 0, 16385);
$data = json_decode($body ?: '', true);
if (!is_array($data) || strlen((string) $body) > 16384) {
    json_response(['ok' => false, 'message' => 'Invalid analytics request.'], 400);
}
$type = (string) ($data['type'] ?? '');
if (!in_array($type, ['product_view', 'add_to_cart', 'order_request'], true)) {
    json_response(['ok' => false, 'message' => 'Invalid analytics event.'], 422);
}
start_app_session();
$user = $_SESSION['user'] ?? null;
if (in_array($type, ['add_to_cart', 'order_request'], true)) {
    if (!$user || !in_array($user['role'] ?? '', ['customer', 'admin'], true)) {
        $message = $type === 'add_to_cart'
            ? 'Sign in before adding products to your cart.'
            : 'Sign in before sending an order request.';
        json_response(['ok' => false, 'message' => $message], 401);
    }
}

$items = $type === 'order_request' ? ($data['items'] ?? []) : [$data['product'] ?? []];
if (!is_array($items) || count($items) < 1 || count($items) > ($type === 'order_request' ? 30 : 1)) {
    json_response(['ok' => false, 'message' => 'Invalid product list.'], 422);
}
$platform = $type === 'order_request' ? (string) ($data['platform'] ?? '') : null;
if ($type === 'order_request' && !in_array($platform, ['facebook', 'instagram'], true)) {
    json_response(['ok' => false, 'message' => 'Invalid platform.'], 422);
}
$randomId = $type === 'order_request' ? bin2hex(random_bytes(16)) : '';
$orderId = $type === 'order_request'
    ? sprintf('%s-%s-%s-%s-%s', substr($randomId, 0, 8), substr($randomId, 8, 4), substr($randomId, 12, 4), substr($randomId, 16, 4), substr($randomId, 20, 12))
    : null;

$catalog = analytics_product_catalog();
if ($catalog === false) {
    json_response(['ok' => false, 'message' => 'Product data is unavailable.'], 503);
}
$validItems = [];
$seenProducts = [];
foreach ($items as $item) {
    if (!is_array($item)) continue;
    $id = trim((string) ($item['id'] ?? ''));
    $quantity = filter_var($item['quantity'] ?? 1, FILTER_VALIDATE_INT);
    if ($id === '' || !isset($catalog[$id]) || isset($seenProducts[$id])
        || $quantity === false || $quantity < 1 || $quantity > 99) {
        json_response(['ok' => false, 'message' => 'One or more cart items could not be recorded.'], 422);
    }
    $seenProducts[$id] = true;
    $validItems[] = [$id, $catalog[$id]['name'], $quantity, $catalog[$id]['price']];
}
if (!$validItems) {
    json_response(['ok' => false, 'message' => 'The order did not contain any valid items.'], 422);
}

try {
    $pdo = database();
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ipPrefix = match ($type) {
        'order_request' => 'o:',
        'add_to_cart' => 'c:',
        default => 'v:',
    };
    $ipBucket = $ipPrefix . hash('sha256', $ip);
    $limits = match ($type) {
        'order_request' => [['user:' . (int) $user['id'], 8], [$ipBucket, 20]],
        'add_to_cart' => [['cart-user:' . (int) $user['id'], 60], [$ipBucket, 90]],
        default => [[$ipBucket, 90]],
    };
    foreach ($limits as [$bucket, $limit]) {
        if (!analytics_rate_limit($pdo, $bucket, $limit)) {
            header('Retry-After: 600');
            json_response(['ok' => false, 'message' => 'Too many requests. Please try again in a few minutes.'], 429);
        }
    }
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM analytics_rate_limits WHERE window_started_at < NOW() - INTERVAL 1 DAY');
    }
    $pdo->beginTransaction();
    $analyticsUserId = isset($user['id']) && (int) $user['id'] > 0 ? (int) $user['id'] : null;
    $statement = $pdo->prepare(
        'INSERT INTO analytics_events (user_id, event_type, product_id, product_name, quantity, unit_price, order_id, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($validItems as [$id, $name, $quantity, $price]) {
        $statement->execute([$analyticsUserId, $type, $id, $name, $quantity, $price, $orderId, $platform]);
    }
    $pdo->commit();
    json_response(['ok' => true, 'itemsRecorded' => count($validItems)]);
} catch (PDOException $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Analytics storage is unavailable.'], 503);
}
