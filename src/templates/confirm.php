<?php
// Set response content type to JSON
header('Content-Type: application/json');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Read the raw POST data
$rawData = file_get_contents('php://input');

// Verify that the input is valid JSON
$jsonData = json_decode($rawData);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Base API endpoint
$apiUrl = '<?= APP_URL ?>'; // Replace with your API URL

// Get query parameters from the original request
$queryString = $_SERVER['QUERY_STRING'];

// Append query parameters to the API URL if they exist
if (!empty($queryString)) {
    $apiUrl .= '?' . $queryString;
}

// Initialize cURL session
$ch = curl_init($apiUrl);

// Set cURL options
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $rawData,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($rawData)
    ]
]);

// Execute the request
$response = curl_exec($ch);

// Check for cURL errors
if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => 'Curl error: ' . curl_error($ch)]);
    exit;
}

// Get HTTP status code
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// Close cURL session
curl_close($ch);

// Set the same HTTP status code as the API response
http_response_code($httpCode);

// Return the API response
echo $response;
?>