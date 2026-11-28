<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
start_app_session();

$storeUser = $_SESSION['user'] ?? null;
$dashboardUser = $_SESSION['dashboard_admin'] ?? null;
$user = ($storeUser['role'] ?? '') === 'admin' ? $storeUser : $dashboardUser;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_response(['ok' => false, 'message' => 'Sign in with an admin account to view the dashboard.'], 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$manilaTimezone = new DateTimeZone('Asia/Manila');
$todayInManila = new DateTimeImmutable('today', $manilaTimezone);
$requestedDate = (string) ($_GET['date'] ?? $todayInManila->format('Y-m-d'));
$parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $requestedDate, $manilaTimezone);
$dateErrors = DateTimeImmutable::getLastErrors();
if (!$parsedDate || ($dateErrors && ($dateErrors['warning_count'] || $dateErrors['error_count'])) || $parsedDate->format('Y-m-d') !== $requestedDate) {
    json_response(['ok' => false, 'message' => 'Choose a valid date for the order value chart.'], 400);
}
if ($parsedDate > $todayInManila) {
    json_response(['ok' => false, 'message' => 'Choose today or an earlier date.'], 400);
}

try {
    $pdo = database();
    $pdo->exec("SET time_zone = '+08:00'");
    $previousDate = $parsedDate->modify('-1 day')->format('Y-m-d');
    $weekStart = $parsedDate->modify('-6 days')->format('Y-m-d');
    $dayTotals = $pdo->prepare(
        "SELECT COUNT(DISTINCT CASE WHEN event_type = 'order_request' THEN order_id END) AS orders,
                COALESCE(SUM(CASE WHEN event_type = 'order_request' THEN quantity * unit_price ELSE 0 END), 0) AS sales,
                COALESCE(SUM(CASE WHEN event_type = 'order_request' THEN quantity ELSE 0 END), 0) AS items,
                SUM(event_type = 'product_view') AS clicks
         FROM analytics_events WHERE DATE(created_at) = ?"
    );
    $dayTotals->execute([$requestedDate]);
    $selected = $dayTotals->fetch();
    $dayTotals->execute([$previousDate]);
    $previous = $dayTotals->fetch();
    $weekStatement = $pdo->prepare(
        "SELECT DATE(created_at) AS day, COUNT(DISTINCT CASE WHEN event_type = 'order_request' THEN order_id END) AS orders,
                COALESCE(SUM(CASE WHEN event_type = 'order_request' THEN quantity * unit_price ELSE 0 END), 0) AS sales,
                SUM(event_type = 'product_view') AS views
         FROM analytics_events WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY DATE(created_at) ORDER BY day"
    );
    $weekStatement->execute([$weekStart, $requestedDate]);
    $week = $weekStatement->fetchAll();
    $hoursStatement = $pdo->prepare(
        "SELECT HOUR(created_at) AS hour, COUNT(DISTINCT order_id) AS orders,
                COALESCE(SUM(quantity * unit_price), 0) AS sales
         FROM analytics_events WHERE event_type = 'order_request' AND DATE(created_at) = ?
         GROUP BY HOUR(created_at) ORDER BY hour"
    );
    $hoursStatement->execute([$requestedDate]);
    $selectedHours = $hoursStatement->fetchAll();
    $salesMixStatement = $pdo->prepare(
        "SELECT product_id AS id, product_name AS name, SUM(quantity * unit_price) AS value, SUM(quantity) AS units
         FROM analytics_events WHERE event_type = 'order_request' AND DATE(created_at) = ?
         GROUP BY product_id, product_name ORDER BY value DESC, name"
    );
    $salesMixStatement->execute([$requestedDate]);
    $salesMix = $salesMixStatement->fetchAll();
    $clickMixStatement = $pdo->prepare(
        "SELECT product_id AS id, product_name AS name, COUNT(*) AS value
         FROM analytics_events WHERE event_type = 'product_view' AND DATE(created_at) = ?
         GROUP BY product_id, product_name ORDER BY value DESC, name"
    );
    $clickMixStatement->execute([$requestedDate]);
    $clickMix = $clickMixStatement->fetchAll();
    $productStatsStatement = $pdo->prepare(
        "SELECT product_id AS id, product_name AS name,
                SUM(event_type = 'product_view') AS clicks,
                SUM(event_type = 'add_to_cart') AS adds,
                COUNT(DISTINCT CASE WHEN event_type = 'order_request' THEN order_id END) AS orders
         FROM analytics_events WHERE DATE(created_at) = ?
         GROUP BY product_id, product_name ORDER BY product_name"
    );
    $productStatsStatement->execute([$requestedDate]);
    $productStats = array_map(static fn(array $row): array => [
        'id' => $row['id'], 'name' => $row['name'],
        'clicks' => (int) $row['clicks'], 'adds' => (int) $row['adds'], 'orders' => (int) $row['orders'],
    ], $productStatsStatement->fetchAll());
    $topClickedStatement = $pdo->prepare(
        "SELECT product_id AS id, product_name AS name, COUNT(*) AS clicks FROM analytics_events
         WHERE event_type = 'product_view' AND DATE(created_at) = ?
         GROUP BY product_id, product_name ORDER BY clicks DESC, name LIMIT 1"
    );
    $topClickedStatement->execute([$requestedDate]);
    $topClicked = $topClickedStatement->fetch() ?: null;
    $topSoldStatement = $pdo->prepare(
        "SELECT product_id AS id, product_name AS name, SUM(quantity) AS units, SUM(quantity * unit_price) AS sales
         FROM analytics_events WHERE event_type = 'order_request' AND DATE(created_at) = ?
         GROUP BY product_id, product_name ORDER BY units DESC, name LIMIT 1"
    );
    $topSoldStatement->execute([$requestedDate]);
    $topSold = $topSoldStatement->fetch() ?: null;
    $platformStatement = $pdo->prepare(
        "SELECT platform, COUNT(DISTINCT order_id) AS orders FROM analytics_events
         WHERE event_type = 'order_request' AND DATE(created_at) = ? GROUP BY platform"
    );
    $platformStatement->execute([$requestedDate]);
    $platforms = $platformStatement->fetchAll();
    $recentStatement = $pdo->prepare(
        "SELECT order_id, platform, SUM(quantity) AS quantity, SUM(quantity * unit_price) AS amount,
                MAX(created_at) AS time, MAX(id) AS latest_id
         FROM analytics_events WHERE event_type = 'order_request' AND DATE(created_at) = ? GROUP BY order_id, platform
         ORDER BY latest_id DESC LIMIT 50"
    );
    $recentStatement->execute([$requestedDate]);
    $recent = $recentStatement->fetchAll();
    if ($recent) {
        $orderIds = array_column($recent, 'order_id');
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        $lineStatement = $pdo->prepare(
            "SELECT order_id, product_id AS id, product_name AS name, quantity, unit_price AS price
             FROM analytics_events WHERE event_type = 'order_request' AND order_id IN ({$placeholders}) ORDER BY id"
        );
        $lineStatement->execute($orderIds);
        $linesByOrder = [];
        foreach ($lineStatement->fetchAll() as $line) {
            $linesByOrder[$line['order_id']][] = [
                'id' => $line['id'], 'name' => $line['name'], 'quantity' => (int) $line['quantity'], 'price' => (float) $line['price'],
            ];
        }
        foreach ($recent as &$order) {
            $order['items'] = $linesByOrder[$order['order_id']] ?? [];
            unset($order['latest_id']);
        }
        unset($order);
    }

    json_response(['ok' => true, 'selected' => [
        'sales' => (float) ($selected['sales'] ?? 0), 'orders' => (int) ($selected['orders'] ?? 0),
        'items' => (int) ($selected['items'] ?? 0), 'clicks' => (int) ($selected['clicks'] ?? 0),
        'salesChange' => (float) ($selected['sales'] ?? 0) - (float) ($previous['sales'] ?? 0),
        'ordersChange' => (int) ($selected['orders'] ?? 0) - (int) ($previous['orders'] ?? 0),
    ], 'week' => $week, 'hours' => $selectedHours, 'selectedDate' => $requestedDate, 'salesMix' => $salesMix, 'clickMix' => $clickMix,
        'topClicked' => $topClicked, 'topSold' => $topSold,
        'platforms' => $platforms, 'recent' => $recent, 'productStats' => $productStats, 'updatedAt' => date(DATE_ATOM)]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Could not load analytics. Import the latest database.sql and try again.'], 503);
}
