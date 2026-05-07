<?php
// models/Gallery.php — matches gallery table

class Gallery {
    private PDO $conn;
    private string $table = 'gallery';

    public function __construct(PDO $db) {
        $this->conn = $db;
    }

    public function create(array $data): array {
        $id  = $this->uuid();
        $sql = "INSERT INTO {$this->table}
                    (id, title, description, category, location, date, imageFilename, imageUrl)
                VALUES (?,?,?,?,?,?,?,?)";

        $this->conn->prepare($sql)->execute([
            $id,
            $data['title'],
            $data['description']   ?? null,
            $data['category'],
            $data['location']      ?? null,
            $data['date']          ?? null,
            $data['imageFilename'],
            $data['imageUrl'],
        ]);

        return $this->findById($id);
    }

    public function findById(string $id, ?string $userId = null): ?array {
        $stmt = $this->conn->prepare("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;

        $row = $this->attachReactions([$row], $userId)[0];
        return $row;
    }

    public function getAll(int $limit = 20, int $offset = 0, array $filters = [], ?string $userId = null): array {
        $where  = ['1=1'];
        $params = [];

        if (!empty($filters['category'])) {
            $where[] = 'category = ?';
            $params[] = $filters['category'];
        }
        if (!empty($filters['search'])) {
            $where[] = '(title LIKE ? OR description LIKE ?)';
            $s = '%' . $filters['search'] . '%';
            array_push($params, $s, $s);
        }

        $sql = "SELECT * FROM {$this->table} WHERE " . implode(' AND ', $where)
             . " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        if (empty($rows)) return [];
        return $this->attachReactions($rows, $userId);
    }

    public function countAll(array $filters = []): int {
        $where  = ['1=1'];
        $params = [];
        if (!empty($filters['category'])) { $where[] = 'category = ?'; $params[] = $filters['category']; }

        $stmt = $this->conn->prepare(
            "SELECT COUNT(*) FROM {$this->table} WHERE " . implode(' AND ', $where)
        );
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    public function update(string $id, array $data): ?array {
        $allowed = ['title','description','category','location','date','imageFilename','imageUrl'];
        $fields  = [];
        $values  = [];

        foreach ($data as $k => $v) {
            if (in_array($k, $allowed, true)) {
                $fields[] = "$k = ?";
                $values[] = $v;
            }
        }
        if (empty($fields)) return $this->findById($id);

        $values[] = $id;
        $this->conn->prepare(
            "UPDATE {$this->table} SET " . implode(', ', $fields) . " WHERE id = ?"
        )->execute($values);

        return $this->findById($id);
    }

    public function delete(string $id): bool {
        $stmt = $this->conn->prepare("DELETE FROM {$this->table} WHERE id = ?");
        return $stmt->execute([$id]);
    }

    // ── Attach reactions to a batch of rows (single query, no N+1) ────────────
    private function attachReactions(array $rows, ?string $userId = null): array {
        $ids = array_column($rows, 'id');
        if (empty($ids)) return $rows;

        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // Aggregate counts
        $stmt = $this->conn->prepare(
            "SELECT galleryId, reaction, COUNT(*) as cnt
             FROM gallery_reactions
             WHERE galleryId IN ($placeholders)
             GROUP BY galleryId, reaction"
        );
        $stmt->execute($ids);
        $counts = [];
        foreach ($stmt->fetchAll() as $r) {
            $counts[$r['galleryId']][$r['reaction']] = (int)$r['cnt'];
        }

        // Per-user reactions
        $myReactions = [];
        if ($userId) {
            $stmt2 = $this->conn->prepare(
                "SELECT galleryId, reaction FROM gallery_reactions
                 WHERE galleryId IN ($placeholders) AND userId = ?"
            );
            $stmt2->execute(array_merge($ids, [$userId]));
            foreach ($stmt2->fetchAll() as $r) {
                $myReactions[$r['galleryId']] = $r['reaction'];
            }
        }

        foreach ($rows as &$row) {
            $gid = $row['id'];
            $row['likeCount']    = (int)($counts[$gid]['like']    ?? 0);
            $row['dislikeCount'] = (int)($counts[$gid]['dislike'] ?? 0);
            $row['myReaction']   = $myReactions[$gid] ?? null;
        }
        return $rows;
    }

    private function uuid(): string {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff),
            mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
            mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff));
    }
}
