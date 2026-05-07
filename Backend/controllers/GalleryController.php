<?php
// controllers/GalleryController.php

require_once __DIR__ . '/../models/Gallery.php';
require_once __DIR__ . '/../models/GalleryReaction.php';
require_once __DIR__ . '/../utils/Upload.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class GalleryController {

    // GET /gallery
    public static function getAll(): void {
        global $conn;

        // Optionally get current user for myReaction
        $userId = null;
        try {
            $token = null;
            $headers = getallheaders();
            foreach ($headers as $k => $v) {
                if (strtolower($k) === 'authorization') {
                    $parts = explode(' ', $v);
                    $token = $parts[1] ?? null;
                }
            }
            if ($token) {
                global $config;
                require_once __DIR__ . '/../utils/JwtUtils.php';
                $payload = JwtUtils::verifyToken($token);
                $userId  = $payload['id'] ?? null;
            }
        } catch (Throwable $e) {}

        $model   = new Gallery($conn);
        $limit   = (int)($_GET['limit']  ?? 20);
        $offset  = (int)($_GET['offset'] ?? 0);
        $filters = array_filter([
            'category' => $_GET['category'] ?? '',
            'search'   => $_GET['search']   ?? '',
        ]);

        $items = $model->getAll($limit, $offset, $filters, $userId);
        $total = $model->countAll($filters);

        sendResponse(200, true, 'Gallery retrieved', [
            'galleryItems' => $items,
            'total'        => $total,
        ]);
    }

    // GET /gallery/{id}
    public static function getById(string $id): void {
        global $conn;

        $userId = null;
        try {
            $headers = getallheaders();
            foreach ($headers as $k => $v) {
                if (strtolower($k) === 'authorization') {
                    $parts = explode(' ', $v);
                    $token = $parts[1] ?? null;
                    if ($token) {
                        require_once __DIR__ . '/../utils/JwtUtils.php';
                        $payload = JwtUtils::verifyToken($token);
                        $userId  = $payload['id'] ?? null;
                    }
                }
            }
        } catch (Throwable $e) {}

        $model = new Gallery($conn);
        $item  = $model->findById($id, $userId);
        if (!$item) sendResponse(404, false, 'Gallery item not found');
        sendResponse(200, true, 'Gallery item retrieved', $item);
    }

    // POST /gallery  (admin)
    public static function create(): void {
        global $conn;
        authorizeAdmin();

        $d        = $_POST;
        $required = ['title','category'];
        foreach ($required as $f) {
            if (empty($d[$f])) sendResponse(400, false, "Field '$f' is required");
        }

        if (empty($_FILES['image'])) sendResponse(400, false, 'Image file is required');

        try {
            $imageUrl = Upload::save('image', 'gallery');
        } catch (Exception $e) {
            sendResponse(400, false, $e->getMessage());
        }

        $model = new Gallery($conn);
        $item  = $model->create([
            'title'         => $d['title'],
            'description'   => $d['description'] ?? null,
            'category'      => $d['category'],
            'location'      => $d['location']    ?? null,
            'date'          => $d['date']         ?? null,
            'imageFilename' => basename($imageUrl),
            'imageUrl'      => $imageUrl,
        ]);

        sendResponse(201, true, 'Gallery item created', $item);
    }

    // PUT /gallery/{id}  (admin)
    public static function update(string $id): void {
        global $conn;
        authorizeAdmin();
        $model = new Gallery($conn);
        $existing = $model->findById($id);
        if (!$existing) sendResponse(404, false, 'Gallery item not found');

        // Support both JSON and multipart (for image replacement)
        $isMultipart = !empty($_FILES['image']);
        $d = $isMultipart ? $_POST : self::json();

        $data = array_filter([
            'title'       => $d['title']       ?? null,
            'description' => $d['description'] ?? null,
            'category'    => $d['category']    ?? null,
            'location'    => $d['location']    ?? null,
            'date'        => $d['date']         ?? null,
        ], fn($v) => $v !== null);

        if ($isMultipart) {
            try {
                // Delete old image file
                Upload::delete($existing['imageUrl']);
                $imageUrl = Upload::save('image', 'gallery');
                $data['imageFilename'] = basename($imageUrl);
                $data['imageUrl']      = $imageUrl;
            } catch (Exception $e) {
                sendResponse(400, false, $e->getMessage());
            }
        }

        $item = $model->update($id, $data);
        sendResponse(200, true, 'Gallery item updated', $item);
    }

    // DELETE /gallery/{id}  (admin)
    public static function delete(string $id): void {
        global $conn;
        authorizeAdmin();
        $model = new Gallery($conn);
        $item  = $model->findById($id);
        if (!$item) sendResponse(404, false, 'Gallery item not found');

        Upload::delete($item['imageUrl']);
        $model->delete($id);
        sendResponse(200, true, 'Gallery item deleted');
    }

    // POST /gallery/{id}/reaction
    public static function react(string $id): void {
        global $conn;
        $auth = authenticate();
        $d    = self::json();

        // reaction can be 'like', 'dislike', or null (remove reaction)
        $reaction = isset($d['reaction']) ? $d['reaction'] : null;

        if ($reaction !== null && !in_array($reaction, ['like', 'dislike'], true)) {
            sendResponse(400, false, 'reaction must be like, dislike, or null');
        }

        $galleryModel = new Gallery($conn);
        if (!$galleryModel->findById($id)) sendResponse(404, false, 'Gallery item not found');

        $reactionModel = new GalleryReaction($conn);

        if ($reaction === null) {
            // Remove reaction (toggle off)
            $reactionModel->delete($id, $auth['id']);
        } else {
            $reactionModel->upsert($id, $auth['id'], $reaction);
        }

        $counts     = $reactionModel->getCountsByGallery($id);
        $myReaction = $reactionModel->getUserReaction($id, $auth['id']);

        sendResponse(200, true, 'Reaction saved', [
            'likeCount'    => (int)($counts['like']    ?? 0),
            'dislikeCount' => (int)($counts['dislike'] ?? 0),
            'myReaction'   => $myReaction,
        ]);
    }

    private static function json(): array {
        $raw = file_get_contents('php://input');
        return $raw ? (json_decode($raw, true) ?? []) : [];
    }
}
