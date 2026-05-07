<?php
// controllers/PaymentController.php

require_once __DIR__ . '/../models/Payment.php';
require_once __DIR__ . '/../models/Booking.php';
require_once __DIR__ . '/../models/Event.php';
require_once __DIR__ . '/../models/Notification.php';
require_once __DIR__ . '/../utils/Upload.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class PaymentController {

    // GET /payments/my-event-tickets
    public static function myEventTickets(): void {
        global $conn;
        $auth   = authenticate();
        $limit  = (int)($_GET['limit']  ?? 50);
        $offset = (int)($_GET['offset'] ?? 0);

        // Fetch payments that are linked to events for this user, joined with event data
        $stmt = $conn->prepare(
            "SELECT p.*, e.title as eventTitle, e.eventType, e.eventDate, e.eventTime,
                    e.location as eventLocation, e.imageUrl as eventImageUrl
             FROM payments p
             LEFT JOIN events e ON p.eventId = e.id
             WHERE p.userId = ? AND p.eventId IS NOT NULL
             ORDER BY p.createdAt DESC
             LIMIT ? OFFSET ?"
        );
        $stmt->execute([$auth['id'], $limit, $offset]);
        $rows = $stmt->fetchAll();

        // Shape the data so the frontend gets event as a nested object
        $payments = array_map(function($row) {
            $event = null;
            if (!empty($row['eventId'])) {
                $event = [
                    'id'        => $row['eventId'],
                    'title'     => $row['eventTitle'],
                    'eventType' => $row['eventType'],
                    'eventDate' => $row['eventDate'],
                    'eventTime' => $row['eventTime'],
                    'location'  => $row['eventLocation'],
                    'imageUrl'  => $row['eventImageUrl'],
                ];
            }
            unset($row['eventTitle'], $row['eventType'], $row['eventDate'],
                  $row['eventTime'], $row['eventLocation'], $row['eventImageUrl']);
            $row['event'] = $event;
            return $row;
        }, $rows);

        // Count total
        $countStmt = $conn->prepare(
            "SELECT COUNT(*) FROM payments WHERE userId = ? AND eventId IS NOT NULL"
        );
        $countStmt->execute([$auth['id']]);
        $total = (int)$countStmt->fetchColumn();

        sendResponse(200, true, 'Event tickets retrieved', [
            'payments' => $payments,
            'total'    => $total,
        ]);
    }

    // GET /payments/my-payments
    public static function myPayments(): void {
        global $conn;
        $auth    = authenticate();
        $model   = new Payment($conn);
        $limit   = (int)($_GET['limit']  ?? 20);
        $offset  = (int)($_GET['offset'] ?? 0);
        $filters = array_filter(['status' => $_GET['status'] ?? '']);

        $payments = $model->getByUser($auth['id'], $limit, $offset, $filters);
        $total    = $model->countAll(['userId' => $auth['id']]);

        sendResponse(200, true, 'Payments retrieved', [
            'payments' => $payments,
            'total'    => $total,
        ]);
    }

    // GET /payments/{id}
    public static function getById(string $id): void {
        global $conn;
        $auth    = authenticate();
        $model   = new Payment($conn);
        $payment = $model->findById($id);

        if (!$payment) sendResponse(404, false, 'Payment not found');
        if ($payment['userId'] !== $auth['id'] && $auth['role'] !== 'admin') {
            sendResponse(403, false, 'Forbidden');
        }

        sendResponse(200, true, 'Payment retrieved', $payment);
    }

    // POST /payments/{id}/proof
    public static function uploadProof(string $id): void {
        global $conn;
        $auth    = authenticate();
        $model   = new Payment($conn);
        $payment = $model->findById($id);

        if (!$payment) sendResponse(404, false, 'Payment not found');
        if ($payment['userId'] !== $auth['id']) sendResponse(403, false, 'Forbidden');

        if (empty($_FILES['proof'])) sendResponse(400, false, 'proof file is required');

        try {
            $proofUrl = Upload::save('proof', 'proofs');
        } catch (Exception $e) {
            sendResponse(400, false, $e->getMessage());
        }

        $model->update($id, ['proofUrl' => $proofUrl]);
        sendResponse(200, true, 'Proof uploaded', ['proofUrl' => $proofUrl]);
    }

    // GET /payments/admin/payments  (admin)
    public static function adminList(): void {
        global $conn;
        authorizeAdmin();
        $model   = new Payment($conn);
        $limit   = (int)($_GET['limit']  ?? 20);
        $offset  = (int)($_GET['offset'] ?? 0);
        $filters = array_filter([
            'status' => $_GET['status'] ?? '',
            'method' => $_GET['method'] ?? '',
        ]);

        $payments = $model->getAll($limit, $offset, $filters);
        $total    = $model->countAll($filters);

        sendResponse(200, true, 'Payments retrieved', [
            'payments' => $payments,
            'total'    => $total,
        ]);
    }

    // GET /payments/admin/event-payments  (admin)
    public static function adminEventPayments(): void {
        global $conn;
        authorizeAdmin();
        $model   = new Payment($conn);
        $limit   = (int)($_GET['limit']  ?? 20);
        $offset  = (int)($_GET['offset'] ?? 0);
        $filters = array_filter([
            'status'    => $_GET['status'] ?? '',
            'eventOnly' => true,
        ]);

        $payments = $model->getAll($limit, $offset, $filters);
        $total    = $model->countAll($filters);

        sendResponse(200, true, 'Event payments retrieved', [
            'payments' => $payments,
            'total'    => $total,
        ]);
    }

    // POST /payments/{id}/process  (admin — approve/reject)
    public static function process(string $id): void {
        global $conn;
        authorizeAdmin();
        $d       = self::json();
        $model   = new Payment($conn);
        $payment = $model->findById($id);

        if (!$payment) sendResponse(404, false, 'Payment not found');

        $approve = !empty($d['simulateSuccess']) || ($d['action'] ?? '') === 'approve';
        $newStatus = $approve ? 'completed' : 'failed';

        $updated = $model->update($id, [
            'status'      => $newStatus,
            'paymentDate' => $approve ? date('Y-m-d H:i:s') : null,
        ]);

        // If approved and linked to a booking → confirm the booking + generate QR
        if ($approve && !empty($payment['bookingId'])) {
            $bookingModel = new Booking($conn);
            $booking      = $bookingModel->findById($payment['bookingId']);
            if ($booking) {
                $qrData = base64_encode(json_encode([
                    'bookingId' => $booking['id'],
                    'customer'  => $booking['customerName'],
                    'event'     => $booking['eventType'],
                    'date'      => $booking['eventDate'],
                    'amount'    => $payment['amount'],
                ]));
                $bookingModel->updateStatus($payment['bookingId'], 'confirmed');
                $bookingModel->updateQr($payment['bookingId'], $qrData);
            }
        }

        // If approved and linked to an event → increment sold tickets
        if ($approve && !empty($payment['eventId'])) {
            $eventModel = new Event($conn);
            $eventModel->incrementSold($payment['eventId']);
        }

        // Notify admin
        try {
            $notif = new Notification($conn);
            $notif->create([
                'userId'  => null,
                'type'    => $approve ? 'payment_completed' : 'payment_failed',
                'title'   => $approve ? 'Payment Approved' : 'Payment Rejected',
                'message' => "Payment #{$id} has been " . ($approve ? 'approved' : 'rejected'),
            ]);
        } catch (Throwable $e) {}

        sendResponse(200, true, 'Payment processed', $updated);
    }

    private static function json(): array {
        $raw = file_get_contents('php://input');
        return $raw ? (json_decode($raw, true) ?? []) : [];
    }
}
