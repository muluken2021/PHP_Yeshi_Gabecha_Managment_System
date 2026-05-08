<?php
// controllers/ServiceController.php

require_once __DIR__ . '/../models/Service.php';
require_once __DIR__ . '/../utils/Upload.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class ServiceController {

    // GET /services
    public static function getAll(): void {
        global $conn;
        $model   = new Service($conn);
        $limit   = (int)($_GET['limit']  ?? 20);
        $offset  = (int)($_GET['offset'] ?? 0);
        $filters = array_filter([
            'status'   => $_GET['status']   ?? '',
            'category' => $_GET['category'] ?? '',
        ]);
        if (isset($_GET['featured'])) $filters['featured'] = $_GET['featured'];

        $services = $model->getAll($limit, $offset, $filters);
        $total    = $model->countAll($filters);

        sendResponse(200, true, 'Services retrieved', [
            'services' => $services,
            'total'    => $total,
        ]);
    }

    // GET /services/{id}
    public static function getById(string $id): void {
        global $conn;
        $model   = new Service($conn);
        $service = $model->findById($id);
        if (!$service) sendResponse(404, false, 'Service not found');
        sendResponse(200, true, 'Service retrieved', $service);
    }

    // POST /services  (admin)
    public static function create(): void {
        global $conn;
        authorizeAdmin();

        $d        = $_POST;
        $required = ['name','price','category'];
        foreach ($required as $f) {
            if (empty($d[$f])) sendResponse(400, false, "Field '$f' is required");
        }

        // Handle multiple image uploads
        $images = [];
        if (!empty($_FILES['images'])) {
            $files = self::normalizeFiles($_FILES['images']);
            foreach ($files as $file) {
                try {
                    $images[] = self::saveFile($file, 'services');
                } catch (Exception $e) {
                    sendResponse(400, false, $e->getMessage());
                }
            }
        }

        $model   = new Service($conn);
        $service = $model->create([
            'name'        => $d['name'],
            'description' => $d['description'] ?? null,
            'price'       => (int)$d['price'],
            'currency'    => $d['currency']    ?? 'ETB',
            'category'    => $d['category'],
            'status'      => $d['status']      ?? 'active',
            'featured'    => !empty($d['featured']) && $d['featured'] !== 'false',
            'images'      => $images,
        ]);

        sendResponse(201, true, 'Service created', $service);
    }

    // PUT /services/{id}  (admin)
    public static function update(string $id): void {
        global $conn;
        authorizeAdmin();
        $model   = new Service($conn);
        $service = $model->findById($id);
        if (!$service) sendResponse(404, false, 'Service not found');

        // PHP doesn't populate $_POST for PUT multipart — parse raw input for JSON,
        // but for multipart PUT we rely on $_FILES being populated by the web server.
        // We use a method-override trick: send as POST with _method=PUT, OR
        // detect content type and parse accordingly.
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $isMultipart = str_contains($contentType, 'multipart/form-data');
        $isJson      = str_contains($contentType, 'application/json');

        if ($isMultipart) {
            // For multipart PUT, Apache/PHP may not populate $_POST.
            // The frontend sends as POST with FormData — handled via route override.
            $d = $_POST;
        } elseif ($isJson) {
            $d = self::json();
        } else {
            // Try raw body as form-encoded
            parse_str(file_get_contents('php://input'), $d);
            if (empty($d)) $d = self::json();
        }

        $data = [];
        if (isset($d['name']))        $data['name']        = $d['name'];
        if (isset($d['description'])) $data['description'] = $d['description'];
        if (isset($d['price']))       $data['price']       = (int)$d['price'];
        if (isset($d['category']))    $data['category']    = $d['category'];
        if (isset($d['status']))      $data['status']      = $d['status'];
        if (isset($d['featured']))    $data['featured']    = ($d['featured'] !== 'false' && $d['featured'] !== '0' && $d['featured'] !== false);
        // JSON path: keepImages replaces the images array
        if (isset($d['keepImages'])) {
            $keep = $d['keepImages'];
            if (is_string($keep)) $keep = [$keep];
            $data['images'] = array_values(array_filter((array)$keep));
        }

        // Handle image updates:
        // - keepImages[] = existing paths to keep (others are removed)
        // - images files  = new uploads to append
        $existingImages = $service['images'] ?? [];

        // If keepImages is sent, use it as the new base (user may have removed some)
        if (isset($d['keepImages']) || isset($_POST['keepImages'])) {
            $keep = $d['keepImages'] ?? $_POST['keepImages'] ?? [];
            if (is_string($keep)) $keep = [$keep]; // single value
            $existingImages = array_values(array_filter((array)$keep));
        }

        if (!empty($_FILES['images'])) {
            $files = self::normalizeFiles($_FILES['images']);
            foreach ($files as $file) {
                if ($file['error'] !== UPLOAD_ERR_OK) continue;
                try {
                    $existingImages[] = self::saveFile($file, 'services');
                } catch (Exception $e) {
                    sendResponse(400, false, $e->getMessage());
                }
            }
        }

        if (isset($d['keepImages']) || isset($_POST['keepImages']) || !empty($_FILES['images'])) {
            $data['images'] = $existingImages;
        }

        $updated = $model->update($id, $data);
        sendResponse(200, true, 'Service updated', $updated);
    }

    // DELETE /services/{id}  (admin)
    public static function delete(string $id): void {
        global $conn;
        authorizeAdmin();
        $model = new Service($conn);
        if (!$model->findById($id)) sendResponse(404, false, 'Service not found');
        $model->delete($id);
        sendResponse(200, true, 'Service deleted');
    }

    // DELETE /services/{id}/images/{index}  (admin)
    public static function deleteImage(string $id, int $index): void {
        global $conn;
        authorizeAdmin();
        $model   = new Service($conn);
        $service = $model->findById($id);
        if (!$service) sendResponse(404, false, 'Service not found');

        $images = $service['images'] ?? [];
        if (!isset($images[$index])) sendResponse(404, false, 'Image not found');

        Upload::delete($images[$index]);
        array_splice($images, $index, 1);
        $model->update($id, ['images' => $images]);

        sendResponse(200, true, 'Image deleted');
    }

    // ── Helpers ───────────────────────────────────────────────
    private static function json(): array {
        $raw = file_get_contents('php://input');
        return $raw ? (json_decode($raw, true) ?? []) : [];
    }

    // Normalize $_FILES['images'] for single or multiple uploads
    private static function normalizeFiles(array $fileInput): array {
        if (is_array($fileInput['name'])) {
            $files = [];
            foreach ($fileInput['name'] as $i => $name) {
                $files[] = [
                    'name'     => $name,
                    'type'     => $fileInput['type'][$i],
                    'tmp_name' => $fileInput['tmp_name'][$i],
                    'error'    => $fileInput['error'][$i],
                    'size'     => $fileInput['size'][$i],
                ];
            }
            return $files;
        }
        return [$fileInput];
    }

    private static function saveFile(array $file, string $folder): string {
        // Temporarily override $_FILES for Upload::save
        $_FILES['_tmp_upload'] = $file;
        $url = Upload::save('_tmp_upload', $folder);
        unset($_FILES['_tmp_upload']);
        return $url;
    }
}
