<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/location-data.php';
start_app_session();

$storeUser = $_SESSION['user'] ?? null;
$dashboardUser = $_SESSION['dashboard_admin'] ?? null;
$user = ($storeUser['role'] ?? '') === 'admin' ? $storeUser : $dashboardUser;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_response(['ok' => false, 'message' => 'Sign in with an admin account to view customer accounts.'], 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$search = trim((string) ($_GET['q'] ?? ''));
if (mb_strlen($search) > 80) $search = mb_substr($search, 0, 80);
$page = max(1, (int) ($_GET['page'] ?? 1));
$pageSize = 6;
$activityMode = (string) ($_GET['activity_mode'] ?? '30days') === 'day' ? 'day' : '30days';
$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
$requestedActivityDate = trim((string) ($_GET['activity_date'] ?? ''));
$activityDate = $today->format('Y-m-d');
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $requestedActivityDate)
    && checkdate((int) substr($requestedActivityDate, 5, 2), (int) substr($requestedActivityDate, 8, 2), (int) substr($requestedActivityDate, 0, 4))
    && $requestedActivityDate <= $activityDate) {
    $activityDate = $requestedActivityDate;
}
$ageLabels = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'];
$sexLabels = ['female' => 'Female', 'male' => 'Male', 'prefer-not-to-say' => 'Prefer not to say'];
$countryNameLookup = [];
foreach (location_country_names() as $countryName) {
    $countryNameLookup[mb_strtolower($countryName, 'UTF-8')] = $countryName;
}

function customer_location_country_first(string $location, array $countryNames): string
{
    $location = trim($location);
    foreach ($countryNames as $countryName) {
        $prefixPattern = '/^' . preg_quote($countryName, '/') . ',\s*/iu';
        if (preg_match($prefixPattern, $location, $prefixMatch)) {
            $city = trim(substr($location, strlen($prefixMatch[0])));
            return $city === '' ? $countryName : $countryName . ', ' . $city;
        }

        $suffixPattern = '/,\s*' . preg_quote($countryName, '/') . '\s*$/iu';
        if (preg_match($suffixPattern, $location, $suffixMatch, PREG_OFFSET_CAPTURE)) {
            $city = trim(substr($location, 0, $suffixMatch[0][1]));
            return $city === '' ? $countryName : $countryName . ', ' . $city;
        }
    }
    return $location;
}

try {
    $pdo = database();
    $pdo->exec("SET time_zone = '+08:00'");

    $accounts = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'customer'")->fetchColumn();
    $onlineUsers = (int) $pdo->query(
        "SELECT COUNT(DISTINCT p.user_id)
         FROM customer_presence p
         INNER JOIN users u ON u.id = p.user_id AND u.role = 'customer'
         WHERE p.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL 75 SECOND"
    )->fetchColumn();
    $activeTrendStatement = $pdo->query(
        "SELECT activity.activity_day, COUNT(DISTINCT activity.user_id) AS total
         FROM (
           SELECT DATE(created_at) AS activity_day, user_id
           FROM analytics_events
           WHERE user_id IS NOT NULL AND created_at >= CURDATE() - INTERVAL 29 DAY
           UNION
           SELECT DATE(updated_at) AS activity_day, user_id
           FROM cart_items
           WHERE updated_at >= CURDATE() - INTERVAL 29 DAY
         ) activity
         INNER JOIN users u ON u.id = activity.user_id AND u.role = 'customer'
         GROUP BY activity.activity_day ORDER BY activity.activity_day"
    );
    $activeTrendByDay = [];
    foreach ($activeTrendStatement->fetchAll() as $row) {
        $activeTrendByDay[(string) $row['activity_day']] = (int) $row['total'];
    }
    $activeUserTrend = [];
    for ($daysBack = 29; $daysBack >= 0; $daysBack--) {
        $day = $today->modify("-{$daysBack} days")->format('Y-m-d');
        $activeUserTrend[] = ['date' => $day, 'count' => $activeTrendByDay[$day] ?? 0];
    }
    $activeUserHourlyTrend = [];
    if ($activityMode === 'day') {
        $hourlyStatement = $pdo->prepare(
            "SELECT activity.activity_hour, COUNT(DISTINCT activity.user_id) AS total
             FROM (
               SELECT HOUR(created_at) AS activity_hour, user_id
               FROM analytics_events
               WHERE user_id IS NOT NULL AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
               UNION
               SELECT HOUR(updated_at) AS activity_hour, user_id
               FROM cart_items
               WHERE updated_at >= ? AND updated_at < DATE_ADD(?, INTERVAL 1 DAY)
             ) activity
             INNER JOIN users u ON u.id = activity.user_id AND u.role = 'customer'
             GROUP BY activity.activity_hour ORDER BY activity.activity_hour"
        );
        $hourlyStatement->execute([$activityDate, $activityDate, $activityDate, $activityDate]);
        $activeByHour = array_fill(0, 24, 0);
        foreach ($hourlyStatement->fetchAll() as $row) {
            $activeByHour[(int) $row['activity_hour']] = (int) $row['total'];
        }
        foreach ($activeByHour as $hour => $count) {
            $activeUserHourlyTrend[] = ['hour' => $hour, 'count' => $count];
        }
    }
    $customersWithCart = (int) $pdo->query(
        "SELECT COUNT(DISTINCT c.user_id) FROM cart_items c INNER JOIN users u ON u.id = c.user_id WHERE u.role = 'customer'"
    )->fetchColumn();
    $trackedSpending = (float) $pdo->query(
        "SELECT COALESCE(SUM(e.quantity * e.unit_price), 0)
         FROM analytics_events e INNER JOIN users u ON u.id = e.user_id
         WHERE u.role = 'customer' AND e.event_type = 'order_request'"
    )->fetchColumn();

    $sexCounts = array_fill_keys(array_keys($sexLabels), 0);
    foreach ($pdo->query("SELECT sex, COUNT(*) AS total FROM users WHERE role = 'customer' GROUP BY sex")->fetchAll() as $row) {
        if (isset($sexCounts[$row['sex']])) $sexCounts[$row['sex']] = (int) $row['total'];
    }

    $ageCounts = array_fill_keys($ageLabels, 0);
    $ageStatement = $pdo->query(
        "SELECT CASE
           WHEN age < 18 THEN 'Under 18'
           WHEN age < 25 THEN '18–24'
           WHEN age < 35 THEN '25–34'
           WHEN age < 45 THEN '35–44'
           WHEN age < 55 THEN '45–54'
           ELSE '55+' END AS age_group, COUNT(*) AS total
         FROM users WHERE role = 'customer' AND age IS NOT NULL GROUP BY age_group"
    );
    foreach ($ageStatement->fetchAll() as $row) {
        if (isset($ageCounts[$row['age_group']])) $ageCounts[$row['age_group']] = (int) $row['total'];
    }

    $locationStatement = $pdo->query(
        "SELECT COALESCE(NULLIF(TRIM(location), ''), 'Not provided') AS place, COUNT(*) AS total
         FROM users WHERE role = 'customer' GROUP BY place"
    );
    $locationCounts = [];
    foreach ($locationStatement->fetchAll() as $row) {
        $place = customer_location_country_first((string) $row['place'], $countryNameLookup);
        $locationCounts[$place] = ($locationCounts[$place] ?? 0) + (int) $row['total'];
    }
    $locations = [];
    foreach ($locationCounts as $name => $count) {
        $locations[] = ['name' => (string) $name, 'count' => (int) $count];
    }
    usort($locations, static fn(array $left, array $right): int => ($right['count'] <=> $left['count']) ?: strcmp($left['name'], $right['name']));
    $locations = array_slice($locations, 0, 8);

    $where = "role = 'customer'";
    $parameters = [];
    if ($search !== '') {
        $where .= " AND (username LIKE ? OR CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?)";
        $like = '%' . $search . '%';
        $parameters = [$like, $like];
    }
    $countStatement = $pdo->prepare("SELECT COUNT(*) FROM users WHERE {$where}");
    $countStatement->execute($parameters);
    $matchingAccounts = (int) $countStatement->fetchColumn();
    $totalPages = max(1, (int) ceil($matchingAccounts / $pageSize));
    $page = min($page, $totalPages);
    $offset = ($page - 1) * $pageSize;
    $userStatement = $pdo->prepare(
        "SELECT id, username, first_name, middle_name, last_name, age, sex, location, created_at
         FROM users WHERE {$where} ORDER BY created_at DESC, id DESC LIMIT {$pageSize} OFFSET {$offset}"
    );
    $userStatement->execute($parameters);
    $users = $userStatement->fetchAll();
    $userIds = array_map(static fn(array $row): int => (int) $row['id'], $users);

    $cartsByUser = [];
    $activityByUser = [];
    if ($userIds) {
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $cartStatement = $pdo->prepare(
            "SELECT user_id, product_id, product_data, quantity, selected FROM cart_items WHERE user_id IN ({$placeholders}) ORDER BY id"
        );
        $cartStatement->execute($userIds);
        foreach ($cartStatement->fetchAll() as $row) {
            $product = json_decode((string) $row['product_data'], true);
            if (!is_array($product)) $product = [];
            $userId = (int) $row['user_id'];
            $quantity = (int) $row['quantity'];
            $cartsByUser[$userId][] = [
                'id' => (string) $row['product_id'],
                'name' => trim((string) ($product['name'] ?? 'Saved product')) ?: 'Saved product',
                'quantity' => $quantity,
                'selected' => (bool) $row['selected'],
                'price' => round((float) ($product['price'] ?? 0), 2),
            ];
        }

        $activityStatement = $pdo->prepare(
            "SELECT user_id, event_type, product_id, product_name, COUNT(*) AS events,
                    SUM(quantity) AS units, SUM(quantity * unit_price) AS value
             FROM analytics_events WHERE user_id IN ({$placeholders}) AND event_type IN ('product_view', 'order_request')
             GROUP BY user_id, event_type, product_id, product_name ORDER BY units DESC"
        );
        $activityStatement->execute($userIds);
        foreach ($activityStatement->fetchAll() as $row) {
            $userId = (int) $row['user_id'];
            $type = $row['event_type'];
            $activityByUser[$userId][$type][] = [
                'name' => (string) $row['product_name'],
                'events' => (int) $row['events'],
                'units' => (int) $row['units'],
                'value' => (float) $row['value'],
            ];
        }
    }

    $customerCards = array_map(static function (array $row) use ($cartsByUser, $activityByUser, $countryNameLookup): array {
        $userId = (int) $row['id'];
        $activity = $activityByUser[$userId] ?? [];
        $ordered = $activity['order_request'] ?? [];
        $clicked = $activity['product_view'] ?? [];
        $cart = $cartsByUser[$userId] ?? [];
        $selected = array_values(array_filter($cart, static fn(array $item): bool => $item['selected']));
        $unselected = array_values(array_filter($cart, static fn(array $item): bool => !$item['selected']));
        return [
            'id' => $userId,
            'username' => (string) $row['username'],
            'name' => trim(implode(' ', array_filter([$row['first_name'], $row['middle_name'], $row['last_name']]))),
            'age' => $row['age'] === null ? null : (int) $row['age'],
            'sex' => (string) $row['sex'],
            'location' => customer_location_country_first(trim((string) ($row['location'] ?? '')), $countryNameLookup),
            'createdAt' => (string) $row['created_at'],
            'totalSpent' => array_sum(array_column($ordered, 'value')),
            'mostClicked' => $clicked[0]['name'] ?? null,
            'mostOrdered' => $ordered[0]['name'] ?? null,
            'cart' => ['selected' => $selected, 'unselected' => $unselected],
        ];
    }, $users);

    json_response([
        'ok' => true,
        'summary' => [
            'onlineUsers' => $onlineUsers,
            'activeUserTrend' => $activeUserTrend,
            'activeUserHourlyTrend' => $activeUserHourlyTrend,
            'activeUserActivityDate' => $activityDate,
            'createdAccounts' => $accounts,
            'customersWithCart' => $customersWithCart,
            'trackedSpending' => $trackedSpending,
            'sex' => $sexCounts,
            'ages' => $ageCounts,
            'locations' => $locations,
        ],
        'customers' => $customerCards,
        'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'totalPages' => $totalPages, 'total' => $matchingAccounts],
        'updatedAt' => date(DATE_ATOM),
    ]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    json_response(['ok' => false, 'message' => 'Customer insights are unavailable. Import the latest database.sql migration and try again.'], 503);
}
