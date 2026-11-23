<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
start_app_session();

$user = $_SESSION['user'] ?? null;
if (!$user) {
    json_response(['ok' => false, 'message' => 'Sign in to access your saved cart.'], 401);
}

$userId = (int) $user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($userId <= 0 && ($user['role'] ?? '') === 'admin') {
        json_response(['ok' => true, 'items' => []]);
    }
    try {
        $pdo = database();
        $statement = $pdo->prepare('SELECT product_id, product_data, quantity, selected FROM cart_items WHERE user_id = ? ORDER BY id');
        $statement->execute([$userId]);
        $items = [];
        foreach ($statement->fetchAll() as $row) {
            $product = json_decode($row['product_data'], true);
            if (!is_array($product)) continue;
            $items[] = [
                'id' => $row['product_id'],
                'product' => $product,
                'quantity' => (int) $row['quantity'],
                'selected' => (bool) $row['selected'],
            ];
        }
        json_response(['ok' => true, 'items' => $items]);
    } catch (PDOException $error) {
        error_log($error->getMessage());
        json_response(['ok' => false, 'message' => 'Could not load your saved cart.'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$data = request_data();
$items = $data['items'] ?? null;
if (!is_array($items) || count($items) > 100) {
    json_response(['ok' => false, 'message' => 'Invalid cart data.'], 422);
}

$validated = [];
foreach ($items as $item) {
    $product = $item['product'] ?? null;
    $id = trim((string) ($item['id'] ?? ''));
    $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
    if (!is_array($product) || $id === '' || strlen($id) > 120 || $quantity === false || $quantity < 1 || $quantity > 99) {
        json_response(['ok' => false, 'message' => 'A cart item is invalid.'], 422);
    }
    if (empty($product['name']) || !isset($product['price']) || !is_numeric($product['price'])) {
        json_response(['ok' => false, 'message' => 'A cart product is missing its name or price.'], 422);
    }
    $validated[] = [
        'id' => $id,
        'data' => json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'quantity' => $quantity,
        'selected' => !empty($item['selected']) ? 1 : 0,
    ];
}

// A built-in admin session without a database can still use the in-page cart.
// It simply has no database record on which to persist cart contents.
if ($userId <= 0 && ($user['role'] ?? '') === 'admin') {
    json_response(['ok' => true]);
}

try {
    $pdo = null;
    $pdo = database();
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM cart_items WHERE user_id = ?')->execute([$userId]);
    if ($validated) {
        $insert = $pdo->prepare('INSERT INTO cart_items (user_id, product_id, product_data, quantity, selected) VALUES (?, ?, ?, ?, ?)');
        foreach ($validated as $item) {
            $insert->execute([$userId, $item['id'], $item['data'], $item['quantity'], $item['selected']]);
        }
    }
    $pdo->commit();
    json_response(['ok' => true]);
} catch (PDOException $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Could not save your cart.'], 500);
}
