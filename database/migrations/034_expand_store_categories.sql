SET NAMES utf8mb4;

-- Keep the existing "other" category ID so stores already assigned to it remain unchanged.
UPDATE store_categories
SET category_name = 'อื่นๆ'
WHERE category_name = 'อื่น ๆ';

INSERT INTO store_categories (category_name)
SELECT wanted.category_name
FROM (
    SELECT 'บาร์ไวท์' AS category_name
    UNION ALL SELECT 'รูฟท็อปบาร์'
    UNION ALL SELECT 'ดราฟต์เบียร์'
    UNION ALL SELECT 'เลาน์จ'
    UNION ALL SELECT 'พื้นบ้าน'
) AS wanted
LEFT JOIN store_categories AS existing ON existing.category_name = wanted.category_name
WHERE existing.category_id IS NULL;

-- Preserve any store previously classified as a restaurant before removing the category.
UPDATE stores AS store
INNER JOIN store_categories AS previous ON previous.category_id = store.category_id
INNER JOIN store_categories AS replacement ON replacement.category_name = 'อื่นๆ'
SET store.category_id = replacement.category_id
WHERE previous.category_name = 'ร้านอาหาร';

DELETE FROM store_categories WHERE category_name = 'ร้านอาหาร';
